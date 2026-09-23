# Kiwi Cloud Tech CRM - Disaster Recovery Runbook
**Domain**: `kiwicloudtech.co.in`  
**Phase**: 13 — Production Hardening  

This runbook outlines practical, step-by-step restoration procedures for the 10 most common operational failure scenarios in Kiwi Cloud Tech CRM.

---

## 1. Complete Server Failure

**Symptoms**: Physical/cloud server terminated, hardware failure, or host instance irrecoverable.

**Recovery Steps**:
1. Provision a replacement Linux server (Ubuntu 22.04 / 24.04 LTS recommended).
2. Install prerequisite packages:
   ```bash
   sudo apt update && sudo apt install -y git curl python3-venv python3-pip nodejs npm postgresql-client nginx
   ```
3. Clone repository and restore `.env` configuration from secure password manager / secret store:
   ```bash
   git clone https://github.com/kiwicloudtech/crm.git /var/www/crm
   cd /var/www/crm
   cp /secure-storage/crm.env .env
   ```
4. Restore the latest database backup (see Scenario 2).
5. Restore persistent uploads folder from backup storage:
   ```bash
   rsync -avz user@backup-server:/backups/crm_uploads/ /var/www/crm/uploads/
   ```
6. Start systemd services:
   ```bash
   sudo systemctl restart crm-backend crm-frontend nginx
   ```
7. Verify health endpoints:
   ```bash
   curl -f http://127.0.0.1:8000/api/health
   curl -f http://127.0.0.1:8000/api/health/readiness
   ```

---

## 2. Database Failure or Data Corruption

**Symptoms**: PostgreSQL service failure, disk block corruption, or accidental data truncation.

**Recovery Steps**:
1. Stop the backend application immediately to prevent dirty state:
   ```bash
   sudo systemctl stop crm-backend
   ```
2. Locate the most recent verified backup in `backups/`:
   ```bash
   ls -lt backups/crm_postgres_*.sql.gz | head -n 5
   ```
3. Restore database using the restore utility:
   ```bash
   python scripts/restore_db.py backups/crm_postgres_YYYYMMDD_HHMMSS.sql.gz
   ```
4. Verify migration head consistency:
   ```bash
   cd backend
   alembic current
   # Expected head: f5711f63c736
   ```
5. Restart backend and verify readiness:
   ```bash
   sudo systemctl start crm-backend
   curl http://127.0.0.1:8000/api/health/readiness
   ```

---

## 3. Failed or Broken Application Deployment

**Symptoms**: Newly deployed code fails to build or throws 500 errors on startup.

**Recovery Steps**:
1. Identify the last known stable Git tag or commit hash:
   ```bash
   git log --oneline -n 5
   ```
2. Revert code to the previous release:
   ```bash
   git checkout <previous_stable_commit>
   ```
3. Rebuild frontend and restart backend:
   ```bash
   cd /var/www/crm/frontend && npm run build
   sudo systemctl restart crm-backend crm-frontend
   ```
4. Verify smoke test passes:
   ```bash
   cd /var/www/crm/backend && python -m tests.smoke_test
   ```

---

## 4. Corrupted or Inconsistent Alembic Migration

**Symptoms**: Database schema mismatch, migration collision, or `alembic check` reports unexpected diffs.

**Recovery Steps**:
1. Check current migration state:
   ```bash
   cd backend
   alembic current
   alembic heads
   ```
2. If multiple heads exist accidentally, downgrade or merge safely.
3. If an individual migration failed halfway through:
   ```bash
   # Downgrade by 1 step
   alembic downgrade -1
   # Re-apply correctly
   alembic upgrade head
   ```
4. Verify schema alignment:
   ```bash
   alembic check
   ```

---

## 5. Lost Uploaded Files / Document Storage Failure

**Symptoms**: File download returns 404 (`"File content not found on server"`), attachments directory missing.

**Recovery Steps**:
1. Verify storage directory permissions:
   ```bash
   mkdir -p /var/www/crm/uploads
   chown -R www-data:www-data /var/www/crm/uploads
   ```
2. Restore file tree from daily rsync/tarball backup:
   ```bash
   tar -xzf /secure-storage/crm_uploads_backup.tar.gz -C /var/www/crm/uploads/
   ```
3. Verify file retrieval via API download endpoint.

---

## 6. Redis Crash or Background Task Desynchronization

**Symptoms**: Automation reminders delayed, cached sessions unavailable.

**Recovery Steps**:
1. Restart Redis service:
   ```bash
   sudo systemctl restart redis-server
   ```
2. Verify Redis responsiveness:
   ```bash
   redis-cli ping
   # Expected response: PONG
   ```
3. Phase 11 Automation rules use database-backed idempotency logs (`automation_event_logs`). No events will be duplicated even after Redis restart. Trigger an on-demand scan:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/v1/automation/rules/scan -H "Authorization: Bearer <admin_token>"
   ```

---

## 7. Expired or Compromised Secret Credentials

**Symptoms**: JWT signing key compromised, database credentials exposed, or Hostinger SMTP password leaked.

**Recovery Steps**:
1. Generate new 32-character secret keys:
   ```bash
   openssl rand -hex 32
   ```
2. Update `.env` with new `SECRET_KEY`, database password, or Hostinger credentials.
3. If database password changed:
   ```sql
   ALTER USER crm_prod_user WITH PASSWORD 'new_strong_password';
   ```
4. Restart application services:
   ```bash
   sudo systemctl restart crm-backend crm-frontend
   ```
5. Note: Rotating `SECRET_KEY` automatically invalidates all existing user JWT sessions, requiring all users to log in again.

---

## 8. Hostinger Email Service Outage

**Symptoms**: Outbound emails timeout, SMTP connection refused, or IMAP synchronization fails.

**Recovery Steps**:
1. The CRM architecture isolates email dispatch so application requests do not fail or hang when Hostinger is unreachable.
2. Verify Hostinger server availability:
   ```bash
   nc -zv smtp.hostinger.com 465
   nc -zv imap.hostinger.com 993
   ```
3. Temporarily disable automated notification emails if desired:
   Set `COMM_NOTIFICATION_EMAILS_ENABLED=false` in `.env`.
4. Once Hostinger recovers, reload backend:
   ```bash
   sudo systemctl reload crm-backend
   ```

---

## 9. WhatsApp Cloud API Outage

**Symptoms**: Inbound webhooks fail verification or outbound template sends return 503 from Meta.

**Recovery Steps**:
1. Check Meta Developer status page for WhatsApp Cloud API incidents.
2. Inbound webhook retry is automatically managed by Meta Cloud API (retries up to 7 days).
3. The CRM stores communication history and duplicate webhook protections prevent duplicate messaging when Meta re-delivers.
4. If Meta API access token expired:
   - Generate a new System User access token from Meta Business Manager.
   - Update `WHATSAPP_API_TOKEN` in `.env`.
   - Reload backend.

---

## 10. AI Provider Outage

**Symptoms**: AI Chat queries to OpenAI or Gemini timeout or return 500/503.

**Recovery Steps**:
1. Check OpenAI / Google AI status pages.
2. The AI module includes automatic graceful degradation: if an external AI provider fails or is unconfigured, it automatically falls back to deterministic structured CRM data queries and drafts without crashing the application.
3. To switch to mock mode immediately during provider outages:
   ```env
   AI_PROVIDER=mock
   ```
4. Reload backend:
   ```bash
   sudo systemctl restart crm-backend
   ```
