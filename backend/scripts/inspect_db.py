import os
import sqlite3

def inspect_sqlite():
    db_path = r"d:\Kiwi Project\crm_updated_latest\crm\backend\crm.db"
    if not os.path.exists(db_path):
        print(f"File not found: {db_path}")
        return
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Total tables found in SQLite: {len(tables)}")
    
    total_rows = 0
    non_empty_tables = []
    empty_tables = []
    
    for t in tables:
        if t.startswith("sqlite_"):
            continue
        cur.execute(f'SELECT COUNT(*) FROM "{t}";')
        cnt = cur.fetchone()[0]
        total_rows += cnt
        if cnt > 0:
            non_empty_tables.append((t, cnt))
        else:
            empty_tables.append(t)
            
    print("\n--- NON-EMPTY TABLES ---")
    for t, cnt in sorted(non_empty_tables, key=lambda x: x[1], reverse=True):
        print(f"{t:35}: {cnt:6} rows")
        
    print(f"\nTotal non-empty tables: {len(non_empty_tables)}")
    print(f"Total empty tables: {len(empty_tables)}")
    print(f"Total rows in SQLite database: {total_rows}")
    conn.close()

if __name__ == "__main__":
    inspect_sqlite()
