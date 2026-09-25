import os
import sys
import time
from sqlalchemy import create_engine, text
from alembic.config import Config
from alembic import command

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.core.config import settings

def run_migrations():
    print("Verifying database connection before running migrations...")
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    
    max_retries = 30
    connected = False
    for i in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database connection successfully established.")
            connected = True
            break
        except Exception as exc:
            print(f"[Attempt {i}/{max_retries}] Database connection not ready yet: {exc}")
            if i == max_retries:
                print("Failed to reach database after maximum attempts. Aborting.")
                sys.exit(1)
            time.sleep(2)
            
    if connected:
        print("Executing Alembic migrations ('alembic upgrade head')...")
        alembic_ini_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "alembic.ini")
        alembic_cfg = Config(alembic_ini_path)
        command.upgrade(alembic_cfg, "head")
        print("Database migrations applied successfully!")

if __name__ == "__main__":
    run_migrations()
