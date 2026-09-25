import httpx
import json

BASE_URL = "http://127.0.0.1:8000"

def run_live_api_tests():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    print("\n--- 1. Testing Health Endpoints ---")
    r = client.get("/api/health")
    print(f"GET /api/health: {r.status_code} -> {r.json()}")
    assert r.status_code == 200

    r = client.get("/api/health/readiness")
    print(f"GET /api/health/readiness: {r.status_code} -> {r.json()}")
    assert r.status_code == 200
    assert r.json().get("database") == "connected"

    print("\n--- 2. Testing Authentication ---")
    login_data = {
        "email": "sales.manager@edtechcrm.com",
        "password": "Admin@123",
    }
    r = client.post("/api/v1/auth/login", json=login_data)
    print(f"POST /api/v1/auth/login: {r.status_code}")
    if r.status_code != 200:
        print(f"Login failed: {r.text}")
        return False
    
    tokens = r.json()
    access_token = tokens["access_token"]
    print("Login successful! Access token received.")

    headers = {"Authorization": f"Bearer {access_token}"}

    print("\n--- 3. Testing User Profile ---")
    r = client.get("/api/v1/auth/me", headers=headers)
    print(f"GET /api/v1/auth/me: {r.status_code} -> {r.json().get('email')} ({r.json().get('full_name')})")
    assert r.status_code == 200

    print("\n--- 4. Testing Companies / Organizations ---")
    r = client.get("/api/v1/companies", headers=headers)
    print(f"GET /api/v1/companies: {r.status_code} -> {len(r.json())} companies found")
    assert r.status_code == 200
    companies = r.json()
    first_company_id = companies[0]["id"] if companies else None

    print("\n--- 5. Testing Contacts ---")
    r = client.get("/api/v1/contacts", headers=headers)
    print(f"GET /api/v1/contacts: {r.status_code} -> {len(r.json())} contacts found")
    assert r.status_code == 200

    print("\n--- 6. Testing Leads & CRUD ---")
    r = client.get("/api/v1/leads", headers=headers)
    print(f"GET /api/v1/leads: {r.status_code} -> {len(r.json())} leads found")
    assert r.status_code == 200

    # Test creating a lead
    if first_company_id:
        new_lead = {
            "title": "PostgreSQL Migration Verification Lead",
            "company_id": first_company_id,
            "status": "New",
            "priority": "High",
            "expected_value": 75000.0,
            "description": "Created automatically to verify PostgreSQL CRUD operations",
        }
        r = client.post("/api/v1/leads", json=new_lead, headers=headers)
        print(f"POST /api/v1/leads (Create): {r.status_code}")
        assert r.status_code in (200, 201)
        created_lead = r.json()
        lead_id = created_lead["id"]
        print(f"Created Lead ID: {lead_id}, Title: {created_lead['title']}")

        # Read back
        r = client.get(f"/api/v1/leads/{lead_id}", headers=headers)
        assert r.status_code == 200
        print(f"GET /api/v1/leads/{lead_id}: Verified created lead")

        # Update lead
        update_data = {"priority": "Medium", "description": "Updated priority during verification"}
        r = client.put(f"/api/v1/leads/{lead_id}", json=update_data, headers=headers)
        assert r.status_code == 200
        print(f"PUT /api/v1/leads/{lead_id}: Updated lead priority to {r.json().get('priority')}")

        # Delete (soft delete) lead
        r = client.delete(f"/api/v1/leads/{lead_id}", headers=headers)
        print(f"DELETE /api/v1/leads/{lead_id}: {r.status_code}")
        assert r.status_code in (200, 204)
        print("CRUD Cycle Completed Successfully on PostgreSQL!")

    print("\n--- 7. Testing Sales Opportunities & Pipelines ---")
    r = client.get("/api/v1/opportunities", headers=headers)
    print(f"GET /api/v1/opportunities: {r.status_code} -> {len(r.json())} opportunities found")
    assert r.status_code == 200

    r = client.get("/api/v1/pipelines", headers=headers)
    print(f"GET /api/v1/pipelines: {r.status_code} -> {len(r.json())} pipelines found")
    assert r.status_code == 200

    print("\n--- 8. Testing Accounting & Chart of Accounts (with Super Admin) ---")
    # Log in as Super Admin (vinothravi2819@gmail.com)
    admin_login = {
        "email": "vinothravi2819@gmail.com",
        "password": "Admin@123",
    }
    r = client.post("/api/v1/auth/login", json=admin_login)
    if r.status_code == 200:
        admin_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/api/v1/accounting/accounts", headers=admin_headers)
        print(f"GET /api/v1/accounting/accounts (Admin): {r.status_code} -> {len(r.json())} accounts found")
        assert r.status_code == 200
    else:
        # Fallback to finance manager
        fin_login = {"email": "finance@edtechcrm.com", "password": "Admin@123"}
        r = client.post("/api/v1/auth/login", json=fin_login)
        assert r.status_code == 200
        fin_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/api/v1/accounting/accounts", headers=fin_headers)
        print(f"GET /api/v1/accounting/accounts (Finance): {r.status_code} -> {len(r.json())} accounts found")
        assert r.status_code == 200

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")
    return True

if __name__ == "__main__":
    run_live_api_tests()
