# Kiwi Cloud Tech CRM - Production Security Checklist
**Domain**: `kiwicloudtech.co.in`  
**Phase**: 13 — Production Hardening  

---

## 1. Authentication & Session Security

- [x] **Password Hashing**: Strong bcrypt algorithm with per-user salt used for all passwords. Plaintext passwords never stored.
- [x] **Password Leaks**: Passwords and hashed passwords are excluded from all API response models via Pydantic schemas.
- [x] **Disabled/Inactive User Handling**: Inactive users rejected immediately at login (HTTP 403) and refresh token generation (HTTP 401).
- [x] **Token Lifetime**: Access token lifetime configured to 24 hours (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`). Refresh tokens expire in 7 days (`REFRESH_TOKEN_EXPIRE_DAYS=7`).
- [x] **Secret Validation**: In production mode (`ENVIRONMENT=production`), server startup fails if `SECRET_KEY` is set to the default development secret or is shorter than 32 characters.

---

## 2. Server-Side RBAC & Authorization

- [x] **Server-Side Enforcement**: All sensitive endpoints enforce permissions via `require_permission` and `require_any_permission` FastAPI dependencies. Hiding UI elements is never relied upon as an authorization mechanism.
- [x] **Departmental Isolation**:
  - Sales users without accounting permissions cannot access financial records, invoices, payments, or ledger accounts.
  - Non-finance users cannot access executive financial reports.
  - Service internal notes remain protected and visible only to authorized service personnel.
  - AI Assistant verifies user permissions before answering financial queries (`accounting.view`).
- [x] **Superuser Protection**: Critical administrative operations (user creation, role assignment, system settings) restricted to active superusers.

---

## 3. Organization & Data Scoping

- [x] **Single-Company / Private Deployment Model**: This CRM deployment is architected for Kiwi Cloud Tech (`kiwicloudtech.co.in`) as a private institutional CRM.
- [x] **Multi-Institution Records**: Educational institutions are modeled as `College` entities. All associated records (`Contact`, `Lead`, `Opportunity`, `SalesOrder`, `Project`, `Ticket`, `Invoice`) maintain foreign key links to their originating college.
- [x] **Audit Trail**: Mutating operations record user ID, email, action, entity type, and timestamp in immutable audit logs.

---

## 4. CORS & Network Security

- [x] **Allowed Origins**: `BACKEND_CORS_ORIGINS` is configurable via environment variable.
- [x] **Credential Safety**: `allow_origins=["*"]` is never combined with `allow_credentials=True`. If wildcard is supplied, credentials are automatically disabled.
- [x] **Internal Service Isolation**: In `docker-compose.yml`, PostgreSQL (5432) and Redis (6379) are bound to `127.0.0.1` so they are not directly reachable from public networks.

---

## 5. Security Headers

- [x] `X-Content-Type-Options: nosniff` (prevents MIME type sniffing).
- [x] `X-Frame-Options: SAMEORIGIN` (prevents clickjacking).
- [x] `X-XSS-Protection: 1; mode=block` (browser XSS filtering).
- [x] `Referrer-Policy: strict-origin-when-cross-origin` (prevents leaking URL paths in referrers).
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()` (restricts unnecessary browser capabilities).
- [x] `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforces HTTPS in production).

---

## 6. Rate Limiting

- [x] **Sliding-Window Rate Limiter**: Thread-safe in-memory sliding-window limiter guarding sensitive endpoints.
- [x] **Login Protection**: Max 10 requests per minute per IP for `/api/v1/auth/login` (mitigates brute-force attacks).
- [x] **AI Assistant Protection**: Max 30 requests per minute per user/IP for `/api/v1/ai/chat`.
- [x] **Outbound Communication Protection**: Max 20 requests per minute per user/IP for email dispatch.
- [x] **Standard HTTP Response**: Returns HTTP 429 Too Many Requests with `Retry-After: 60` and correlation `X-Request-ID`.

---

## 7. File Upload & Storage Security

- [x] **Filename Sanitization**: `sanitize_filename` strips directory traversal sequences (`..`, `/`, `\`), null bytes (`\0`), and replaces non-alphanumeric characters with underscores.
- [x] **Extension Whitelist**: Only safe document/image extensions permitted (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.txt`, `.log`, `.json`, `.zip`, `.csv`, `.docx`, `.xlsx`).
- [x] **Executable Blocklist**: Explicitly blocks executable extensions (`.exe`, `.bat`, `.sh`, `.py`, `.php`, `.js`, `.html`, `.dll`).
- [x] **Size Ceilings**: Enforces 10MB limit (Service tickets, QA bugs) and 15MB limit (Communications).
- [x] **Private Storage**: Files stored outside web root with randomized storage prefixes (`f"{uuid.uuid4().hex[:8]}_{safe_filename}"`).
- [x] **Authorized Downloads**: Downloads require valid authentication and respective domain permission (`service.view`, `bugs.view`, `communications.view`).

