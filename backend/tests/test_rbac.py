from fastapi.testclient import TestClient

def test_rbac_sales_exec_forbidden_to_create_company(client: TestClient, sales_headers: dict):
    # Sales executive only has crm.companies.view, not crm.companies.create
    response = client.post(
        "/api/v1/companies",
        headers=sales_headers,
        json={
            "organization_name": "Unauthorized College Test",
            "code": "TEST-UNAUTH-01",
            "type": "Engineering College",
        },
    )
    assert response.status_code == 403
    assert "Permission denied" in response.json()["detail"]

def test_rbac_admin_allowed_to_create_college(client: TestClient, admin_headers: dict):
    response = client.post(
        "/api/v1/companies",
        headers=admin_headers,
        json={
            "organization_name": "Admin Authorized College",
            "code": "TEST-AUTH-ADMIN",
            "type": "University",
        },
    )
    assert response.status_code == 200
    assert response.json()["code"] == "TEST-AUTH-ADMIN"
