from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.organizations.models import Company, Contact


def test_unauthenticated_request_rejected(client: TestClient):
    res = client.get("/api/v1/service/tickets")
    assert res.status_code == 401


def test_service_executive_and_manager_rbac(
    client: TestClient,
    db_session: Session,
    service_exec_headers: dict,
    service_manager_headers: dict,
    sales_headers: dict,
):
    col = Company(organization_name="RBAC Service College", code="RBAC-SVC", city="Salem")
    db_session.add(col)
    db_session.commit()
    con = Contact(company_id=col.id, name="Dean RBAC", email="dean@rbac.edu")
    db_session.add(con)
    db_session.commit()

    # 1. Service Executive creates ticket -> Success
    res = client.post("/api/v1/service/tickets", json={
        "company_id": col.id,
        "contact_id": con.id,
        "subject": "Role Based Access Verification",
        "description": "Verifying role permission matrix for service operations.",
    }, headers=service_exec_headers)
    assert res.status_code == 201
    ticket_id = res.json()["id"]

    # 2. Sales Executive cannot create categories -> Forbidden 403
    cat_res = client.post("/api/v1/service/categories", json={
        "name": "Unauthorized Category",
        "code": "UNAUTH",
    }, headers=sales_headers)
    assert cat_res.status_code == 403

    # 3. Service Manager can create categories -> 201
    mgr_cat_res = client.post("/api/v1/service/categories", json={
        "name": "Authorized Support Category",
        "code": "AUTH_SVC",
    }, headers=service_manager_headers)
    assert mgr_cat_res.status_code == 201

    # 4. Service Manager can export CSV -> 200
    export_res = client.get("/api/v1/service/export", headers=service_manager_headers)
    assert export_res.status_code == 200
    assert "Ticket Number" in export_res.text

    # 5. Sales Executive without service.export cannot export -> 403
    export_sales_res = client.get("/api/v1/service/export", headers=sales_headers)
    assert export_sales_res.status_code == 403


def test_idor_protection_invalid_ticket(client: TestClient, service_exec_headers: dict):
    # Non-existent ID returns 404
    res = client.get("/api/v1/service/tickets/00000000-0000-0000-0000-000000000000", headers=service_exec_headers)
    assert res.status_code == 404
