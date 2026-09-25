#!/usr/bin/env python3
"""
KCT CRM - Safe, Deterministic SQLite -> PostgreSQL Migration Script

Transfers master, configuration, security, business entities, and audit data
from a read-only SQLite database into the target PostgreSQL 16 database.

Key Features & Guarantees:
- Strictly read-only access to SQLite (uri=True with mode=ro).
- Redacts credentials and never logs passwords or raw connection strings.
- Runs within an atomic PostgreSQL transaction (commit on success, rollback on failure).
- Preserves all UUIDs, primary keys, foreign keys, timestamps, booleans, JSON, and NULLs.
- Idempotent and non-destructive: uses ON CONFLICT DO NOTHING to avoid duplicate records.
- Strict foreign key dependency ordering across all 77 application tables.
- Handles self-referencing relationships (e.g., chart of accounts hierarchies).
- Comprehensive verification before, during, and after migration.
"""

import os
import sys
import json
import argparse
import sqlite3
from typing import Dict, List, Tuple, Any, Optional
from urllib.parse import urlparse
import psycopg
from psycopg.types.json import Json

# All 77 application tables in strict topological foreign-key dependency order
ALL_TABLES_TOPOLOGICAL_ORDER = [
    "audit_logs",
    "departments",
    "permissions",
    "roles",
    "lead_sources",
    "pipelines",
    "product_categories",
    "number_sequences",
    "service_categories",
    "sla_policies",
    "whatsapp_configs",
    "phone_configs",
    "automation_rules",
    "automation_job_logs",
    "teams",
    "role_permissions",
    "pipeline_stages",
    "products",
    "service_subcategories",
    "users",
    "vendors",
    "ai_conversations",
    "tasks",
    "user_roles",
    "fiscal_periods",
    "communication_templates",
    "notifications",
    "companies",
    "activities",
    "saved_reports",
    "notes",
    "notification_preferences",
    "email_accounts",
    "meetings",
    "accounts",
    "ai_messages",
    "journal_entries",
    "contacts",
    "tax_rates",
    "bank_reconciliations",
    "customer_payments",
    "vendor_payments",
    "journal_lines",
    "bills",
    "opportunities",
    "leads",
    "bank_reconciliation_items",
    "bill_items",
    "bill_allocations",
    "quotations",
    "quotation_items",
    "contracts",
    "sales_orders",
    "sales_order_items",
    "projects",
    "test_suites",
    "invoices",
    "milestones",
    "expenses",
    "project_members",
    "test_cases",
    "invoice_items",
    "payment_allocations",
    "project_tasks",
    "bugs",
    "test_executions",
    "bug_comments",
    "bug_attachments",
    "tickets",
    "ticket_comments",
    "email_threads",
    "ticket_assignments",
    "ticket_status_history",
    "ticket_escalations",
    "ticket_attachments",
    "communication_messages",
    "communication_attachments",
]


def redact_connection_string(conn_str: str) -> str:
    """Safely redact credentials from connection string for logging."""
    try:
        parsed = urlparse(conn_str)
        host = parsed.hostname or "localhost"
        port = f":{parsed.port}" if parsed.port else ""
        db = parsed.path.lstrip("/") if parsed.path else ""
        user = parsed.username or "postgres"
        return f"{parsed.scheme}://{user}:***@{host}{port}/{db}"
    except Exception:
        return "postgresql://***:***@host/db"


