import pytest
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity, Pipeline, PipelineStage
from app.activities.models import Activity, Task

def ensure_step6_fixtures(db: Session):
    """Ensure multi-segment fixtures exist for dashboard and search tests."""
    # Ensure college/company
    company = db.query(Company).filter(Company.organization_name == "KCT Global Tech Ltd").first()
    if not company:
        company = Company(
            id=str(uuid.uuid4()),
            organization_name="KCT Global Tech Ltd",
            code=f"KCT-{uuid.uuid4().hex[:6]}",
            type="Corporate / IT Services",
            industry="Information Technology",
            website="https://kctglobal.tech",
            city="Chennai",
            state="Tamil Nadu",
            status="Customer",
        )
        db.add(company)
        db.flush()

    contact = db.query(Contact).filter(Contact.email == "arun.director@kctglobal.tech").first()
    if not contact:
        contact = Contact(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name="Arun Sundaram",
            designation="Managing Director",
            email="arun.director@kctglobal.tech",
            phone="+91 94433 22110",
            status="Active",
            is_primary=True,
        )
        db.add(contact)
        db.flush()

    # Pipelines
    pipes_info = [
        ("EdTech Pipeline", "Payment", 50000.0),
        ("IT Services Pipeline", "Proposal", 350000.0),
        ("Talent / Outsourcing Pipeline", "Interview", 120000.0),
        ("Higher Education Sales Pipeline", "Negotiation", 800000.0),
    ]

    for p_name, s_name, val in pipes_info:
        pipe = db.query(Pipeline).filter(Pipeline.name == p_name).first()
        if not pipe:
            pipe = Pipeline(name=p_name, is_default=False, is_active=True)
            db.add(pipe)
            db.flush()
        stage = db.query(PipelineStage).filter(PipelineStage.pipeline_id == pipe.id, PipelineStage.name == s_name).first()
        if not stage:
            stage = PipelineStage(pipeline_id=pipe.id, name=s_name, order=1, probability=50)
            db.add(stage)
            db.flush()

        opp = db.query(Opportunity).filter(Opportunity.title == f"{p_name} Contract").first()
        if not opp:
            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=f"{p_name} Contract",
                company_id=company.id,
                contact_id=contact.id,
                pipeline_id=pipe.id,
                stage_id=stage.id,
                value=val,
                status="Open",
            )
            db.add(opp)
            db.flush()

    # Leads
    lead_today = db.query(Lead).filter(Lead.title == "Enterprise Cloud Transformation").first()
    if not lead_today:
        now = datetime.now(timezone.utc)
        lead_today = Lead(
            id=str(uuid.uuid4()),
            title="Enterprise Cloud Transformation",
            company_id=company.id,
            contact_id=contact.id,
            company_name="KCT Global Tech Ltd",
            contact_name="Arun Sundaram",
            contact_email="arun.director@kctglobal.tech",
            business_segment="IT Services",
            status="Contacted",
            next_action="Review SOW with Arun",
            next_follow_up_date=now,
        )
        db.add(lead_today)
        db.flush()

    # Tasks
    task = db.query(Task).filter(Task.title == "Prepare IT Services Proposal").first()
    if not task:
        task = Task(
            id=str(uuid.uuid4()),
            title="Prepare IT Services Proposal",
            priority="High",
            status="In Progress",
            due_date=datetime.now(timezone.utc) + timedelta(days=1),
        )
        db.add(task)
        db.flush()

    db.commit()
    return company, contact

def test_dashboard_stats_founder_kpis(client: TestClient, admin_headers: dict, db_session: Session):
    ensure_step6_fixtures(db_session)

    res = client.get("/api/v1/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()

    # Verify key founder metrics are returned
    assert "new_leads_today" in stats
    assert "new_leads_month" in stats
    assert "open_deals" in stats
    assert "open_opportunities" in stats
    assert "open_pipeline_value" in stats
    assert "pipeline_breakdown" in stats
    assert "follow_ups_today" in stats
    assert "overdue_follow_ups" in stats
    assert "overdue_actions" in stats
    assert "leads_missing_next_action" in stats
    assert "tasks_due_today" in stats
    assert "overdue_tasks" in stats
    assert "total_companies" in stats

    # Verify pipeline breakdown includes all 4 founder pipelines
    breakdown = stats["pipeline_breakdown"]
    pipe_names = [p["pipeline_name"] for p in breakdown]
    assert "EdTech Pipeline" in pipe_names
    assert "IT Services Pipeline" in pipe_names
    assert "Talent / Outsourcing Pipeline" in pipe_names
    assert "Higher Education Sales Pipeline" in pipe_names

def test_dashboard_charts_multi_segment(client: TestClient, admin_headers: dict, db_session: Session):
    ensure_step6_fixtures(db_session)

    res = client.get("/api/v1/dashboard/charts", headers=admin_headers)
    assert res.status_code == 200
    charts = res.json()

    assert "leads_by_status" in charts
    assert "leads_by_segment" in charts
    assert "deals_by_pipeline_stage" in charts
    assert "lead_source_performance" in charts

    # Check that deals_by_pipeline_stage includes pipeline info
    deals_stages = charts["deals_by_pipeline_stage"]
    assert len(deals_stages) > 0
    first_stage = deals_stages[0]
    assert "pipeline_id" in first_stage
    assert "pipeline_name" in first_stage
    assert "stage_name" in first_stage
    assert "count" in first_stage
    assert "value" in first_stage

def test_opportunity_search_by_company_and_contact(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact = ensure_step6_fixtures(db_session)

    # Search by Company name
    res_company = client.get("/api/v1/opportunities?search=KCT+Global", headers=admin_headers)
    assert res_company.status_code == 200
    opps = res_company.json()
    assert len(opps) > 0
    assert all("KCT" in (o.get("company_name") or "") or "KCT" in o["title"] for o in opps)

    # Search by Contact name
    res_contact = client.get("/api/v1/opportunities?search=Arun+Sundaram", headers=admin_headers)
    assert res_contact.status_code == 200
    contact_opps = res_contact.json()
    assert len(contact_opps) > 0

def test_companies_type_and_industry_filters(client: TestClient, admin_headers: dict, db_session: Session):
    ensure_step6_fixtures(db_session)

    # Filter by type
    res_type = client.get("/api/v1/companies?type=Corporate%20/%20IT%20Services", headers=admin_headers)
    assert res_type.status_code == 200
    data = res_type.json()
    assert len(data) > 0
    assert any(c["organization_name"] == "KCT Global Tech Ltd" for c in data)

    # Filter by industry
    res_ind = client.get("/api/v1/companies?industry=Information%20Technology", headers=admin_headers)
    assert res_ind.status_code == 200
    ind_data = res_ind.json()
    assert len(ind_data) > 0

def test_tasks_and_activities_search_and_scope(client: TestClient, admin_headers: dict, db_session: Session):
    ensure_step6_fixtures(db_session)

    # Task search
    res_task = client.get("/api/v1/tasks?search=Proposal", headers=admin_headers)
    assert res_task.status_code == 200
    tasks = res_task.json()
    assert any("Proposal" in t["title"] for t in tasks)

    # Task priority filter
    res_pri = client.get("/api/v1/tasks?priority=High", headers=admin_headers)
    assert res_pri.status_code == 200
    high_tasks = res_pri.json()
    assert all(t["priority"] == "High" for t in high_tasks)

    # Task scope open
    res_open = client.get("/api/v1/tasks?scope=open", headers=admin_headers)
    assert res_open.status_code == 200
