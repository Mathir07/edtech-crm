import sqlite3
import glob
import os

files = glob.glob(r"d:\Kiwi Project\crm_updated_latest\crm\backups\*.db") + \
        glob.glob(r"d:\Kiwi Project\crm_updated_latest\crm\backend\*.db*")

print("Checking databases for record counts:")
for f in files:
    if not os.path.isfile(f) or f.endswith(('-wal', '-shm', '.gz', '.py')):
        continue
    try:
        conn = sqlite3.connect(f"file:{f}?mode=ro", uri=True)
        cur = conn.cursor()
        counts = {}
        for tbl in ['users', 'companies', 'contacts', 'leads', 'opportunities', 'invoices', 'projects', 'tickets', 'audit_logs']:
            try:
                cur.execute(f'SELECT count(*) FROM "{tbl}"')
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    counts[tbl] = cnt
            except Exception:
                pass
        conn.close()
        print(f"\nDatabase: {os.path.basename(f)}")
        print(f"  Non-empty counts: {counts}")
    except Exception as e:
        print(f"Error checking {f}: {e}")
