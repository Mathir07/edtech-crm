from fastapi.testclient import TestClient

def test_full_crm_workflow(client: TestClient, admin_headers: dict):
    # 1. Create College
    col_resp = client.post(
        "/api/v1/companies",
        headers=admin_headers,
        json={
            "organization_name": "Test Engineering Institute",
            "code": "TEI-2026",
            "type": "Engineering College",
            "city": "Coimbatore",
            "state": "Tamil Nadu",
            "email": "contact@tei.edu",
        },
    )
    assert col_resp.status_code == 200
    college = col_resp.json()
    company_id = college["id"]
    assert college["code"] == "TEI-2026"

    # Duplicate code rejection test
    dup_resp = client.post(
        "/api/v1/companies",
        headers=admin_headers,
        json={
            "organization_name": "Duplicate College",
            "code": "TEI-2026",
            "type": "Engineering College",
        },
    )
    assert dup_resp.status_code == 400

    # 2. Create Contact for College
    con_resp = client.post(
        "/api/v1/contacts",
        headers=admin_headers,
        json={
            "company_id": company_id,
            "name": "Dr. S. K. Narayanan",
            "designation": "Principal",
            "department": "Administration",
            "email": "principal@tei.edu",
            "phone": "+91 9876500000",
            "is_primary": True,
        },
    )
    assert con_resp.status_code == 200
    contact = con_resp.json()
    contact_id = contact["id"]
    assert contact["name"] == "Dr. S. K. Narayanan"

    # 3. Create Lead
    lead_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "company_id": company_id,
            "contact_id": contact_id,
            "title": "TEI - Campus Management System Suite",
            "expected_value": 350000.0,
            "priority": "High",
            "status": "New",
            "description": "Needs campus fee automation and student portal.",
        },
    )
    assert lead_resp.status_code == 200
    lead = lead_resp.json()
    lead_id = lead["id"]
    assert lead["status"] == "New"

    # Update Lead Status to Qualified
    update_lead = client.put(
        f"/api/v1/leads/{lead_id}",
        headers=admin_headers,
        json={"status": "Qualified", "qualification_status": "Qualified"},
    )
    assert update_lead.status_code == 200
    assert update_lead.json()["status"] == "Qualified"

    # 4. Convert Lead to Opportunity
    conv_resp = client.post(
        f"/api/v1/leads/{lead_id}/convert",
        headers=admin_headers,
        json={
            "opportunity_title": "TEI Deal Q4: Campus Suite 2026",
            "value": 400000.0,
        },
    )
    assert conv_resp.status_code == 200
    conv_data = conv_resp.json()
    opp_id = conv_data["opportunity_id"]

    # Verify Lead is now Converted
    check_lead = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers)
    assert check_lead.json()["status"] == "Converted"

    # 5. Get Pipeline Stages and move Opportunity stage
    pipe_resp = client.get("/api/v1/pipelines", headers=admin_headers)
    assert pipe_resp.status_code == 200
    stages = pipe_resp.json()[0]["stages"]
    won_stage = next(s for s in stages if s["name"] == "Closed Won")

    stage_move = client.patch(
        f"/api/v1/opportunities/{opp_id}/stage",
        headers=admin_headers,
        json={"stage_id": won_stage["id"]},
    )
    assert stage_move.status_code == 200
    opp_data = stage_move.json()
    assert opp_data["status"] == "Won"
    assert opp_data["won_at"] is not None

    # 6. Create Follow-up Activity
    act_resp = client.post(
        "/api/v1/activities",
        headers=admin_headers,
        json={
            "type": "Call",
            "subject": "Commercial agreement sign-off call",
            "related_entity_type": "company",
            "related_entity_id": company_id,
        },
    )
    assert act_resp.status_code == 200
    act_id = act_resp.json()["id"]

    # Complete Activity
    comp_resp = client.patch(
        f"/api/v1/activities/{act_id}/complete",
        headers=admin_headers,
    )
    assert comp_resp.status_code == 200
    assert comp_resp.json()["is_completed"] is True

    # 7. College 360 Aggregation View
    c360_resp = client.get(f"/api/v1/companies/{company_id}", headers=admin_headers)
    assert c360_resp.status_code == 200
    c360 = c360_resp.json()
    assert len(c360["contacts"]) == 1
    assert len(c360["leads"]) == 1
    assert len(c360["opportunities"]) == 1
    assert len(c360["activities"]) == 1
    assert len(c360["timeline"]) >= 1

    # 8. Global Search
    search_resp = client.get("/api/v1/search?q=Narayanan", headers=admin_headers)
    assert search_resp.status_code == 200
    results = search_resp.json()["results"]
    assert any(r["type"] == "contact" and "Narayanan" in r["title"] for r in results)

    # 9. Audit Logs Check
    audit_resp = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) > 0
    actions = [l["action"] for l in logs]
    assert "CREATE" in actions
    assert "CONVERT" in actions
    assert "STAGE_CHANGE" in actions
