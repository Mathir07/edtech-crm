import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crm.models import Lead, LeadSource
from app.organizations.models import Company, Contact
from app.sales.models import Pipeline, PipelineStage, Opportunity
from app.activities.models import Activity
from app.users.models import User

def ensure_founder_pipelines(db: Session):
    """Ensure the 3 founder pipelines and required stages exist in the active test session."""
    pipelines_spec = [
        ("EdTech Pipeline", [
            ("Lead", 1), ("Qualified", 2), ("Counselling", 3), ("Demo", 4),
            ("Payment", 5), ("Enrolled", 6), ("Completed", 7), ("Referral", 8),
        ]),
        ("IT Services Pipeline", [
            ("Prospect", 1), ("Contacted", 2), ("Discovery", 3), ("Requirement", 4),
            ("Proposal", 5), ("Negotiation", 6), ("Won", 7), ("Delivery", 8), ("Retainer", 9),
        ]),
        ("Talent / Outsourcing Pipeline", [
            ("Company Prospect", 1), ("Requirement", 2), ("Candidate Search", 3),
            ("Profiles Shared", 4), ("Interview", 5), ("Selected", 6), ("Joined", 7), ("Invoice", 8),
        ]),
    ]
    for p_name, stages in pipelines_spec:
        pipe = db.query(Pipeline).filter(Pipeline.name == p_name).first()
        if not pipe:
            pipe = Pipeline(name=p_name, is_default=False, is_active=True)
            db.add(pipe)
            db.flush()
            for s_name, order in stages:
                stage = PipelineStage(
                    pipeline_id=pipe.id,
                    name=s_name,
                    order=order,
                    probability=10 * order,
                )
                db.add(stage)
    db.commit()


# 1. Create an independent Lead without company_id.
def test_create_independent_lead_without_company_id(client: TestClient, admin_headers: dict):
    resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": "Independent Prospect Lead",
            "description": "Prospect inquiring about training programs",
            "status": "New",
            "priority": "Medium",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["title"] == "Independent Prospect Lead"
    assert data["company_id"] is None
    assert data["contact_id"] is None
    assert data["company_name"] is None


# 2. Create Lead with all prospect fields and business segment.
def test_create_lead_with_all_new_fields(client: TestClient, admin_headers: dict):
    now_utc = datetime.now(timezone.utc)
    future_date = (now_utc + timedelta(days=3)).isoformat()

    # Ensure a source exists
    source_resp = client.post(
        "/api/v1/lead-sources",
        headers=admin_headers,
        json={"name": f"Website Inbound {datetime.now().microsecond}", "description": "Website direct"},
    )
    source_id = source_resp.json()["id"]

    resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": "Apex Tech Cloud Migration",
            "contact_name": "Rahul Sharma",
            "contact_email": "rahul@example.com",
            "contact_phone": "+91 9876543210",
            "company_name": "Apex Tech Corp",
            "business_segment": "IT Services",
            "source_id": source_id,
            "next_action": "Send discovery questionnaire",
            "next_follow_up_date": future_date,
        },
    )
    assert resp.status_code == 200, resp.text
    lead = resp.json()
    assert lead["contact_name"] == "Rahul Sharma"
    assert lead["contact_email"] == "rahul@example.com"
    assert lead["contact_phone"] == "+91 9876543210"
    assert lead["company_name"] == "Apex Tech Corp"
    assert lead["business_segment"] == "IT Services"
    assert lead["next_action"] == "Send discovery questionnaire"
    assert lead["source_id"] == source_id
    assert lead["next_follow_up_date"] is not None


# 3. Update Lead next_action and next_follow_up_date.
def test_update_lead_next_action_and_follow_up(client: TestClient, admin_headers: dict):
    create_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Action Test Lead", "next_action": "Initial call"},
    )
    lead_id = create_resp.json()["id"]

    new_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    update_resp = client.put(
        f"/api/v1/leads/{lead_id}",
        headers=admin_headers,
        json={
            "next_action": "Conduct product walkthrough",
            "next_follow_up_date": new_date,
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["next_action"] == "Conduct product walkthrough"
    assert updated["next_follow_up_date"] is not None

    get_resp = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["next_action"] == "Conduct product walkthrough"


# 4. Filter today's follow-ups.
def test_filter_today_follow_ups(client: TestClient, admin_headers: dict):
    now_utc = datetime.now(timezone.utc)
    today_time = now_utc.replace(hour=14, minute=0, second=0).isoformat()
    tomorrow_time = (now_utc + timedelta(days=1)).replace(hour=14, minute=0, second=0).isoformat()

    lead_today = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Today Follow Up Lead", "next_follow_up_date": today_time},
    ).json()

    lead_tomorrow = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Tomorrow Follow Up Lead", "next_follow_up_date": tomorrow_time},
    ).json()

    filter_resp = client.get("/api/v1/leads?scope=today_follow_ups", headers=admin_headers)
    assert filter_resp.status_code == 200
    results = filter_resp.json()
    ids = [r["id"] for r in results]
    assert lead_today["id"] in ids
    assert lead_tomorrow["id"] not in ids


