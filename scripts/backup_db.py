#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Database Backup Utility
Domain: kiwicloudtech.co.in

Supports:
- Local SQLite backup (safe hot copy)
- Production PostgreSQL backup via pg_dump
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
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    compressed_file = BACKUP_DIR / f"crm_postgres_{timestamp}.sql.gz"

    print(f"[*] Running PostgreSQL backup via pg_dump...")
    cmd = ["pg_dump", "--dbname", pg_url, "--clean", "--if-exists", "--no-owner", "--no-privileges"]
    
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
        print("Error: 'pg_dump' utility not found on PATH. Ensure PostgreSQL client tools are installed.", file=sys.stderr)
        sys.exit(1)

def prune_old_backups(pattern: str, retain_count: int):
    files = sorted(BACKUP_DIR.glob(pattern), key=os.path.getmtime, reverse=True)
    if len(files) > retain_count:
        for old_file in files[retain_count:]:
            print(f"[*] Pruning old backup: {old_file.name}")
            old_file.unlink()

def main():
    db_url = os.environ.get("DATABASE_URL", "sqlite:///./backend/crm.db")
    if db_url.startswith("sqlite"):
        # Parse sqlite path
        path_str = db_url.replace("sqlite:///", "").lstrip("./")
        db_path = BASE_DIR / path_str
        if not db_path.exists():
            # Try backend/crm.db or root crm.db
            candidates = [BASE_DIR / "backend" / "crm.db", BASE_DIR / "crm.db"]
            for c in candidates:
                if c.exists():
                    db_path = c
                    break
        backup_sqlite(db_path)
    elif db_url.startswith("postgresql"):
        backup_postgres(db_url)
    else:
        print(f"Unsupported database URL scheme: {db_url}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
