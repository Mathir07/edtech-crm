# EduCRM Enterprise - Higher Education Internal CRM

A real, production-ready full-stack Enterprise CRM built for an EdTech company managing college and university clients across the end-to-end institutional sales and service lifecycle.

---

## 1. Company Context & CRM Lifecycle

**Target Market**: Higher education institutions, autonomous engineering colleges, universities, and business schools.  
**Users**: Management, Sales Managers, Sales Executives, Project Managers, Engineering, QA, Client Service, and Finance teams.

**Institutional CRM Lifecycle Stages**:
```
Lead ➔ Qualification ➔ Institutional Contact ➔ Requirement Analysis ➔ Meeting & Demo 
➔ Sales Opportunity ➔ Proposal / Quotation ➔ Commercial Negotiation ➔ Contract Closure 
➔ Project Setup ➔ Delivery & Integration ➔ QA Validation ➔ Deployment Sign-off ➔ Invoicing 
➔ Payment Receipt ➔ Service & SLA Support ➔ Annual Renewal & Upsell
```

---

## 2. Technology Stack

- **Frontend**: Next.js 16.3.5 (App Router with Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS v4, Lucide Icons
- **Backend**: Python 3.11, FastAPI (REST API with OpenAPI 3.0), SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL 16 (single primary database with SQLAlchemy 2.0 & `psycopg` driver), QueuePool connection pooling (pool_size=10, max_overflow=20), Alembic migrations. Full details in [docs/POSTGRESQL_MIGRATION_GUIDE.md](file:///d:/Kiwi%20Project/crm_updated_latest/crm/docs/POSTGRESQL_MIGRATION_GUIDE.md)
- **Security**: JWT Access & Refresh token rotation, Bcrypt password hashing, fine-grained Role-Based Access Control (RBAC), HTTP Security Headers (CSP, HSTS, X-Frame-Options, etc.), In-Memory Sliding-Window Rate Limiting, File Upload Sanitization & Extension Whitelisting, Production Traceback Masking
- **Operations & Observability**: Health and readiness checks (`/api/health`, `/api/health/readiness`), Request Correlation (`X-Request-ID`), structured logging, automated backup & restore utilities (`scripts/backup_db.py`, `scripts/restore_db.py`)
- **Deployment**: Docker & Docker Compose, Nginx reverse proxy with SSL readiness


---

## 3. Modular Monolith Architecture

```
d:\kct\crm/
├── backend/
│   ├── app/
│   │   ├── core/           # Database engine, JWT security, audit service, config, deps
│   │   ├── auth/           # Login, logout, token refresh, password change
│   │   ├── users/          # Users, 11 roles, permissions, departments, teams
│   │   ├── organizations/  # Colleges & Contacts, College 360 view aggregator
│   │   ├── crm/            # Leads, lead sources, qualification, conversion
│   │   ├── sales/          # Pipelines, pipeline stages, opportunities, stage transitions
│   │   ├── activities/     # Activities, calls, follow-ups, tasks, meetings, notes
│   │   ├── dashboard/      # Real PostgreSQL statistical & chart aggregations
│   │   ├── search/         # Global search across colleges, contacts, leads, opps
│   │   ├── audit/          # Immutable enterprise audit logs
│   │   ├── seed/           # Seed script with production roles and demo institutions
│   │   ├── projects/       # Extension point: College deployment projects (Phase 3)
│   │   ├── qa/             # Extension point: QA issues & UAT sign-offs (Phase 3)
│   │   ├── service/        # Extension point: Helpdesk tickets & AMC renewals (Phase 3)
│   │   ├── accounting/     # Extension point: Invoicing & GST reconciliation (Phase 3)
│   │   ├── communication/  # Extension point: Email/WhatsApp integration (Phase 3)
│   │   ├── documents/      # Extension point: College contracts & proposals (Phase 3)
│   │   ├── notifications/  # Extension point: In-app reminders (Phase 3)
│   │   ├── reports/        # Extension point: PDF/CSV exports (Phase 3)
│   │   └── ai/             # Extension point: AI Deal Insights & scoring (Phase 3)
│   ├── alembic/            # Database schema version migrations
│   ├── tests/              # Pytest automated test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx            # Real-time PostgreSQL CRM Dashboard
│   │   │   │   ├── colleges/           # College list & College 360 profile
│   │   │   │   ├── contacts/           # Institutional contacts directory
│   │   │   │   ├── leads/              # Lead qualification & conversion
│   │   │   │   ├── pipeline/           # Sales Pipeline Kanban Board
│   │   │   │   ├── opportunities/      # Opportunities table & deal details
│   │   │   │   ├── activities/         # Activities, overdue tasks, follow-ups
│   │   │   │   ├── audit-logs/         # Audit trail viewer
│   │   │   │   └── settings/           # User profile, password change, RBAC
│   │   ├── components/
│   │   │   ├── ui/                     # Modal, Badge, EmptyState
│   │   │   ├── layout/                 # Sidebar, Topbar
│   │   │   └── search/                 # GlobalSearchModal (Ctrl+K)
│   │   └── lib/
│   │       ├── api.ts                  # Typed API client
│   │       └── auth.tsx                # AuthContext & RBAC permission checks
│   └── Dockerfile
├── nginx/
│   └── nginx.conf                      # Production reverse proxy
├── docker-compose.yml                  # Postgres, Redis, Backend, Frontend, Nginx
├── .env.example
└── README.md
```

---

## 4. Initial Roles & Role-Based Access Control (RBAC)

The system is configured with 11 initial organizational roles:
1. **Super Admin**: Unrestricted administrative and system configuration access.
2. **Management**: Executive oversight, read-all visibility, quotations approval, audit logs.
3. **Sales Manager**: Pipeline stage management, lead assignment, deal updates.
4. **Sales Executive**: College outreach, lead nurturing, demo scheduling, deal conversion.
5. **Project Manager**: College implementation and milestone management.
6. **Developer**: Technical integrations and LMS connectors.
7. **QA Engineer**: Quality testing and client acceptance validation.
8. **Service Manager**: Support ticket management, customer success, AMC renewals.
9. **Service Executive**: Helpdesk ticket resolution and daily college support.
10. **Accountant**: College invoices, GST compliance, receipt tracking.
11. **Finance Manager**: Commercial approvals, payment sign-offs, accounts receivable.

All endpoints strictly enforce permissions on the backend using the `require_permission(...)` dependency.

---

## 5. Seeded Demo Users

For immediate testing, run the seed command to create the default users (all with password `Admin@123`):

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@edtechcrm.com` | `Admin@123` |
| Sales Manager | `sales.manager@edtechcrm.com` | `Admin@123` |
| Sales Executive | `sales.exec@edtechcrm.com` | `Admin@123` |
| Project Manager | `pm@edtechcrm.com` | `Admin@123` |
| Finance Manager | `finance@edtechcrm.com` | `Admin@123` |

---

## 6. Quick Start: Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 16+ running locally on port 5432 (or via Docker)

### 1. Database Setup
Ensure PostgreSQL is running and create the database:
```sql
CREATE DATABASE edtech_crm;
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate

# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt

# Apply all Alembic migrations to PostgreSQL
alembic upgrade head

# Option A: Import existing SQLite data (if migrating from SQLite)
python scripts/migrate_sqlite_to_pg.py

# Option B: Run seed data (for fresh demo setup)
python -m app.seed.seed_data

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Backend API will be available at: `http://localhost:8000`  
Swagger UI Docs: `http://localhost:8000/api/v1/docs`

For full PostgreSQL installation, configuration, backup/restore, and cloud deployment guides, see [docs/POSTGRESQL_MIGRATION_GUIDE.md](file:///d:/Kiwi%20Project/crm_updated_latest/crm/docs/POSTGRESQL_MIGRATION_GUIDE.md).

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend Web Application will be available at: `http://localhost:3000`

---

## 7. Running via Docker Compose

To run the entire production stack (PostgreSQL + Redis + Backend + Frontend + Nginx):

```bash
# Start all containers
docker-compose up --build -d

# Verify containers are running
docker-compose ps

# Access the CRM application through Nginx reverse proxy
http://localhost
```

---

## 8. Database Migrations

Alembic manages all database schema changes:
```bash
cd backend

# Apply migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "add_new_feature"
```

---

## 9. Running Automated Tests

Run the complete backend test suite covering Authentication, RBAC permission enforcement, College CRUD, Contact CRUD, Lead qualification & conversion, Opportunity stage movements, Activities, and Audit logs:

```bash
cd backend
python -m pytest tests/ -v
```

---

## 10. Core Features Implemented

1. **Authentication & Security**:
   - Secure login, JWT issuance, refresh tokens, `/auth/me`, password changes, audit logging of login events.
2. **College / Client 360**:
   - Comprehensive institution overview, multiple contacts, active leads, opportunities, follow-up activities, chronological unified event timeline, strategic notes, and modular extension cards.
3. **Lead Management**:
   - Search, status filtering, priority filtering, inline status updater, and one-click lead conversion into an Opportunity.
4. **Sales Pipeline Kanban**:
   - Visual Kanban board with stage columns (New Lead ➔ Qualified ➔ Requirement Analysis ➔ Product Demo ➔ Proposal & Quotation ➔ Negotiation ➔ Closed Won / Closed Lost).
   - Deal cards with contract values and probabilities.
   - Stage progression controls with database persistence and audit log creation.
5. **Activities & Client Follow-ups**:
   - Filter tabs: Due Today, Overdue, Upcoming, Completed, Assigned to Me.
   - Logging calls, meetings, demos, emails, and follow-ups.
6. **CRM Dashboard**:
   - Real PostgreSQL KPI cards (Total Colleges, Active Leads, Open Deals, Pipeline Value, Won Deals, Follow-ups Today, Overdue Tasks).
   - Real-time pipeline stage breakdown and lead source performance.
7. **Global Search**:
   - Interactive search modal (`Ctrl + K`) querying Colleges, Contacts, Leads, and Opportunities with keyboard shortcuts and direct navigation.
8. **Enterprise Audit Trail**:
   - Complete log of all user actions with before/after diffs, IP addresses, and timestamps.

---

## 11. Phase 9: Communications & External Integrations

### Hostinger Email (Primary Provider)
The CRM uses **Hostinger Webmail** as its primary email provider for institutional outreach:
- **Outgoing Email**: CRM ➔ SMTP (`smtp.hostinger.com:465` SSL / `587` TLS) ➔ Hostinger ➔ Recipient
- **Incoming Email**: Recipient ➔ Hostinger ➔ IMAP (`imap.hostinger.com:993` SSL) ➔ CRM Sync
- **Company Email Domain**: `kiwicloudtech.co.in` (e.g. `info@kiwicloudtech.co.in`)

#### Official Hostinger Server Configuration
| Parameter | Setting | Protocol |
|-----------|---------|----------|
| **SMTP Server** | `smtp.hostinger.com` | SSL (Port 465) or STARTTLS (Port 587) |
| **IMAP Server** | `imap.hostinger.com` | SSL (Port 993) |
| **Authentication** | Full email address & secure mailbox password | Password / App Secret |

#### Safe Environment Variables (`.env`)
```bash
# Hostinger Email Configuration
HOSTINGER_SMTP_HOST=smtp.hostinger.com
HOSTINGER_SMTP_PORT=465
HOSTINGER_SMTP_USERNAME=info@kiwicloudtech.co.in
HOSTINGER_SMTP_PASSWORD=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>
HOSTINGER_SMTP_USE_TLS=false
HOSTINGER_SMTP_USE_SSL=true

HOSTINGER_IMAP_HOST=imap.hostinger.com
HOSTINGER_IMAP_PORT=993
HOSTINGER_IMAP_USERNAME=info@kiwicloudtech.co.in
HOSTINGER_IMAP_PASSWORD=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>
HOSTINGER_IMAP_USE_SSL=true

HOSTINGER_EMAIL_FROM=info@kiwicloudtech.co.in
HOSTINGER_EMAIL_FROM_NAME="Kiwi Cloud Tech"

# WhatsApp Business Cloud API
WHATSAPP_PROVIDER=META_CLOUD
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_TOKEN=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>
WHATSAPP_PHONE_NUMBER_ID=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>
WHATSAPP_WEBHOOK_SECRET=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>

# Telephony / SIP Provider
PHONE_PROVIDER=TWILIO
PHONE_API_URL=
PHONE_API_KEY=<SET_IN_SECURE_DEPLOYMENT_ENVIRONMENT>
```

#### Admin Connection Test
Administrators can verify connection integrity via:
`POST /api/v1/communications/integrations/email/test`
Returns safe status reports:
```json
{
  "provider": "HOSTINGER",
  "status": "NOT_CONFIGURED",
  "smtp": "NOT_CONFIGURED",
  "imap": "NOT_CONFIGURED",
  "message": "Hostinger credentials not configured in environment.",
  "email": "info@kiwicloudtech.co.in"
}
```

### WhatsApp Business Platform
- Official Meta Cloud API integration with HMAC-SHA256 webhook signature verification.
- Inbound/outbound message tracking, delivery status (`SENT`, `DELIVERED`, `READ`).
- Template variable interpolation with strict validation rejecting unresolved `{{variables}}`.

### Phone / Voice Logging
- Manual call logging with direction (`INBOUND`, `OUTBOUND`), duration (MM:SS), institutional dispositions (`PROPOSAL_REQUESTED`, `FOLLOW_UP_REQUIRED`, `RESOLVED`, `BUSY`, `NO_ANSWER`), and notes.
- Rule 55 Enforced: If no live telephony provider credentials are configured, live calling is strictly displayed as **NOT CONFIGURED** (zero fake features).

### Unified Communication Timeline
Chronological communication feed accessible across:
- **College 360**
- **Contact 360**
- Leads, Opportunities, Projects, and Tickets.
Filterable across `ALL`, `EMAIL`, `WHATSAPP`, and `PHONE`.

---

## 12. Phase 10: Reports & Management Dashboard

Phase 10 delivers a centralized, real-time institutional reporting engine and executive intelligence dashboard for Kiwi Cloud Tech CRM (`kiwicloudtech.co.in`). All reports are strictly **read-only projections** derived from authoritative domain calculations across CRM, Sales, Projects, QA, Service, Accounting, and Communications.

### Core Capabilities
1. **Executive Management Dashboard (`/reports`)**:
   - Cross-departmental KPIs spanning Pipeline Value, Weighted Pipeline, Won Revenue, Invoiced, AR, SLA Compliance %, Active Projects, Open Bugs, and Omnichannel Touchpoints.
2. **Sales & Pipeline Intelligence (`/reports/sales` & `/reports/pipeline`)**:
   - Lead ingestion, qualification rate, lead-to-opportunity conversion rate, deal win rate, and average deal size.
   - Lead Source ROI matrix and sales representative productivity tracking.
   - Stage-by-stage pipeline velocity with probability-weighted risk projections.
3. **Project Progress & Delivery Health (`/reports/projects`)**:
   - Milestones tracking, completed vs overdue tasks, delivery gating readiness, and real-time health badges (`ON_TRACK`, `AT_RISK`, `DELAYED`).
4. **QA Bugs & Testing Execution (`/reports/qa`)**:
   - Test suite execution pass rates, defect severity matrix (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and triage resolution ratios.
5. **Support Desk & SLA Compliance (`/reports/service`)**:
   - Business-hours SLA resolution and response adherence %, breach counters, ticket volume by classification, and agent caseload analysis.
6. **Financial Working Capital & AR/AP Aging (`/reports/finance`)**:
   - Double-entry general ledger reconciliations, invoice collections, outstanding receivables, vendor payables, and 4-tier aging schedules (`0-30`, `31-60`, `61-90`, `90+` days).
7. **Omnichannel Communications (`/reports/communications`)**:
   - Auditing of Hostinger SMTP/IMAP email threads, WhatsApp messages, and telephony call logs with call disposition breakdowns.
8. **Cross-Department Team Workload (`/reports/team`)**:
   - Real-time caseload matrix per employee (leads, opps, projects, tasks, tickets, logged activities) to diagnose bottlenecks.
9. **Saved Custom Reports Directory (`/reports/saved`)**:
   - Persistent report configurations with custom filter states, descriptions, and public/shared toggles.
10. **RFC-4180 Streaming CSV Exports**:
    - High-performance, streaming CSV generation for all 9 report types via `/api/v1/reports/export`.

### API Endpoints
- `GET /api/v1/reports/status` — Reports module status
- `GET /api/v1/reports/executive` — Executive management dashboard metrics
- `GET /api/v1/reports/sales` — Sales & lead sources report
- `GET /api/v1/reports/pipeline` — Sales pipeline stage breakdown
- `GET /api/v1/reports/projects` — Projects delivery health report
- `GET /api/v1/reports/qa` — QA bugs & test execution report
- `GET /api/v1/reports/service` — Support tickets & SLA compliance report
- `GET /api/v1/reports/finance` — Financial overview & AR/AP aging report
- `GET /api/v1/reports/communications` — Communications channel touchpoints report
- `GET /api/v1/reports/team` — Team workload matrix report
- `GET /api/v1/reports/export` — RFC-4180 CSV export stream
- `GET /api/v1/reports/saved` — List saved report configurations
- `POST /api/v1/reports/saved` — Save a report configuration
- `GET /api/v1/reports/saved/{id}` — Get saved report configuration
- `PUT /api/v1/reports/saved/{id}` — Update saved report configuration
- `DELETE /api/v1/reports/saved/{id}` — Delete saved report configuration

### Role-Based Access Control (RBAC)
| Permission Code | Description | Default Roles |
|---|---|---|
| `reports.view` | Access reports module and dashboard navigation | Admin, Management, Sales, Service, PM, Finance |
| `reports.view_executive` | Access Executive Cross-Departmental Dashboard | Admin, Management |
| `reports.view_sales` | Access Sales and Pipeline Reports | Admin, Management, Sales Manager, Sales Exec |
| `reports.view_projects` | Access Projects Delivery Health Report | Admin, Management, Project Manager |
| `reports.view_qa` | Access QA & Bug Execution Report | Admin, Management, QA Lead, Project Manager |
| `reports.view_service` | Access Service SLA & Ticket Report | Admin, Management, Support Manager, Support Agent |
| `reports.view_finance` | Access Financial Overview & AR/AP Aging | Admin, Management, Finance Manager, Accountant |
| `reports.view_communications`| Access Communications Touchpoint Report | Admin, Management, Sales Manager, Support Manager |
| `reports.view_team` | Access Personnel Workload Matrix | Admin, Management, Sales Manager, Support Manager |
| `reports.manage_saved` | Create, update, delete saved report configurations | Admin, Management, Managers |
| `reports.export` | Export streaming CSV reports | Admin, Management, Managers |

---

## 13. Phase 11: Automation & Notifications

### Overview
A lightweight, startup-focused internal notification center and automated background scan engine designed to prevent missed deadlines, stagnant leads, overdue invoices, SLA breaches, project slips, or critical bugs across Kiwi Cloud Tech CRM (`kiwicloudtech.co.in`).

### Key Capabilities
1. **Internal Notification Center (`/notifications`)**:
   - Real-time global Topbar bell trigger with unread badge counter and quick-action preview panel.
   - Dedicated notification center page with unread/read filters, domain type selectors, priority tags (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and search.
   - Seamless linkback navigation directly to source records (Tasks, Meetings, Leads, Opportunities, Invoices, Tickets, Projects, Bugs).
2. **Authoritative Business Automations**:
   - **Task Due & Overdue**: Scans pending tasks approaching due date within 24h or becoming overdue.
   - **Meeting Reminders**: 24h and 1h advance reminders for scheduled meetings.
   - **Lead Follow-up**: Alerts owners of untouched leads exceeding 7 days of inactivity.
   - **Opportunity Follow-up**: Flags stagnant open opportunities with no engagement for 7+ days.
   - **Invoice Reminders**: Alerts accounting & sales reps of approaching due dates (3 days/today) and overdue invoices.
   - **Payment Received**: Alerts finance teams when customer payments are recorded.
   - **Service SLA Warnings & Breaches**: Proactive warning for tickets nearing first response (30 mins) or resolution (60 mins), plus immediate escalation upon breach.
   - **Project Delays**: Flags delayed projects and overdue milestones for Project Managers.
   - **Critical QA Bug Escalation**: Immediate alerts to PMs and QA leads for CRITICAL bugs blocking release readiness.
3. **Idempotency & Deduplication Engine**:
   - Deterministic `dedup_key` generation per business event to guarantee 0 duplicate notifications upon rerun.
4. **Hostinger Email Notification Dispatch**:
   - Multi-tenant email dispatch using Hostinger SMTP with RFC 2822 MIME message formatting, safe HTML rendering, and user preference gating.
5. **Notification Preferences (`/settings/notifications`)**:
   - Granular in-app and email delivery toggles per domain category (Tasks, Meetings, Sales, Finance, Service, Projects, QA).
6. **Automation Admin Control (`/settings/automation`)**:
   - Real-time management dashboard with rule enable/disable switches, manual scan trigger button, and detailed execution audit log table.

### API Endpoints
- `GET /api/v1/notifications` — List user notifications (with filters & pagination)
- `GET /api/v1/notifications/unread-count` — Badge counter for unread alerts
- `POST /api/v1/notifications/mark-read` — Mark specific or all notifications as read
- `DELETE /api/v1/notifications/{id}` — Delete a notification
- `GET /api/v1/notifications/preferences` — Get user notification preferences
- `PUT /api/v1/notifications/preferences` — Update user notification preferences
- `GET /api/v1/automation/rules` — List all configured automation rules
- `PUT /api/v1/automation/rules/{id}/toggle` — Enable / disable an automation rule
- `PUT /api/v1/automation/rules/{id}` — Update automation rule configuration
- `POST /api/v1/automation/run` — Manually trigger automation scans (all or specific rule)
- `GET /api/v1/automation/logs` — List background automation execution history logs

### RBAC Permissions
| Permission Code | Description | Default Roles |
|---|---|---|
| `notifications.view` | Access notification center and receive business alerts | All Authenticated Roles |
| `notifications.manage` | Manage notification configurations and user preferences | Super Admin, Management |
| `automation.view` | View automation rules and scan execution history | Super Admin, Management, Department Managers |
| `automation.manage` | Enable/disable rules and manually trigger system scans | Super Admin, Management |

---

## 14. Small AI Assistant (Phase 12)

The Kiwi Cloud Tech CRM AI Assistant is a lightweight, permission-aware internal copilot operating strictly in **Read + Draft** mode. It helps employees query CRM information using natural language, summarize institutional accounts and projects, prioritize follow-ups, explain business reports, and generate communication drafts without autonomous write actions or unauthorized data leakage.

### Key Capabilities
1. **Natural-Language CRM Search & Retrieval**:
   - Translates employee inquiries into safe, permission-filtered queries across Colleges, Contacts, Leads, Opportunities, Projects, Service Tickets, QA Bugs, Invoices, and Reports.
2. **Customer / College 360 Summary**:
   - Comprehensive structured institutional summaries including active contacts, open deals, active projects, unresolved support tickets, and recent communications.
   - Strictly enforces accounting permissions: financial details and invoice balances are completely omitted for non-finance users.
3. **Authoritative Project Summaries**:
   - Summarizes milestones, task progress, and delivery readiness utilizing the authoritative `recalculate_project_progress()` and `validate_project_delivery_readiness()` calculation engines.
4. **Actionable Follow-up Assistant**:
   - Surfaces overdue tasks, scheduled meetings today, and dormant leads/opportunities untouched for > 7 days.
5. **Service & SLA Monitoring**:
   - Real-time summaries of unresolved critical tickets, approaching SLA deadlines, and breach status.
6. **QA & Quality Tracking**:
   - Instant visibility into open critical/high defects and test execution status across client deployments.
7. **Authoritative Report Explanations**:
   - Plain-English explanations grounded directly in authoritative reporting metrics across Sales, Projects, QA, Service, and Finance.
8. **Communication Drafting (Read + Draft Only)**:
   - Drafts contextual emails and WhatsApp messages for follow-ups, payment reminders, and service ticket replies.
   - Includes mandatory `[Draft Only]` warning — never transmits communications autonomously.
9. **Zero Autonomous Write Actions**:
   - The AI Assistant is prohibited from creating, updating, or deleting CRM records, recording payments, modifying accounting data, or closing bugs.
10. **Multi-Turn Context & Citation Links**:
    - Retains conversation context across follow-up queries.
    - Emits clickable markdown citations directly linking users to referenced CRM records.
11. **Provider Abstraction & Cost Controls**:
    - Pluggable provider architecture with `MockDeterministicAIProvider` for local offline/testing execution and `ExternalLLMProvider` for OpenAI/Gemini integration.
    - Hard rate limits: 2000 character prompt ceiling, max 10 tool records returned, and audit logging for every query.

### API Endpoints
- `POST /api/v1/ai/chat` — Submit query to AI Assistant with optional conversation thread ID
- `GET /api/v1/ai/conversations` — List recent conversation threads for authenticated user
- `GET /api/v1/ai/conversations/{id}` — Fetch conversation detail with full message history and citations
- `DELETE /api/v1/ai/conversations/{id}` — Delete a conversation thread
- `GET /api/v1/ai/quick-actions` — Retrieve permission-tailored quick action prompts
- `GET /api/v1/ai/status` — AI module status and provider health check

### RBAC Permissions
| Permission Code | Description | Default Roles |
|---|---|---|
| `ai.chat` | Query the AI Assistant, view conversational summaries, and draft messages | All Authenticated Staff |
| `ai.manage` | Manage AI Assistant configurations and provider settings | Super Admin, Management |

---

## 15. Production Hardening & Operations (Phase 13)

The CRM is comprehensively hardened for enterprise production deployment:

### Key Hardening Implementations
1. **HTTP Security Headers Middleware**: Injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and HSTS for production/HTTPS.
2. **Sliding-Window Rate Limiting**: In-memory rate limiting guarding authentication (`/api/v1/auth/login`: max 10 req/min), AI chat (`/api/v1/ai/chat`: max 30 req/min), and email dispatch (max 20 req/min). Returns HTTP 429 with `Retry-After: 60`.
3. **Request Correlation & Structured Logging**: Injects `X-Request-ID` across every request/response and records millisecond-precision access logs.
4. **File Upload Security & Path Traversal Protection**: Centralized `sanitize_filename` strips path traversal (`..`) and non-safe characters; `validate_uploaded_file` enforces strict extension whitelists (blocking `.exe`, `.bat`, `.sh`, `.py`, `.php`, etc.) and size limits (10MB/15MB).
5. **Database Readiness Probe**: `GET /api/health/readiness` performs an active database ping (`SELECT 1`).
6. **Production Error Masking**: Masking of internal server tracebacks, SQL statements, and database credentials in production API responses.
7. **Database Backup & Recovery Utilities**: Cross-platform utilities (`scripts/backup_db.py` and `scripts/restore_db.py`) supporting gzip compression and 14-day retention.
8. **Production Runbooks**: Detailed runbooks provided in [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md), [`docs/PRODUCTION_SECURITY_CHECKLIST.md`](docs/PRODUCTION_SECURITY_CHECKLIST.md), and [`docs/DISASTER_RECOVERY.md`](docs/DISASTER_RECOVERY.md).