# 5. Filter overdue follow-ups.
def test_filter_overdue_follow_ups(client: TestClient, admin_headers: dict):
    now_utc = datetime.now(timezone.utc)
    yesterday_time = (now_utc - timedelta(days=2)).isoformat()
    future_time = (now_utc + timedelta(days=3)).isoformat()

    active_overdue = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Active Overdue Lead", "status": "New", "next_follow_up_date": yesterday_time},
    ).json()

    converted_overdue = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Converted Overdue Lead", "status": "Converted", "next_follow_up_date": yesterday_time},
    ).json()

    future_lead = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Future Lead", "status": "New", "next_follow_up_date": future_time},
    ).json()

    filter_resp = client.get("/api/v1/leads?scope=overdue_follow_ups", headers=admin_headers)
    assert filter_resp.status_code == 200
    ids = [r["id"] for r in filter_resp.json()]
    assert active_overdue["id"] in ids
    assert converted_overdue["id"] not in ids
    assert future_lead["id"] not in ids


# 6. Filter Leads by business segment.
def test_filter_leads_by_business_segment(client: TestClient, admin_headers: dict):
    tag = datetime.now().microsecond
    lead_edtech = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": f"EdTech Segment Lead {tag}", "business_segment": "EdTech"},
    ).json()

    lead_it = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": f"IT Segment Lead {tag}", "business_segment": "IT Services"},
    ).json()

    filter_resp = client.get("/api/v1/leads?segment=EdTech", headers=admin_headers)
    assert filter_resp.status_code == 200
    for r in filter_resp.json():
        assert r["business_segment"] == "EdTech"
    ids = [r["id"] for r in filter_resp.json()]
    assert lead_edtech["id"] in ids
    assert lead_it["id"] not in ids


# 7. Filter Leads by source.
def test_filter_leads_by_source(client: TestClient, admin_headers: dict):
    tag = datetime.now().microsecond
    source_resp = client.post(
        "/api/v1/lead-sources",
        headers=admin_headers,
        json={"name": f"Campus Event {tag}"},
    )
    src_id = source_resp.json()["id"]

    src_lead = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": f"Sourced Lead {tag}", "source_id": src_id},
    ).json()

    other_lead = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": f"Non Sourced Lead {tag}"},
    ).json()

    filter_resp = client.get(f"/api/v1/leads?source_id={src_id}", headers=admin_headers)
    assert filter_resp.status_code == 200
    ids = [r["id"] for r in filter_resp.json()]
    assert src_lead["id"] in ids
    assert other_lead["id"] not in ids


# 8. Filter unassigned Leads.
def test_filter_unassigned_leads(client: TestClient, admin_headers: dict):
    create_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Unassigned Test Lead"},
    )
    lead_id = create_resp.json()["id"]

    # Explicitly unassign the lead
    client.put(f"/api/v1/leads/{lead_id}", headers=admin_headers, json={"owner_id": None})

    filter_resp = client.get("/api/v1/leads?unassigned=true", headers=admin_headers)
    assert filter_resp.status_code == 200
    unassigned_leads = filter_resp.json()
    for l in unassigned_leads:
        assert l["owner_id"] is None
    ids = [l["id"] for l in unassigned_leads]
    assert lead_id in ids


# 9. Filter "mine".
def test_filter_mine(client: TestClient, admin_headers: dict):
    create_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "My Lead"},
    )
    lead_id = create_resp.json()["id"]

    filter_resp = client.get("/api/v1/leads?scope=mine", headers=admin_headers)
    assert filter_resp.status_code == 200
    mine_ids = [l["id"] for l in filter_resp.json()]
    assert lead_id in mine_ids


