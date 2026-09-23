from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.organizations.models import Company, Contact
from app.service.models import SLAPolicy, Ticket
from app.service.calculations import add_business_minutes, update_ticket_sla_lifecycle


def test_business_hours_minute_calculations():
    # Thursday 10:00 AM UTC (3:30 PM IST)
    # Add 120 minutes: should be completed today or tomorrow morning
    dt = datetime(2026, 9, 17, 10, 0, 0, tzinfo=timezone.utc)
    res = add_business_minutes(dt, 120, business_hours_only=True, timezone_str="Asia/Kolkata")
    assert res > dt


def test_sla_pause_and_resume_on_waiting_customer(client: TestClient, db_session: Session, service_manager_headers: dict):
    col = Company(organization_name="SLA Test College", code="SLA-COL", city="Coimbatore")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="Dean SLA", email="dean@sla.edu")
    db_session.add(con)
    db_session.commit()

    # Create policy: 60m response, 480m resolution
    policy = SLAPolicy(
        name="Unit Test Standard Policy",
        priority="MEDIUM",
        severity="MEDIUM",
        first_response_minutes=60,
        resolution_minutes=480,
        business_hours_only=False,
    )
    db_session.add(policy)
    db_session.commit()

    # Create ticket
    t_res = client.post("/api/v1/service/tickets", json={
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "SLA Pause Verification",
        "description": "Checking timer pause when awaiting customer response.",
        "priority": "MEDIUM",
        "severity": "MEDIUM",
    }, headers=service_manager_headers)
    assert t_res.status_code == 201
    ticket_id = t_res.json()["id"]

    initial_detail = client.get(f"/api/v1/service/tickets/{ticket_id}", headers=service_manager_headers).json()
    initial_due_at = datetime.fromisoformat(initial_detail["due_at"])

    # Advance to IN_PROGRESS
    client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={"status": "OPEN"}, headers=service_manager_headers)
    client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={"status": "IN_PROGRESS"}, headers=service_manager_headers)

    # 1. Move to WAITING_FOR_CUSTOMER: SLA should be paused
    pause_res = client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={
        "status": "WAITING_FOR_CUSTOMER",
        "reason": "Requested sample screenshot from college IT officer."
    }, headers=service_manager_headers)
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "WAITING_FOR_CUSTOMER"
    assert pause_res.json()["sla_status"] == "PAUSED"
    assert pause_res.json()["sla_paused_at"] is not None

    # Simulate elapsed paused time in database
    ticket = db_session.query(Ticket).filter(Ticket.id == ticket_id).first()
    ticket.sla_paused_at = datetime.now(timezone.utc) - timedelta(minutes=45)
    db_session.commit()

    # 2. Resume ticket to IN_PROGRESS: SLA should resume and extend due_at
    resume_res = client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={
        "status": "IN_PROGRESS",
        "reason": "College provided required screenshots."
    }, headers=service_manager_headers)
    assert resume_res.status_code == 200
    resumed = resume_res.json()
    assert resumed["status"] == "IN_PROGRESS"
    assert resumed["sla_status"] in ("ON_TRACK", "AT_RISK")
    assert resumed["total_paused_minutes"] >= 45

    resumed_due_at = datetime.fromisoformat(resumed["due_at"])
    # The resolution deadline must have extended by at least 45 minutes
    assert resumed_due_at > initial_due_at


def test_sla_breach_detection(client: TestClient, db_session: Session, service_manager_headers: dict):
    col = Company(organization_name="Breach Test College", code="BRCH-COL", city="Madurai")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="Dean Breach", email="dean@brch.edu")
    db_session.add(con)
    db_session.commit()

    # Create ticket
    t_res = client.post("/api/v1/service/tickets", json={
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "Breach Evaluation Ticket",
        "description": "Testing that overdue tickets trigger breached flag.",
    }, headers=service_manager_headers)
    ticket_id = t_res.json()["id"]

    # Artificially set due_at in the past
    ticket = db_session.query(Ticket).filter(Ticket.id == ticket_id).first()
    ticket.due_at = datetime.now(timezone.utc) - timedelta(minutes=30)
    db_session.commit()

    # Fetch detail which triggers update_ticket_sla_lifecycle
    detail = client.get(f"/api/v1/service/tickets/{ticket_id}", headers=service_manager_headers).json()
    assert detail["sla_status"] == "BREACHED"
    assert detail["sla_breached"] is True
    assert detail["sla_breached_at"] is not None
