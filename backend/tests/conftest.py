import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db

# Disable rate limiting for automated tests to prevent 429 errors
settings.RATE_LIMIT_ENABLED = False
from app.core.security import get_password_hash, create_access_token
from app.users.models import User, Role, Permission, Department
from app.sales.models import Pipeline, PipelineStage
from app.accounting.models import Account, FiscalPeriod, TaxRate
from datetime import date
from decimal import Decimal

import os

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_DATABASE_URL:
    if TEST_DATABASE_URL.startswith("postgres://"):
        TEST_DATABASE_URL = TEST_DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif TEST_DATABASE_URL.startswith("postgresql://") and not TEST_DATABASE_URL.startswith("postgresql+"):
        TEST_DATABASE_URL = TEST_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    if TEST_DATABASE_URL:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create all permissions
    all_permissions = [
        ("crm.companies.view", "View Colleges", "crm"),
        ("crm.companies.create", "Create Colleges", "crm"),
        ("crm.companies.edit", "Edit Colleges", "crm"),
        ("crm.companies.delete", "Delete Colleges", "crm"),
        ("crm.leads.view", "View Leads", "crm"),
        ("crm.leads.create", "Create Leads", "crm"),
        ("crm.leads.edit", "Edit Leads", "crm"),
        ("crm.opportunities.view", "View Opps", "crm"),
        ("crm.opportunities.create", "Create Opps", "crm"),
        ("crm.opportunities.edit", "Edit Opps", "crm"),
        ("crm.opportunities.delete", "Delete Opps", "crm"),
        ("sales.pipelines.manage", "Manage Pipelines", "sales"),
        # Sales permissions
        ("sales.products.view", "View Products", "sales"),
        ("sales.products.create", "Create Products", "sales"),
        ("sales.products.edit", "Edit Products", "sales"),
        ("sales.products.delete", "Delete Products", "sales"),
        ("sales.quotations.view", "View Quotations", "sales"),
        ("sales.quotations.create", "Create Quotations", "sales"),
        ("sales.quotations.edit", "Edit Quotations", "sales"),
        ("sales.quotations.approve", "Approve Quotations", "sales"),
        ("sales.quotations.delete", "Delete Quotations", "sales"),
        ("sales.quotations.export", "Export Quotations", "sales"),
        ("sales.contracts.view", "View Contracts", "sales"),
        ("sales.contracts.create", "Create Contracts", "sales"),
        ("sales.contracts.edit", "Edit Contracts", "sales"),
        ("sales.contracts.approve", "Approve Contracts", "sales"),
        ("sales.orders.view", "View Orders", "sales"),
        ("sales.orders.create", "Create Orders", "sales"),
        ("sales.orders.edit", "Edit Orders", "sales"),
        ("sales.orders.confirm", "Confirm Orders", "sales"),
        ("sales.orders.cancel", "Cancel Orders", "sales"),
        # Projects & Operations
        ("projects.view", "View Projects", "projects"),
        ("projects.create", "Create Projects", "projects"),
        ("projects.edit", "Edit Projects", "projects"),
        ("projects.delete", "Delete Projects", "projects"),
        ("projects.assign", "Assign Team Members", "projects"),
        ("projects.manage", "Manage Milestones", "projects"),
        ("projects.complete", "Complete Projects", "projects"),
        # Tasks
        ("tasks.view", "View Tasks", "tasks"),
        ("tasks.create", "Create Tasks", "tasks"),
        ("tasks.edit", "Edit Tasks", "tasks"),
        ("tasks.assign", "Assign Tasks", "tasks"),
        ("tasks.manage", "Manage Tasks", "tasks"),
        # QA & Test Execution
        ("qa.view", "View QA", "qa"),
        ("qa.create", "Create QA", "qa"),
        ("qa.execute", "Execute Tests", "qa"),
        ("qa.edit", "Edit QA", "qa"),
        ("qa.manage", "Manage QA", "qa"),
        # Bug Tracking
        ("bugs.view", "View Bugs", "bugs"),
        ("bugs.create", "Create Bugs", "bugs"),
        ("bugs.edit", "Edit Bugs", "bugs"),
        ("bugs.assign", "Assign Bugs", "bugs"),
        ("bugs.resolve", "Resolve Bugs", "bugs"),
        ("bugs.retest", "Retest Bugs", "bugs"),
        ("bugs.close", "Close Bugs", "bugs"),
        ("bugs.manage", "Manage Bugs", "bugs"),
        # Delivery
        ("delivery.manage", "Manage Delivery", "projects"),
        # Service & Support
        ("service.view", "View Support Tickets", "service"),
        ("service.create", "Create Support Tickets", "service"),
        ("service.edit", "Edit Support Tickets", "service"),
        ("service.assign", "Assign Support Tickets", "service"),
        ("service.manage", "Manage Service Operations", "service"),
        ("service.delete", "Delete Support Tickets", "service"),
        ("service.resolve", "Resolve Support Tickets", "service"),
        ("service.close", "Close Support Tickets", "service"),
        ("service.reopen", "Reopen Support Tickets", "service"),
        ("service.escalate", "Escalate Support Tickets", "service"),
        ("service.manage_sla", "Manage Service SLA", "service"),
        ("service.view_reports", "View Service Reports", "service"),
        ("service.export", "Export Service Tickets", "service"),
        ("service.view_internal_notes", "View Internal Notes", "service"),
        ("service.manage_categories", "Manage Service Categories", "service"),
        ("service.manage_teams", "Manage Service Teams", "service"),
        # Finance & Accounting
        ("accounting.view", "View Financial Statements, Invoices & Reports", "accounting"),
        ("accounting.create", "Create Invoices, Bills, Payments & Expenses", "accounting"),
        ("accounting.edit", "Edit Draft Financial Records", "accounting"),
        ("accounting.delete_draft", "Delete Draft Financial Records", "accounting"),
        ("accounting.post", "Post Journal Entries, Invoices & Bills", "accounting"),
        ("accounting.void", "Void Financial Documents", "accounting"),
        ("accounting.reverse", "Reverse Posted Journal Entries", "accounting"),
        ("accounting.manage_accounts", "Manage Chart of Accounts", "accounting"),
        ("accounting.manage_periods", "Manage Fiscal Periods & Year-End Close", "accounting"),
        ("accounting.manage_tax", "Configure Tax Rates & Rules", "accounting"),
        ("accounting.manage_vendors", "Manage Vendors & Suppliers", "accounting"),
        ("accounting.manage_bills", "Manage Vendor Bills & Payables", "accounting"),
        ("accounting.manage_payments", "Process Customer & Vendor Payments", "accounting"),
        ("accounting.manage_invoices", "Manage Customer Invoicing", "accounting"),
        ("accounting.reconcile", "Perform Bank & Cash Reconciliation", "accounting"),
        ("accounting.reports", "View Full Financial Statements & Aging", "accounting"),
        ("accounting.export", "Export Accounting Data & Ledgers", "accounting"),
        # Communications & External Integrations
        ("communications.view", "View Unified Communications & History", "communications"),
        ("communications.send_email", "Compose and Send Customer Emails", "communications"),
        ("communications.send_whatsapp", "Send WhatsApp Business Messages", "communications"),
        ("communications.log_call", "Log Manual & Inbound Phone Calls", "communications"),
        ("communications.view_calls", "View Telephony Logs & Recordings", "communications"),
        ("communications.view_email", "View Email Threads & Mailbox", "communications"),
        ("communications.view_whatsapp", "View WhatsApp Conversations", "communications"),
        ("communications.manage_integrations", "Configure Gmail, WhatsApp & Phone Integrations", "communications"),
        ("communications.manage_templates", "Manage Communication Templates", "communications"),
        ("communications.export", "Export Communication Transcripts", "communications"),
        ("communications.delete_draft", "Delete Draft Communication Messages", "communications"),
        # Reports & Analytics
        ("reports.view", "View Executive Reports & Dashboards", "reports"),
        ("reports.view_executive", "View Executive Management Dashboard", "reports"),
        ("reports.view_sales", "View Sales & Pipeline Reports", "reports"),
        ("reports.view_projects", "View Projects & Delivery Reports", "reports"),
        ("reports.view_qa", "View QA & Quality Reports", "reports"),
        ("reports.view_service", "View Service & SLA Reports", "reports"),
        ("reports.view_finance", "View Finance & Aging Reports", "reports"),
        ("reports.view_communications", "View Communications Reports", "reports"),
        ("reports.view_team", "View Team Workload Reports", "reports"),
        ("reports.export", "Export CRM Data & Analytics", "reports"),
        ("reports.manage_saved", "Create and Manage Saved Reports", "reports"),
        ("audit.view", "View Audit Logs", "audit"),
        ("users.manage", "Manage Users", "users"),
        # Automation & Notifications
        ("notifications.view", "View Notifications", "notifications"),
        ("notifications.manage", "Manage Notifications", "notifications"),
        ("automation.view", "View Automation", "automation"),
        ("automation.manage", "Manage Automation", "automation"),
        # AI Assistant (Phase 12)
        ("ai.chat", "Interact with AI Assistant", "ai"),
        ("ai.manage", "Manage AI Assistant", "ai"),
    ]
    perm_objs = {}
    for code, name, mod in all_permissions:
        perm = Permission(code=code, name=name, module=mod)
        db.add(perm)
        perm_objs[code] = perm
    db.commit()

    # Roles
    admin_role = Role(name="Super Admin", description="Super Admin", is_system=True)
    admin_role.permissions = list(perm_objs.values())
    db.add(admin_role)

    sales_manager_role = Role(name="Sales Manager", description="Sales Manager", is_system=False)
    sales_manager_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "crm.companies.create", "crm.companies.edit",
            "crm.leads.view", "crm.leads.create", "crm.leads.edit",
            "crm.opportunities.view", "crm.opportunities.create", "crm.opportunities.edit",
            "sales.pipelines.manage",
            "sales.products.view", "sales.products.create", "sales.products.edit",
            "sales.quotations.view", "sales.quotations.create", "sales.quotations.edit", "sales.quotations.approve",
            "sales.contracts.view", "sales.contracts.create", "sales.contracts.edit", "sales.contracts.approve",
            "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.orders.confirm", "sales.orders.cancel",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp", "communications.manage_templates",
        ]
    ]
    db.add(sales_manager_role)

    sales_exec_role = Role(name="Sales Executive", description="Sales Executive", is_system=False)
    sales_exec_role.permissions = [
        perm_objs["crm.companies.view"],
        perm_objs["crm.leads.view"],
        perm_objs["crm.leads.create"],
        perm_objs["crm.leads.edit"],
        perm_objs["crm.opportunities.view"],
        perm_objs["sales.products.view"],
        perm_objs["sales.quotations.view"],
        perm_objs["sales.quotations.create"],
        perm_objs["sales.quotations.edit"],
        perm_objs["sales.contracts.view"],
        perm_objs["sales.orders.view"],
        perm_objs["sales.orders.create"],
        perm_objs["communications.view"],
        perm_objs["communications.send_email"],
        perm_objs["communications.send_whatsapp"],
        perm_objs["communications.log_call"],
        perm_objs["communications.view_calls"],
        perm_objs["communications.view_email"],
        perm_objs["communications.view_whatsapp"],
        perm_objs["ai.chat"],
    ]
    db.add(sales_exec_role)

    pm_role = Role(name="Project Manager", description="Project Manager", is_system=False)
    pm_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "sales.orders.view", "sales.contracts.view",
            "projects.view", "projects.create", "projects.edit", "projects.assign", "projects.manage", "projects.complete",
            "tasks.view", "tasks.create", "tasks.edit", "tasks.assign", "tasks.manage",
            "qa.view", "bugs.view", "bugs.create", "bugs.edit", "bugs.assign", "delivery.manage",
            "audit.view",
            "communications.view", "communications.view_email", "communications.view_calls",
        ]
    ]
    db.add(pm_role)

    dev_role = Role(name="Developer", description="Developer", is_system=False)
    dev_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "projects.view",
            "tasks.view", "tasks.edit",
            "qa.view",
            "bugs.view", "bugs.create", "bugs.edit", "bugs.resolve"
        ]
    ]
    db.add(dev_role)

    qa_role = Role(name="QA Engineer", description="QA Engineer", is_system=False)
    qa_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "projects.view",
            "tasks.view",
            "qa.view", "qa.create", "qa.execute", "qa.edit", "qa.manage",
            "bugs.view", "bugs.create", "bugs.edit", "bugs.retest", "bugs.close",
            "service.view", "service.view_internal_notes"
        ]
    ]
    db.add(qa_role)

    service_manager_role = Role(name="Service Manager", description="Service Manager", is_system=False)
    service_manager_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view",
            "service.view", "service.create", "service.edit", "service.assign", "service.manage",
            "service.delete", "service.resolve", "service.close", "service.reopen", "service.escalate",
            "service.manage_sla", "service.view_reports", "service.export",
            "service.view_internal_notes", "service.manage_categories", "service.manage_teams",
            "projects.view", "bugs.view", "audit.view",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp", "communications.manage_templates",
        ]
    ]
    db.add(service_manager_role)

    service_exec_role = Role(name="Service Executive", description="Service Executive", is_system=False)
    service_exec_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view",
            "service.view", "service.create", "service.edit", "service.resolve",
            "service.view_internal_notes", "service.reopen",
            "projects.view", "bugs.view",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp",
        ]
    ]
    db.add(service_exec_role)

    fin_mgr_role = Role(name="Finance Manager", description="Finance Manager", is_system=False)
    fin_mgr_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "sales.orders.view", "sales.contracts.view", "projects.view",
            "accounting.view", "accounting.create", "accounting.edit", "accounting.delete_draft",
            "accounting.post", "accounting.void", "accounting.reverse", "accounting.manage_accounts",
            "accounting.manage_periods", "accounting.manage_tax", "accounting.manage_vendors",
            "accounting.manage_bills", "accounting.manage_payments", "accounting.manage_invoices",
            "accounting.reconcile", "accounting.reports", "accounting.export",
            "audit.view"
        ]
    ]
    db.add(fin_mgr_role)

    accountant_role = Role(name="Accountant", description="Accountant", is_system=False)
    accountant_role.permissions = [
        perm_objs[c] for c in [
            "crm.companies.view", "sales.orders.view",
            "accounting.view", "accounting.create", "accounting.edit", "accounting.delete_draft",
            "accounting.post", "accounting.manage_invoices", "accounting.manage_payments",
            "accounting.manage_bills", "accounting.manage_vendors", "accounting.reconcile",
            "accounting.reports", "accounting.export"
        ]
    ]
    db.add(accountant_role)

    # Department
    dept = Department(name="Sales Department")
    db.add(dept)
    eng_dept = Department(name="Engineering")
    db.add(eng_dept)
    svc_dept = Department(name="Client Services")
    db.add(svc_dept)
    fin_dept = Department(name="Finance & Accounting")
    db.add(fin_dept)
    db.commit()

    # Users
    admin_user = User(
        email="test.admin@edtechcrm.com",
        hashed_password=get_password_hash("AdminPass123"),
        first_name="Admin",
        last_name="Tester",
        is_active=True,
        is_superuser=True,
        department_id=dept.id,
    )
    admin_user.roles = [admin_role]
    db.add(admin_user)

    sales_mgr_user = User(
        email="test.manager@edtechcrm.com",
        hashed_password=get_password_hash("ManagerPass123"),
        first_name="Manager",
        last_name="Tester",
        is_active=True,
        is_superuser=False,
        department_id=dept.id,
    )
    sales_mgr_user.roles = [sales_manager_role]
    db.add(sales_mgr_user)

    sales_user = User(
        email="test.sales@edtechcrm.com",
        hashed_password=get_password_hash("SalesPass123"),
        first_name="Sales",
        last_name="Tester",
        is_active=True,
        is_superuser=False,
        department_id=dept.id,
    )
    sales_user.roles = [sales_exec_role]
    db.add(sales_user)

    pm_user = User(
        email="test.pm@edtechcrm.com",
        hashed_password=get_password_hash("PmPass123"),
        first_name="Project",
        last_name="Manager",
        is_active=True,
        is_superuser=False,
        department_id=eng_dept.id,
    )
    pm_user.roles = [pm_role]
    db.add(pm_user)

    dev_user = User(
        email="test.dev@edtechcrm.com",
        hashed_password=get_password_hash("DevPass123"),
        first_name="Core",
        last_name="Developer",
        is_active=True,
        is_superuser=False,
        department_id=eng_dept.id,
    )
    dev_user.roles = [dev_role]
    db.add(dev_user)

    qa_user = User(
        email="test.qa@edtechcrm.com",
        hashed_password=get_password_hash("QaPass123"),
        first_name="QA",
        last_name="Engineer",
        is_active=True,
        is_superuser=False,
        department_id=eng_dept.id,
    )
    qa_user.roles = [qa_role]
    db.add(qa_user)

    service_mgr_user = User(
        email="test.servicemgr@edtechcrm.com",
        hashed_password=get_password_hash("ServiceMgrPass123"),
        first_name="Service",
        last_name="Manager",
        is_active=True,
        is_superuser=False,
        department_id=svc_dept.id,
    )
    service_mgr_user.roles = [service_manager_role]
    db.add(service_mgr_user)

    service_exec_user = User(
        email="test.serviceexec@edtechcrm.com",
        hashed_password=get_password_hash("ServiceExecPass123"),
        first_name="Service",
        last_name="Executive",
        is_active=True,
        is_superuser=False,
        department_id=svc_dept.id,
    )
    service_exec_user.roles = [service_exec_role]
    db.add(service_exec_user)

    fin_mgr_user = User(
        email="test.finmgr@edtechcrm.com",
        hashed_password=get_password_hash("FinMgrPass123"),
        first_name="Finance",
        last_name="Manager",
        is_active=True,
        is_superuser=False,
        department_id=fin_dept.id,
    )
    fin_mgr_user.roles = [fin_mgr_role]
    db.add(fin_mgr_user)

    accountant_user = User(
        email="test.accountant@edtechcrm.com",
        hashed_password=get_password_hash("AccountantPass123"),
        first_name="Staff",
        last_name="Accountant",
        is_active=True,
        is_superuser=False,
        department_id=fin_dept.id,
    )
    accountant_user.roles = [accountant_role]
    db.add(accountant_user)

    # Pipeline & Stages
    pipeline = Pipeline(name="Default Sales Pipeline", is_default=True, is_active=True)
    db.add(pipeline)
    db.flush()

    s1 = PipelineStage(pipeline_id=pipeline.id, name="Lead In", order=1, probability=10)
    s2 = PipelineStage(pipeline_id=pipeline.id, name="Discovery", order=2, probability=30)
    s3 = PipelineStage(pipeline_id=pipeline.id, name="Closed Won", order=3, probability=100, is_won=True)
    s4 = PipelineStage(pipeline_id=pipeline.id, name="Closed Lost", order=4, probability=0, is_lost=True)
    db.add_all([s1, s2, s3, s4])

    # Accounting Seed: Chart of Accounts
    coa_defaults = [
        ("1000", "Cash on Hand", "ASSET", None, False, True),
        ("1010", "HDFC Bank Operating Account", "ASSET", None, False, True),
        ("1020", "ICICI Bank Client Escrow", "ASSET", None, False, True),
        ("1200", "Accounts Receivable", "ASSET", None, True, False),
        ("1300", "Prepaid Expenses", "ASSET", None, False, False),
        ("1500", "Computer & Office Equipment", "ASSET", None, False, False),
        ("2110", "GST / Input Tax Credit", "ASSET", None, False, False),
        ("2000", "Accounts Payable", "LIABILITY", None, True, False),
        ("2100", "GST / Tax Output Payable", "LIABILITY", None, False, False),
        ("2200", "Salaries & Employee Dues Payable", "LIABILITY", None, False, False),
        ("3000", "Founder Equity & Paid-in Capital", "EQUITY", None, False, False),
        ("3100", "Retained Earnings", "EQUITY", None, False, False),
        ("4000", "Software & Product License Revenue", "REVENUE", None, False, False),
        ("4100", "Implementation & Professional Services", "REVENUE", None, False, False),
        ("4200", "AMC & Annual Maintenance", "REVENUE", None, False, False),
        ("5000", "Salaries & Wages", "EXPENSE", None, False, False),
        ("5100", "Cloud Infrastructure & Hosting", "EXPENSE", None, False, False),
        ("5200", "Software Subscriptions & Tooling", "EXPENSE", None, False, False),
        ("5300", "Office & Operating Expenses", "EXPENSE", None, False, False),
        ("5400", "Marketing & Institutional Events", "EXPENSE", None, False, False),
        ("5500", "Legal & Professional Fees", "EXPENSE", None, False, False),
        ("5600", "Travel & Campus Demonstrations", "EXPENSE", None, False, False),
    ]
    for code, name, atype, parent, is_ctrl, is_bc in coa_defaults:
        db.add(Account(
            account_code=code,
            account_name=name,
            account_type=atype,
            parent_account_id=parent,
            is_control_account=is_ctrl,
            is_bank_or_cash=is_bc,
            is_active=True
        ))

    # Fiscal Period
    fp = FiscalPeriod(
        name="FY 2026-27",
        start_date=date(2026, 4, 1),
        end_date=date(2027, 3, 31),
        status="OPEN"
    )
    db.add(fp)

    # Tax Rates
    db.add(TaxRate(name="GST 18%", code="GST_18", rate=Decimal("18.00"), is_active=True))
    db.add(TaxRate(name="GST 5%", code="GST_5", rate=Decimal("5.00"), is_active=True))
    db.add(TaxRate(name="Exempt", code="EXEMPT", rate=Decimal("0.00"), is_active=True))

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.admin@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def sales_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.sales@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def sales_manager_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.manager@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def pm_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.pm@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def dev_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.dev@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def qa_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.qa@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def service_manager_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.servicemgr@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def service_exec_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.serviceexec@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def service_readonly_headers(db_session: Session) -> dict:
    perm = db_session.query(Permission).filter(Permission.code == "service.view").first()
    role = Role(name="Service Readonly", description="Readonly")
    role.permissions = [perm]
    db_session.add(role)
    user = User(
        email="readonly.service@edtechcrm.com",
        hashed_password=get_password_hash("ReadonlyPass123"),
        first_name="Readonly",
        last_name="Service",
        is_active=True,
    )
    user.roles = [role]
    db_session.add(user)
    db_session.commit()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def finance_manager_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.finmgr@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def accountant_headers(db_session: Session) -> dict:
    user = db_session.query(User).filter(User.email == "test.accountant@edtechcrm.com").first()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