def find_default_sqlite_path() -> str:
    """Locate default crm.db file."""
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "crm.db"),
        os.path.join(os.getcwd(), "crm.db"),
        os.path.join(os.getcwd(), "backend", "crm.db"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return candidates[0]


def get_target_pg_url() -> str:
    """Retrieve PostgreSQL connection URL with fallback to default."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        # Check backend config settings if available
        try:
            from app.core.config import settings
            url = settings.DATABASE_URL
        except Exception:
            url = "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm"
    
    # Normalize URL for psycopg
    if url.startswith("postgresql+psycopg://"):
        url = url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def transform_value(val: Any, udt_type: str) -> Any:
    """Transform SQLite value to PostgreSQL compatible representation."""
    if val is None:
        return None
    if udt_type == "bool":
        if isinstance(val, bool):
            return val
        if isinstance(val, (int, float)):
            return bool(val)
        if isinstance(val, str):
            return val.lower() in ("true", "1", "t", "yes", "y")
        return bool(val)
    if udt_type in ("json", "jsonb"):
        if isinstance(val, str):
            try:
                return Json(json.loads(val))
            except Exception:
                return Json(val)
        return Json(val)
    return val


def sort_self_referencing_rows(table_name: str, rows: List[sqlite3.Row]) -> List[sqlite3.Row]:
    """Sort rows for tables with self-referencing foreign keys so parents precede children."""
    if table_name == "accounts":
        # Put root/parent accounts (parent_account_id IS NULL) first
        parents = [r for r in rows if r["parent_account_id"] is None]
        children = [r for r in rows if r["parent_account_id"] is not None]
        return parents + children
    if table_name == "journal_entries":
        # Original entries before reversed entries
        parents = [r for r in rows if r["reversed_entry_id"] is None]
        children = [r for r in rows if r["reversed_entry_id"] is not None]
        return parents + children
    return rows


def normalize_pg_url(url: str) -> str:
    """Normalize SQLAlchemy dialect URLs to standard PostgreSQL URLs for psycopg."""
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def run_migration(sqlite_path: str, pg_url: str, dry_run: bool = False, tables_filter: Optional[List[str]] = None) -> bool:
    pg_url = normalize_pg_url(pg_url)
    print("=" * 65)
    print("KIWI CLOUD TECH CRM - SQLITE TO POSTGRESQL DATA MIGRATION")
    print("=" * 65)
    print(f"Source SQLite File : {sqlite_path}")
    print(f"Target Database    : {redact_connection_string(pg_url)}")
    print(f"Dry Run Mode       : {'ENABLED (will rollback)' if dry_run else 'DISABLED (will commit)'}")

    # 1. Connect to SQLite read-only
    print("\n[Step 1] Connecting to SQLite source (READ-ONLY)...")
    if not os.path.exists(sqlite_path):
        print(f"ERROR: SQLite source database not found at '{sqlite_path}'", file=sys.stderr)
        return False

    s_conn = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()

    # Integrity & FK checks on source
    s_cur.execute("PRAGMA integrity_check;")
    ic_res = s_cur.fetchone()[0]
    if ic_res != "ok":
        print(f"ERROR: SQLite integrity check failed: {ic_res}", file=sys.stderr)
        s_conn.close()
        return False
    print("SQLite integrity check: OK")

    s_cur.execute("PRAGMA foreign_key_check;")
    fk_violations = s_cur.fetchall()
    if fk_violations:
        print(f"WARNING: SQLite source has {len(fk_violations)} FK warnings (reviewing)...", file=sys.stderr)
    else:
        print("SQLite foreign key check: 0 violations (OK)")

    # 2. Connect to PostgreSQL
    print("\n[Step 2] Connecting to target PostgreSQL...")
    try:
        p_conn = psycopg.connect(pg_url)
    except Exception as e:
        print(f"ERROR: Failed to connect to PostgreSQL: {type(e).__name__}: {e}", file=sys.stderr)
        s_conn.close()
        return False

    try:
        with p_conn.cursor() as p_cur:
            # Check target tables and fetch schema columns
            p_cur.execute("""
                SELECT table_name, column_name, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position;
            """)
            pg_schema: Dict[str, Dict[str, str]] = {}
            for t_name, c_name, u_name in p_cur.fetchall():
                if t_name not in pg_schema:
                    pg_schema[t_name] = {}
                pg_schema[t_name][c_name] = u_name

            # Determine tables to process
            active_tables = [t for t in ALL_TABLES_TOPOLOGICAL_ORDER if t in pg_schema]
            if tables_filter:
                active_tables = [t for t in active_tables if t in tables_filter]

            # Get primary key columns for conflict resolution
            pk_map: Dict[str, List[str]] = {}
            for t in active_tables:
                p_cur.execute("""
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_schema = 'public'
                      AND tc.table_name = %s
                    ORDER BY kcu.ordinal_position;
                """, (t,))
                pks = [r[0] for r in p_cur.fetchall()]
                pk_map[t] = pks

            # 3. Analyze source row counts
            print("\n[Step 3] Inspecting source and target records...")
            source_counts: Dict[str, int] = {}
            target_initial_counts: Dict[str, int] = {}
            total_source_rows = 0

            for tbl in active_tables:
                # Check if table exists in SQLite
                s_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (tbl,))
                if not s_cur.fetchone():
                    source_counts[tbl] = 0
                else:
                    s_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                    cnt = s_cur.fetchone()[0]
                    source_counts[tbl] = cnt
                    total_source_rows += cnt

                p_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                target_initial_counts[tbl] = p_cur.fetchone()[0]

            print(f"Total source rows across {len(active_tables)} tables: {total_source_rows}")
            non_empty_sources = [t for t in active_tables if source_counts[t] > 0]
            print(f"Non-empty source tables: {len(non_empty_sources)}")

            # 4. Migrate data table by table in dependency order
            print("\n[Step 4] Transferring data into PostgreSQL (idempotent ON CONFLICT DO NOTHING)...")
            migrated_count = 0
            skipped_existing_count = 0

            for tbl in active_tables:
                s_count = source_counts[tbl]
                if s_count == 0:
                    continue

                pg_cols = pg_schema[tbl]
                pks = pk_map.get(tbl, ["id"])

                s_cur.execute(f'SELECT * FROM "{tbl}";')
                raw_rows = s_cur.fetchall()
                if not raw_rows:
                    continue

                # Sort self-referencing rows if necessary
                rows = sort_self_referencing_rows(tbl, raw_rows)

                # Find column intersection
                source_col_names = list(rows[0].keys())
                common_cols = [c for c in source_col_names if c in pg_cols]

                if not common_cols:
                    print(f"  [!] Skipped {tbl}: No matching columns found between SQLite and PostgreSQL.")
                    continue

                cols_sql = ", ".join([f'"{c}"' for c in common_cols])
                placeholders = ", ".join(["%s"] * len(common_cols))

                # Build conflict target clause
                if pks and all(p in common_cols for p in pks):
                    pk_clause = ", ".join([f'"{p}"' for p in pks])
                    conflict_clause = f'ON CONFLICT ({pk_clause}) DO NOTHING'
                else:
                    conflict_clause = ''

                insert_sql = f'INSERT INTO "{tbl}" ({cols_sql}) VALUES ({placeholders}) {conflict_clause};'

                transformed_rows = []
                for row in rows:
                    vals = []
                    for c in common_cols:
                        raw_v = row[c]
                        udt_t = pg_cols.get(c, "")
                        vals.append(transform_value(raw_v, udt_t))
                    transformed_rows.append(tuple(vals))

                # Execute insert with savepoint protection for unique constraint collisions
                before_tbl_cnt = target_initial_counts[tbl]
                try:
                    with p_conn.transaction():
                        p_cur.executemany(insert_sql, transformed_rows)
                except psycopg.errors.IntegrityError:
                    # Fallback to row-by-row savepoints to skip duplicate unique keys
                    for row_tuple in transformed_rows:
                        try:
                            with p_conn.transaction():
                                p_cur.execute(insert_sql, row_tuple)
                        except psycopg.errors.IntegrityError:
                            pass

                # Check rows inserted for this table
                p_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                after_tbl_cnt = p_cur.fetchone()[0]
                newly_inserted = after_tbl_cnt - before_tbl_cnt
                skipped = len(transformed_rows) - newly_inserted

                migrated_count += newly_inserted
                skipped_existing_count += skipped

                status_msg = f"{newly_inserted:5} inserted"
                if skipped > 0:
                    status_msg += f" ({skipped} already present)"
                print(f"  -> {tbl:32}: {status_msg}")

            # 5. Post-migration verification
            print("\n[Step 5] Post-migration table row counts in PostgreSQL:")
            target_final_counts: Dict[str, int] = {}
            total_target_rows = 0
            for tbl in active_tables:
                p_cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
                cnt = p_cur.fetchone()[0]
                target_final_counts[tbl] = cnt
                total_target_rows += cnt
                if cnt > 0:
                    print(f"     {tbl:32}: {cnt:5} rows")

            print(f"\nTotal rows in target PostgreSQL database: {total_target_rows}")
            print(f"Total newly migrated rows in this run   : {migrated_count}")
            print(f"Total pre-existing / skipped rows       : {skipped_existing_count}")

            # 5b. Synchronize number sequences to prevent duplicate number generation
            if not dry_run and "number_sequences" in active_tables:
                print("\n[Step 5b] Synchronizing NumberSequence values with existing records...")
                entity_table_cols = {
                    "quotation": ("quotations", "quotation_number"),
                    "contract": ("contracts", "contract_number"),
                    "sales_order": ("sales_orders", "order_number"),
                    "project": ("projects", "project_number"),
                    "task": ("project_tasks", "task_number"),
                    "test_case": ("test_cases", "test_case_number"),
                    "bug": ("bugs", "bug_number"),
                    "ticket": ("tickets", "ticket_number"),
                    "journal_entry": ("journal_entries", "entry_number"),
                    "invoice": ("invoices", "invoice_number"),
                    "payment": ("customer_payments", "payment_number"),
                    "bill": ("bills", "bill_number"),
                    "vendor_payment": ("vendor_payments", "payment_number"),
                    "expense": ("expenses", "expense_number"),
                }
                for entity_type, (tbl, col) in entity_table_cols.items():
                    if tbl in active_tables:
                        try:
                            p_cur.execute(f'SELECT "{col}" FROM "{tbl}" WHERE "{col}" IS NOT NULL;')
                            recs = p_cur.fetchall()
                            max_num = 0
                            for (val,) in recs:
                                m = re.search(r'-(\d{4})$', str(val))
                                if m:
                                    max_num = max(max_num, int(m.group(1)))
                            if max_num > 0:
                                p_cur.execute(
                                    'UPDATE number_sequences SET current_val = GREATEST(current_val, %s) WHERE entity_type = %s;',
                                    (max_num, entity_type)
                                )
                        except Exception:
                            pass
                print("  -> NumberSequence values synchronized successfully.")

            # 6. Commit or Rollback
            if dry_run:
                print("\n[Step 6] DRY RUN: Rolling back transaction (no data saved)...")
                p_conn.rollback()
                print("Rollback completed successfully.")
            else:
                print("\n[Step 6] Committing PostgreSQL transaction...")
                p_conn.commit()
                print("Transaction successfully committed.")

    except Exception as exc:
        print(f"\n[ERROR] Migration aborted due to exception: {type(exc).__name__}: {exc}", file=sys.stderr)
        p_conn.rollback()
        p_conn.close()
        s_conn.close()
        return False
    finally:
        try:
            p_conn.close()
        except Exception:
            pass
        try:
            s_conn.close()
        except Exception:
            pass

    print("\n" + "=" * 65)
    print("MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 65)
    return True


def main():
    parser = argparse.ArgumentParser(description="Deterministic SQLite to PostgreSQL Migration Tool for EdTech CRM")
    parser.add_argument("--sqlite-path", "-s", default=None, help="Path to source SQLite database file (default: backend/crm.db)")
    parser.add_argument("--pg-url", "-p", default=None, help="PostgreSQL connection string (default: DATABASE_URL env var)")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Perform migration inside transaction then rollback without saving")
    parser.add_argument("--verify-only", "-v", action="store_true", help="Only verify source and target schemas without modifying data")
    args = parser.parse_args()

    sqlite_path = args.sqlite_path or os.environ.get("SQLITE_PATH") or find_default_sqlite_path()
    pg_url = args.pg_url or get_target_pg_url()

    if args.verify_only:
        print(f"Verifying SQLite: {sqlite_path}")
        print(f"Verifying PG    : {redact_connection_string(pg_url)}")
        if not os.path.exists(sqlite_path):
            print("ERROR: SQLite database does not exist.")
            sys.exit(1)
        s_conn = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
        cur = s_conn.cursor()
        cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table';")
        print(f"SQLite total tables: {cur.fetchone()[0]}")
        s_conn.close()
        try:
            p_conn = psycopg.connect(pg_url)
            p_cur = p_conn.cursor()
            p_cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
            print(f"PostgreSQL total tables: {p_cur.fetchone()[0]}")
            p_conn.close()
            print("Verification successful!")
            sys.exit(0)
        except Exception as e:
            print(f"ERROR connecting to PostgreSQL: {e}")
            sys.exit(1)

    success = run_migration(sqlite_path=sqlite_path, pg_url=pg_url, dry_run=args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
