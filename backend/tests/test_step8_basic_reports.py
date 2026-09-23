import pytest
from fastapi.testclient import TestClient


def test_leads_operational_report(client: TestClient, admin_headers: dict):
    res = client.get("/api/v1/reports/leads", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_leads" in data
    assert "new_leads" in data
    assert "qualified_leads" in data
    assert "converted_leads" in data
    assert "lost_unqualified_leads" in data
    assert "follow_ups_due_today" in data
    assert "overdue_follow_ups" in data
    assert "leads_by_segment" in data
    assert "leads_by_source" in data
    assert "leads_by_owner" in data
    assert "leads_by_status" in data
    assert isinstance(data["leads_by_segment"], list)


def test_activities_operational_report(client: TestClient, admin_headers: dict):
    res = client.get("/api/v1/reports/activities", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_activities" in data
    assert "completed_activities" in data
    assert "pending_activities" in data
    assert "follow_ups_due_today" in data
    assert "overdue_follow_ups" in data
    assert "activities_by_type" in data
    assert "activities_by_owner" in data
    assert isinstance(data["activities_by_type"], list)


def test_tasks_operational_report(client: TestClient, admin_headers: dict):
    res = client.get("/api/v1/reports/tasks", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert "total_tasks" in data
    assert "open_tasks" in data
    assert "completed_tasks" in data
    assert "overdue_tasks" in data
    assert "tasks_due_today" in data
    assert "tasks_by_priority" in data
    assert "tasks_by_owner" in data
    assert isinstance(data["tasks_by_priority"], list)


def test_sales_report_reconciliation(client: TestClient, admin_headers: dict):
    res = client.get("/api/v1/reports/sales", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    # Reconciled nested structures for frontend compatibility
    assert "crm_summary" in data
    assert "sales_summary" in data
    assert "sales_owners" in data
    assert "pipeline_stages" in data

    assert "total_leads" in data["crm_summary"]
    assert "lead_conversion_rate" in data["crm_summary"]
    assert "quotations_count" in data["sales_summary"]
    assert "sales_orders_count" in data["sales_summary"]


def test_csv_export_leads_activities_tasks(client: TestClient, admin_headers: dict):
    # Leads CSV
    res_leads = client.get("/api/v1/reports/export?report_type=LEADS", headers=admin_headers)
    assert res_leads.status_code == 200
    assert "text/csv" in res_leads.headers["content-type"]
    assert "leads_operational_report.csv" in res_leads.headers["content-disposition"]
    assert "Total Leads" in res_leads.text

    # Activities CSV
    res_act = client.get("/api/v1/reports/export?report_type=ACTIVITIES", headers=admin_headers)
    assert res_act.status_code == 200
    assert "text/csv" in res_act.headers["content-type"]
    assert "activities_operational_report.csv" in res_act.headers["content-disposition"]
    assert "Total Activities" in res_act.text

    # Tasks CSV
    res_tasks = client.get("/api/v1/reports/export?report_type=TASKS", headers=admin_headers)
    assert res_tasks.status_code == 200
    assert "text/csv" in res_tasks.headers["content-type"]
    assert "tasks_operational_report.csv" in res_tasks.headers["content-disposition"]
    assert "Total Tasks" in res_tasks.text


def test_step8_reports_rbac(client: TestClient, qa_headers: dict):
    # QA user has reports.view_qa but lacks reports.view_sales or reports.export
    res_leads = client.get("/api/v1/reports/leads", headers=qa_headers)
    assert res_leads.status_code == 403

    res_exp = client.get("/api/v1/reports/export?report_type=LEADS", headers=qa_headers)
    assert res_exp.status_code == 403
