import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

def test_reports_status(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/reports/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["module"] == "reports"
    assert data["status"] == "active"


def test_executive_dashboard(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/reports/executive", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "crm" in data
    assert "sales" in data
    assert "pipeline_stages" in data
    assert "projects" in data
    assert "qa" in data
    assert "service" in data
    assert "finance" in data
    assert "communications" in data

    assert isinstance(data["crm"]["total_leads"], int)
    assert isinstance(data["crm"]["lead_conversion_rate"], float)
    assert isinstance(data["sales"]["quotations_value"], float)
    assert isinstance(data["finance"]["total_invoiced"], float)
    assert isinstance(data["finance"]["outstanding_receivables"], float)


def test_sales_and_pipeline_reports(client: TestClient, admin_headers: dict):
    # Test sales report
    resp = client.get("/api/v1/reports/sales", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "lead_sources" in data
    assert "owner_performance" in data
    assert "stages" in data
    assert isinstance(data["total_leads"], int)

    # Test pipeline report
    resp_pipe = client.get("/api/v1/reports/pipeline", headers=admin_headers)
    assert resp_pipe.status_code == 200
    pipe_data = resp_pipe.json()
    assert "total_pipeline_value" in pipe_data
    assert "weighted_pipeline_value" in pipe_data
    assert "stages" in pipe_data


def test_projects_and_qa_reports(client: TestClient, admin_headers: dict):
    # Test projects report
    resp_proj = client.get("/api/v1/reports/projects", headers=admin_headers)
    assert resp_proj.status_code == 200
    p_data = resp_proj.json()
    assert "total_projects" in p_data
    assert "average_progress" in p_data
    assert "projects" in p_data
    for p in p_data["projects"]:
        assert "health" in p
        assert p["health"] in ["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED"]

    # Test QA report
    resp_qa = client.get("/api/v1/reports/qa", headers=admin_headers)
    assert resp_qa.status_code == 200
    qa_data = resp_qa.json()
    assert "total_test_suites" in qa_data
    assert "total_test_cases" in qa_data
    assert "pass_rate" in qa_data
    assert "bugs_by_severity" in qa_data
    assert "bugs_by_status" in qa_data


def test_service_and_finance_reports(client: TestClient, admin_headers: dict):
    # Test service report
    resp_svc = client.get("/api/v1/reports/service", headers=admin_headers)
    assert resp_svc.status_code == 200
    svc_data = resp_svc.json()
    assert "total_tickets" in svc_data
    assert "sla_compliance_rate" in svc_data
    assert "tickets_by_category" in svc_data

    # Test finance report
    resp_fin = client.get("/api/v1/reports/finance", headers=admin_headers)
    assert resp_fin.status_code == 200
    fin_data = resp_fin.json()
    assert "total_invoiced" in fin_data
    assert "total_collected" in fin_data
    assert "ar_aging" in fin_data
    assert "ap_aging" in fin_data
    assert "current_0_30" in fin_data["ar_aging"]
    assert "total_outstanding" in fin_data["ar_aging"]


def test_communications_and_team_reports(client: TestClient, admin_headers: dict):
    # Test communications report
    resp_comm = client.get("/api/v1/reports/communications", headers=admin_headers)
    assert resp_comm.status_code == 200
    c_data = resp_comm.json()
    assert "total_communications" in c_data
    assert "emails_sent" in c_data
    assert "channels" in c_data
    assert "call_dispositions" in c_data

    # Test team workload report
    resp_team = client.get("/api/v1/reports/team", headers=admin_headers)
    assert resp_team.status_code == 200
    team_data = resp_team.json()
    assert "total_members" in team_data
    assert "members" in team_data
    if team_data["members"]:
        m = team_data["members"][0]
        assert "user_name" in m
        assert "assigned_leads" in m
        assert "assigned_tasks" in m


def test_saved_reports_lifecycle(client: TestClient, admin_headers: dict):
    # 1. Create a saved report
    payload = {
        "name": "Executive Weekly Overview",
        "description": "Weekly management metrics",
        "report_type": "EXECUTIVE",
        "filters_json": {"date_preset": "THIS_WEEK"},
        "columns_json": ["crm", "sales", "finance"],
        "is_favorite": True,
        "is_shared": True,
    }
    create_resp = client.post("/api/v1/reports/saved", json=payload, headers=admin_headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    report_id = created["id"]
    assert created["name"] == "Executive Weekly Overview"
    assert created["report_type"] == "EXECUTIVE"

    # 2. List saved reports
    list_resp = client.get("/api/v1/reports/saved", headers=admin_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(r["id"] == report_id for r in items)

    # 3. Get single saved report
    get_resp = client.get(f"/api/v1/reports/saved/{report_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == report_id

    # 4. Update saved report
    update_resp = client.put(
        f"/api/v1/reports/saved/{report_id}",
        json={"name": "Updated Executive Overview", "is_favorite": False},
        headers=admin_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Executive Overview"
    assert update_resp.json()["is_favorite"] is False

    # 5. Delete saved report
    del_resp = client.delete(f"/api/v1/reports/saved/{report_id}", headers=admin_headers)
    assert del_resp.status_code == 204

    # 6. Verify deleted
    get_del = client.get(f"/api/v1/reports/saved/{report_id}", headers=admin_headers)
    assert get_del.status_code == 404


def test_csv_export(client: TestClient, admin_headers: dict):
    for r_type in ["EXECUTIVE", "SALES", "PIPELINE", "PROJECTS", "QA", "SERVICE", "FINANCE", "COMMUNICATIONS", "TEAM"]:
        resp = client.get(f"/api/v1/reports/export?report_type={r_type}", headers=admin_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert f"attachment; filename=" in resp.headers.get("content-disposition", "")
        assert len(resp.text) > 0


def test_date_preset_filtering(client: TestClient, admin_headers: dict):
    for preset in ["TODAY", "YESTERDAY", "THIS_WEEK", "LAST_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR", "CUSTOM"]:
        resp = client.get(f"/api/v1/reports/executive?date_preset={preset}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["period_label"] is not None


def test_reports_rbac_enforcement(client: TestClient):
    # Requesting without authorization token returns 401
    resp = client.get("/api/v1/reports/executive")
    assert resp.status_code in [401, 403]

    resp_exp = client.get("/api/v1/reports/export?report_type=EXECUTIVE")
    assert resp_exp.status_code in [401, 403]
