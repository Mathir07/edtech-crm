import pytest
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity, Pipeline, PipelineStage
from app.activities.models import Activity

def ensure_fixtures(db: Session):
    """Ensure an Account (College), Contact, Lead, and Opportunity exist."""
    # Ensure college/company
    company = db.query(Company).filter(Company.organization_name == "Apex Infotech Solutions").first()
    if not company:
        company = Company(
            id=str(uuid.uuid4()),
            organization_name="Apex Infotech Solutions",
            code=f"APX-{uuid.uuid4().hex[:6]}",
            type="Corporate / IT Services",
            industry="Information Technology",
            city="Bengaluru",
            state="Karnataka",
        )
        db.add(company)
        db.flush()

    # Ensure contact
    contact = db.query(Contact).filter(Contact.email == "rahul.verma@apexinfotech.io").first()
    if not contact:
        contact = Contact(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name="Rahul Verma",
            designation="VP of Engineering",
            email="rahul.verma@apexinfotech.io",
            phone="+91 98765 43210",
            is_primary=True,
        )
        db.add(contact)
        db.flush()

    # Ensure lead linked to contact and company
    lead = db.query(Lead).filter(Lead.title == "Apex Cloud Migration Project").first()
    if not lead:
        lead = Lead(
            id=str(uuid.uuid4()),
            title="Apex Cloud Migration Project",
            contact_id=contact.id,
            company_id=company.id,
            company_name="Apex Infotech Solutions",
            contact_name="Rahul Verma",
            contact_email="rahul.verma@apexinfotech.io",
            contact_phone="+91 98765 43210",
            business_segment="IT Services",
            status="contacted",
        )
        db.add(lead)
        db.flush()

    # Ensure pipeline & stage for opportunity
    pipe = db.query(Pipeline).filter(Pipeline.name == "IT Services Pipeline").first()
    if not pipe:
        pipe = Pipeline(name="IT Services Pipeline", is_default=False, is_active=True)
        db.add(pipe)
        db.flush()
    stage = db.query(PipelineStage).filter(PipelineStage.pipeline_id == pipe.id).first()
    if not stage:
        stage = PipelineStage(pipeline_id=pipe.id, name="Discovery", order=1, probability=20)
        db.add(stage)
        db.flush()

    opp = db.query(Opportunity).filter(Opportunity.title == "Apex Cloud Contract").first()
    if not opp:
        opp = Opportunity(
            id=str(uuid.uuid4()),
            title="Apex Cloud Contract",
            company_id=company.id,
            contact_id=contact.id,
            pipeline_id=pipe.id,
            stage_id=stage.id,
            value=250000.0,
            status="Open",
        )
        db.add(opp)
        db.flush()

    db.commit()
    return company, contact, lead, opp

def test_contact_list_returns_company_name_and_searches(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact, lead, opp = ensure_fixtures(db_session)

    # Fetch contacts
    res = client.get("/api/v1/contacts", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    matching = [c for c in data if c["id"] == contact.id]
    assert len(matching) == 1
    c_item = matching[0]
    assert c_item["name"] == "Rahul Verma"
    assert c_item["company_name"] == "Apex Infotech Solutions"
    assert c_item["company_name"] == "Apex Infotech Solutions"

    # Search by company name
    res_search = client.get("/api/v1/contacts?search=Apex", headers=admin_headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any(c["id"] == contact.id for c in search_data)

def test_contact_detail_endpoint(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact, lead, opp = ensure_fixtures(db_session)

    res = client.get(f"/api/v1/contacts/{contact.id}", headers=admin_headers)
    assert res.status_code == 200
    detail = res.json()
    assert detail["contact"]["id"] == contact.id
    assert detail["contact"]["name"] == "Rahul Verma"
    assert detail["contact"]["company_name"] == "Apex Infotech Solutions"
    assert detail["company"] is not None
    assert detail["company"]["id"] == company.id
    assert detail["company"]["organization_name"] == "Apex Infotech Solutions"

    # Check related leads
    assert len(detail["leads"]) >= 1
    assert any(l["id"] == lead.id for l in detail["leads"])

    # Check related opportunities
    assert len(detail["opportunities"]) >= 1
    assert any(o["id"] == opp.id for o in detail["opportunities"])

def test_activity_with_contact_target(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact, lead, opp = ensure_fixtures(db_session)

    act_payload = {
        "subject": "Quarterly Technical Review Call",
        "type": "Call",
        "description": "Discussing current infrastructure scaling requirements",
        "related_entity_type": "contact",
        "related_entity_id": contact.id,
    }
    res = client.post("/api/v1/activities", json=act_payload, headers=admin_headers)
    assert res.status_code in (200, 201)
    act_data = res.json()
    assert act_data["subject"] == "Quarterly Technical Review Call"
    assert act_data["related_entity_type"] == "contact"
    assert act_data["related_entity_id"] == contact.id
    assert act_data["related_entity_name"] == "Rahul Verma"

    # Verify activity shows up in contact detail
    res_contact = client.get(f"/api/v1/contacts/{contact.id}", headers=admin_headers)
    assert res_contact.status_code == 200
    c_detail = res_contact.json()
    assert any(a["id"] == act_data["id"] for a in c_detail["activities"])

def test_followup_activity_syncs_with_lead(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact, lead, opp = ensure_fixtures(db_session)

    due_str = (datetime.utcnow() + timedelta(days=3)).isoformat()
    act_payload = {
        "subject": "Send updated commercial proposal",
        "type": "Follow-up",
        "description": "Follow up with Rahul after finalizing scope",
        "due_at": due_str,
        "related_entity_type": "lead",
        "related_entity_id": lead.id,
    }
    res = client.post("/api/v1/activities", json=act_payload, headers=admin_headers)
    assert res.status_code in (200, 201)
    act = res.json()
    assert act["related_entity_name"] == lead.title

    # Check lead was synchronized
    res_lead = client.get(f"/api/v1/leads/{lead.id}", headers=admin_headers)
    assert res_lead.status_code == 200
    lead_data = res_lead.json()
    assert lead_data["next_action"] == "Send updated commercial proposal"
    assert lead_data["next_follow_up_date"] is not None

def test_complete_activity_preserves_history(client: TestClient, admin_headers: dict, db_session: Session):
    company, contact, lead, opp = ensure_fixtures(db_session)

    act_payload = {
        "subject": "Demo for Cloud Migration",
        "type": "Demo",
        "related_entity_type": "opportunity",
        "related_entity_id": opp.id,
    }
    res = client.post("/api/v1/activities", json=act_payload, headers=admin_headers)
    assert res.status_code in (200, 201)
    act_id = res.json()["id"]

    # Mark complete
    res_comp = client.patch(f"/api/v1/activities/{act_id}/complete", headers=admin_headers)
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["is_completed"] is True
    assert comp_data["completed_at"] is not None
    assert comp_data["related_entity_name"] == opp.title
