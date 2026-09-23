from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission, require_any_permission, get_current_user
from app.core.audit import record_audit_log
from app.users.models import User

from app.reports.models import SavedReport
from app.reports.schemas import (
    ReportFilterParams,
    ExecutiveDashboardResponse,
    SalesReportResponse,
    PipelineReportResponse,
    ProjectsReportResponse,
    QAReportResponse,
    ServiceReportResponse,
    FinanceReportResponse,
    CommunicationsReportResponse,
    TeamWorkloadReportResponse,
    SavedReportCreate,
    SavedReportUpdate,
    SavedReportResponse,
    LeadsReportResponse,
    ActivitiesReportResponse,
    TasksReportResponse,
)
from app.reports.service import (
    get_executive_dashboard,
    get_sales_report,
    get_pipeline_report,
    get_projects_report,
    get_qa_report,
    get_service_report,
    get_finance_report,
    get_communications_report,
    get_team_workload_report,
    get_leads_report,
    get_activities_report,
    get_tasks_report,
    export_report_csv,
)

router = APIRouter()


# =====================================================================
# 1. STATUS ENDPOINT
# =====================================================================

@router.get("/status", tags=["Reports & Analytics"])
@router.get("/reports/status", tags=["Reports & Analytics"])
def reports_extension_status():
    """Module extension status for Reports & Management Dashboard."""
    return {"module": "reports", "status": "active", "version": "2.0"}


# =====================================================================
# 2. EXECUTIVE & DOMAIN REPORTS
# =====================================================================

@router.get("/executive", response_model=ExecutiveDashboardResponse, tags=["Reports & Analytics"])
def get_executive_management_dashboard(
    date_preset: Optional[str] = Query(None, description="Preset date range (e.g. THIS_MONTH, THIS_QUARTER, THIS_YEAR)"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_executive"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        owner_id=owner_id,
    )
    return get_executive_dashboard(db, filters)


@router.get("/sales", response_model=SalesReportResponse, tags=["Reports & Analytics"])
def get_sales_analytics_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_sales"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        owner_id=owner_id,
    )
    return get_sales_report(db, filters)


@router.get("/pipeline", response_model=PipelineReportResponse, tags=["Reports & Analytics"])
def get_pipeline_analytics_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_sales"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        owner_id=owner_id,
    )
    return get_pipeline_report(db, filters)


@router.get("/leads", response_model=LeadsReportResponse, tags=["Reports & Analytics"])
def get_leads_operational_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    segment: Optional[str] = Query(None, description="Actual business segment (EdTech, IT Services, Talent)"),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_sales"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        owner_id=owner_id,
        segment=segment,
        status=status,
    )
    return get_leads_report(db, filters)


@router.get("/activities", response_model=ActivitiesReportResponse, tags=["Reports & Analytics"])
def get_activities_operational_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_team"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
    )
    return get_activities_report(db, filters)


@router.get("/tasks", response_model=TasksReportResponse, tags=["Reports & Analytics"])
def get_tasks_operational_report(
    owner_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_team", "reports.view_projects"])),
):
    filters = ReportFilterParams(
        owner_id=owner_id,
        status=status,
    )
    return get_tasks_report(db, filters)



@router.get("/projects", response_model=ProjectsReportResponse, tags=["Reports & Analytics"])
def get_projects_analytics_report(
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_projects"])),
):
    filters = ReportFilterParams(company_id=company_id, owner_id=owner_id)
    return get_projects_report(db, filters)


@router.get("/qa", response_model=QAReportResponse, tags=["Reports & Analytics"])
def get_qa_analytics_report(
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_qa"])),
):
    filters = ReportFilterParams(company_id=company_id)
    return get_qa_report(db, filters)


@router.get("/service", response_model=ServiceReportResponse, tags=["Reports & Analytics"])
def get_service_analytics_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_service"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
    )
    return get_service_report(db, filters)


@router.get("/finance", response_model=FinanceReportResponse, tags=["Reports & Analytics"])
def get_finance_analytics_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view_finance")),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
    )
    return get_finance_report(db, filters)


@router.get("/communications", response_model=CommunicationsReportResponse, tags=["Reports & Analytics"])
def get_communications_analytics_report(
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_communications"])),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
    )
    return get_communications_report(db, filters)


