# Kiwi Cloud Tech CRM - Production Deployment Guide
**Domain**: `kiwicloudtech.co.in`  
**Phase**: 13 — Production Hardening  

This guide provides the complete, authoritative, 20-point production deployment runbook for Kiwi Cloud Tech CRM.

---

## Architecture Overview

```
Internet
   ↓
[HTTPS / Nginx Reverse Proxy (Port 443)]
   ├── /api/ → [FastAPI Backend (Uvicorn / Port 8000)]
   │              ├── PostgreSQL 16 (Port 5432)
   │              └── Redis 7 (Port 6379)
   └── /     → [Next.js Frontend (Node.js / Port 3000)]
```

---

## A. Environment Variables

Create `.env` in the project root by copying `.env.example`:
```bash
cp .env.example .env
```

Ensure the following variables are configured for production:
- `ENVIRONMENT=production`
- `SECRET_KEY`: Secure, randomly generated secret with at least 32 characters (e.g. `openssl rand -hex 32`).
- `DATABASE_URL`: `postgresql+psycopg://<user>:<password>@localhost:5432/edtech_crm`
- `BACKEND_CORS_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://crm.kiwicloudtech.co.in`).
- `RATE_LIMIT_ENABLED=true`
- `NEXT_PUBLIC_API_URL=/api/v1`

---

## B. PostgreSQL Setup

1. Install PostgreSQL 16:
   ```bash
   sudo apt update && sudo apt install postgresql postgresql-contrib
   ```
2. Create dedicated production database and user:
   ```sql
   CREATE DATABASE edtech_crm;
   CREATE USER crm_prod_user WITH ENCRYPTED PASSWORD 'replace_with_strong_password';
   GRANT ALL PRIVILEGES ON DATABASE edtech_crm TO crm_prod_user;
   ALTER DATABASE edtech_crm OWNER TO crm_prod_user;
   ```
3. Verify connection pool tuning parameters in `.env`:
   ```env
   DB_POOL_SIZE=10
   DB_MAX_OVERFLOW=20
   DB_POOL_RECYCLE=1800
   DB_POOL_TIMEOUT=30
   ```

---

## C. Redis Setup

Redis provides optional caching and Celery/background job task queuing:
```bash
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```
Set `REDIS_URL=redis://localhost:6379/0` in `.env`.

---

## D. Database Migrations (Alembic)

In production, schema DDL is strictly executed via Alembic migrations. Runtime `create_all` is automatically bypassed when `ENVIRONMENT=production`.

1. Inspect current migration head:
   ```bash
   cd backend
   alembic current
   ```
2. Check that no pending schema drift exists:
   ```bash
   alembic check
   ```
3. Run upgrade to latest head (`b9e8d7c6b5a4`):
   ```bash
   alembic upgrade head
   ```

---

## E. Backend Startup

Using Systemd:
Create `/etc/systemd/system/crm-backend.service`:
```ini
[Unit]
Description=Kiwi Cloud Tech CRM - FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/crm/backend
EnvironmentFile=/var/www/crm/.env
ExecStart=/var/www/crm/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable crm-backend
sudo systemctl start crm-backend
```

---

## F. Frontend Startup

Build and start Next.js:
Create `/etc/systemd/system/crm-frontend.service`:
```ini
[Unit]
Description=Kiwi Cloud Tech CRM - Next.js Frontend
After=network.target crm-backend.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/crm/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Build and start:
```bash
cd frontend
npm ci
npm run build
sudo systemctl daemon-reload
sudo systemctl enable crm-frontend
sudo systemctl start crm-frontend
```

---

## G. Nginx Configuration

Copy hardened `nginx/nginx.conf` to `/etc/nginx/sites-available/crm.conf`:
```bash
sudo cp nginx/nginx.conf /etc/nginx/conf.d/crm.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## H. HTTPS / SSL Configuration (Certbot)

Generate free TLS certificates using Let's Encrypt Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d crm.kiwicloudtech.co.in
```
Certbot will configure automatic HTTP to HTTPS redirection and renewal timers.

---

## I. Hostinger SMTP & IMAP Setup

Primary email provider for Kiwi Cloud Tech is Hostinger (`kiwicloudtech.co.in`).
1. In `.env`, populate:
   ```env
   HOSTINGER_SMTP_HOST=smtp.hostinger.com
   HOSTINGER_SMTP_PORT=465
   HOSTINGER_SMTP_USERNAME=info@kiwicloudtech.co.in
   HOSTINGER_SMTP_PASSWORD=<production_password>
   HOSTINGER_SMTP_USE_SSL=true

   HOSTINGER_IMAP_HOST=imap.hostinger.com
   HOSTINGER_IMAP_PORT=993
   HOSTINGER_IMAP_USERNAME=info@kiwicloudtech.co.in
   HOSTINGER_IMAP_PASSWORD=<production_password>
   HOSTINGER_IMAP_USE_SSL=true

   HOSTINGER_EMAIL_FROM=info@kiwicloudtech.co.in
   HOSTINGER_EMAIL_FROM_NAME="Kiwi Cloud Tech"
   COMM_NOTIFICATION_EMAILS_ENABLED=true
   ```
2. Run email diagnostics from CRM Settings or CLI.
*Note: Marked as REQUIRES PRODUCTION CREDENTIALS until real Hostinger credentials are provided.*

---

## J. WhatsApp Business API Setup

Official Meta Cloud API integration:
1. Obtain Meta WhatsApp credentials from Meta Developer Portal.
2. In `.env`, populate:
   ```env
   WHATSAPP_PROVIDER=META_CLOUD
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0
   WHATSAPP_API_TOKEN=<system_user_access_token>
   WHATSAPP_PHONE_NUMBER_ID=<phone_number_id>
   WHATSAPP_WEBHOOK_SECRET=<webhook_verify_token>
   ```
3. Set Webhook URL in Meta App: `https://crm.kiwicloudtech.co.in/api/v1/communications/whatsapp/webhook`
*Note: Marked as REQUIRES PRODUCTION CREDENTIALS until live token is configured.*

