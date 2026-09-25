# PostgreSQL 16 Migration & Deployment Guide
**EdTech Enterprise CRM (Kiwi Cloud Tech)**  
**Version**: 2.0 (PostgreSQL 16 Production Ready)  

---

## 1. Overview & Architecture

The EdTech CRM main application database has been migrated from SQLite to **PostgreSQL 16** using SQLAlchemy 2.0 ORM, the modern `psycopg` (v3) PostgreSQL driver, and Alembic migrations.

### Key Architectural Enhancements
1. **Primary Production Database**: PostgreSQL 16 is now the single primary database for development, staging, and production deployments. All SQLite dependencies (`crm.db`, `crm.db-wal`, `crm.db-shm`) have been removed from runtime and Docker Compose.
2. **High-Performance Connection Pooling**: Standardized SQLAlchemy `QueuePool` with:
   - `DB_POOL_SIZE=10`
   - `DB_MAX_OVERFLOW=20`
   - `DB_POOL_RECYCLE=1800` (recycles connections every 30 minutes)
   - `DB_POOL_TIMEOUT=30`
   - `pool_pre_ping=True` (automatic reconnect on dropped TCP sockets)
3. **Deterministic & Idempotent Migration**: Automated topological transfer script (`backend/scripts/migrate_sqlite_to_pg.py`) capable of moving all 77 tables without data loss or unique constraint violations.
4. **Complete Docker Integration**: `docker-compose.yml` and `docker-compose.production.yml` provision a dedicated PostgreSQL 16 container (`postgres:16-alpine`) with health checks, persistent volume storage (`postgres_data`), and backend service dependency (`service_healthy`).

---

## 2. Installing PostgreSQL 16 Locally