@router.get("/team", response_model=TeamWorkloadReportResponse, tags=["Reports & Analytics"])
def get_team_workload_analytics_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.view_team"])),
):
    filters = ReportFilterParams()
    return get_team_workload_report(db, filters)


# =====================================================================
# 3. CSV EXPORT ENDPOINT
# =====================================================================

@router.get("/export", tags=["Reports & Analytics"])
def export_report_to_csv(
    report_type: str = Query("EXECUTIVE", description="EXECUTIVE, SALES, PIPELINE, PROJECTS, QA, SERVICE, FINANCE, COMMUNICATIONS, TEAM, LEADS, ACTIVITIES, TASKS"),
    date_preset: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    company_id: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.export")),
):
    filters = ReportFilterParams(
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        owner_id=owner_id,
        segment=segment,
    )

    # Record audit log
    record_audit_log(
        db=db,
        action="EXPORT",
        entity_type="Report",
        entity_id=report_type.upper(),
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"report_type": report_type, "filters": filters.model_dump(mode="json", exclude_none=True)},
        request=request,
    )

    return export_report_csv(db, report_type, filters)


# =====================================================================
# 4. SAVED REPORTS CRUD
# =====================================================================

def _format_saved_report(sr: SavedReport) -> SavedReportResponse:
    res = SavedReportResponse.model_validate(sr)
    res.creator_name = sr.created_by.full_name if sr.created_by else None
    return res


@router.get("/saved", response_model=List[SavedReportResponse], tags=["Reports - Saved"])
def list_saved_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.manage_saved"])),
):
    reports = db.query(SavedReport).filter(
        (SavedReport.created_by_id == current_user.id) | (SavedReport.is_shared == True)
    ).order_by(SavedReport.is_favorite.desc(), SavedReport.updated_at.desc()).all()
    return [_format_saved_report(r) for r in reports]


@router.post("/saved", response_model=SavedReportResponse, status_code=status.HTTP_201_CREATED, tags=["Reports - Saved"])
def create_saved_report(
    data: SavedReportCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.manage_saved")),
):
    report = SavedReport(
        name=data.name,
        description=data.description,
        report_type=data.report_type.upper(),
        filters_json=data.filters_json or {},
        columns_json=data.columns_json,
        is_favorite=data.is_favorite,
        is_shared=data.is_shared,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="SavedReport",
        entity_id=report.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"name": report.name, "report_type": report.report_type},
        request=request,
    )
    return _format_saved_report(report)


@router.get("/saved/{report_id}", response_model=SavedReportResponse, tags=["Reports - Saved"])
def get_saved_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["reports.view", "reports.manage_saved"])),
):
    report = db.query(SavedReport).filter(SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved report not found")
    if report.created_by_id != current_user.id and not report.is_shared:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this saved report")
    return _format_saved_report(report)


@router.put("/saved/{report_id}", response_model=SavedReportResponse, tags=["Reports - Saved"])
def update_saved_report(
    report_id: str,
    data: SavedReportUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.manage_saved")),
):
    report = db.query(SavedReport).filter(SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved report not found")
    if report.created_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator or admin can modify saved report")

    before_state = {"name": report.name, "report_type": report.report_type}

    if data.name is not None:
        report.name = data.name
    if data.description is not None:
        report.description = data.description
    if data.filters_json is not None:
        report.filters_json = data.filters_json
    if data.columns_json is not None:
        report.columns_json = data.columns_json
    if data.is_favorite is not None:
        report.is_favorite = data.is_favorite
    if data.is_shared is not None:
        report.is_shared = data.is_shared

    report.updated_by_id = current_user.id
    db.commit()
    db.refresh(report)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="SavedReport",
        entity_id=report.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=before_state,
        new_values={"name": report.name, "report_type": report.report_type},
        request=request,
    )
    return _format_saved_report(report)


@router.delete("/saved/{report_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Reports - Saved"])
def delete_saved_report(
    report_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.manage_saved")),
):
    report = db.query(SavedReport).filter(SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved report not found")
    if report.created_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator or admin can delete saved report")

    db.delete(report)
    db.commit()

    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="SavedReport",
        entity_id=report_id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    return None
