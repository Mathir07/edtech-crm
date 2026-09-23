import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.sales.models import Pipeline, PipelineStage, Opportunity
from app.organizations.models import Company

def ensure_pipelines(db: Session):
    """Ensure founder pipelines and stages exist in the test DB session."""
    pipelines_spec = [
        ("Higher Education Sales Pipeline", [
            ("Lead In", 1), ("Contact Made", 2), ("Needs Defined", 3), ("Proposal Sent", 4),
            ("Negotiation", 5), ("Contract Sent", 6), ("Closed Won", 7), ("Closed Lost", 8)
        ]),
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
            for s_name, s_order in stages:
                stage = PipelineStage(
                    pipeline_id=pipe.id,
                    name=s_name,
                    order=s_order,
                    probability=10 * s_order if s_order < 10 else 90,
                    is_won=("Won" in s_name or "Enrolled" in s_name or "Joined" in s_name or "Closed Won" in s_name),
                    is_lost=("Lost" in s_name),
                )
                db.add(stage)
    db.commit()

def ensure_college(db: Session) -> str:
    col = db.query(Company).first()
    if not col:
        import uuid
        col = Company(
            organization_name="PSG College of Technology",
            code=f"PSG-{uuid.uuid4().hex[:6]}",
            type="Engineering College",
            city="Coimbatore",
            state="Tamil Nadu",
        )
        db.add(col)
        db.commit()
    return col.id

def test_all_founder_and_legacy_pipelines_exist(client: TestClient, admin_headers: dict, db_session: Session):
    """Verify EdTech, IT Services, Talent / Outsourcing, and Higher Education pipelines exist."""
    ensure_pipelines(db_session)
    res = client.get("/api/v1/pipelines", headers=admin_headers)
    assert res.status_code == 200
    pipelines = res.json()
    
    pipe_names = {p["name"] for p in pipelines}
    assert "EdTech Pipeline" in pipe_names
    assert "IT Services Pipeline" in pipe_names
    assert "Talent / Outsourcing Pipeline" in pipe_names
    assert "Higher Education Sales Pipeline" in pipe_names

def test_pipeline_stages_order_and_names(client: TestClient, admin_headers: dict, db_session: Session):
    """Verify each founder pipeline has exact configured stages in correct order."""
    ensure_pipelines(db_session)
    res = client.get("/api/v1/pipelines", headers=admin_headers)
    assert res.status_code == 200
    pipelines = {p["name"]: p for p in res.json()}

    # 1. EdTech Pipeline
    edtech = pipelines["EdTech Pipeline"]
    edtech_stages = [s["name"] for s in sorted(edtech["stages"], key=lambda x: x["order"])]
    assert edtech_stages == [
        "Lead", "Qualified", "Counselling", "Demo", "Payment", "Enrolled", "Completed", "Referral"
    ]

    # 2. IT Services Pipeline
    it = pipelines["IT Services Pipeline"]
    it_stages = [s["name"] for s in sorted(it["stages"], key=lambda x: x["order"])]
    assert it_stages == [
        "Prospect", "Contacted", "Discovery", "Requirement", "Proposal", "Negotiation", "Won", "Delivery", "Retainer"
    ]

    # 3. Talent / Outsourcing Pipeline
    talent = pipelines["Talent / Outsourcing Pipeline"]
    talent_stages = [s["name"] for s in sorted(talent["stages"], key=lambda x: x["order"])]
    assert talent_stages == [
        "Company Prospect", "Requirement", "Candidate Search", "Profiles Shared", "Interview", "Selected", "Joined", "Invoice"
    ]

def test_filter_opportunities_by_pipeline_id(client: TestClient, admin_headers: dict, db_session: Session):
    """Verify GET /api/v1/opportunities?pipeline_id=... filters properly and includes pipeline_name."""
    ensure_pipelines(db_session)
    company_id = ensure_college(db_session)
    
    pipes_res = client.get("/api/v1/pipelines", headers=admin_headers)
    assert pipes_res.status_code == 200
    pipes = pipes_res.json()
    
    higher_ed = next(p for p in pipes if p["name"] == "Higher Education Sales Pipeline")
    first_stage = higher_ed["stages"][0]
    
    # Create an opp in higher ed
    client.post("/api/v1/opportunities", json={
        "title": "Higher Ed Test Deal",
        "company_id": company_id,
        "pipeline_id": higher_ed["id"],
        "stage_id": first_stage["id"],
        "value": 450000.0,
    }, headers=admin_headers)

    res = client.get(f"/api/v1/opportunities?pipeline_id={higher_ed['id']}", headers=admin_headers)
    assert res.status_code == 200
    opps = res.json()
    assert len(opps) > 0
    for o in opps:
        assert o["pipeline_id"] == higher_ed["id"]
        assert o["pipeline_name"] == "Higher Education Sales Pipeline"

def test_create_opportunity_with_specific_pipeline_and_stage(client: TestClient, admin_headers: dict, db_session: Session):
    """Verify creating an opportunity under a founder pipeline works and validates stage match."""
    ensure_pipelines(db_session)
    company_id = ensure_college(db_session)
    
    pipes_res = client.get("/api/v1/pipelines", headers=admin_headers)
    pipes = {p["name"]: p for p in pipes_res.json()}
    it_pipe = pipes["IT Services Pipeline"]
    edtech_pipe = pipes["EdTech Pipeline"]
    
    it_first_stage = next(s for s in it_pipe["stages"] if s["name"] == "Prospect")
    
    # Successful creation under IT Services
    opp_payload = {
        "title": "IT Services Cloud Migration Deal",
        "company_id": company_id,
        "pipeline_id": it_pipe["id"],
        "stage_id": it_first_stage["id"],
        "value": 750000.0,
    }
    create_res = client.post("/api/v1/opportunities", json=opp_payload, headers=admin_headers)
    assert create_res.status_code == 200, f"Failed: {create_res.text}"
    created_opp = create_res.json()
    assert created_opp["pipeline_id"] == it_pipe["id"]
    assert created_opp["stage_id"] == it_first_stage["id"]
    assert created_opp["pipeline_name"] == "IT Services Pipeline"
    assert created_opp["stage_name"] == "Prospect"
    
    # Prevent cross-pipeline stage assignment (EdTech stage with IT pipeline)
    edtech_first_stage = next(s for s in edtech_pipe["stages"] if s["name"] == "Lead")
    invalid_payload = {
        "title": "Invalid Cross Pipeline Deal",
        "company_id": company_id,
        "pipeline_id": it_pipe["id"],
        "stage_id": edtech_first_stage["id"],
        "value": 100000.0,
    }
    invalid_res = client.post("/api/v1/opportunities", json=invalid_payload, headers=admin_headers)
    assert invalid_res.status_code == 400
    assert "belong to selected pipeline" in invalid_res.text

def test_stage_movement_cross_pipeline_validation(client: TestClient, admin_headers: dict, db_session: Session):
    """Verify stage movement accepts valid stages of the same pipeline and rejects other pipelines' stages."""
    ensure_pipelines(db_session)
    company_id = ensure_college(db_session)
    
    pipes_res = client.get("/api/v1/pipelines", headers=admin_headers)
    pipes = {p["name"]: p for p in pipes_res.json()}
    it_pipe = pipes["IT Services Pipeline"]
    edtech_pipe = pipes["EdTech Pipeline"]
    
    it_prospect_stage = next(s for s in it_pipe["stages"] if s["name"] == "Prospect")
    it_discovery_stage = next(s for s in it_pipe["stages"] if s["name"] == "Discovery")
    edtech_demo_stage = next(s for s in edtech_pipe["stages"] if s["name"] == "Demo")
    
    # Create test opp
    create_res = client.post("/api/v1/opportunities", json={
        "title": "IT Stage Movement Test Deal",
        "company_id": company_id,
        "pipeline_id": it_pipe["id"],
        "stage_id": it_prospect_stage["id"],
        "value": 300000.0,
    }, headers=admin_headers)
    assert create_res.status_code == 200
    opp_id = create_res.json()["id"]
    
    # Valid advance to Discovery in same pipeline
    move_res = client.patch(f"/api/v1/opportunities/{opp_id}/stage", json={
        "stage_id": it_discovery_stage["id"]
    }, headers=admin_headers)
    assert move_res.status_code == 200
    assert move_res.json()["stage_id"] == it_discovery_stage["id"]
    
    # Invalid move to EdTech stage
    invalid_move = client.patch(f"/api/v1/opportunities/{opp_id}/stage", json={
        "stage_id": edtech_demo_stage["id"]
    }, headers=admin_headers)
    assert invalid_move.status_code == 400
    assert "belong to opportunity's pipeline" in invalid_move.text
