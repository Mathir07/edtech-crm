import io
import pytest
from app.crm.models import Lead, LeadSource
from app.organizations.models import Company, Contact
from app.users.models import User


def test_leads_template(client, admin_headers):
    res = client.get("/api/v1/leads/template", headers=admin_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=leads_template.csv" in res.headers["content-disposition"]
    content = res.text
    assert "title,contact_name,company_name,business_segment" in content
    assert "Sample Lead" in content


def test_leads_export_with_filters(client, admin_headers, db_session):
    # Ensure some leads exist
    src = db_session.query(LeadSource).first()
    l1 = Lead(
        title="Step 7 Export Lead 1",
        contact_name="Lead One",
        business_segment="IT Services",
        contact_email="lead1@testexport.com",
        status="New",
        priority="High",
        source_id=src.id if src else None,
    )
    l2 = Lead(
        title="Step 7 Export Lead 2",
        contact_name="Lead Two",
        business_segment="EdTech",
        contact_email="lead2@testexport.com",
        status="Contacted",
        priority="Low",
        source_id=src.id if src else None,
    )
    db_session.add_all([l1, l2])
    db_session.commit()

    # Filtered export: segment=IT Services
    res = client.get(
        "/api/v1/leads/export?segment=IT%20Services",
        headers=admin_headers
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Step 7 Export Lead 1" in res.text
    assert "Step 7 Export Lead 2" not in res.text


def test_leads_import_success_and_company_matching(client, admin_headers, db_session):
    # Create an existing company to test matching
    college = Company(
        organization_name="Apex Import Innovations",
        code="APX_IMP",
        type="Corporate",
        status="Active",
    )
    db_session.add(college)
    db_session.commit()

    csv_data = """title,contact_name,company_name,business_segment,contact_email,contact_phone,status,priority,expected_value,next_action,next_follow_up_date
Cloud Setup,Alex Miller,Apex Import Innovations,IT Services,alex.miller@apex.com,+919998887771,New,High,45000,Call back,2026-10-15
Math Mastery,Sunil Rao,Unknown Corp NonExistent,EdTech,sunil.rao@math.com,+919998887772,New,Medium,20000,Email demo,2026-10-20
"""
    files = {"file": ("leads_test.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post(
        "/api/v1/leads/import",
        files=files,
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 2
    assert data["imported"] == 2
    assert data["duplicates"] == 0
    assert data["validation_errors"] == 0

    # Verify in DB: Apex Import Innovations lead has company_id linked
    lead1 = db_session.query(Lead).filter(Lead.contact_email == "alex.miller@apex.com").first()
    assert lead1 is not None
    assert lead1.company_id == college.id
    assert lead1.business_segment == "IT Services"
    assert lead1.expected_value == 45000.0

    # Verify second lead: preserved company_name text, company_id is None, no clutter college created
    lead2 = db_session.query(Lead).filter(Lead.contact_email == "sunil.rao@math.com").first()
    assert lead2 is not None
    assert lead2.company_id is None
    assert lead2.company_name == "Unknown Corp NonExistent"
    assert lead2.business_segment == "EdTech"


def test_leads_import_segment_validation(client, admin_headers, db_session):
    # Tests that EdTech, IT Services, Talent, Higher Education are allowed, but arbitrary segments are rejected
    csv_data = """title,contact_name,business_segment,contact_email
Lead EdTech,A,EdTech,seg_edtech@test.com
Lead IT,B,IT Services,seg_it@test.com
Lead Talent,C,Talent,seg_talent@test.com
Lead HigherEd,D,Higher Education,seg_highed@test.com
Lead Bad,E,Crypto Mining,seg_bad@test.com
"""
    files = {"file": ("segments.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post(
        "/api/v1/leads/import",
        files=files,
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 5
    assert data["imported"] == 4
    assert data["validation_errors"] == 1
    assert any("Unrecognized business segment 'Crypto Mining'" in err for err in data["row_errors"])


def test_leads_import_duplicate_detection(client, admin_headers, db_session):
    # Insert initial lead
    l = Lead(
        title="Existing Unique Lead",
        contact_name="Existing Contact",
        contact_email="existing_unique@test.com",
        contact_phone="+919111222333",
        status="New",
    )
    db_session.add(l)
    db_session.commit()

    csv_data = """title,contact_name,contact_email,contact_phone
Lead Dup 1,Existing Contact,existing_unique@test.com,+910000000000
Lead Dup 2,Another Contact,other@test.com,+919111222333
Lead Fresh,Fresh Person,fresh@test.com,+919444555666
"""
    files = {"file": ("dup_leads.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post(
        "/api/v1/leads/import",
        files=files,
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 3
    assert data["imported"] == 1
    assert data["duplicates"] == 2
    assert any("existing_unique@test.com" in err for err in data["row_errors"])
    assert any("+919111222333" in err for err in data["row_errors"])


def test_contacts_template(client, admin_headers):
    res = client.get("/api/v1/contacts/template", headers=admin_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "contacts_template.csv" in res.headers["content-disposition"]
    assert "name,company_name,designation" in res.text


def test_contacts_export(client, admin_headers, db_session):
    col = Company(organization_name="Contact Export Corp", code="CEC_EXP", type="Corporate")
    db_session.add(col)
    db_session.flush()
    c = Contact(
        name="Exported Contact Person",
        company_id=col.id,
        email="contact_exp@cec.com",
        phone="+919876000111",
        status="Active",
    )
    db_session.add(c)
    db_session.commit()

    res = client.get("/api/v1/contacts/export", headers=admin_headers)
    assert res.status_code == 200
    assert "Exported Contact Person" in res.text
    assert "Contact Export Corp" in res.text


def test_contacts_import_success_and_missing_company(client, admin_headers, db_session):
    col = Company(organization_name="Valid Account Inc", code="VAL_ACC", type="Corporate")
    db_session.add(col)
    db_session.commit()

    csv_data = """name,company_name,designation,email,phone,is_primary
Anita Sen,Valid Account Inc,Director,anita.sen@validacc.com,+918881112233,true
Ghost Person,Missing Phantom Corp,Manager,ghost@phantom.com,+918881112244,false
"""
    files = {"file": ("contacts.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post(
        "/api/v1/contacts/import",
        files=files,
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 2
    assert data["imported"] == 1
    assert data["validation_errors"] == 1
    assert any("Missing Phantom Corp" in err for err in data["row_errors"])

    # Verify Anita Sen was imported
    imported_c = db_session.query(Contact).filter(Contact.email == "anita.sen@validacc.com").first()
    assert imported_c is not None
    assert imported_c.company_id == col.id
    assert imported_c.is_primary is True


def test_non_csv_file_rejected(client, admin_headers):
    files = {"file": ("data.txt", io.BytesIO(b"Hello world"), "text/plain")}
    res = client.post(
        "/api/v1/leads/import",
        files=files,
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "Invalid file type" in res.json()["detail"]


def test_csv_import_export_rbac(client, qa_headers):
    # QA user lacks crm.leads.create and crm.companies.edit
    files = {"file": ("leads.csv", io.BytesIO(b"title\nTest Lead\n"), "text/csv")}
    res = client.post("/api/v1/leads/import", files=files, headers=qa_headers)
    assert res.status_code == 403

    res2 = client.post("/api/v1/contacts/import", files=files, headers=qa_headers)
    assert res2.status_code == 403


