"""Complete End-to-End Live Sales Acceptance Test for Kiwi CRM Enterprise.

Validates the end-to-end sales lifecycle against the live backend API:
College -> Contact -> Lead -> Opportunity -> Catalog -> Quotation Composer ->
Approval Workflow -> Send Guard -> Acceptance -> Contract -> Sales Order ->
Project Handoff Readiness -> College 360 Aggregation -> Sales Dashboard -> Audit Logs.
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from datetime import date, timedelta
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_sales_acceptance_test():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)
    print("=================================================================")
    print(">>> STARTING COMPREHENSIVE SALES E2E LIVE ACCEPTANCE TEST <<<")
    print("=================================================================\n")

    # Step 1: Login as Admin
    print("1. Authenticating as Super Admin...")
    resp = client.post("/auth/login", json={"email": "admin@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[OK] Admin authenticated")

    # Step 2: Login as Sales Manager
    print("\n2. Authenticating as Sales Manager...")
    resp = client.post("/auth/login", json={"email": "sales.manager@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Sales Manager login failed: {resp.text}"
    sm_token = resp.json()["access_token"]
    sm_headers = {"Authorization": f"Bearer {sm_token}"}
    print("[OK] Sales Manager authenticated")

    # Step 3: Login as Sales Executive
    print("\n3. Authenticating as Sales Executive...")
    resp = client.post("/auth/login", json={"email": "sales.exec@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Sales Executive login failed: {resp.text}"
    se_token = resp.json()["access_token"]
    se_user_id = resp.json()["user_id"]
    se_headers = {"Authorization": f"Bearer {se_token}"}
    print("[OK] Sales Executive authenticated")

    # Step 4: Create College
    print("\n4. Creating College: 'Sri Krishna College of Engineering & Technology'...")
    college_code = "SKCET-CBE-01"
    col_payload = {
        "organization_name": "Sri Krishna College of Engineering & Technology",
        "code": college_code,
        "type": "Autonomous Institution",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "status": "Prospect",
        "owner_id": se_user_id,
        "notes": "Autonomous NAAC A++ engineering college with 8,500 students.",
    }
    col_resp = client.post("/companies", json=col_payload, headers=se_headers)
    if col_resp.status_code == 400 and "already exists" in col_resp.text:
        college = client.get(f"/companies?search={college_code}", headers=se_headers).json()[0]
    else:
        assert col_resp.status_code == 200, f"College creation failed: {col_resp.text}"
        college = col_resp.json()
    company_id = college["id"]
    print(f"[OK] College verified: {college['organization_name']} (ID: {company_id})")

    # Step 5: Create Contact
    print("\n5. Creating Contact: 'Dr. J. Janet (Principal)'...")
    con_payload = {
        "company_id": company_id,
        "name": "Dr. J. Janet",
        "designation": "Principal & Professor",
        "email": "principal@skcet.ac.in",
        "phone": "+91 422 2678001",
        "is_primary": True,
    }
    con_resp = client.post("/contacts", json=con_payload, headers=se_headers)
    assert con_resp.status_code == 200, f"Contact creation failed: {con_resp.text}"
    contact = con_resp.json()
    contact_id = contact["id"]
    print(f"[OK] Contact added: {contact['name']} (ID: {contact_id})")

    # Step 6: Create Lead & Convert to Opportunity
    print("\n6. Creating Lead and converting to Opportunity...")
    lead_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "title": "SKCET - Autonomous OBE & Examination Cloud ERP",
        "description": "Enterprise cloud examination engine and NIRF/NAAC analytics portal.",
        "priority": "High",
        "expected_value": 850000.0,
        "status": "New",
        "owner_id": se_user_id,
    }
    lead_resp = client.post("/leads", json=lead_payload, headers=se_headers)
    assert lead_resp.status_code == 200, f"Lead creation failed: {lead_resp.text}"
    lead_id = lead_resp.json()["id"]

    # Qualify lead
    client.put(f"/leads/{lead_id}", json={"status": "Qualified", "qualification_status": "Qualified"}, headers=se_headers)

    # Convert to opportunity
    conv_resp = client.post(
        f"/leads/{lead_id}/convert",
        json={"opportunity_title": "SKCET Enterprise ERP & Exam Solution 2026", "value": 850000.0},
        headers=se_headers,
    )
    assert conv_resp.status_code == 200, f"Conversion failed: {conv_resp.text}"
    opp_id = conv_resp.json()["opportunity_id"]
    print(f"[OK] Lead converted to Opportunity (ID: {opp_id})")

    # Step 7: Product Catalog & RBAC Verification
    print("\n7. Verifying Product Catalog & RBAC restrictions...")
    # Sales Executive should NOT be able to create a product category
    bad_cat = client.post("/product-categories", json={"name": "Forbidden Category"}, headers=se_headers)
    assert bad_cat.status_code == 403, f"Expected 403 for executive creating category, got {bad_cat.status_code}"
    print("[OK] RBAC verified: Sales Executive cannot create categories")

    # Sales Manager creates category
    cat_name = f"Enterprise SIS & ERP {college_code}"
    cat_resp = client.post("/product-categories", json={"name": cat_name}, headers=sm_headers)
    if cat_resp.status_code == 400 and "already exists" in cat_resp.text:
        cats = client.get("/product-categories", headers=sm_headers).json()
        cat_id = next(c["id"] for c in cats if c["name"] == cat_name)
    else:
        assert cat_resp.status_code == 200, cat_resp.text
        cat_id = cat_resp.json()["id"]

    # Sales Executive should NOT be able to create a product
    bad_prod = client.post("/products", json={"name": "Forbidden Prod", "code": "FORBID-01"}, headers=se_headers)
    assert bad_prod.status_code == 403, f"Expected 403 for executive creating product, got {bad_prod.status_code}"
    print("[OK] RBAC verified: Sales Executive cannot create products")

    # Sales Manager creates products
    p1_payload = {
        "category_id": cat_id,
        "name": "EduSuite Campus ERP Cloud Suite",
        "code": f"PRD-ERP-{college_code}",
        "type": "Product",
        "unit": "Campus License",
        "base_price": 600000.00,
        "tax_rate": 18.00,
        "status": "Active",
    }
    p1_resp = client.post("/products", json=p1_payload, headers=sm_headers)
    if p1_resp.status_code == 400 and "already exists" in p1_resp.text:
        prods = client.get("/products", headers=sm_headers).json()
        p1_id = next(p["id"] for p in prods if p["code"] == p1_payload["code"])
    else:
        assert p1_resp.status_code == 200, p1_resp.text
        p1_id = p1_resp.json()["id"]

    p2_payload = {
        "category_id": cat_id,
        "name": "Annual Maintenance & 24/7 SLA",
        "code": f"SRV-SLA-{college_code}",
        "type": "Service",
        "unit": "Year",
        "base_price": 100000.00,
        "tax_rate": 18.00,
        "status": "Active",
    }
    p2_resp = client.post("/products", json=p2_payload, headers=sm_headers)
    if p2_resp.status_code == 400 and "already exists" in p2_resp.text:
        prods = client.get("/products", headers=sm_headers).json()
        p2_id = next(p["id"] for p in prods if p["code"] == p2_payload["code"])
    else:
        assert p2_resp.status_code == 200, p2_resp.text
        p2_id = p2_resp.json()["id"]
    print(f"[OK] Products created in catalog by Sales Manager: {p1_payload['name']}, {p2_payload['name']}")

    # Step 8: Calculation Preview Engine
    print("\n8. Testing Financial Calculation Preview API...")
    calc_payload = {
        "items": [
            {
                "product_id": p1_id,
                "description": "EduSuite Campus ERP Cloud Suite (Unlimited Students)",
                "quantity": 1.0,
                "unit_price": 600000.0,
                "discount": 50000.0,  # 50,000 discount
                "tax_rate": 18.0,
            },
            {
                "product_id": p2_id,
                "description": "Annual Maintenance & 24/7 SLA (Year 1)",
                "quantity": 1.0,
                "unit_price": 100000.0,
                "discount": 0.0,
                "tax_rate": 18.0,
            }
        ]
    }
    # Expected calculations:
    # Item 1: subtotal = 600000, discount = 50000, taxable = 550000, tax = 99000, line_total = 649000
    # Item 2: subtotal = 100000, discount = 0, taxable = 100000, tax = 18000, line_total = 118000
    # Overall: subtotal = 700000, discount = 50000, tax = 117000, total = 767000
    calc_resp = client.post("/quotations/calculate", json=calc_payload, headers=se_headers)
    assert calc_resp.status_code == 200, calc_resp.text
    calc = calc_resp.json()
    assert calc["subtotal"] == 700000.0, f"Expected subtotal 700000, got {calc['subtotal']}"
    assert calc["discount_amount"] == 50000.0, f"Expected discount 50000, got {calc['discount_amount']}"
    assert calc["tax_amount"] == 117000.0, f"Expected tax 117000, got {calc['tax_amount']}"
    assert calc["total_amount"] == 767000.0, f"Expected total 767000, got {calc['total_amount']}"
    print(f"[OK] Financial calculation engine accurate: Subtotal=INR {calc['subtotal']:,.2f}, Discount=INR {calc['discount_amount']:,.2f}, GST=INR {calc['tax_amount']:,.2f}, Grand Total=INR {calc['total_amount']:,.2f}")

    # Step 9: Create Quotation as Sales Executive
    print("\n9. Composing and saving formal Quotation...")
    quote_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "opportunity_id": opp_id,
        "quotation_date": date.today().isoformat(),
        "valid_until": (date.today() + timedelta(days=30)).isoformat(),
        "currency": "INR",
        "notes": "Custom tailored commercial proposal for SKCET Autonomous College.",
        "terms": "50% advance with Purchase Order, 40% on UAT signoff, 10% on Go-Live. Net 30 days.",
        "items": calc_payload["items"],
    }
    q_resp = client.post("/quotations", json=quote_payload, headers=se_headers)
    assert q_resp.status_code == 200, f"Quotation creation failed: {q_resp.text}"
    quote = q_resp.json()
    quote_id = quote["id"]
    quotation_number = quote["quotation_number"]
    assert quotation_number.startswith("QT-")
    assert quote["status"] == "Draft"
    assert quote["total_amount"] == 767000.0
    assert len(quote["items"]) == 2
    assert quote["company_name"] == "Sri Krishna College of Engineering & Technology"
    print(f"[OK] Quotation created: {quotation_number} (Status: Draft, Total: INR {quote['total_amount']:,.2f})")

    # Step 10: Submit Quotation for Approval
    print("\n10. Submitting Quotation for Management / Sales Manager approval...")
    sub_resp = client.post(f"/quotations/{quote_id}/submit", headers=se_headers)
    assert sub_resp.status_code == 200, sub_resp.text
    assert sub_resp.json()["status"] == "Pending Approval"
    print(f"[OK] Quotation {quotation_number} transitioned to: Pending Approval")

    # Step 11: RBAC: Executive tries to approve -> rejected
    print("\n11. Verifying RBAC: Executive cannot approve quotation...")
    bad_app = client.post(f"/quotations/{quote_id}/approve", headers=se_headers)
    assert bad_app.status_code == 403, f"Expected 403, got {bad_app.status_code}"
    print("[OK] RBAC verified: Sales Executive blocked from self-approving quotation")

    # Step 12: Sales Manager approves Quotation
    print("\n12. Approving Quotation as Sales Manager...")
    app_resp = client.post(f"/quotations/{quote_id}/approve", headers=sm_headers)
    assert app_resp.status_code == 200, app_resp.text
    approved_q = app_resp.json()
    assert approved_q["status"] == "Approved"
    assert approved_q["approved_by_id"] is not None
    print(f"[OK] Quotation {quotation_number} Approved by Sales Manager (Timestamp: {approved_q['approved_at']})")

    # Step 13: Send Quotation to Client (Email Guard Check)
    print("\n13. Sending Quotation to Client & validating Email Guard...")
    send_resp = client.post(f"/quotations/{quote_id}/send", headers=sm_headers)
    assert send_resp.status_code == 200, send_resp.text
    send_data = send_resp.json()
    assert send_data["status"] == "Sent"
    assert "Unconfigured" in send_data["email_integration_status"]
    print(f"[OK] Quotation sent to client. Email guard confirmed: '{send_data['email_integration_status']}'")

    # Step 14: Client Accepts Quotation
    print("\n14. Marking Quotation as Accepted by Institution...")
    acc_resp = client.post(f"/quotations/{quote_id}/accept", headers=sm_headers)
    assert acc_resp.status_code == 200, acc_resp.text
    assert acc_resp.json()["status"] == "Accepted"
    print(f"[OK] Quotation {quotation_number} marked as: Accepted")

    # Step 15: Create Contract from Accepted Quotation
    print("\n15. Executing Contract creation from Accepted Quotation...")
    contract_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "opportunity_id": opp_id,
        "quotation_id": quote_id,
        "title": "SKCET - Master Institutional ERP License & Service Agreement",
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=365)).isoformat(),
        "contract_value": 767000.0,
        "currency": "INR",
        "description": "Institutional enterprise software agreement resulting from accepted quote " + quotation_number,
        "terms": "Governed by proposal terms. Net 30 days.",
    }
    ct_resp = client.post("/contracts", json=contract_payload, headers=sm_headers)
    assert ct_resp.status_code == 200, ct_resp.text
    contract = ct_resp.json()
    contract_id = contract["id"]
    contract_number = contract["contract_number"]
    assert contract_number.startswith("CT-")
    assert contract["status"] == "Draft"
    print(f"[OK] Contract drafted: {contract_number} (Value: INR {contract['contract_value']:,.2f})")

    # Step 16: Activate Contract
    print("\n16. Activating and executing Contract...")
    act_resp = client.post(f"/contracts/{contract_id}/activate", headers=sm_headers)
    assert act_resp.status_code == 200, act_resp.text
    assert act_resp.json()["status"] == "Active"
    print(f"[OK] Contract {contract_number} activated! Signed date: {act_resp.json()['signed_date']}")

    # Step 17: Generate Sales Order
    print("\n17. Creating Sales Order linked to Quotation & Contract...")
    so_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "opportunity_id": opp_id,
        "quotation_id": quote_id,
        "contract_id": contract_id,
        "order_date": date.today().isoformat(),
        "notes": "Approved institutional purchase order received from principal office.",
    }
    so_resp = client.post("/sales-orders", json=so_payload, headers=se_headers)
    assert so_resp.status_code == 200, so_resp.text
    order = so_resp.json()
    order_id = order["id"]
    order_number = order["order_number"]
    assert order_number.startswith("SO-")
    assert order["status"] == "Draft"
    assert order["total_amount"] == 767000.0
    assert len(order["items"]) == 2
    print(f"[OK] Sales Order generated: {order_number} (Total: INR {order['total_amount']:,.2f})")

    # Step 18: RBAC: Executive tries to confirm Sales Order -> rejected
    print("\n18. Verifying RBAC: Executive cannot confirm Sales Order...")
    bad_so_conf = client.post(f"/sales-orders/{order_id}/confirm", headers=se_headers)
    assert bad_so_conf.status_code == 403
    print("[OK] RBAC verified: Sales Executive forbidden from confirming sales order")

    # Step 19: Confirm Sales Order & Validate Project Handoff Package
    print("\n19. Confirming Sales Order & Inspecting Project Handoff Package...")
    conf_resp = client.post(f"/sales-orders/{order_id}/confirm", headers=sm_headers)
    assert conf_resp.status_code == 200, conf_resp.text
    conf_body = conf_resp.json()
    assert conf_body["order"]["status"] == "Confirmed"
    assert "project_handoff" in conf_body
    handoff = conf_body["project_handoff"]
    assert handoff["status"] == "Ready for Deployment & Milestone Setup"
    assert handoff["company_id"] == company_id
    assert handoff["order_id"] == order_id
    assert handoff["contract_id"] == contract_id
    assert handoff["total_value"] == 767000.0
    assert handoff["next_module"] == "projects"
    print(f"[OK] Sales Order {order_number} Confirmed!")
    print(f"[OK] Project Handoff Contract: {handoff['status']} -> Ready for future Projects module!")

    # Step 20: Company 360 Aggregation Verification
    print("\n20. Verifying College 360 view incorporates Quotations, Contracts, and Orders...")
    c360_resp = client.get(f"/companies/{company_id}", headers=sm_headers)
    assert c360_resp.status_code == 200, c360_resp.text
    c360 = c360_resp.json()
    assert len(c360["quotations"]) >= 1, "Quotation missing in College 360"
    assert any(q["quotation_number"] == quotation_number for q in c360["quotations"])
    assert len(c360["contracts"]) >= 1, "Contract missing in College 360"
    assert any(c["contract_number"] == contract_number for c in c360["contracts"])
    assert len(c360["sales_orders"]) >= 1, "Sales Order missing in College 360"
    assert any(o["order_number"] == order_number for o in c360["sales_orders"])

    # Verify timeline
    timeline_types = [t["type"] for t in c360["timeline"]]
    assert "quotation" in timeline_types, "Timeline missing quotation event"
    assert "contract" in timeline_types, "Timeline missing contract event"
    assert "sales_order" in timeline_types, "Timeline missing sales order event"
    print(f"[OK] College 360 verified: Quotations ({len(c360['quotations'])}), Contracts ({len(c360['contracts'])}), Sales Orders ({len(c360['sales_orders'])}), Timeline ({len(c360['timeline'])} events)")

    # Step 21: Global Search Integration
    print(f"\n21. Verifying Global Search for '{quotation_number}'...")
    s_resp = client.get(f"/search?q={quotation_number}", headers=sm_headers)
    assert s_resp.status_code == 200
    results = s_resp.json()["results"]
    assert any(r["type"] == "quotation" and quotation_number in r["title"] for r in results)
    print(f"[OK] Global Search returned Quotation record: {results[0]['title']}")

    # Step 22: Sales Dashboard Aggregations
    print("\n22. Checking Sales Dashboard PostgreSQL aggregations...")
    dash_resp = client.get("/sales/dashboard/stats", headers=sm_headers)
    assert dash_resp.status_code == 200
    stats = dash_resp.json()
    assert stats["total_quotations"] >= 1
    assert stats["accepted_quotations"] >= 1
    assert stats["accepted_quotation_value"] >= 767000.0
    assert stats["active_contracts"] >= 1
    assert stats["active_contract_value"] >= 767000.0
    assert stats["confirmed_orders"] >= 1
    assert stats["confirmed_order_value"] >= 767000.0
    print(f"[OK] Sales Dashboard verified: Accepted Quotes=INR {stats['accepted_quotation_value']:,.2f}, Active Contracts=INR {stats['active_contract_value']:,.2f}, Confirmed Orders=INR {stats['confirmed_order_value']:,.2f}")

    # Step 23: Audit Trail Verification
    print("\n23. Checking Enterprise Audit Trail for sales operations...")
    audit_resp = client.get("/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    actions = [l["action"] for l in logs]
    assert "CREATE" in actions
    assert "APPROVE" in actions
    assert "SEND" in actions
    assert "ACCEPT" in actions
    assert "ACTIVATE" in actions
    assert "CONFIRM" in actions
    print(f"[OK] Audit logs verified with {len(logs)} recorded operational actions")

    print("\n=================================================================")
    print(">>> SECTION 23 COMPREHENSIVE SALES E2E TEST FULLY PASSED! <<<")
    print("=================================================================\n")

if __name__ == "__main__":
    run_sales_acceptance_test()
