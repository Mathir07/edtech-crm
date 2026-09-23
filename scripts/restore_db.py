#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Database Restore Utility
Domain: kiwicloudtech.co.in

Safely restores a verified backup file into a target SQLite file or PostgreSQL database.
"""

import os
import sys
import gzip
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

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
    print(f"[*] Restoring PostgreSQL database from {backup_file}...")
    if not backup_file.exists():
        print(f"Error: Backup file does not exist at {backup_file}", file=sys.stderr)
        sys.exit(1)

    cmd = ["psql", "--dbname", pg_url]
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
        print("Error: 'psql' client utility not found on PATH.", file=sys.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/restore_db.py <path_to_backup_file> [target_path_or_pg_url]")
        sys.exit(1)

    backup_file = Path(sys.argv[1]).resolve()
    target = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("DATABASE_URL", "sqlite:///./backend/crm_restored_test.db")

    if target.startswith("sqlite"):
        path_str = target.replace("sqlite:///", "").lstrip("./")
        target_path = BASE_DIR / path_str
        restore_sqlite(backup_file, target_path)
    elif target.startswith("postgresql"):
        restore_postgres(backup_file, target)
    else:
        target_path = Path(target).resolve()
        restore_sqlite(backup_file, target_path)

if __name__ == "__main__":
    main()
