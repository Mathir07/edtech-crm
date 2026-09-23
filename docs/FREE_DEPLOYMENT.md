# Free Deployment Guide: Kiwi Cloud Tech CRM

This guide provides end-to-end instructions for deploying the Kiwi Cloud Tech CRM completely on **free-tier cloud services**:
- **Frontend:** [Vercel Hobby (Free)](https://vercel.com/mathi8) — Next.js
- **Backend:** [Render Free Web Service](https://render.com) — FastAPI
- **Database:** [Neon Serverless Postgres](https://neon.tech) / [Supabase](https://supabase.com) (or Render Free PostgreSQL)
- **Source Control:** [GitHub: Mathir07/edtech-crm](https://github.com/Mathir07/edtech-crm)
- **Target Custom Domains:**
  - Frontend: `https://crm.kiwicloudtech.co.in`
  - Backend API: `https://api.crm.kiwicloudtech.co.in`

---

## Architecture Overview

```text
User Browser
    │
    ├──> https://crm.kiwicloudtech.co.in (or https://*.vercel.app)
    │    └── Hosted on Vercel Hobby Free (Next.js 15)
    │
    └──> Direct API calls (REST / JSON / Blobs)
         │
         ▼
    https://api.crm.kiwicloudtech.co.in (or https://*.onrender.com)
    └── Hosted on Render Free Web Service (FastAPI + Uvicorn)
         │
         ▼
    PostgreSQL Database (Neon / Supabase / Render Free Postgres)
```

---

## Step 1: Push Code to GitHub

Ensure all recent production hardening changes are committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "Production hardening: centralized API, health checks, Render & Vercel config"
git push origin main
```

Verify your repository contains the updated code at `https://github.com/Mathir07/edtech-crm`.

---

## Step 2: Set Up a Free PostgreSQL Database

FastAPI in production requires PostgreSQL. SQLite is not safe for production due to ephemeral file systems on free cloud platforms.

### Recommended: Neon Serverless Postgres (Generous Free Tier)
1. Sign up at [neon.tech](https://neon.tech) (free forever, 0.5 GB storage, no 30-day deletion).
2. Create a new project (e.g. `kiwi-crm-db`).
3. Under **Dashboard**, copy your Connection Details. Select **Pooled connection** or direct connection string:
   ```text
   postgresql://username:password@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Note: Our backend automatically converts `postgres://` or `postgresql://` to `postgresql+psycopg://` for SQLAlchemy 2 compatibility.

*(Alternative: Supabase free PostgreSQL or Render Free PostgreSQL)*

---

## Step 3: Deploy Backend on Render Free

### Option A: Using the Render Dashboard (Manual Web Service)

1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub account and choose repository `Mathir07/edtech-crm`.
4. Configure the Web Service:
   - **Name:** `kiwi-crm-api` (or preferred name)
   - **Region:** Choose closest to your users (e.g., `Singapore` or `Frankfurt`)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free`
5. Expand **Advanced** -> **Health Check Path**:
   - Set to: `/health`
6. Add **Environment Variables**:

| Variable | Value / Description |
| :--- | :--- |
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | Generate a 64-char hex string (e.g., run `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `DATABASE_URL` | Your PostgreSQL connection string from Neon / Supabase |
| `CORS_ORIGINS` | `https://crm.kiwicloudtech.co.in,http://localhost:3000` *(Add your Vercel preview domain here once deployed)* |
| `ALLOW_SQLITE_IN_PRODUCTION` | `False` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `PYTHONUNBUFFERED` | `1` |

7. Click **Create Web Service**.
8. Once built and deployed, Render will provide a service URL:
   `https://kiwi-crm-api.onrender.com`
9. Test the deployment:
   - Visit `https://kiwi-crm-api.onrender.com/health` in your browser.
   - You should receive: `{"status":"healthy","service":"crm-backend","environment":"production"}`.

### Option B: Using `render.yaml` (Blueprint)
The repository includes a pre-configured `render.yaml`. In Render, select **Blueprints** -> Connect `Mathir07/edtech-crm` -> Click **Apply**.

---

## Step 4: Deploy Frontend on Vercel Hobby (Free)

1. Log in to [vercel.com/mathi8](https://vercel.com/mathi8).
2. Click **Add New...** -> **Project**.
3. Import Git Repository: `Mathir07/edtech-crm`.
4. Configure the Project:
   - **Project Name:** `kiwi-crm-frontend` (or `edtech-crm`)
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and select `frontend`.
5. Under **Environment Variables**, add:

| Name | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://kiwi-crm-api.onrender.com/api/v1` | **CRITICAL:** Use your Render backend URL + `/api/v1` |

6. Click **Deploy**.
7. Vercel will build and deploy the Next.js app in ~60-90 seconds and assign a URL:
   `https://kiwi-crm-frontend-mathi8.vercel.app`

---

## Step 5: Close the CORS Loop

Now that your Vercel frontend URL exists, you must authorize it on your Render backend:

1. Go to your **Render Dashboard** -> `kiwi-crm-api` -> **Environment**.
2. Update `CORS_ORIGINS` to include your Vercel domain:
   ```text
   https://kiwi-crm-frontend-mathi8.vercel.app,https://crm.kiwicloudtech.co.in,http://localhost:3000
   ```
3. Save changes. Render will automatically redeploy the backend with the new CORS permissions.

---

## Step 6: Connect Custom Domains (`kiwicloudtech.co.in`)

### 1. Frontend Domain (`crm.kiwicloudtech.co.in`)
1. In your **Vercel Dashboard**, go to **Settings** -> **Domains**.
2. Enter `crm.kiwicloudtech.co.in` and click **Add**.
3. Vercel will provide DNS instructions:
   - Type: `CNAME`
   - Name / Host: `crm`
   - Value / Target: `cname.vercel-dns.com`
4. Log in to your DNS registrar (GoDaddy, Cloudflare, Namecheap, etc.) and add the CNAME record.
5. Vercel will automatically provision a free SSL certificate via Let's Encrypt once DNS propagates.

### 2. Backend Domain (`api.crm.kiwicloudtech.co.in`)
1. In your **Render Dashboard**, go to **Settings** -> **Custom Domains**.
2. Click **Add Custom Domain** and enter `api.crm.kiwicloudtech.co.in`.
3. In your DNS registrar, add:
   - Type: `CNAME`
   - Name / Host: `api.crm`
   - Value / Target: `kiwi-crm-api.onrender.com`
4. Click **Verify** in Render. Render will automatically issue an SSL certificate.

### 3. Update Vercel & Render for Custom Domains
1. In **Render Dashboard**, ensure `CORS_ORIGINS` includes:
   `https://crm.kiwicloudtech.co.in,https://kiwi-crm-frontend-mathi8.vercel.app`
2. In **Vercel Dashboard**, go to **Settings** -> **Environment Variables**.
3. Update `NEXT_PUBLIC_API_URL` to:
   `https://api.crm.kiwicloudtech.co.in/api/v1`
4. Go to **Deployments** -> Click **...** on the latest deployment -> **Redeploy** (to bake in the new `NEXT_PUBLIC_API_URL` during build).

---

## Step 7: Free-Tier Limitations & Recommendations

### 1. Render Free Inactivity Spin-Down (Cold Starts)
- **Behavior:** Render free web services spin down after 15 minutes of inactivity. The first incoming request will take 30 to 50 seconds to wake up the server.
- **Solution:** 
  - To prevent sleep during business hours, you can set up a free uptime monitor (such as [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)) to ping `https://api.crm.kiwicloudtech.co.in/health` every 10 minutes.

### 2. Ephemeral Local File Storage on Render Free
- **Behavior:** Render free instances do not persist local disk storage across restarts or redeploys. Files saved in `storage/` or `uploads/` (such as bug attachments, ticket attachments, or email attachments) will be lost when the instance restarts.
- **Production Recommendation:**
  - For zero-cost persistent object storage, configure **Cloudflare R2** (10 GB free storage, zero egress bandwidth fees, S3-compatible API) or **AWS S3 Free Tier** (5 GB free for 12 months).

### 3. Database Free Limits
- Neon free tier provides 0.5 GB of storage. Make sure to monitor database size under Neon metrics.
- Keep regular SQL backups (`pg_dump`) of your database.

---

## Verification & Sanity Checklist

| Check | Expected Result | Verified? |
| :--- | :--- | :--- |
| `GET https://api.crm.../health` | Returns `200 OK` with JSON status | [ ] |
| `GET https://api.crm.../health/readiness` | Returns `200 OK` (`database: ok`) | [ ] |
| Frontend Load | Next.js dashboard loads without console errors | [ ] |
| Login Flow | Returns JWT access & refresh tokens stored in cookies/storage | [ ] |
| Authenticated File Export | Leads/Contacts/Reports CSV download triggers native file save | [ ] |
| File Upload | Leads/Contacts CSV import processes successfully | [ ] |
| CORS Preflight | Browser console has no `Access-Control-Allow-Origin` blocked errors | [ ] |