---

## K. AI Provider Configuration

Production AI assistant operates under READ + DRAFT guardrails:
1. In `.env`, configure:
   ```env
   AI_PROVIDER=openai  # or "gemini"
   AI_API_KEY=<provider_api_key>
   AI_MODEL=gpt-4o-mini
   AI_MAX_PROMPT_LENGTH=2000
   AI_MAX_TOOL_RESULTS=10
   ```
2. For testing without live keys, `AI_PROVIDER=mock` remains active and fully functional.

---

## L. Backup Setup

Automated daily backup via cron:
```bash
# Add to crontab (crontab -e)
0 2 * * * cd /var/www/crm && /var/www/crm/backend/venv/bin/python scripts/backup_db.py >> /var/log/crm_backup.log 2>&1
```
Backups are compressed with gzip and retained for 14 days by default in `/var/www/crm/backups/`.

---

## M. Restore Test Procedure

Regularly verify that backups can be restored into a non-production test database:
```bash
python scripts/restore_db.py backups/crm_postgres_YYYYMMDD_HHMMSS.sql.gz postgresql://postgres:pass@localhost:5432/crm_restore_test
```

---

## N. Monitoring & Observability

Lightweight monitoring metrics to track:
- **Liveness**: `GET /api/health` (HTTP 200)
- **Readiness**: `GET /api/health/readiness` (HTTP 200 / checks DB connectivity)
- **Log inspection**: Check `/var/log/crm_access.log` for structured entries:
  `[2026-09-19 18:56:00] [INFO] [req_id=...] GET /api/v1/crm/colleges - 200 (14.2ms)`

---

## O. Health Checks

1. Liveness endpoint:
   ```bash
   curl -i http://127.0.0.1:8000/api/health
   # Returns 200 {"status": "healthy", "service": "EdTech Enterprise CRM", "environment": "production"}
   ```
2. Readiness endpoint:
   ```bash
   curl -i http://127.0.0.1:8000/api/health/readiness
   # Returns 200 {"status": "ready", "service": "EdTech Enterprise CRM", "database": "connected", "environment": "production"}
   ```

---

## P. Security Checklist

- [x] Passwords hashed with bcrypt; never returned in API payloads.
- [x] JWT tokens use HS256 with minimum 32-character secret.
- [x] Inactive / disabled accounts forbidden from logging in or using refresh tokens.
- [x] RBAC verified server-side on all sensitive CRM, Sales, Projects, QA, Service, Accounting, and AI endpoints.
- [x] Rate limiting active on login (10/min), AI chat (30/min), and email dispatch (20/min).
- [x] Security headers set: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- [x] File uploads sanitized against path traversal (`..`), whitelisted against executable file extensions, and restricted to 10MB/15MB limits.
- [x] Production error responses mask stack tracebacks and internal exception names.

---

## Q. Rollback Procedure

If a deployment fails:
1. Revert Git commit: `git checkout <previous_stable_tag>`
2. Roll back database migration if necessary:
   ```bash
   cd backend
   alembic downgrade -1
   ```
3. Restart services:
   ```bash
   sudo systemctl restart crm-backend crm-frontend
   ```

---

## R. Incident Recovery

Refer to [docs/DISASTER_RECOVERY.md](file:///d:/kct/crm/docs/DISASTER_RECOVERY.md) for detailed recovery workflows covering database restoration, corrupted migrations, lost files, and credential rotation.

---

## S. First Admin Setup

If starting from a fresh database:
```bash
cd backend
python -m app.core.seed_rbac
python -m app.core.seed_admin
```
Default credentials:
- Username: `admin@edtechcrm.com`
- Change password immediately upon first login under `/settings`.

---

## T. Production Smoke Test

Run the full end-to-end automated verification script:
```bash
cd backend
python -m tests.smoke_test
```
This verifies complete cross-department CRM continuity across Login, College, Contact, Lead, Opportunity, Quotation, Sales Order, Project, QA, Bug, Invoice, Payment, Service Ticket, Communication, Report, Notification, and AI Assistant.