# 10 & 11. Create a Lead-related Activity & verify lead.last_activity_at updates.
def test_lead_activity_creation_and_completion_updates_last_activity_at(
    client: TestClient, admin_headers: dict
):
    create_lead_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"title": "Activity Integration Lead"},
    )
    lead_id = create_lead_resp.json()["id"]
    assert create_lead_resp.json()["last_activity_at"] is None

    # Create Activity for Lead
    act_resp = client.post(
        "/api/v1/activities",
        headers=admin_headers,
        json={
            "subject": "Follow up call with prospect",
            "type": "Call",
            "related_entity_type": "lead",
            "related_entity_id": lead_id,
        },
    )
    assert act_resp.status_code == 200, act_resp.text
    act_id = act_resp.json()["id"]

    # Verify lead.last_activity_at is updated
    lead_after_act = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers).json()
    assert lead_after_act["last_activity_at"] is not None
    first_activity_time = lead_after_act["last_activity_at"]

    # Complete Activity
    comp_resp = client.patch(f"/api/v1/activities/{act_id}/complete", headers=admin_headers)
    assert comp_resp.status_code == 200

    lead_after_comp = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers).json()
    assert lead_after_comp["last_activity_at"] is not None
    assert lead_after_comp["last_activity_at"] >= first_activity_time


# 12. Convert a Lead with an existing contact_id.
def test_convert_lead_with_existing_contact(client: TestClient, admin_headers: dict):
    # Create College and Contact
    tag = datetime.now().microsecond
    col_resp = client.post(
        "/api/v1/companies",
        headers=admin_headers,
        json={"organization_name": f"Conversion Test College {tag}", "code": f"CONV-{tag}"},
    )
    col_id = col_resp.json()["id"]

    con_resp = client.post(
        "/api/v1/contacts",
        headers=admin_headers,
        json={"company_id": col_id, "name": "Dean Sharma", "email": f"dean{tag}@college.edu"},
    )
    con_id = con_resp.json()["id"]

    lead_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"company_id": col_id, "contact_id": con_id, "title": "Deal with Existing Contact"},
    )
    lead_id = lead_resp.json()["id"]

    conv_resp = client.post(
        f"/api/v1/leads/{lead_id}/convert",
        headers=admin_headers,
        json={"opportunity_title": "Converted Opportunity 1", "value": 150000.0},
    )
    assert conv_resp.status_code == 200, conv_resp.text
    conv_data = conv_resp.json()
    assert conv_data["company_id"] == col_id
    assert conv_data["contact_id"] == con_id

    lead_after = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers).json()
    assert lead_after["status"] == "Converted"
    assert lead_after["converted_opportunity_id"] == conv_data["opportunity_id"]


# 13. Convert a Lead without contact_id but with contact_name.
def test_convert_lead_creates_contact_from_prospect_info(client: TestClient, admin_headers: dict):
    tag = datetime.now().microsecond
    lead_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": f"Inbound Prospect {tag}",
            "contact_name": "Sunita Rao",
            "contact_email": f"sunita{tag}@raoenterprises.com",
            "contact_phone": "+91 9988776655",
            "company_name": f"Rao Enterprises {tag}",
            "business_segment": "IT Services",
        },
    )
    lead_id = lead_resp.json()["id"]

    conv_resp = client.post(
        f"/api/v1/leads/{lead_id}/convert",
        headers=admin_headers,
        json={"opportunity_title": f"Rao Enterprises Deal {tag}", "value": 500000.0},
    )
    assert conv_resp.status_code == 200, conv_resp.text
    conv_data = conv_resp.json()
    assert conv_data["contact_id"] is not None

    lead_after = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers).json()
    assert lead_after["status"] == "Converted"
    assert lead_after["contact_id"] == conv_data["contact_id"]
    assert lead_after["contact_name"] == "Sunita Rao"


