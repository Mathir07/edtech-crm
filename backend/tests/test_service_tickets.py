import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.organizations.models import Company, Contact
from app.projects.models import Project
from app.qa.models import Bug
from app.service.models import ServiceCategory, ServiceSubcategory, SLAPolicy


def test_ticket_creation_numbering_and_validation(client: TestClient, db_session: Session, service_exec_headers: dict):
    # 1. Create 2 test colleges and contacts
    col1 = Company(organization_name="IIT Bombay Tech Support", code="IITB-SVC", city="Mumbai")
    col2 = Company(organization_name="IIT Delhi Campus", code="IITD-SVC", city="New Delhi")
    db_session.add_all([col1, col2])
    db_session.commit()

    con1 = Contact(company_id=col1.id, name="Dean Academic IITB", email="dean.iitb@edu.in")
    con2 = Contact(company_id=col2.id, name="Dean Academic IITD", email="dean.iitd@edu.in")
    db_session.add_all([con1, con2])
    db_session.commit()

    # 2. Reject mismatched college and contact
    mismatched_payload = {
        "company_id": col1.id,
        "contact_id": con2.id,  # belongs to col2
        "subject": "Portal login failed for exam cell",
        "description": "Faculty unable to enter terminal marks for batch 2026.",
        "priority": "HIGH",
        "severity": "HIGH",
        "source": "PORTAL",
    }
    resp = client.post("/api/v1/service/tickets", json=mismatched_payload, headers=service_exec_headers)
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"]

    # 3. Create valid ticket
    valid_payload = {
        "company_id": col1.id,
        "contact_id": con1.id,
        "subject": "Portal login failed for exam cell",
        "description": "Faculty unable to enter terminal marks for batch 2026.",
        "priority": "HIGH",
        "severity": "HIGH",
        "source": "EMAIL",
    }
    resp = client.post("/api/v1/service/tickets", json=valid_payload, headers=service_exec_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ticket_number"].startswith("TKT-")
    assert data["company_id"] == col1.id
    assert data["status"] in ("NEW", "OPEN")
    assert data["sla_status"] == "ON_TRACK"
    ticket_id = data["id"]

    # 4. Fetch detail
    det_resp = client.get(f"/api/v1/service/tickets/{ticket_id}", headers=service_exec_headers)
    assert det_resp.status_code == 200
    det = det_resp.json()
    assert det["ticket_number"] == data["ticket_number"]
    assert det["company_name"] == "IIT Bombay Tech Support"
    assert det["contact_name"] == "Dean Academic IITB"


def test_ticket_lifecycle_status_transitions(client: TestClient, db_session: Session, service_manager_headers: dict):
    # Setup college and contact
    col = Company(organization_name="BITS Pilani Service", code="BITS-SVC", city="Pilani")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="Registrar BITS", email="reg@bits.edu.in")
    db_session.add(con)
    db_session.commit()

    # Create ticket
    payload = {
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "Single Sign-On Certificate Expired",
        "description": "SAML federation signing key expired today morning.",
        "priority": "URGENT",
        "severity": "CRITICAL",
        "source": "PORTAL",
    }
    res = client.post("/api/v1/service/tickets", json=payload, headers=service_manager_headers)
    assert res.status_code == 201
    ticket_id = res.json()["id"]

    # 1. Invalid status transition: NEW directly to CLOSED must fail
    bad_res = client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={"status": "CLOSED"}, headers=service_manager_headers)
    assert bad_res.status_code == 400
    assert "Invalid status transition" in bad_res.json()["detail"]

    # 2. Valid transition: NEW -> OPEN -> IN_PROGRESS
    client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={"status": "OPEN"}, headers=service_manager_headers)
    patch_res = client.patch(f"/api/v1/service/tickets/{ticket_id}/status", json={"status": "IN_PROGRESS"}, headers=service_manager_headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"

    # 3. Resolve ticket requires resolution summary
    empty_res = client.post(f"/api/v1/service/tickets/{ticket_id}/resolve", json={"resolution_summary": "  "}, headers=service_manager_headers)
    assert empty_res.status_code == 422 or empty_res.status_code == 400

    resolve_res = client.post(f"/api/v1/service/tickets/{ticket_id}/resolve", json={
        "resolution_summary": "Updated SAML x509 public signing cert and validated login with college IdP."
    }, headers=service_manager_headers)
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"
    assert resolve_res.json()["resolved_at"] is not None

    # 4. Customer confirmation -> CLOSED
    confirm_res = client.post(f"/api/v1/service/tickets/{ticket_id}/confirm", json={
        "customer_confirmed_by": "Dr. Sharma (Director IT)"
    }, headers=service_manager_headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "CLOSED"
    assert confirm_res.json()["customer_confirmed_by"] == "Dr. Sharma (Director IT)"

    # 5. Reopening ticket
    reopen_res = client.post(f"/api/v1/service/tickets/{ticket_id}/reopen", json={
        "reason": "Faculty still report login error on mobile browser."
    }, headers=service_manager_headers)
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "REOPENED"
    assert reopen_res.json()["reopen_count"] == 1
    assert "mobile browser" in reopen_res.json()["last_reopened_reason"]


def test_ticket_comments_and_internal_notes_visibility(client: TestClient, db_session: Session, service_manager_headers: dict, service_readonly_headers: dict):
    col = Company(organization_name="NIT Trichy Service", code="NITT-SVC", city="Trichy")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="Dean NITT", email="dean@nitt.edu")
    db_session.add(con)
    db_session.commit()

    res = client.post("/api/v1/service/tickets", json={
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "Grade card PDF formatting issue",
        "description": "Column widths truncating elective course titles.",
    }, headers=service_manager_headers)
    ticket_id = res.json()["id"]

    # 1. Add Customer Reply
    c_res = client.post(f"/api/v1/service/tickets/{ticket_id}/comments", json={
        "message": "We have received your report and are investigating the layout template.",
        "comment_type": "CUSTOMER_REPLY"
    }, headers=service_manager_headers)
    assert c_res.status_code == 201
    assert c_res.json()["comment_type"] == "CUSTOMER_REPLY"

    # 2. Add Internal Note
    in_res = client.post(f"/api/v1/service/tickets/{ticket_id}/comments", json={
        "message": "INTERNAL NOTE: Known issue with wkhtmltopdf in v2.3 release, patch dev team.",
        "comment_type": "INTERNAL_NOTE"
    }, headers=service_manager_headers)
    assert in_res.status_code == 201
    assert in_res.json()["comment_type"] == "INTERNAL_NOTE"

    # 3. Authorized Service Manager sees both comments
    comments_mgr = client.get(f"/api/v1/service/tickets/{ticket_id}/comments", headers=service_manager_headers).json()
    assert len(comments_mgr) == 2
    types = [c["comment_type"] for c in comments_mgr]
    assert "CUSTOMER_REPLY" in types
    assert "INTERNAL_NOTE" in types

    # 4. User without service.view_internal_notes does NOT see the internal note
    comments_ro = client.get(f"/api/v1/service/tickets/{ticket_id}/comments", headers=service_readonly_headers).json()
    assert len(comments_ro) == 1
    assert comments_ro[0]["comment_type"] == "CUSTOMER_REPLY"


def test_ticket_bug_linking_and_timeline(client: TestClient, db_session: Session, service_manager_headers: dict):
    col = Company(organization_name="Anna University Service", code="AU-SVC", city="Chennai")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="HOD CSE", email="hod.cse@annauniv.edu")
    db_session.add(con)
    db_session.commit()

    # Create project and bug
    prj = Project(project_number="PRJ-2026-9999", name="AU SIS Deployment", company_id=col.id)
    db_session.add(prj)
    db_session.commit()

    bug = Bug(bug_number="BUG-2026-8888", project_id=prj.id, title="PDF renderer text overflow", severity="HIGH")
    db_session.add(bug)
    db_session.commit()

    # Create ticket
    t_res = client.post("/api/v1/service/tickets", json={
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "Hall ticket print truncated",
        "description": "Hall ticket exam time is cutoff on A4 paper.",
        "project_id": prj.id,
    }, headers=service_manager_headers)
    ticket_id = t_res.json()["id"]

    # Link Bug
    link_res = client.post(f"/api/v1/service/tickets/{ticket_id}/link-bug", json={
        "bug_id": bug.id
    }, headers=service_manager_headers)
    assert link_res.status_code == 200
    assert link_res.json()["linked_bug_id"] == bug.id
    assert link_res.json()["linked_bug_number"] == "BUG-2026-8888"

    # Verify Timeline
    timeline_res = client.get(f"/api/v1/service/tickets/{ticket_id}/timeline", headers=service_manager_headers)
    assert timeline_res.status_code == 200
    events = timeline_res.json()
    assert len(events) >= 1
    types = [e["type"] for e in events]
    assert "create" in types
