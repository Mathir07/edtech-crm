#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Database Restore Utility
Domain: kiwicloudtech.co.in

Safely restores a verified backup file into a target PostgreSQL database or SQLite file.
"""

import os
import sys
import gzip
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def find_tool(tool_name: str) -> str:
    """Find binary on PATH or common PostgreSQL installation directories."""
    found = shutil.which(tool_name)
    if found:
        return found
    candidates = [
        Path(r"D:\Kiwi Project\PostgreSQL\bin") / f"{tool_name}.exe",
        Path(r"C:\Program Files\PostgreSQL\16\bin") / f"{tool_name}.exe",
        Path(r"C:\Program Files\PostgreSQL\17\bin") / f"{tool_name}.exe",
        Path(r"C:\Program Files\PostgreSQL\18\bin") / f"{tool_name}.exe",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return tool_name


def restore_sqlite(backup_file: Path, target_db: Path):
    print(f"[*] Restoring SQLite backup from {backup_file} -> {target_db}...")
    if not backup_file.exists():
        print(f"Error: Backup file does not exist at {backup_file}", file=sys.stderr)
        sys.exit(1)

    if backup_file.name.endswith(".gz"):
        with gzip.open(backup_file, "rb") as f_in, open(target_db, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
    else:
        shutil.copy2(backup_file, target_db)

    print(f"[OK] Successfully restored database to {target_db}")


def restore_postgres(backup_file: Path, pg_url: str):
    if pg_url.startswith("postgresql+psycopg://"):
        pg_url = pg_url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    psql_bin = find_tool("psql")
    print(f"[*] Restoring PostgreSQL database from {backup_file} using {psql_bin}...")
    if not backup_file.exists():
        print(f"Error: Backup file does not exist at {backup_file}", file=sys.stderr)
        sys.exit(1)

    cmd = [psql_bin, "--dbname", pg_url]
    try:
        if backup_file.name.endswith(".gz"):
            with gzip.open(backup_file, "rb") as f_in:
                proc = subprocess.run(cmd, stdin=f_in, capture_output=True, text=True)
        else:
            with open(backup_file, "r", encoding="utf-8") as f_in:
                proc = subprocess.run(cmd, stdin=f_in, capture_output=True, text=True)

        if proc.returncode != 0:
            print(f"Error restoring PostgreSQL: {proc.stderr}", file=sys.stderr)
            sys.exit(1)

        print(f"[OK] Successfully restored PostgreSQL database.")
    except FileNotFoundError:
        print("Error: 'psql' client utility not found.", file=sys.stderr)
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/restore_db.py <path_to_backup_file> [target_path_or_pg_url]")
        sys.exit(1)

    backup_file = Path(sys.argv[1]).resolve()
    target = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm")

    if target.startswith("sqlite"):
        path_str = target.replace("sqlite:///", "").lstrip("./")
        target_path = BASE_DIR / path_str
        restore_sqlite(backup_file, target_path)
    elif target.startswith(("postgresql", "postgres")):
        restore_postgres(backup_file, target)
    else:
        target_path = Path(target).resolve()
        restore_sqlite(backup_file, target_path)


if __name__ == "__main__":
    main()
