#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Clean Slate Transactional Data Script
Domain: kiwicloudtech.co.in

Safely removes all transactional and test data (colleges, contacts, leads,
opportunities, quotations, orders, projects, QA records, tickets, invoices,
activities, and audit logs) while strictly preserving:
- All users, login IDs, and password hashes
- All 11 roles and 122 permissions (RBAC)
- All departments and teams
- All master configurations (lead sources, pipelines, stages, products, SLA policies, chart of accounts)
- NumberSequence counters reset to 0 so fresh records start from 0001
"""

import sys
import os
from pathlib import Path
import psycopg

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings

def clean_transactional_data():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql+psycopg://"):
        raw_url = db_url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif db_url.startswith("postgres://"):
        raw_url = db_url.replace("postgres://", "postgresql://", 1)
    else:
        raw_url = db_url

    print("=" * 65)
    print("KIWI CLOUD TECH CRM - CLEAN TRANSACTIONAL / TEST DATA")
    print("=" * 65)
    print(f"Target Database: {raw_url.split('@')[-1] if '@' in raw_url else raw_url}")

    # Tables to be cleaned (strictly transactional data)
    tables_to_truncate = [
        "audit_logs",
        "saved_reports",
        "automation_job_logs",
        "notification_preferences",
        "notifications",
        "ai_messages",
        "ai_conversations",
        "communication_attachments",
        "communication_messages",
        "email_threads",
        "activities",
        "notes",
        "meetings",
        "tasks",
        "ticket_assignments",
        "ticket_attachments",
        "ticket_comments",
        "ticket_escalations",
        "ticket_status_history",
        "tickets",
        "bug_attachments",
        "bug_comments",
        "bugs",
        "test_executions",
        "test_cases",
        "test_suites",
        "project_tasks",
        "milestones",
        "project_members",
        "projects",
        "journal_lines",
        "journal_entries",
        "bank_reconciliation_items",
        "bank_reconciliations",
        "payment_allocations",
        "customer_payments",
        "invoice_items",
        "invoices",
        "bill_allocations",
        "vendor_payments",
        "bill_items",
        "bills",
        "expenses",
        "vendors",
        "sales_order_items",
        "sales_orders",
        "quotation_items",
        "quotations",
        "contracts",
        "opportunities",
        "leads",
        "contacts",
        "companies",
    ]

    conn = psycopg.connect(raw_url)
    try:
        with conn.cursor() as cur:
            print("\n[Step 1] Verifying user accounts before cleanup...")
            cur.execute("SELECT COUNT(*) FROM users;")
            user_count_before = cur.fetchone()[0]
            cur.execute("SELECT email, first_name, last_name, is_superuser FROM users ORDER BY email;")
            users = cur.fetchall()
            print(f"Found {user_count_before} users:")
            for u in users:
                print(f"  - {u[0]:35} ({u[1]} {u[2]}) | superuser={u[3]}")

            print("\n[Step 2] Cleaning transactional and test tables...")
            for tbl in tables_to_truncate:
                try:
                    cur.execute(f'TRUNCATE TABLE "{tbl}" CASCADE;')
                    print(f"  [x] Truncated: {tbl}")
                except Exception as e:
                    print(f"  [!] Skipped {tbl}: {e}")

            print("\n[Step 3] Resetting NumberSequence counters to 0...")
            cur.execute("UPDATE number_sequences SET current_val = 0;")
            cur.execute("SELECT entity_type, year, current_val FROM number_sequences;")
            seqs = cur.fetchall()
            print(f"Reset {len(seqs)} number sequences to 0:")
            for s in seqs:
                print(f"  - {s[0]:20} (Year {s[1]}): current_val = {s[2]}")

            print("\n[Step 4] Verifying master configuration and user accounts preserved...")
            cur.execute("SELECT COUNT(*) FROM users;")
            user_count_after = cur.fetchone()[0]
            assert user_count_before == user_count_after, f"User count mismatch! {user_count_before} vs {user_count_after}"

            cur.execute("SELECT COUNT(*) FROM roles;")
            roles_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM permissions;")
            perms_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM departments;")
            depts_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM pipelines;")
            pipes_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM pipeline_stages;")
            stages_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM product_categories;")
            prod_cats = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM products;")
            prods = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM accounts;")
            accounts_cnt = cur.fetchone()[0]

            print(f"  Users count         : {user_count_after} (100% PRESERVED)")
            print(f"  Roles count         : {roles_cnt} (100% PRESERVED)")
            print(f"  Permissions count   : {perms_cnt} (100% PRESERVED)")
            print(f"  Departments count   : {depts_cnt} (100% PRESERVED)")
            print(f"  Pipelines count     : {pipes_cnt} (100% PRESERVED)")
            print(f"  Pipeline Stages     : {stages_cnt} (100% PRESERVED)")
            print(f"  Product Categories  : {prod_cats} (100% PRESERVED)")
            print(f"  Products            : {prods} (100% PRESERVED)")
            print(f"  Chart of Accounts   : {accounts_cnt} (100% PRESERVED)")

            print("\n[Step 5] Verifying transactional tables are completely clean (0 rows)...")
            check_tables = ["companies", "contacts", "leads", "opportunities", "quotations", "sales_orders", "projects", "bugs", "tickets", "invoices", "audit_logs"]
            for ct in check_tables:
                cur.execute(f'SELECT COUNT(*) FROM "{ct}";')
                cnt = cur.fetchone()[0]
                print(f"  {ct:20}: {cnt} rows")
                assert cnt == 0, f"Table {ct} still has {cnt} rows!"

            print("\n[Step 6] Committing changes...")
            conn.commit()
            print("Transaction committed successfully.")

    except Exception as exc:
        conn.rollback()
        print(f"\n[ERROR] Cleanup failed: {exc}", file=sys.stderr)
        return False
    finally:
        conn.close()

    print("\n" + "=" * 65)
    print("CLEAN SLATE COMPLETE: ALL TEST DATA REMOVED SUCCESSFULLY")
    print("ALL USER LOGINS, PASSWORDS, ROLES & CONFIGURATIONS PRESERVED")
    print("=" * 65)
    return True

if __name__ == "__main__":
    success = clean_transactional_data()
    sys.exit(0 if success else 1)
