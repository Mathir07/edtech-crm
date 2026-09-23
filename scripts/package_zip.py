#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Export Package Utility
Creates a clean, updated ZIP archive of the project for sharing with the team.
Excludes virtualenvs, node_modules, build caches, and sensitive .env files.
"""

import os
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_ZIP = ROOT_DIR / "kiwi-cloud-tech-crm-latest.zip"

# Directories to exclude
EXCLUDED_DIR_NAMES = {
    "venv",
    ".venv",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".next",
    "backups",
    ".git",
    ".gemini",
}

# Files to exclude
EXCLUDED_FILE_NAMES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "kiwi-cloud-tech-crm-latest.zip",
}

EXCLUDED_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".log",
}

def should_exclude_dir(dir_path: Path) -> bool:
    for part in dir_path.parts:
        if part in EXCLUDED_DIR_NAMES:
            return True
    return False

def should_exclude_file(file_path: Path) -> bool:
    if file_path.name in EXCLUDED_FILE_NAMES:
        return True
    if file_path.name.startswith(".env") and file_path.name != ".env.example":
        return True
    if file_path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return True
    return False

def create_archive():
    print(f"[*] Scanning project root: {ROOT_DIR}")
    print(f"[*] Target archive: {OUTPUT_ZIP.name}")

    if OUTPUT_ZIP.exists():
        print(f"[*] Removing existing {OUTPUT_ZIP.name} before rebuild...")
        OUTPUT_ZIP.unlink()

    included_files = []
    excluded_dirs_encountered = set()

    for root, dirs, files in os.walk(ROOT_DIR):
        current_dir = Path(root)

        # Filter dirs in-place to prevent walking into excluded directories
        dirs_to_remove = []
        for d in dirs:
            if d in EXCLUDED_DIR_NAMES:
                dirs_to_remove.append(d)
                excluded_dirs_encountered.add(d)

        for d in dirs_to_remove:
            dirs.remove(d)

        # Skip if current_dir itself is excluded
        if should_exclude_dir(current_dir):
            continue

        for f in files:
            file_path = current_dir / f
            if should_exclude_file(file_path):
                continue
            included_files.append(file_path)

    print(f"[*] Found {len(included_files)} files to package.")
    print(f"[*] Building ZIP archive...")

    total_uncompressed_bytes = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_path in included_files:
            rel_path = file_path.relative_to(ROOT_DIR)
            zf.write(file_path, arcname=str(rel_path))
            total_uncompressed_bytes += file_path.stat().st_size

    # Verify archive integrity
    print(f"[*] Verifying ZIP integrity...")
    with zipfile.ZipFile(OUTPUT_ZIP, "r") as zf:
        bad_file = zf.testzip()
        if bad_file is not None:
            print(f"[ERROR] Corrupt file in archive: {bad_file}", file=sys.stderr)
            sys.exit(1)
        zip_file_count = len(zf.namelist())

    compressed_bytes = OUTPUT_ZIP.stat().st_size
    size_mb = compressed_bytes / (1024 * 1024)
    uncomp_mb = total_uncompressed_bytes / (1024 * 1024)

    print("\n" + "=" * 60)
    print("KIWI CLOUD TECH CRM - EXPORT COMPLETE")
    print("=" * 60)
    print(f"ZIP File Path:     {OUTPUT_ZIP}")
    print(f"ZIP File Size:     {size_mb:.2f} MB ({compressed_bytes:,} bytes)")
    print(f"Uncompressed Size: {uncomp_mb:.2f} MB ({total_uncompressed_bytes:,} bytes)")
    print(f"Files Included:    {zip_file_count}")
    print(f"Excluded Dirs:     {', '.join(sorted(excluded_dirs_encountered))}")
    print("=" * 60)

if __name__ == "__main__":
    create_archive()