---

## 8. Error Handling & Traceback Masking

- [x] **Production Error Masking**: In `ENVIRONMENT=production`, the global exception handler returns:
  `{"detail": "An internal server error occurred. Please contact system administrator if this persists.", "request_id": "<uuid>"}`
- [x] **Zero Traceback Leaks**: Traceback strings, SQL statements, database credentials, and file paths are never exposed in production HTTP responses.
- [x] **Server-Side Correlation**: Unhandled exceptions are logged server-side with correlation `X-Request-ID` and request timing.

---

## 9. Structured Logging & Redaction

- [x] **Structured Access Logs**: Method, URL path, HTTP status code, duration (ms), and correlation ID logged for every request.
- [x] **Secret Redaction**: Passwords, access tokens, refresh tokens, encryption keys, and third-party API secrets are never written to log files.
- [x] **Immutable Audit Logs**: Audit trail entries (`record_audit_log`) cannot be updated or deleted via API.

---

## 10. Health Checks

- [x] **Liveness**: `GET /api/health` returns immediate 200 OK with service name and environment.
- [x] **Readiness**: `GET /api/health/readiness` executes a ping query (`SELECT 1`) against the active database and returns 200 OK or 503 Service Unavailable.

---

## 11. AI Production Safety (Phase 12)

- [x] **READ + DRAFT Guardrails**: The AI Assistant is architecturally constrained to reading data and drafting content.
- [x] **No Autonomous Mutations**: AI cannot autonomously send emails, send WhatsApp messages, modify accounting records, change tickets, or delete data.
- [x] **Audit Trail**: Every AI query records user ID, tools executed, and timestamp in the audit log.
- [x] **Financial RBAC**: Users without `accounting.view` permission are strictly blocked from retrieving financial metrics via AI.
- [x] **Prompt Limits**: Prompt length capped at 2,000 characters to protect against token exhaustion.

---

## 12. External Integrations Status Matrix

| Integration | Provider / Protocol | Implementation Status | Live Connectivity |
| :--- | :--- | :--- | :--- |
| **Email (SMTP/IMAP)** | Hostinger (`smtp.hostinger.com:465`, `imap.hostinger.com:993`) | Fully Implemented | NOT LIVE TESTED / REQUIRES PRODUCTION CREDENTIALS |
| **WhatsApp** | Meta WhatsApp Cloud API (`graph.facebook.com`) | Fully Implemented | NOT LIVE TESTED / REQUIRES PRODUCTION CREDENTIALS |
| **Phone / Telephony** | Twilio / Exotel | Abstraction Implemented (Manual logging active) | NOT CONFIGURED / REQUIRES SIP/API CREDENTIALS |
| **AI Assistant** | OpenAI (`gpt-4o-mini`) / Google Gemini | Fully Implemented (Deterministic mock active) | NOT LIVE TESTED / REQUIRES PRODUCTION API KEY |
| **Database** | PostgreSQL 16 (psycopg driver) | Fully Implemented & Configured | TESTED VIA DOCKER / LOCAL DEV USES SQLITE |
