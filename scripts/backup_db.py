#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Database Backup Utility
Domain: kiwicloudtech.co.in

Supports:
- Production PostgreSQL 16 backup via pg_dump
- Local SQLite backup (safe hot copy)
- Timestamped filenames
- Optional gzip compression
- Retention cleanup (default: retain 14 latest backups)
"""

import os
import sys
import shutil
import gzip
import subprocess
from datetime import datetime
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


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


def backup_sqlite(db_path: Path, retention_days: int = 14) -> Path:
    if not db_path.exists():
        print(f"Error: SQLite database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"crm_sqlite_{timestamp}.db"
    compressed_file = BACKUP_DIR / f"crm_sqlite_{timestamp}.db.gz"

    print(f"[*] Creating SQLite backup from {db_path}...")
    shutil.copy2(db_path, backup_file)

    print(f"[*] Compressing backup to {compressed_file.name}...")
    with open(backup_file, "rb") as f_in, gzip.open(compressed_file, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    backup_file.unlink()

    print(f"[OK] SQLite backup successfully created: {compressed_file}")
    prune_old_backups("crm_sqlite_*.db.gz", retention_days)
    return compressed_file


def backup_postgres(pg_url: str, retention_days: int = 14) -> Path:
    # Normalize URL for pg_dump
    if pg_url.startswith("postgresql+psycopg://"):
        pg_url = pg_url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    compressed_file = BACKUP_DIR / f"crm_postgres_{timestamp}.sql.gz"

    pg_dump_bin = find_tool("pg_dump")
    print(f"[*] Running PostgreSQL backup via {pg_dump_bin}...")
    cmd = [pg_dump_bin, "--dbname", pg_url, "--clean", "--if-exists", "--no-owner", "--no-privileges"]
    
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with gzip.open(compressed_file, "wb") as f_out:
            shutil.copyfileobj(proc.stdout, f_out)
        proc.wait()
        
        if proc.returncode != 0:
            err = proc.stderr.read().decode()
            print(f"Error during pg_dump: {err}", file=sys.stderr)
            if compressed_file.exists():
                compressed_file.unlink()
            sys.exit(1)
            
        print(f"[OK] PostgreSQL backup successfully created: {compressed_file}")
        prune_old_backups("crm_postgres_*.sql.gz", retention_days)
        return compressed_file
    except FileNotFoundError:
        print("Error: 'pg_dump' utility not found. Ensure PostgreSQL client tools are installed.", file=sys.stderr)
        sys.exit(1)


def prune_old_backups(pattern: str, retain_count: int):
    files = sorted(BACKUP_DIR.glob(pattern), key=os.path.getmtime, reverse=True)
    if len(files) > retain_count:
        for old_file in files[retain_count:]:
            print(f"[*] Pruning old backup: {old_file.name}")
            old_file.unlink()


def main():
    db_url = os.environ.get("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm")
    if db_url.startswith("sqlite"):
        path_str = db_url.replace("sqlite:///", "").lstrip("./")
        db_path = BASE_DIR / path_str
        if not db_path.exists():
            candidates = [BASE_DIR / "backend" / "crm.db", BASE_DIR / "crm.db"]
            for c in candidates:
                if c.exists():
                    db_path = c
                    break
        backup_sqlite(db_path)
    elif db_url.startswith(("postgresql", "postgres")):
        backup_postgres(db_url)
    else:
        print(f"Unsupported database URL scheme: {db_url}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
