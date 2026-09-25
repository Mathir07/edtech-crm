import sqlite3
import psycopg
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def compare():
    sqlite_path = r"d:\Kiwi Project\crm_updated_latest\crm\backend\crm.db"
    s_conn = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
    s_cur = s_conn.cursor()
    
    p_conn = psycopg.connect("postgresql://postgres:postgres@localhost:5432/edtech_crm")
    p_cur = p_conn.cursor()
    
    s_cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    s_tables = set(r[0] for r in s_cur.fetchall() if not r[0].startswith("sqlite_"))
    
    p_cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
    p_tables = set(r[0] for r in p_cur.fetchall())
    
    print(f"SQLite tables count: {len(s_tables)}")
    print(f"PostgreSQL tables count: {len(p_tables)}")
    
    missing_in_pg = s_tables - p_tables
    missing_in_sqlite = p_tables - s_tables
    print(f"Tables in SQLite but missing in PG: {missing_in_pg}")
    print(f"Tables in PG but missing in SQLite: {missing_in_sqlite}")
    
    # Compare columns for common tables
    col_diffs = {}
    for tbl in sorted(s_tables.intersection(p_tables)):
        s_cur.execute(f'PRAGMA table_info("{tbl}");')
        s_cols = set(r[1] for r in s_cur.fetchall())
        
        p_cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{tbl}';")
        p_cols = set(r[0] for r in p_cur.fetchall())
        
        if s_cols != p_cols:
            col_diffs[tbl] = {
                "sqlite_only": s_cols - p_cols,
                "pg_only": p_cols - s_cols
            }
            
    if col_diffs:
        print("\nColumn differences found:")
        for t, d in col_diffs.items():
            print(f"  {t}: {d}")
    else:
        print("\nAll common tables have IDENTICAL column sets!")
        
    s_conn.close()
    p_conn.close()

if __name__ == "__main__":
    compare()