# 14. Verify conversion routes based on business segment.
def test_conversion_routes_by_business_segment(
    client: TestClient, admin_headers: dict, db_session: Session
):
    ensure_founder_pipelines(db_session)

    tag = datetime.now().microsecond

    # Case A: EdTech -> EdTech Pipeline, Counselling
    lead_edtech = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": f"EdTech Deal {tag}",
            "contact_name": "Student Lead",
            "company_name": f"EdTech Academy {tag}",
            "business_segment": "EdTech",
        },
    ).json()

    conv_edtech = client.post(
        f"/api/v1/leads/{lead_edtech['id']}/convert",
        headers=admin_headers,
        json={"opportunity_title": f"EdTech Opp {tag}"},
    )
    assert conv_edtech.status_code == 200
    opp_edtech = conv_edtech.json()
    pipe_edtech = db_session.query(Pipeline).filter(Pipeline.id == opp_edtech["pipeline_id"]).first()
    assert pipe_edtech.name == "EdTech Pipeline"
    opp_record = client.get(f"/api/v1/opportunities/{opp_edtech['opportunity_id']}", headers=admin_headers).json()
    assert opp_record["stage_name"] == "Counselling"

    # Case B: IT Services -> IT Services Pipeline, Discovery
    lead_it = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": f"IT Deal {tag}",
            "contact_name": "CTO Lead",
            "company_name": f"IT Client {tag}",
            "business_segment": "IT Services",
        },
    ).json()

    conv_it = client.post(
        f"/api/v1/leads/{lead_it['id']}/convert",
        headers=admin_headers,
        json={"opportunity_title": f"IT Opp {tag}"},
    )
    assert conv_it.status_code == 200
    opp_it = conv_it.json()
    pipe_it = db_session.query(Pipeline).filter(Pipeline.id == opp_it["pipeline_id"]).first()
    assert pipe_it.name == "IT Services Pipeline"
    opp_record_it = client.get(f"/api/v1/opportunities/{opp_it['opportunity_id']}", headers=admin_headers).json()
    assert opp_record_it["stage_name"] == "Discovery"

    # Case C: Talent -> Talent / Outsourcing Pipeline, Requirement
    lead_talent = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": f"Talent Deal {tag}",
            "contact_name": "HR Lead",
            "company_name": f"Hiring Org {tag}",
            "business_segment": "Talent",
        },
    ).json()

    conv_talent = client.post(
        f"/api/v1/leads/{lead_talent['id']}/convert",
        headers=admin_headers,
        json={"opportunity_title": f"Talent Opp {tag}"},
    )
    assert conv_talent.status_code == 200
    opp_talent = conv_talent.json()
    pipe_talent = db_session.query(Pipeline).filter(Pipeline.id == opp_talent["pipeline_id"]).first()
    assert pipe_talent.name == "Talent / Outsourcing Pipeline"
    opp_record_talent = client.get(f"/api/v1/opportunities/{opp_talent['opportunity_id']}", headers=admin_headers).json()
    assert opp_record_talent["stage_name"] == "Requirement"


# 15. Verify explicit pipeline_id overrides automatic segment routing.
def test_explicit_pipeline_id_overrides_segment_routing(client: TestClient, admin_headers: dict):
    tag = datetime.now().microsecond
    pipelines = client.get("/api/v1/pipelines", headers=admin_headers).json()
    default_pipe = pipelines[0]

    lead = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "title": f"Override Test Lead {tag}",
            "contact_name": "Prospect Name",
            "company_name": f"Override Corp {tag}",
            "business_segment": "EdTech",
        },
    ).json()

    conv_resp = client.post(
        f"/api/v1/leads/{lead['id']}/convert",
        headers=admin_headers,
        json={
            "opportunity_title": f"Override Opp {tag}",
            "pipeline_id": default_pipe["id"],
        },
    )
    assert conv_resp.status_code == 200
    opp_data = conv_resp.json()
    assert opp_data["pipeline_id"] == default_pipe["id"]


# 16. Verify existing Lead conversion behavior remains compatible.
def test_existing_lead_conversion_behavior_remains_compatible(client: TestClient, admin_headers: dict):
    tag = datetime.now().microsecond
    col_resp = client.post(
        "/api/v1/companies",
        headers=admin_headers,
        json={"organization_name": f"Legacy Org {tag}", "code": f"LEG-{tag}"},
    )
    col_id = col_resp.json()["id"]

    lead_resp = client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={"company_id": col_id, "title": f"Legacy Lead {tag}", "expected_value": 200000.0},
    )
    lead_id = lead_resp.json()["id"]

    conv_resp = client.post(
        f"/api/v1/leads/{lead_id}/convert",
        headers=admin_headers,
        json={"opportunity_title": f"Legacy Converted Opp {tag}"},
    )
    assert conv_resp.status_code == 200
    res = conv_resp.json()
    assert "opportunity_id" in res
    assert res["company_id"] == col_id


# 17. Verify existing Leads remain valid and can be fetched.
def test_existing_leads_remain_valid(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/leads", headers=admin_headers)
    assert resp.status_code == 200
    leads = resp.json()
    assert isinstance(leads, list)
    for lead in leads:
        assert "id" in lead
        assert "title" in lead
        assert "status" in lead


# 18. Verify existing Opportunity records remain intact.
def test_existing_opportunities_remain_intact(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/opportunities", headers=admin_headers)
    assert resp.status_code == 200
    opps = resp.json()
    assert isinstance(opps, list)


# 19. Verify existing Activity records remain intact.
def test_existing_activities_remain_intact(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/activities", headers=admin_headers)
    assert resp.status_code == 200
    acts = resp.json()
    assert isinstance(acts, list)
