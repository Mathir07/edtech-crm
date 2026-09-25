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

        # Seed master users, roles, and configuration if empty
        try:
            from app.core.database import SessionLocal
            from app.users.models import User
            from app.seed.seed_data import seed
            from scripts.clean_test_data import clean_transactional_data

            db = SessionLocal()
            user_count = db.query(User).count()
            db.close()

            if user_count == 0:
                print("Database has no users. Seeding master system roles, permissions, and users...")
                seed()
                print("Purging mock test records to ensure clean transactional database...")
                clean_transactional_data()
                print("Pristine master database initialized with working login credentials.")
            else:
                print(f"Database already contains {user_count} users. Verifying superuser accounts...")
                vinoth = db.query(User).filter(User.email == "vinothravi2819@gmail.com").first()
                if not vinoth:
                    from app.core.security import get_password_hash
                    from app.users.models import Role
                    admin_role = db.query(Role).filter(Role.name == "Super Admin").first()
                    vinoth = User(
                        email="vinothravi2819@gmail.com",
                        hashed_password=get_password_hash("Admin@123"),
                        first_name="Vinoth",
                        last_name="Ravi",
                        is_active=True,
                        is_superuser=True,
                    )
                    if admin_role:
                        vinoth.roles = [admin_role]
                    db.add(vinoth)
                    db.commit()
                    print("Created missing Super Admin: vinothravi2819@gmail.com")
        except Exception as seed_err:
            print(f"Warning: Error during initial seed check: {seed_err}")

if __name__ == "__main__":
    run_migrations()