### Windows
1. Download the official PostgreSQL 16 installer from [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Run the installer and select:
   - PostgreSQL Server
   - Command Line Tools (`psql`, `pg_dump`)
3. Set password for user `postgres` (e.g., `postgres` for local development).
4. Default port: `5432`.
5. Add `C:\Program Files\PostgreSQL\16\bin` to your system `PATH`.

### Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16 postgresql-contrib-16
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### macOS (Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16
```

---

## 3. Creating the Database & User

### Using `psql` (Interactive Command Line)
```bash
# Connect as superuser
psql -U postgres -h localhost -p 5432

# In psql prompt:
CREATE DATABASE edtech_crm;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE edtech_crm TO postgres;
ALTER DATABASE edtech_crm OWNER TO postgres;
\q
```

### Single Command (PowerShell / Bash)
```powershell
# Windows PowerShell
$env:PGPASSWORD="postgres"
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE edtech_crm;"
```
```bash
# Linux / macOS
PGPASSWORD=postgres psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE edtech_crm;"
```

---

## 4. Running Alembic Database Migrations

Alembic manages all schema DDL. A completely fresh PostgreSQL database can be initialized from scratch to head:

```bash
cd backend

# Ensure virtual environment is activated
# Windows: .\venv\Scripts\activate
# Linux/macOS: source venv/bin/activate

# Set database URL environment variable (or let backend/.env provide it)
export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm"

# Execute all migrations up to head
alembic upgrade head
```

This creates all 78 tables (77 CRM application tables + `alembic_version`) with all indexes, foreign keys, and constraints.

---

## 5. Importing Existing SQLite Data to PostgreSQL

Use the deterministic migration script `migrate_sqlite_to_pg.py`:

```bash
cd backend

# Optional: Run in dry-run mode first to test and verify
python scripts/migrate_sqlite_to_pg.py --sqlite-path crm.db --pg-url "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm" --dry-run

# Execute the live idempotent data migration
python scripts/migrate_sqlite_to_pg.py --sqlite-path crm.db --pg-url "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm"
```

### Features of the Migration Process:
- **Topological Sorting**: Inserts tables in strict foreign-key order:
  `audit_logs ➔ departments ➔ permissions ➔ roles ➔ ... ➔ users ➔ companies ➔ contacts ➔ leads ➔ opportunities ➔ ... ➔ invoices ➔ tickets`
- **Self-Referencing Hierarchies**: Automatically orders rows in `accounts` (Chart of Accounts) and `journal_entries` so parent records precede children.
- **Idempotency**: Uses `ON CONFLICT DO NOTHING` and transaction savepoints so rerunning the script never causes duplicates or unique constraint errors.
- **Data Integrity**: Preserves original UUID primary keys, password hashes, foreign key links, boolean types, JSON columns, and timestamps.

---

## 6. Seeding Demo / Master Data

To populate initial departments, teams, users, sales pipelines, lead sources, demo institutions, contacts, opportunities, and chart of accounts:

```bash
cd backend
python -m app.seed.seed_data
```

Default credentials seeded:
- **Super Admin**: `vinothravi2819@gmail.com` / `Admin@123` (or `admin@edtechcrm.com` / `Admin@123`)
- **Sales Manager**: `sales.manager@edtechcrm.com` / `Admin@123`
- **Sales Executive**: `sales.exec@edtechcrm.com` / `Admin@123`
- **Project Manager**: `pm@edtechcrm.com` / `Admin@123`
- **Finance Manager**: `finance@edtechcrm.com` / `Admin@123`

---

## 7. Starting the Backend & Frontend Locally

### Start Backend (FastAPI)
```bash
cd backend
# With virtual environment activated:
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Root: `http://localhost:8000`
- Swagger UI Docs: `http://localhost:8000/api/v1/docs`
- Health Liveness: `http://localhost:8000/api/health`
- Database Readiness: `http://localhost:8000/api/health/readiness`

### Start Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 8. Running with Docker Compose

To deploy the entire production stack (PostgreSQL 16 + Redis + FastAPI Backend + Next.js Frontend + Nginx):

```bash
# 1. Copy production environment file
cp .env.example .env

# 2. Configure POSTGRES_PASSWORD and SECRET_KEY in .env
# (Ensure SECRET_KEY is at least 32 characters in production)

# 3. Build and launch services
docker-compose -f docker-compose.production.yml up --build -d

# 4. Check service status and health
docker-compose -f docker-compose.production.yml ps

# 5. Run migrations inside the container
docker-compose -f docker-compose.production.yml exec backend alembic upgrade head

# 6. (Optional) Run data migration inside the container
docker-compose -f docker-compose.production.yml exec backend python scripts/migrate_sqlite_to_pg.py
```

### Docker Service Architecture
- `db`: PostgreSQL 16 Alpine (`var/lib/postgresql/data` volume)
- `redis`: Redis 7 Alpine (`/data` volume)
- `backend`: FastAPI Python 3.11 with psycopg (`depends_on: db: condition: service_healthy`)
- `frontend`: Next.js 16 Node.js container
- `nginx`: Reverse proxy on ports 80/443 routing `/api/` to backend and `/` to frontend

---

## 9. Deploying to Managed PostgreSQL Providers

The CRM application is built on standard PostgreSQL 16 and fully supports all major managed cloud database providers.

### Connection String Format
SQLAlchemy with psycopg driver requires the dialect prefix `postgresql+psycopg://`:
```
postgresql+psycopg://<username>:<password>@<host>:<port>/<database>?sslmode=require
```

### Provider-Specific Setup

#### 1. AWS RDS / Aurora PostgreSQL
1. Create a PostgreSQL 16 DB instance.
2. In VPC Security Groups, allow inbound traffic on port 5432 from your application server or ECS/EKS cluster.
3. Configure environment variable:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:<PASSWORD>@<RDS_ENDPOINT>.rds.amazonaws.com:5432/edtech_crm?sslmode=require
   ```

#### 2. Supabase
1. Create a new Supabase project.
2. Go to **Project Settings** ➔ **Database** ➔ **Connection string**.
3. Choose **URI** (Session Pooler or Direct):
   ```env
   DATABASE_URL=postgresql+psycopg://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
   ```

#### 3. Neon Serverless Postgres
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string from Dashboard:
   ```env
   DATABASE_URL=postgresql+psycopg://<USER>:<PASSWORD>@<ENDPOINT>.neon.tech/edtech_crm?sslmode=require
   ```

#### 4. Render PostgreSQL
1. Create a PostgreSQL database on Render.
2. Copy the **Internal Database URL** (for backend services deployed on Render) or **External Database URL**:
   ```env
   DATABASE_URL=postgresql+psycopg://<USER>:<PASSWORD>@<HOST>.render.com/edtech_crm?sslmode=require
   ```
*(Note: If Render provides a `postgres://` URL, the application's config validator automatically converts it to `postgresql+psycopg://`)*.

#### 5. Google Cloud SQL
1. Create a Cloud SQL for PostgreSQL 16 instance.
2. Connect via Cloud SQL Auth Proxy or authorized private IP:
   ```env
   DATABASE_URL=postgresql+psycopg://<USER>:<PASSWORD>@127.0.0.1:5432/edtech_crm
   ```

---

## 10. Automated Backups & Disaster Recovery

### Automated Backup via `pg_dump`
```bash
python scripts/backup_db.py
```
- Creates compressed, timestamped backup in `backups/crm_postgres_YYYYMMDD_HHMMSS.sql.gz`.
- Automatically prunes backups older than 14 runs.

### Restoring a Backup via `psql`
```bash
python scripts/restore_db.py backups/crm_postgres_20260925_101600.sql.gz "postgresql+psycopg://postgres:postgres@localhost:5432/edtech_crm"
```
