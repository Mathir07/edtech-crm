"""End-to-end acceptance test validating the full prompt Section 27 workflow against the live CRM."""

import sys
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_acceptance_test():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    print("--- STARTING SECTION 27 FINAL ACCEPTANCE TEST ---")

    # Step 1: Login as Admin to get authorization to create new user
    print("\n1. Logging in as Admin...")
    resp = client.post("/auth/login", json={"email": "admin@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[OK] Admin login successful")

    # Step 2: Create a new User
    print("\n2. Creating new company user (Sales Representative)...")
    roles_resp = client.get("/roles", headers=admin_headers)
    sales_role = next(r for r in roles_resp.json() if r["name"] == "Sales Executive")

    new_user_email = "rajesh.sales@edtechcrm.com"
    # Check if exists or create
    user_payload = {
        "email": new_user_email,
        "password": "Password@123",
        "first_name": "Rajesh",
        "last_name": "Kannan",
        "phone": "+91 9988776655",
        "role_ids": [sales_role["id"]],
        "is_active": True,
    }
    create_u_resp = client.post("/users", json=user_payload, headers=admin_headers)
    if create_u_resp.status_code == 400 and "already exists" in create_u_resp.text:
        print("[OK] User already exists from previous run")
    else:
        assert create_u_resp.status_code == 200, f"User creation failed: {create_u_resp.text}"
        print(f"[OK] User created: {new_user_email}")

    # Step 3: Login as newly created user
    print("\n3. Logging in as Rajesh Kannan...")
    login_resp = client.post("/auth/login", json={"email": new_user_email, "password": "Password@123"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    user_token = login_resp.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    user_id = login_resp.json()["user_id"]
    print(f"[OK] Logged in successfully. Token received for {new_user_email}")

    # Step 4: Create College (Admin creates or Executive creates if permitted)
    print("\n4. Creating College: 'PSG College of Technology & Innovation'...")
    college_code = "PSG-TECH-01"
    college_payload = {
        "organization_name": "PSG College of Technology & Innovation",
        "code": college_code,
        "type": "Autonomous Institution",
        "website": "https://psgtech.edu",
        "email": "contact@psgtech.edu",
        "phone": "+91 422 2572177",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "status": "Prospect",
        "owner_id": user_id,
        "notes": "Premier engineering institution with 9,000 students. Evaluating campus enterprise management.",
    }
    col_resp = client.post("/companies", json=college_payload, headers=admin_headers)
    if col_resp.status_code == 400 and "already exists" in col_resp.text:
        # fetch existing
        cols = client.get(f"/companies?search={college_code}", headers=admin_headers).json()
        college = cols[0]
    else:
        assert col_resp.status_code == 200, f"College creation failed: {col_resp.text}"
        college = col_resp.json()
    company_id = college["id"]
    print(f"[OK] College created/verified: {college['organization_name']} (ID: {company_id})")

    # Step 5: Add Contact
    print("\n5. Adding Contact: 'Dr. K. Prakasan (Principal)'...")
    contact_payload = {
        "company_id": company_id,
        "name": "Dr. K. Prakasan",
        "designation": "Principal & Head of Institution",
        "department": "Administration",
        "email": "principal@psgtech.edu",
        "phone": "+91 9443011223",
        "is_primary": True,
    }
    con_resp = client.post("/contacts", json=contact_payload, headers=admin_headers)
    assert con_resp.status_code == 200, f"Contact creation failed: {con_resp.text}"
    contact = con_resp.json()
    contact_id = contact["id"]
    print(f"[OK] Contact added: {contact['name']} (ID: {contact_id})")

    # Step 6: Create Lead
    print("\n6. Creating Lead: 'PSG - Campus Management & Examination ERP'...")
    lead_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "title": "PSG - Campus Management & Examination ERP",
        "description": "Autonomous curriculum, OBE assessment, and online examination engine.",
        "priority": "High",
        "expected_value": 750000.0,
        "status": "New",
        "owner_id": user_id,
    }
    lead_resp = client.post("/leads", json=lead_payload, headers=user_headers)
    assert lead_resp.status_code == 200, f"Lead creation failed: {lead_resp.text}"
    lead = lead_resp.json()
    lead_id = lead["id"]
    print(f"[OK] Lead created: {lead['title']} (ID: {lead_id})")

    # Step 7: Assign Lead (re-assign or verify owner)
    print("\n7. Verifying Lead Assignment to Rajesh Kannan...")
    assert lead["owner_id"] == user_id, "Lead was not assigned properly"
    print(f"[OK] Lead assigned to {new_user_email}")

    # Step 8: Qualify Lead
    print("\n8. Qualifying Lead...")
    qual_resp = client.put(
        f"/leads/{lead_id}",
        json={"status": "Qualified", "qualification_status": "Qualified"},
        headers=user_headers,
    )
    assert qual_resp.status_code == 200
    assert qual_resp.json()["status"] == "Qualified"
    print("[OK] Lead marked as Qualified")

    # Step 9: Convert Lead to Opportunity
    print("\n9. Converting Lead to Opportunity...")
    conv_resp = client.post(
        f"/leads/{lead_id}/convert",
        json={
            "opportunity_title": "PSG Tech - Institutional ERP Deal 2026",
            "value": 850000.0,
        },
        headers=user_headers,
    )
    assert conv_resp.status_code == 200, f"Conversion failed: {conv_resp.text}"
    opp_id = conv_resp.json()["opportunity_id"]
    print(f"[OK] Lead converted to Opportunity ID: {opp_id}")

    # Step 10: Move Opportunity through Pipeline
    opp_data = client.get(f"/opportunities/{opp_id}", headers=user_headers).json()
    pipe_resp = client.get("/pipelines", headers=user_headers).json()
    matched_pipe = next((p for p in pipe_resp if p["id"] == opp_data.get("pipeline_id")), pipe_resp[0])
    stages = matched_pipe["stages"]
    demo_stage = next((s for s in stages if s["name"] in ["Product Demo", "Demo", "Discovery"]), stages[1])
    won_stage = next((s for s in stages if s.get("is_won")), None) or next((s for s in stages if s["name"] in ["Closed Won", "Won", "Enrolled"]), stages[-1])

    # Move to Product Demo
    move1 = client.patch(f"/opportunities/{opp_id}/stage", json={"stage_id": demo_stage["id"]}, headers=user_headers)
    assert move1.status_code == 200
    print(f"[OK] Opportunity moved to: {demo_stage['name']}")

    # Move to Closed Won
    move2 = client.patch(f"/opportunities/{opp_id}/stage", json={"stage_id": won_stage["id"]}, headers=user_headers)
    assert move2.status_code == 200
    assert move2.json()["status"] == "Won"
    assert move2.json()["won_at"] is not None
    print(f"[OK] Opportunity moved to: {won_stage['name']} (status=Won, won_at={move2.json()['won_at']})")

    # Step 11: Create Follow-up Activity
    print("\n11. Creating Follow-up Activity...")
    act_payload = {
        "type": "Call",
        "subject": "Follow-up with Dean on Deployment Schedule",
        "description": "Coordinate installation dates with IT department.",
        "related_entity_type": "company",
        "related_entity_id": company_id,
    }
    act_resp = client.post("/activities", json=act_payload, headers=user_headers)
    assert act_resp.status_code == 200
    act_id = act_resp.json()["id"]
    print(f"[OK] Follow-up activity created: ID {act_id}")

    # Step 12: Complete Follow-up
    print("\n12. Completing Follow-up...")
    comp_resp = client.patch(f"/activities/{act_id}/complete", headers=user_headers)
    assert comp_resp.status_code == 200
    assert comp_resp.json()["is_completed"] is True
    print("[OK] Activity marked as completed")

    # Step 13: Create Meeting
    print("\n13. Creating Boardroom Meeting...")
    meeting_payload = {
        "title": "Implementation Kickoff with Dean & HoDs",
        "description": "Kickoff meeting for system setup and database migration.",
        "start_time": "2026-09-25T10:00:00Z",
        "end_time": "2026-09-25T11:30:00Z",
        "location": "Boardroom, Administrative Block",
        "related_entity_type": "company",
        "related_entity_id": company_id,
    }
    meet_resp = client.post("/meetings", json=meeting_payload, headers=user_headers)
    assert meet_resp.status_code == 200
    print(f"[OK] Meeting scheduled: {meet_resp.json()['title']}")

    # Step 14: Add Note
    print("\n14. Adding Note to College...")
    note_resp = client.post(
        "/notes",
        json={
            "content": "Principal confirmed college council approved the proposal without changes.",
            "related_entity_type": "company",
            "related_entity_id": company_id,
        },
        headers=user_headers,
    )
    assert note_resp.status_code == 200
    print("[OK] Note added successfully")

    # Step 15: View College 360
    print("\n15. Verifying College 360 Aggregation...")
    c360_resp = client.get(f"/companies/{company_id}", headers=user_headers)
    assert c360_resp.status_code == 200
    c360 = c360_resp.json()
    assert len(c360["contacts"]) >= 1, "Contacts missing in 360"
    assert len(c360["leads"]) >= 1, "Leads missing in 360"
    assert len(c360["opportunities"]) >= 1, "Opportunities missing in 360"
    assert len(c360["activities"]) >= 1, "Activities missing in 360"
    assert len(c360["meetings"]) >= 1, "Meetings missing in 360"
    assert len(c360["notes"]) >= 1, "Notes missing in 360"
    assert len(c360["timeline"]) >= 3, "Chronological timeline missing events"
    print(f"[OK] College 360 verified with {len(c360['timeline'])} chronological timeline events!")

    # Step 16: Global Search
    print("\n16. Testing Global Search for 'Prakasan'...")
    search_resp = client.get("/search?q=Prakasan", headers=user_headers)
    assert search_resp.status_code == 200
    results = search_resp.json()["results"]
    assert any(r["type"] == "contact" and "Prakasan" in r["title"] for r in results)
    print(f"[OK] Global search found contact: {results[0]['title']}")

    # Step 17: Check Dashboard Stats
    print("\n17. Checking CRM Dashboard Stats from DB...")
    dash_resp = client.get("/dashboard/stats", headers=user_headers)
    assert dash_resp.status_code == 200
    stats = dash_resp.json()
    assert (stats.get("total_companies", 0) or stats.get("total_colleges", 0)) >= 1
    assert stats["won_opportunities"] >= 1
    print(f"[OK] Dashboard verified: Total Companies={stats.get('total_companies', stats.get('total_colleges'))}, Won Deals={stats['won_opportunities']}")

    # Step 18: Check Audit Logs
    print("\n18. Checking Audit Trail...")
    audit_resp = client.get("/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    actions = [l["action"] for l in logs]
    assert "CREATE" in actions
    assert "CONVERT" in actions
    assert "STAGE_CHANGE" in actions
    print(f"[OK] Audit logs verified with {len(logs)} recorded operational actions")

    # Step 19: Logout
    print("\n19. Logging out...")
    logout_resp = client.post("/auth/logout", headers=user_headers)
    assert logout_resp.status_code == 200
    print("[OK] User successfully logged out")

    print("\n=======================================================")
    print(">>> SECTION 27 FINAL ACCEPTANCE TEST FULLY PASSED! <<<")
    print("=======================================================\n")

if __name__ == "__main__":
    run_acceptance_test()
