import sys
import os

# Add parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base
import app.core.models

def inspect():
    print(f"Total registered SQLAlchemy tables in Base.metadata: {len(Base.metadata.tables)}")
    
    issues = []
    summary = {}
    
    for table_name, table in Base.metadata.tables.items():
        summary[table_name] = {
            "columns": len(table.columns),
            "primary_key": [c.name for c in table.primary_key],
            "foreign_keys": len(table.foreign_keys),
            "indexes": len(table.indexes),
        }
        for col in table.columns:
            col_type = str(col.type)
            # Check for potential issues in PostgreSQL
            # E.g., boolean columns without explicit boolean type
            # Date/DateTime without timezone
            # JSON columns
            pass
            
    print(f"\nTables summary (first 10):")
    for t in list(summary.keys())[:10]:
        print(f"  {t:30}: {summary[t]['columns']} cols, PK: {summary[t]['primary_key']}, FKs: {summary[t]['foreign_keys']}")
        
    print(f"\nTotal tables inspected: {len(summary)}")

if __name__ == "__main__":
    inspect()
