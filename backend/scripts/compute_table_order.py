import sys
import os
from collections import defaultdict, deque

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base
import app.core.models

def get_table_order():
    tables = Base.metadata.tables
    # Build graph: if table A has FK pointing to table B, B must be inserted before A (B -> A)
    adj = defaultdict(set)
    in_degree = defaultdict(int)
    
    for t_name in tables:
        in_degree[t_name] = 0
        
    for t_name, table in tables.items():
        for fk in table.foreign_keys:
            target_table = fk.column.table.name
            if target_table != t_name and target_table in tables:
                # self-referencing FKs are handled separately (allow null parent)
                adj[target_table].add(t_name)

    # Recompute in_degree
    for u in adj:
        for v in adj[u]:
            in_degree[v] += 1

    # Kahn's algorithm
    queue = deque([t for t in tables if in_degree[t] == 0])
    ordered = []
    
    while queue:
        u = queue.popleft()
        ordered.append(u)
        for v in list(adj[u]):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)
                
    remaining = [t for t in tables if t not in ordered]
    if remaining:
        print(f"Cycles or unresolved dependencies found in: {remaining}")
    else:
        print("Strict acyclic topological order found for all tables!")
        
    print(f"\nTotal tables ordered: {len(ordered)} / {len(tables)}")
    print("\nOrdered table list:")
    for idx, t in enumerate(ordered, 1):
        print(f"{idx:2d}. {t}")
        
    return ordered

if __name__ == "__main__":
    get_table_order()
