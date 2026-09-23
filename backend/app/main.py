from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
import app.core.models  # Ensures all models are registered

# Routers
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.organizations.router import router as organizations_router
from app.crm.router import router as crm_router
from app.sales.router import router as sales_router
from app.activities.router import router as activities_router
from app.dashboard.router import router as dashboard_router
from app.search.router import router as search_router
from app.audit.router import router as audit_router

# Extension modules
from app.projects.router import router as projects_router
from app.qa.router import router as qa_router
from app.service.router import router as service_router
from app.accounting.router import router as accounting_router
from app.communication.router import router as communication_router
from app.documents.router import router as documents_router
from app.notifications.router import router as notifications_router, automation_router
from app.reports.router import router as reports_router
from app.ai.router import router as ai_router

from contextlib import asynccontextmanager
from sqlalchemy import text
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RequestCorrelationMiddleware,
    RateLimitMiddleware,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # In development, ensure core tables exist if starting with an empty database.
    # In production, schema changes must be driven exclusively via Alembic migrations.
    if settings.ENVIRONMENT == "development":
        Base.metadata.create_all(bind=engine)
    yield

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# 1. Rate Limiting Middleware (innermost application boundary)
app.add_middleware(RateLimitMiddleware)

# 2. Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# 3. Request Correlation & Structured Logging Middleware
app.add_middleware(RequestCorrelationMiddleware)

# 4. CORS Configuration
cors_origins = settings.BACKEND_CORS_ORIGINS
allow_creds = True
if "*" in cors_origins:
    allow_creds = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler (Masks internal tracebacks in production)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    content = {
        "detail": "An internal server error occurred. Please contact system administrator if this persists.",
        "request_id": req_id,
    }
    if settings.ENVIRONMENT == "development":
        content["type"] = type(exc).__name__
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
        headers={"X-Request-ID": req_id},
    )

# Liveness Check
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }

# Readiness Check (Verifies database connectivity)
@app.get("/health/readiness", tags=["Health"])
@app.get("/api/health/readiness", tags=["Health"])
def readiness_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": settings.PROJECT_NAME,
                "database": "disconnected",
                "environment": settings.ENVIRONMENT,
            },
        )

    return {
        "status": "ready",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "environment": settings.ENVIRONMENT,
    }

# Register Core API Routers under /api/v1
api_v1_prefix = settings.API_V1_STR

app.include_router(auth_router, prefix=f"{api_v1_prefix}/auth", tags=["Auth"])
app.include_router(users_router, prefix=api_v1_prefix, tags=["Users & RBAC"])
app.include_router(organizations_router, prefix=api_v1_prefix, tags=["Companies & Contacts"])
app.include_router(crm_router, prefix=api_v1_prefix, tags=["Leads & Sources"])
app.include_router(sales_router, prefix=api_v1_prefix, tags=["Pipelines & Opportunities"])
app.include_router(projects_router, prefix=api_v1_prefix, tags=["Projects & Milestones"])
app.include_router(qa_router, prefix=api_v1_prefix, tags=["QA & Bugs"])
app.include_router(service_router, prefix=api_v1_prefix, tags=["Service & Support"])
app.include_router(accounting_router, prefix=api_v1_prefix, tags=["Accounting & Finance"])
app.include_router(communication_router, prefix=f"{api_v1_prefix}/communications", tags=["Communications"])
app.include_router(communication_router, prefix=f"{api_v1_prefix}/communication", tags=["Communications"])
app.include_router(activities_router, prefix=api_v1_prefix, tags=["Activities, Tasks & Meetings"])
app.include_router(dashboard_router, prefix=api_v1_prefix, tags=["CRM Dashboard"])
app.include_router(search_router, prefix=api_v1_prefix, tags=["Global Search"])
app.include_router(audit_router, prefix=api_v1_prefix, tags=["Audit Logs"])
app.include_router(reports_router, prefix=f"{api_v1_prefix}/reports", tags=["Reports & Analytics"])
app.include_router(notifications_router, prefix=f"{api_v1_prefix}/notifications", tags=["Notifications"])
app.include_router(automation_router, prefix=f"{api_v1_prefix}/automation", tags=["Automation"])
app.include_router(ai_router, prefix=f"{api_v1_prefix}/ai", tags=["AI Assistant"])

# Register Extension Point Routers
app.include_router(projects_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Projects"])
app.include_router(qa_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - QA"])
app.include_router(service_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Service"])
app.include_router(accounting_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Accounting"])
app.include_router(communication_router, prefix=f"{api_v1_prefix}/extensions/communication", tags=["Extensions - Communication"])
app.include_router(documents_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Documents"])
app.include_router(notifications_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Notifications"])
app.include_router(reports_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - Reports"])
app.include_router(ai_router, prefix=f"{api_v1_prefix}/extensions", tags=["Extensions - AI"])
