import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from decimal import Decimal
from datetime import datetime, timezone, timedelta, date
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.users.models import Role, Permission, User, Department, Team
from app.organizations.models import Company, Contact
from app.crm.models import LeadSource, Lead
from app.sales.models import (
    Pipeline, PipelineStage, Opportunity,
    ProductCategory, Product, NumberSequence,
    Quotation, QuotationItem, Contract,
    SalesOrder, SalesOrderItem,
)
from app.activities.models import Activity, Task, Meeting, Note
from app.audit.models import AuditLog
from app.projects.models import Project, ProjectMember, Milestone, ProjectTask
from app.qa.models import TestSuite, TestCase, TestExecution, Bug, BugComment, BugAttachment
from app.service.models import (
    ServiceCategory, ServiceSubcategory, SLAPolicy,
    Ticket, TicketComment, TicketAttachment,
    TicketStatusHistory, TicketAssignment, TicketEscalation
)
from app.accounting.models import Account, FiscalPeriod, TaxRate

def seed():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding permissions...")
        all_permissions = [
            # CRM
            ("crm.companies.view", "View Companies & Accounts", "crm"),
            ("crm.companies.create", "Create New Companies", "crm"),
            ("crm.companies.edit", "Edit Company Details", "crm"),
            ("crm.companies.delete", "Delete Companies", "crm"),
            ("crm.leads.view", "View Inbound & Outbound Leads", "crm"),
            ("crm.leads.create", "Create Leads", "crm"),
            ("crm.leads.edit", "Edit & Qualify Leads", "crm"),
            ("crm.leads.assign", "Assign Leads to Sales Team", "crm"),
            ("crm.opportunities.view", "View Opportunities", "crm"),
            ("crm.opportunities.create", "Create Sales Opportunities", "crm"),
            ("crm.opportunities.edit", "Edit Opportunity & Stages", "crm"),
            ("crm.opportunities.delete", "Delete Opportunities", "crm"),
            # Sales & Products Catalog
            ("sales.products.view", "View Products & Service Catalog", "sales"),
            ("sales.products.create", "Create Products & Categories", "sales"),
            ("sales.products.edit", "Edit Products & Categories", "sales"),
            ("sales.products.delete", "Delete Products & Categories", "sales"),
            # Sales & Quotations
            ("sales.pipelines.manage", "Configure Sales Pipelines & Stages", "sales"),
            ("sales.quotations.view", "View Quotations & Proposals", "sales"),
            ("sales.quotations.create", "Create Quotations", "sales"),
            ("sales.quotations.edit", "Edit Quotations", "sales"),
            ("sales.quotations.approve", "Approve Quotations & Discounts", "sales"),
            ("sales.quotations.delete", "Delete Quotations", "sales"),
            ("sales.quotations.export", "Export Quotations", "sales"),
            # Sales Contracts
            ("sales.contracts.view", "View Institutional Contracts", "sales"),
            ("sales.contracts.create", "Create Contracts", "sales"),
            ("sales.contracts.edit", "Edit Contracts", "sales"),
            ("sales.contracts.approve", "Activate & Sign Contracts", "sales"),
            # Sales Orders
            ("sales.orders.view", "View Sales Orders", "sales"),
            ("sales.orders.create", "Create Sales Orders", "sales"),
            ("sales.orders.edit", "Edit Sales Orders", "sales"),
            ("sales.orders.confirm", "Confirm Sales Orders & Trigger Handoff", "sales"),
            ("sales.orders.cancel", "Cancel Sales Orders", "sales"),
            # Projects & Operations
            ("projects.view", "View Client Projects", "projects"),
            ("projects.create", "Create Deployment Projects", "projects"),
            ("projects.edit", "Edit Project Details & Timeline", "projects"),
            ("projects.delete", "Delete Projects", "projects"),
            ("projects.assign", "Assign Team Members to Project", "projects"),
            ("projects.manage", "Manage Milestones & Scope", "projects"),
            ("projects.complete", "Complete and Close Projects", "projects"),
            # Tasks
            ("tasks.view", "View Project & Developer Tasks", "tasks"),
            ("tasks.create", "Create Tasks", "tasks"),
            ("tasks.edit", "Edit Task Details & Status", "tasks"),
            ("tasks.assign", "Assign Tasks to Team Members", "tasks"),
            ("tasks.manage", "Manage and Delete Tasks", "tasks"),
            # QA & Test Execution
            ("qa.view", "View QA Testing & Test Cases", "qa"),
            ("qa.create", "Create QA Test Suites & Cases", "qa"),
            ("qa.execute", "Execute QA Tests and Log Results", "qa"),
            ("qa.edit", "Edit Test Cases & Suites", "qa"),
            ("qa.manage", "Manage and Archive QA Suites", "qa"),
            # Bug Tracking
            ("bugs.view", "View Bugs and Issues", "bugs"),
            ("bugs.create", "Report and Create Bugs", "bugs"),
            ("bugs.edit", "Edit Bug Details & Severity", "bugs"),
            ("bugs.assign", "Assign Bugs to Developers", "bugs"),
            ("bugs.resolve", "Mark Bugs as Resolved", "bugs"),
            ("bugs.retest", "Retest and Reopen/Close Bugs", "bugs"),
            ("bugs.close", "Close Bugs", "bugs"),
            ("bugs.manage", "Manage and Delete Bugs", "bugs"),
            # Delivery
            ("delivery.manage", "Manage Delivery Workflows & QA Overrides", "projects"),
            # Service & Support
            ("service.view", "View Support Tickets & Service Portal", "service"),
            ("service.create", "Create Support Tickets", "service"),
            ("service.edit", "Edit Support Tickets", "service"),
            ("service.assign", "Assign and Reassign Support Tickets", "service"),
            ("service.manage", "Manage Service Operations & Workflows", "service"),
            ("service.delete", "Delete Support Tickets", "service"),
            ("service.resolve", "Resolve Support Tickets", "service"),
            ("service.close", "Close Support Tickets", "service"),
            ("service.reopen", "Reopen Resolved or Closed Tickets", "service"),
            ("service.escalate", "Escalate Support Tickets", "service"),
            ("service.manage_sla", "Manage Service SLA Policies", "service"),
            ("service.view_reports", "View Service Reports & Analytics", "service"),
            ("service.export", "Export Service Tickets", "service"),
            ("service.view_internal_notes", "View and Add Internal Notes", "service"),
            ("service.manage_categories", "Manage Service Categories & Subcategories", "service"),
            ("service.manage_teams", "Manage Service Support Teams", "service"),
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
            # Communications & Integrations
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
            # Analytics & Audit
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
            ("audit.view", "View Enterprise Audit Logs", "audit"),
            ("users.manage", "Manage System Users, Roles & Permissions", "users"),
            # Automation & Notifications (Phase 11)
            ("notifications.view", "View Internal CRM Notifications & Center", "notifications"),
            ("notifications.manage", "Manage All Notifications & Preferences", "notifications"),
            ("automation.view", "View Automation Rules & Execution Status", "automation"),
            ("automation.manage", "Manage and Trigger System Automations", "automation"),
            # AI Assistant (Phase 12)
            ("ai.chat", "Interact with AI Assistant", "ai"),
            ("ai.manage", "Manage AI Assistant & Settings", "ai"),
        ]

        perm_objs = {}
        for code, name, module in all_permissions:
            perm = db.query(Permission).filter(Permission.code == code).first()
            if not perm:
                perm = Permission(code=code, name=name, module=module)
                db.add(perm)
                db.flush()
            perm_objs[code] = perm

        print("Seeding initial 11 roles...")
        roles_data = [
            ("Super Admin", "Full unrestricted access across all organizational modules", True),
            ("Management", "Executive oversight, strategic pipeline visibility, reporting and approvals", False),
            ("Sales Manager", "Manages sales pipeline, assign leads, approve quotations and monitor KPIs", False),
            ("Sales Executive", "Day-to-day lead nurturing, college meetings, demos, opportunity closing", False),
            ("Project Manager", "Oversees deployment, college software implementation, and milestone delivery", False),
            ("Developer", "Builds college integrations, custom LMS connectors and technical deliverables", False),
            ("QA Engineer", "Validates implementation correctness, user acceptance testing with college teams", False),
            ("Service Manager", "Manages college customer success, SLAs, escalation and AMC renewals", False),
            ("Service Executive", "Resolves daily college support queries, ticketing, and service requests", False),
            ("Accountant", "Handles college invoicing, GST compliance, receipt reconciliation and payments", False),
            ("Finance Manager", "Financial planning, payment sign-offs, accounts receivable and fiscal health", False),
        ]

        role_objs = {}
        for name, desc, is_sys in roles_data:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, description=desc, is_system=is_sys)
                db.add(role)
                db.flush()
            role_objs[name] = role

        # Assign permissions to roles
        # Super Admin gets all
        role_objs["Super Admin"].permissions = list(perm_objs.values())
        
        # Management
        mgmt_perms = [
            "crm.companies.view", "crm.leads.view", "crm.opportunities.view",
            "sales.products.view", "sales.quotations.view", "sales.quotations.approve", "sales.quotations.export",
            "sales.contracts.view", "sales.contracts.approve",
            "sales.orders.view", "sales.orders.confirm",
            "projects.view", "projects.complete", "tasks.view", "qa.view", "bugs.view", "delivery.manage",
            "service.view", "accounting.view",
            "reports.view", "reports.view_executive", "reports.view_sales", "reports.view_projects", "reports.view_qa",
            "reports.view_service", "reports.view_finance", "reports.view_communications", "reports.view_team",
            "reports.export", "reports.manage_saved", "audit.view",
            "communications.view", "communications.view_email", "communications.view_whatsapp", "communications.view_calls", "communications.export",
            "notifications.view", "notifications.manage", "automation.view", "automation.manage",
            "ai.chat", "ai.manage"
        ]
        role_objs["Management"].permissions = [perm_objs[c] for c in mgmt_perms if c in perm_objs]

        # Sales Manager
        sm_perms = [
            "crm.companies.view", "crm.companies.create", "crm.companies.edit",
            "crm.leads.view", "crm.leads.create", "crm.leads.edit", "crm.leads.assign",
            "crm.opportunities.view", "crm.opportunities.create", "crm.opportunities.edit",
            "sales.pipelines.manage",
            "sales.products.view", "sales.products.create", "sales.products.edit",
            "sales.quotations.view", "sales.quotations.create", "sales.quotations.edit", "sales.quotations.approve", "sales.quotations.delete", "sales.quotations.export",
            "sales.contracts.view", "sales.contracts.create", "sales.contracts.edit", "sales.contracts.approve",
            "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.orders.confirm", "sales.orders.cancel",
            "projects.view",
            "reports.view", "reports.view_sales", "reports.export", "reports.manage_saved",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp", "communications.manage_templates",
            "notifications.view", "automation.view"
        ]
        role_objs["Sales Manager"].permissions = [perm_objs[c] for c in sm_perms if c in perm_objs]

        # Sales Executive (Strictly barred from quotation approval and order confirmation)
        se_perms = [
            "crm.companies.view", "crm.companies.create", "crm.companies.edit",
            "crm.leads.view", "crm.leads.create", "crm.leads.edit",
            "crm.opportunities.view", "crm.opportunities.create", "crm.opportunities.edit",
            "sales.products.view",
            "sales.quotations.view", "sales.quotations.create", "sales.quotations.edit",
            "sales.contracts.view",
            "sales.orders.view", "sales.orders.create",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp",
            "notifications.view"
        ]
        role_objs["Sales Executive"].permissions = [perm_objs[c] for c in se_perms if c in perm_objs]

        # Project Manager
        pm_perms = [
            "crm.companies.view",
            "projects.view", "projects.create", "projects.edit", "projects.assign", "projects.manage", "projects.complete",
            "tasks.view", "tasks.create", "tasks.edit", "tasks.assign", "tasks.manage",
            "qa.view", "bugs.view", "bugs.create", "bugs.assign", "delivery.manage",
            "audit.view",
            "reports.view", "reports.view_projects", "reports.view_qa",
            "communications.view", "communications.view_email", "communications.view_calls",
            "notifications.view", "automation.view"
        ]
        role_objs["Project Manager"].permissions = [perm_objs[c] for c in pm_perms if c in perm_objs]

        # Developer
        dev_perms = [
            "crm.companies.view",
            "projects.view",
            "tasks.view", "tasks.edit",
            "qa.view",
            "bugs.view", "bugs.edit", "bugs.resolve",
            "notifications.view"
        ]
        role_objs["Developer"].permissions = [perm_objs[c] for c in dev_perms if c in perm_objs]

        # QA Engineer
        qa_perms = [
            "crm.companies.view",
            "projects.view",
            "tasks.view",
            "qa.view", "qa.create", "qa.execute", "qa.edit", "qa.manage",
            "bugs.view", "bugs.create", "bugs.edit", "bugs.retest", "bugs.close",
            "service.view", "service.view_internal_notes",
            "notifications.view"
        ]
        role_objs["QA Engineer"].permissions = [perm_objs[c] for c in qa_perms if c in perm_objs]

        # Service Manager
        svc_mgr_perms = [
            "crm.companies.view",
            "service.view", "service.create", "service.edit", "service.assign", "service.manage",
            "service.resolve", "service.close", "service.reopen", "service.escalate",
            "service.manage_sla", "service.view_reports", "service.export",
            "service.view_internal_notes", "service.manage_categories", "service.manage_teams",
            "projects.view", "bugs.view", "audit.view",
            "reports.view", "reports.view_service",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp", "communications.manage_templates",
            "notifications.view", "automation.view"
        ]
        role_objs["Service Manager"].permissions = [perm_objs[c] for c in svc_mgr_perms if c in perm_objs]

        # Service Executive
        svc_exec_perms = [
            "crm.companies.view",
            "service.view", "service.create", "service.edit", "service.resolve",
            "service.view_internal_notes", "service.reopen",
            "projects.view", "bugs.view",
            "communications.view", "communications.send_email", "communications.send_whatsapp", "communications.log_call", "communications.view_calls", "communications.view_email", "communications.view_whatsapp",
            "notifications.view"
        ]
        role_objs["Service Executive"].permissions = [perm_objs[c] for c in svc_exec_perms if c in perm_objs]

        # Finance Manager
        fin_mgr_perms = [
            "crm.companies.view", "sales.orders.view", "sales.contracts.view", "projects.view",
            "accounting.view", "accounting.create", "accounting.edit", "accounting.delete_draft",
            "accounting.post", "accounting.void", "accounting.reverse", "accounting.manage_accounts",
            "accounting.manage_periods", "accounting.manage_tax", "accounting.manage_vendors",
            "accounting.manage_bills", "accounting.manage_payments", "accounting.manage_invoices",
            "accounting.reconcile", "accounting.reports", "accounting.export",
            "reports.view", "reports.view_finance", "reports.export", "audit.view",
            "notifications.view", "automation.view"
        ]
        role_objs["Finance Manager"].permissions = [perm_objs[c] for c in fin_mgr_perms if c in perm_objs]

        # Accountant
        accountant_perms = [
            "crm.companies.view", "sales.orders.view",
            "accounting.view", "accounting.create", "accounting.edit", "accounting.delete_draft",
            "accounting.post", "accounting.manage_invoices", "accounting.manage_payments",
            "accounting.manage_bills", "accounting.manage_vendors", "accounting.reconcile",
            "accounting.reports", "accounting.export", "reports.view",
            "notifications.view"
        ]
        role_objs["Accountant"].permissions = [perm_objs[c] for c in accountant_perms if c in perm_objs]

        print("Seeding departments...")
        depts_data = [
            ("Management & Strategy", "Executive leadership and institutional growth"),
            ("Sales & Institutional Partnerships", "College outreach, admissions suite sales and conversions"),
            ("Engineering & Delivery", "Core platform engineering, college LMS integrations and infrastructure"),
            ("Quality Assurance", "Testing, college customer UAT and release verification"),
            ("Client Services & Success", "College support, trainer onboarding, ticket resolution and renewals"),
            ("Finance & Accounts", "Billing, college contracts, receivables and compliance"),
        ]
        dept_objs = {}
        for name, desc in depts_data:
            dept = db.query(Department).filter(Department.name == name).first()
            if not dept:
                dept = Department(name=name, description=desc)
                db.add(dept)
                db.flush()
            dept_objs[name] = dept

        print("Seeding default teams...")
        sales_team = db.query(Team).filter(Team.name == "Higher Ed Sales Team").first()
        if not sales_team:
            sales_team = Team(
                name="Higher Ed Sales Team",
                department_id=dept_objs["Sales & Institutional Partnerships"].id,
            )
            db.add(sales_team)
            db.flush()

        service_team = db.query(Team).filter(Team.name == "College Support & Success Team").first()
        if not service_team:
            service_team = Team(
                name="College Support & Success Team",
                department_id=dept_objs["Client Services & Success"].id,
            )
            db.add(service_team)
            db.flush()

        print("Seeding default system users...")
        default_pw = get_password_hash("Admin@123")
        users_data = [
            ("admin@edtechcrm.com", "System", "Administrator", "Super Admin", True, True),
            ("vinothravi2819@gmail.com", "Vinoth", "Ravi", "Super Admin", True, True),
            ("sales.manager@edtechcrm.com", "Arun", "Kumar", "Sales Manager", False, False),
            ("sales.exec@edtechcrm.com", "Sneha", "Raman", "Sales Executive", False, False),
            ("pm@edtechcrm.com", "Vikram", "Menon", "Project Manager", False, False),
            ("dev@edtechcrm.com", "Rohan", "Sharma", "Developer", False, False),
            ("qa@edtechcrm.com", "Priya", "Balan", "QA Engineer", False, False),
            ("service.mgr@edtechcrm.com", "Kavitha", "Sundaram", "Service Manager", False, False),
            ("service.exec@edtechcrm.com", "Karthik", "Rajan", "Service Executive", False, False),
            ("finance@edtechcrm.com", "Divya", "Krishnan", "Finance Manager", False, False),
        ]

        user_objs = {}
        for email, fn, ln, rname, is_super, is_admin in users_data:
            user = db.query(User).filter(User.email == email).first()
            if not user and is_super:
                user = db.query(User).filter(User.is_superuser == True).first()
            if not user:
                dept_id = dept_objs["Management & Strategy"].id
                t_id = None
                if "Sales" in rname:
                    dept_id = dept_objs["Sales & Institutional Partnerships"].id
                    t_id = sales_team.id
                elif rname in ["Project Manager", "Developer"]:
                    dept_id = dept_objs["Engineering & Delivery"].id
                elif rname == "QA Engineer":
                    dept_id = dept_objs["Quality Assurance"].id
                elif "Service" in rname:
                    dept_id = dept_objs["Client Services & Success"].id
                    t_id = service_team.id
                elif "Finance" in rname:
                    dept_id = dept_objs["Finance & Accounts"].id

                user = User(
                    email=email,
                    hashed_password=default_pw,
                    first_name=fn,
                    last_name=ln,
                    phone="+91 9876543210",
                    is_active=True,
                    is_superuser=is_super,
                    department_id=dept_id,
                    team_id=t_id,
                )
                user.roles = [role_objs[rname]]
                db.add(user)
                db.flush()
            user_objs[email] = user

        if "admin@edtechcrm.com" not in user_objs or not user_objs["admin@edtechcrm.com"]:
            super_u = db.query(User).filter(User.is_superuser == True).first()
            if super_u:
                user_objs["admin@edtechcrm.com"] = super_u

        print("Seeding sales pipelines & stages...")
        print("Preserving existing sales pipeline if present...")
        pipeline = db.query(Pipeline).filter(Pipeline.name == "Higher Education Sales Pipeline").first()
        if not pipeline:
            pipeline = Pipeline(
                name="Higher Education Sales Pipeline",
                description="Standard enterprise college acquisition & platform deployment cycle",
                is_default=False,
                is_active=True,
            )
            db.add(pipeline)
            db.flush()

            stages_data = [
                ("New Lead", 1, 10, False, False, "#3b82f6"),
                ("Qualified", 2, 25, False, False, "#6366f1"),
                ("Requirement Analysis", 3, 40, False, False, "#8b5cf6"),
                ("Product Demo", 4, 60, False, False, "#ec4899"),
                ("Proposal & Quotation", 5, 75, False, False, "#f59e0b"),
                ("Negotiation", 6, 90, False, False, "#10b981"),
                ("Closed Won", 7, 100, True, False, "#059669"),
                ("Closed Lost", 8, 0, False, True, "#ef4444"),
            ]
            for sname, order, prob, is_won, is_lost, color in stages_data:
                stage = PipelineStage(
                    pipeline_id=pipeline.id,
                    name=sname,
                    order=order,
                    probability=prob,
                    is_won=is_won,
                    is_lost=is_lost,
                    color=color,
                )
                db.add(stage)
            db.flush()
        else:
            # Preserve existing pipeline and ensure EdTech can be default
            pipeline.is_default = False
            db.flush()

        stages = db.query(PipelineStage).filter(PipelineStage.pipeline_id == pipeline.id).order_by(PipelineStage.order.asc()).all()
        stage_map = {s.name: s for s in stages}

        print("Seeding Founder's 3 Business Pipelines...")
        founder_pipelines_data = [
            {
                "name": "EdTech Pipeline",
                "description": "Founder primary EdTech sales & student lifecycle funnel",
                "is_default": True,
                "stages": [
                    ("Lead", 1, 10, False, False, "#3b82f6"),
                    ("Qualified", 2, 25, False, False, "#6366f1"),
                    ("Counselling", 3, 40, False, False, "#8b5cf6"),
                    ("Demo", 4, 60, False, False, "#ec4899"),
                    ("Payment", 5, 80, False, False, "#f59e0b"),
                    ("Enrolled", 6, 100, True, False, "#10b981"),
                    ("Completed", 7, 100, True, False, "#059669"),
                    ("Referral", 8, 100, True, False, "#047857"),
                ],
            },
            {
                "name": "IT Services Pipeline",
                "description": "Founder IT software services & enterprise client acquisition funnel",
                "is_default": False,
                "stages": [
                    ("Prospect", 1, 10, False, False, "#3b82f6"),
                    ("Contacted", 2, 20, False, False, "#6366f1"),
                    ("Discovery", 3, 35, False, False, "#8b5cf6"),
                    ("Requirement", 4, 50, False, False, "#ec4899"),
                    ("Proposal", 5, 65, False, False, "#f59e0b"),
                    ("Negotiation", 6, 80, False, False, "#d97706"),
                    ("Won", 7, 100, True, False, "#10b981"),
                    ("Delivery", 8, 100, True, False, "#059669"),
                    ("Retainer", 9, 100, True, False, "#047857"),
                ],
            },
            {
                "name": "Talent / Outsourcing Pipeline",
                "description": "Founder talent acquisition, corporate hiring, and staffing funnel",
                "is_default": False,
                "stages": [
                    ("Company Prospect", 1, 10, False, False, "#3b82f6"),
                    ("Requirement", 2, 25, False, False, "#6366f1"),
                    ("Candidate Search", 3, 40, False, False, "#8b5cf6"),
                    ("Profiles Shared", 4, 55, False, False, "#ec4899"),
                    ("Interview", 5, 70, False, False, "#f59e0b"),
                    ("Selected", 6, 85, False, False, "#10b981"),
                    ("Joined", 7, 100, True, False, "#059669"),
                    ("Invoice", 8, 100, True, False, "#047857"),
                ],
            },
        ]

        founder_pipeline_objs = {}
        for pdata in founder_pipelines_data:
            p_obj = db.query(Pipeline).filter(Pipeline.name == pdata["name"]).first()
            if not p_obj:
                p_obj = Pipeline(
                    name=pdata["name"],
                    description=pdata["description"],
                    is_default=pdata["is_default"],
                    is_active=True,
                )
                db.add(p_obj)
                db.flush()
            else:
                p_obj.description = pdata["description"]
                p_obj.is_default = pdata["is_default"]
                p_obj.is_active = True
                db.flush()
            founder_pipeline_objs[pdata["name"]] = p_obj

            existing_stages = {s.name: s for s in db.query(PipelineStage).filter(PipelineStage.pipeline_id == p_obj.id).all()}
            for sname, order, prob, is_won, is_lost, color in pdata["stages"]:
                if sname in existing_stages:
                    stg = existing_stages[sname]
                    stg.order = order
                    stg.probability = prob
                    stg.is_won = is_won
                    stg.is_lost = is_lost
                    stg.color = color
                else:
                    stg = PipelineStage(
                        pipeline_id=p_obj.id,
                        name=sname,
                        order=order,
                        probability=prob,
                        is_won=is_won,
                        is_lost=is_lost,
                        color=color,
                    )
                    db.add(stg)
            db.flush()

        print("Seeding lead sources...")
        # 1. Existing/legacy demo sources (preserved for demo lead references)
        legacy_sources_data = [
            ("Website Inbound", "College principals and deans requesting demo via website form"),
            ("Higher Ed Conclave 2026", "National Academic Leadership Conference stall leads"),
            ("Dean Referral", "Word-of-mouth referral from partner university deans"),
            ("Cold Institutional Outreach", "Direct outreach to Autonomous colleges in South India"),
            ("EdTech Expo 2026", "Annual EdTech technology convention"),
        ]
        source_objs = {}
        for sname, sdesc in legacy_sources_data:
            src = db.query(LeadSource).filter(LeadSource.name == sname).first()
            if not src:
                src = LeadSource(name=sname, description=sdesc, is_active=True)
                db.add(src)
                db.flush()
            source_objs[sname] = src

        # 2. Standardized Founder Lead Sources
        standardized_sources_data = [
            ("Website", "Inbound leads generated through website forms and landing pages"),
            ("Google Ads", "Paid search and display campaigns via Google Ads"),
            ("Instagram", "Social media campaigns and inquiries via Instagram"),
            ("Facebook", "Paid lead ads and inquiries via Meta/Facebook"),
            ("LinkedIn", "B2B outreach, sponsored content, and direct messages via LinkedIn"),
            ("YouTube", "Video descriptions, masterclasses, and channel inquiries via YouTube"),
            ("WhatsApp", "Direct inbound WhatsApp messages and business click-to-chat campaigns"),
            ("College", "On-campus seminars, workshops, and college partnerships"),
            ("Webinar", "Online webinars, info sessions, and masterclass attendees"),
            ("Workshop", "Hands-on technical workshops and bootcamps"),
            ("Referral", "Word-of-mouth recommendations from alumni, clients, or partners"),
            ("Cold Email", "Targeted outbound B2B email prospecting campaigns"),
            ("Cold Call", "Direct outbound telephone outreach to prospective clients"),
            ("Partner", "Channel partners, educational consultants, and strategic alliances"),
            ("Existing Customer", "Upsell, cross-sell, or renewal from existing clients and students"),
            ("Organic Search", "Unpaid search engine traffic from Google, Bing, and other search engines"),
        ]
        for sname, sdesc in standardized_sources_data:
            src = db.query(LeadSource).filter(LeadSource.name == sname).first()
            if not src:
                src = LeadSource(name=sname, description=sdesc, is_active=True)
                db.add(src)
                db.flush()
            else:
                src.is_active = True
                db.flush()
            source_objs[sname] = src

        print("Seeding clearly labeled demo colleges...")
        companies_seed = [
            {
                "organization_name": "Demo College 1 - Kumaraguru Institute of Technology",
                "code": "DEMO-KIT-01",
                "type": "Engineering College",
                "website": "https://demo-kit.edu.in",
                "email": "contact@demo-kit.edu.in",
                "phone": "+91 422 2669401",
                "address": "Saravanampatti, Chinnavedampatti",
                "city": "Coimbatore",
                "state": "Tamil Nadu",
                "country": "India",
                "postal_code": "641049",
                "status": "Prospect",
                "notes": "Autonomous engineering institution with 8,500 students. Seeking unified campus ERP and placement tracking.",
            },
            {
                "organization_name": "Demo College 2 - National Institute of Engineering",
                "code": "DEMO-NIE-02",
                "type": "Engineering College",
                "website": "https://demo-nie.edu.in",
                "email": "dean.office@demo-nie.edu.in",
                "phone": "+91 821 2480475",
                "address": "Manandavadi Road",
                "city": "Mysuru",
                "state": "Karnataka",
                "country": "India",
                "postal_code": "570008",
                "status": "Customer",
                "notes": "Premier engineering institution. Phase 1 LMS already deployed. Exploring AI labs add-on.",
            },
            {
                "organization_name": "Demo College 3 - Apex School of Business & Analytics",
                "code": "DEMO-ASB-03",
                "type": "Business School",
                "website": "https://demo-apex-business.edu.in",
                "email": "director@demo-apex-business.edu.in",
                "phone": "+91 80 25531234",
                "address": "Koramangala 4th Block",
                "city": "Bengaluru",
                "state": "Karnataka",
                "country": "India",
                "postal_code": "560034",
                "status": "Prospect",
                "notes": "MBA and PGDM college. Interested in digital executive assessment and career portal.",
            },
        ]

        created_companies = {}
        for cdata in companies_seed:
            col = db.query(Company).filter(Company.code == cdata["code"]).first()
            if not col:
                col = Company(
                    **cdata,
                    owner_id=user_objs["sales.exec@edtechcrm.com"].id,
                    created_by_id=user_objs["admin@edtechcrm.com"].id,
                )
                db.add(col)
                db.flush()
            created_companies[cdata["code"]] = col

        print("Seeding demo contacts...")
        contacts_seed = [
            (
                created_companies["DEMO-KIT-01"].id,
                "Dr. Rajesh Sharma",
                "Principal & Senior Professor",
                "Administration",
                "principal@demo-kit.edu.in",
                "+91 9443123456",
                True,
            ),
            (
                created_companies["DEMO-KIT-01"].id,
                "Dr. Priya Venkat",
                "Dean of Academics",
                "Academics & Curriculum",
                "dean.academics@demo-kit.edu.in",
                "+91 9443654321",
                False,
            ),
            (
                created_companies["DEMO-NIE-02"].id,
                "Dr. K. S. Murthy",
                "Director",
                "Board of Trustees",
                "director@demo-nie.edu.in",
                "+91 9845112233",
                True,
            ),
            (
                created_companies["DEMO-ASB-03"].id,
                "Prof. Ananya Roy",
                "Dean - Executive Education",
                "Management Studies",
                "ananya.roy@demo-asb.edu.in",
                "+91 9880998877",
                True,
            ),
        ]

        created_contacts = []
        for cid, name, desig, dept, email, phone, is_pri in contacts_seed:
            con = db.query(Contact).filter(Contact.email == email).first()
            if not con:
                con = Contact(
                    company_id=cid,
                    name=name,
                    designation=desig,
                    department=dept,
                    email=email,
                    phone=phone,
                    is_primary=is_pri,
                    created_by_id=user_objs["admin@edtechcrm.com"].id,
                )
                db.add(con)
                db.flush()
            created_contacts.append(con)

        print("Seeding demo leads...")
        leads_seed = [
            {
                "title": "Demo Lead: Campus ERP & Placement Suite 2026",
                "company_id": created_companies["DEMO-KIT-01"].id,
                "contact_id": created_contacts[0].id,
                "source_id": source_objs["Higher Ed Conclave 2026"].id,
                "owner_id": user_objs["sales.exec@edtechcrm.com"].id,
                "status": "Qualified",
                "priority": "High",
                "expected_value": 450000.0,
                "expected_close_date": date.today() + timedelta(days=45),
                "qualification_status": "Qualified",
                "description": "Comprehensive student lifecycle, fee automation, and placement drive portal for KIT.",
            },
            {
                "title": "Demo Lead: AI Skill Assessment Lab Suite",
                "company_id": created_companies["DEMO-ASB-03"].id,
                "contact_id": created_contacts[3].id,
                "source_id": source_objs["Website Inbound"].id,
                "owner_id": user_objs["sales.manager@edtechcrm.com"].id,
                "status": "Contacted",
                "priority": "Medium",
                "expected_value": 280000.0,
                "expected_close_date": date.today() + timedelta(days=60),
                "qualification_status": "Pending",
                "description": "Online case study simulation platform for MBA cohorts.",
            },
        ]

        for ldata in leads_seed:
            ld = db.query(Lead).filter(Lead.title == ldata["title"]).first()
            if not ld:
                ld = Lead(**ldata, created_by_id=user_objs["admin@edtechcrm.com"].id)
                db.add(ld)
                db.flush()

        print("Seeding demo opportunities...")
        opps_seed = [
            {
                "company_id": created_companies["DEMO-KIT-01"].id,
                "contact_id": created_contacts[1].id,
                "title": "KIT - Enterprise Campus Automation (8,500 Students)",
                "description": "Enterprise campus management system deal. Product demo completed successfully.",
                "pipeline_id": pipeline.id,
                "stage_id": stage_map["Proposal & Quotation"].id,
                "owner_id": user_objs["sales.exec@edtechcrm.com"].id,
                "value": 520000.0,
                "probability": 75,
                "expected_close_date": date.today() + timedelta(days=30),
                "status": "Open",
            },
            {
                "company_id": created_companies["DEMO-NIE-02"].id,
                "contact_id": created_contacts[2].id,
                "title": "NIE - Placement Management Software & Career Portal",
                "description": "Automated campus recruitment portal with resume parser and test engine.",
                "pipeline_id": pipeline.id,
                "stage_id": stage_map["Requirement Analysis"].id,
                "owner_id": user_objs["sales.manager@edtechcrm.com"].id,
                "value": 350000.0,
                "probability": 40,
                "expected_close_date": date.today() + timedelta(days=45),
                "status": "Open",
            },
            {
                "company_id": created_companies["DEMO-ASB-03"].id,
                "contact_id": created_contacts[3].id,
                "title": "Apex B-School - Digital Learning & LMS Modernization",
                "description": "Annual cloud SaaS license for 1,200 MBA scholars.",
                "pipeline_id": pipeline.id,
                "stage_id": stage_map["Product Demo"].id,
                "owner_id": user_objs["sales.exec@edtechcrm.com"].id,
                "value": 240000.0,
                "probability": 60,
                "expected_close_date": date.today() + timedelta(days=20),
                "status": "Open",
            },
        ]

        for odata in opps_seed:
            opp = db.query(Opportunity).filter(Opportunity.title == odata["title"]).first()
            if not opp:
                opp = Opportunity(**odata, created_by_id=user_objs["admin@edtechcrm.com"].id)
                db.add(opp)
                db.flush()

        print("Seeding demo activities, follow-ups, meetings & notes...")
        now = datetime.now(timezone.utc)
        
        # Follow-up activity due today
        act_today = Activity(
            type="Call",
            subject="Follow-up with Dean on Proposal Pricing",
            description="Discuss commercial payment terms and 3-year multi-year discount.",
            due_at=now.replace(hour=14, minute=30, second=0),
            is_completed=False,
            assigned_to_id=user_objs["sales.exec@edtechcrm.com"].id,
            created_by_id=user_objs["sales.manager@edtechcrm.com"].id,
            related_entity_type="company",
            related_entity_id=created_companies["DEMO-KIT-01"].id,
        )
        db.add(act_today)

        # Overdue task
        task_overdue = Task(
            title="Prepare Revised Commercial Proposal for NIE",
            description="Update student slab count to include 2nd shift engineering batch.",
            assigned_to_id=user_objs["sales.exec@edtechcrm.com"].id,
            priority="High",
            status="In Progress",
            due_date=now - timedelta(days=2),
            related_entity_type="company",
            related_entity_id=created_companies["DEMO-NIE-02"].id,
            created_by_id=user_objs["admin@edtechcrm.com"].id,
        )
        db.add(task_overdue)

        # Upcoming Meeting
        meeting_upcoming = Meeting(
            title="Executive Platform Demo with Management Board",
            description="Live walkthrough of Company 360 analytics, examination module and student portal.",
            start_time=now + timedelta(days=3, hours=2),
            end_time=now + timedelta(days=3, hours=3, minutes=30),
            location="Boardroom A, Campus Academic Block",
            meeting_link="https://meet.google.com/edtech-kit-demo",
            organizer_id=user_objs["sales.exec@edtechcrm.com"].id,
            status="Scheduled",
            related_entity_type="company",
            related_entity_id=created_companies["DEMO-KIT-01"].id,
        )
        db.add(meeting_upcoming)

        # Note
        note_company = Note(
            content="Dean Dr. Priya Venkat was very impressed with the NAAC compliance export features. Key decision maker alongside Principal Dr. Sharma.",
            author_id=user_objs["sales.exec@edtechcrm.com"].id,
            related_entity_type="company",
            related_entity_id=created_companies["DEMO-KIT-01"].id,
        )
        db.add(note_company)

        # Initial audit log
        audit_init = AuditLog(
            user_id=user_objs["admin@edtechcrm.com"].id,
            user_email="admin@edtechcrm.com",
            action="SYSTEM_SEED",
            entity_type="SYSTEM",
            new_values={"status": "initial_seed_completed"},
        )
        db.add(audit_init)

        print("Seeding demo product categories...")
        categories_data = [
            ("HigherEd ERP & SIS", "Complete institutional student information system and campus administration"),
            ("Outcome Based Education & Exam Engine", "NBA/NAAC OBE curriculum, CO-PO mapping, autonomous examination engine"),
            ("Smart Campus & IoT Infrastructure", "RFID/Biometric attendance, smart turns, digital gate pass, campus WiFi auth"),
            ("Accreditation & Compliance SaaS", "Annual NIRF, NAAC, NBA, and AICTE automatic data compilation workflows"),
            ("Professional Implementation & Support", "Campus deployment, data migration, LMS integrations, and 24/7 SLAs"),
        ]
        created_categories = {}
        for cname, cdesc in categories_data:
            cat = db.query(ProductCategory).filter(ProductCategory.name == cname).first()
            if not cat:
                cat = ProductCategory(name=cname, description=cdesc, status="Active")
                db.add(cat)
                db.flush()
            created_categories[cname] = cat

        print("Seeding demo product catalog...")
        products_data = [
            (
                "EduSuite Campus ERP Cloud", "PRD-ERP-01",
                "Flagship Higher Education Enterprise Management platform covering admissions, fee billing, and student records.",
                "HigherEd ERP & SIS", "Product", "Campus License", 750000.00, 18.00
            ),
            (
                "Autonomous Exam Engine & COE Module", "PRD-EXAM-02",
                "End-to-end examination management: question bank, hall ticket generation, barcode evaluation, and SGPA/CGPA calculation.",
                "Outcome Based Education & Exam Engine", "Product", "Annual License", 350000.00, 18.00
            ),
            (
                "Smart Campus Attendance & Biometric Gateway", "PRD-IOT-03",
                "Integrated facial recognition and UHF RFID gate system with instant parent SMS and LMS sync.",
                "Smart Campus & IoT Infrastructure", "Product", "Unit", 150000.00, 18.00
            ),
            (
                "NAAC / NBA Accreditation Readiness SaaS", "PRD-ACC-04",
                "Automated SSR generation, student satisfaction survey analytics, and criterion document repository.",
                "Accreditation & Compliance SaaS", "Subscription", "Subscription/Year", 200000.00, 18.00
            ),
            (
                "Annual Maintenance & 24/7 SLA Support", "SRV-AMC-01",
                "Dedicated college technical account manager, SLA-backed bug fixes, and version upgrades.",
                "Professional Implementation & Support", "Service", "Year", 120000.00, 18.00
            ),
            (
                "Custom LMS Connector & Database Migration", "SRV-INT-02",
                "Legacy Oracle/MySQL student data migration and single sign-on (SSO) integration with Moodle/Canvas.",
                "Professional Implementation & Support", "Custom", "Project", 80000.00, 18.00
            ),
        ]
        created_products = {}
        for pname, pcode, pdesc, cname, ptype, punit, pprice, ptax in products_data:
            prod = db.query(Product).filter(Product.code == pcode).first()
            if not prod:
                prod = Product(
                    name=pname,
                    code=pcode,
                    description=pdesc,
                    category_id=created_categories[cname].id,
                    type=ptype,
                    unit=punit,
                    base_price=pprice,
                    tax_rate=ptax,
                    status="Active",
                )
                db.add(prod)
                db.flush()
            created_products[pcode] = prod

        print("Seeding demo Quotation, Contract, and Sales Order...")
        kit_company = created_companies["DEMO-KIT-01"]
        kit_contact = db.query(Contact).filter(Contact.company_id == kit_company.id).first()
        kit_opp = db.query(Opportunity).filter(Opportunity.company_id == kit_company.id).first()

        # Seed Number Sequence if not present
        current_year = datetime.now(timezone.utc).year
        for et, pref in [
            ("quotation", "QT"), ("contract", "CT"), ("sales_order", "SO"),
            ("project", "PRJ"), ("task", "TSK"), ("test_case", "TC"), ("bug", "BUG")
        ]:
            seq = db.query(NumberSequence).filter(NumberSequence.entity_type == et, NumberSequence.year == current_year).first()
            if not seq:
                db.add(NumberSequence(entity_type=et, year=current_year, current_val=1, prefix=pref))
                db.flush()

        # Demo Quotation
        quote_code = f"QT-{current_year}-0001"
        demo_quote = db.query(Quotation).filter(Quotation.quotation_number == quote_code).first()
        if not demo_quote:
            demo_quote = Quotation(
                quotation_number=quote_code,
                company_id=kit_company.id,
                contact_id=kit_contact.id if kit_contact else None,
                opportunity_id=kit_opp.id if kit_opp else None,
                quotation_date=date.today() - timedelta(days=10),
                valid_until=date.today() + timedelta(days=20),
                status="Approved",
                currency="INR",
                subtotal=870000.00,
                discount_amount=50000.00,
                tax_amount=147600.00,
                total_amount=967600.00,
                notes="Standard institutional proposal for Kumaraguru College of Technology.",
                terms="Payment: 50% advance on PO, 40% on UAT sign-off, 10% on Go-Live.",
                created_by_id=user_objs["sales.exec@edtechcrm.com"].id,
                approved_by_id=user_objs["sales.manager@edtechcrm.com"].id,
                approved_at=datetime.now(timezone.utc) - timedelta(days=9),
            )
            db.add(demo_quote)
            db.flush()

            # Items
            p1 = created_products["PRD-ERP-01"]
            p2 = created_products["SRV-AMC-01"]
            qi1 = QuotationItem(
                quotation_id=demo_quote.id,
                product_id=p1.id,
                description="EduSuite Campus ERP Cloud - Campus License (Unlimited Students)",
                quantity=1.00,
                unit_price=750000.00,
                discount=50000.00,
                tax_rate=18.00,
                tax_amount=126000.00,
                line_total=826000.00,
                sort_order=1,
            )
            qi2 = QuotationItem(
                quotation_id=demo_quote.id,
                product_id=p2.id,
                description="Annual Maintenance & 24/7 SLA Support (Year 1)",
                quantity=1.00,
                unit_price=120000.00,
                discount=0.00,
                tax_rate=18.00,
                tax_amount=21600.00,
                line_total=141600.00,
                sort_order=2,
            )
            db.add_all([qi1, qi2])

        # Demo Contract
        contract_code = f"CT-{current_year}-0001"
        demo_contract = db.query(Contract).filter(Contract.contract_number == contract_code).first()
        if not demo_contract:
            demo_contract = Contract(
                contract_number=contract_code,
                company_id=kit_company.id,
                contact_id=kit_contact.id if kit_contact else None,
                opportunity_id=kit_opp.id if kit_opp else None,
                quotation_id=demo_quote.id if demo_quote else None,
                title="KIT - Master Institutional Enterprise Software & Support Agreement",
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() + timedelta(days=360),
                contract_value=967600.00,
                currency="INR",
                status="Active",
                description="Annual enterprise contract covering ERP Cloud licensing and implementation.",
                terms="Governed by the terms of Proposal QT-2026-0001. Net 30 payment terms.",
                signed_date=date.today() - timedelta(days=5),
                created_by_id=user_objs["sales.manager@edtechcrm.com"].id,
                approved_by_id=user_objs["admin@edtechcrm.com"].id,
            )
            db.add(demo_contract)

        # Demo Sales Order
        order_code = f"SO-{current_year}-0001"
        demo_order = db.query(SalesOrder).filter(SalesOrder.order_number == order_code).first()
        if not demo_order:
            demo_order = SalesOrder(
                order_number=order_code,
                company_id=kit_company.id,
                contact_id=kit_contact.id if kit_contact else None,
                opportunity_id=kit_opp.id if kit_opp else None,
                quotation_id=demo_quote.id if demo_quote else None,
                contract_id=demo_contract.id if demo_contract else None,
                order_date=date.today() - timedelta(days=4),
                status="Confirmed",
                currency="INR",
                subtotal=870000.00,
                discount_amount=50000.00,
                tax_amount=147600.00,
                total_amount=967600.00,
                notes="Confirmed by management board. Ready for deployment and database provisioning.",
                created_by_id=user_objs["sales.manager@edtechcrm.com"].id,
                confirmed_by_id=user_objs["admin@edtechcrm.com"].id,
                confirmed_at=datetime.now(timezone.utc) - timedelta(days=4),
            )
            db.add(demo_order)
            db.flush()

            soi1 = SalesOrderItem(
                sales_order_id=demo_order.id,
                product_id=created_products["PRD-ERP-01"].id,
                description="EduSuite Campus ERP Cloud - Campus License",
                quantity=1.00,
                unit_price=750000.00,
                discount=50000.00,
                tax_rate=18.00,
                tax_amount=126000.00,
                line_total=826000.00,
            )
            db.add(soi1)

        # Demo Project from Confirmed Sales Order
        project_code = f"PRJ-{current_year}-0001"
        demo_project = db.query(Project).filter(Project.project_number == project_code).first()
        if not demo_project:
            demo_project = Project(
                project_number=project_code,
                name="KIT Enterprise Campus ERP Deployment",
                description="Turnkey campus ERP deployment covering 7,500 students, faculty SIS, and fees management.",
                company_id=kit_company.id,
                sales_order_id=demo_order.id if demo_order else None,
                contract_id=demo_contract.id if demo_contract else None,
                project_manager_id=user_objs["pm@edtechcrm.com"].id,
                status="ACTIVE",
                priority="HIGH",
                start_date=date.today() - timedelta(days=3),
                target_date=date.today() + timedelta(days=90),
                progress_percentage=25.00,
                budget=967600.00,
                notes="Campus implementation underway. Phase 1 discovery and environment setup completed.",
                created_by_id=user_objs["admin@edtechcrm.com"].id,
                updated_by_id=user_objs["pm@edtechcrm.com"].id,
            )
            db.add(demo_project)
            db.flush()

            # Assign Team Members
            pm_member = ProjectMember(project_id=demo_project.id, user_id=user_objs["pm@edtechcrm.com"].id, role="Project Manager", active=True)
            dev_member = ProjectMember(project_id=demo_project.id, user_id=user_objs["dev@edtechcrm.com"].id, role="Developer", active=True)
            qa_member = ProjectMember(project_id=demo_project.id, user_id=user_objs["qa@edtechcrm.com"].id, role="QA Engineer", active=True)
            db.add_all([pm_member, dev_member, qa_member])

            # Milestones
            m1 = Milestone(
                project_id=demo_project.id,
                name="Phase 1: Discovery & Architecture Setup",
                description="Campus network audit, cloud tenant provisioning, and security baselining",
                sequence=1,
                status="COMPLETED",
                start_date=date.today() - timedelta(days=3),
                due_date=date.today() - timedelta(days=1),
                completed_at=datetime.now(timezone.utc) - timedelta(days=1),
                completion_percentage=100.00,
            )
            m2 = Milestone(
                project_id=demo_project.id,
                name="Phase 2: Core Platform & SIS Integration",
                description="Database migration, student directory LDAP sync, and academic schedule setup",
                sequence=2,
                status="IN_PROGRESS",
                start_date=date.today(),
                due_date=date.today() + timedelta(days=30),
                completion_percentage=50.00,
            )
            m3 = Milestone(
                project_id=demo_project.id,
                name="Phase 3: User Acceptance Testing (UAT)",
                description="Faculty and examination cell acceptance test runs",
                sequence=3,
                status="NOT_STARTED",
                start_date=date.today() + timedelta(days=31),
                due_date=date.today() + timedelta(days=60),
                completion_percentage=0.00,
            )
            m4 = Milestone(
                project_id=demo_project.id,
                name="Phase 4: Campus Go-Live & Handover",
                description="Cutover to live production and staff training signoff",
                sequence=4,
                status="NOT_STARTED",
                start_date=date.today() + timedelta(days=61),
                due_date=date.today() + timedelta(days=90),
                completion_percentage=0.00,
            )
            db.add_all([m1, m2, m3, m4])
            db.flush()

            # Tasks
            t1 = ProjectTask(
                task_number=f"TSK-{current_year}-0001",
                project_id=demo_project.id,
                milestone_id=m1.id,
                title="Configure AWS VPC and campus database clusters",
                description="Multi-AZ PostgreSQL cluster with VPC peering and automated snapshots",
                assigned_to_id=user_objs["dev@edtechcrm.com"].id,
                created_by_id=user_objs["pm@edtechcrm.com"].id,
                status="COMPLETED",
                priority="HIGH",
                estimated_hours=16.0,
                actual_hours=14.5,
                start_date=date.today() - timedelta(days=3),
                due_date=date.today() - timedelta(days=1),
                completed_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
            t2 = ProjectTask(
                task_number=f"TSK-{current_year}-0002",
                project_id=demo_project.id,
                milestone_id=m2.id,
                title="Implement REST SIS student records sync service",
                description="Batch sync API connecting legacy college SQL database to new EduSuite Cloud",
                assigned_to_id=user_objs["dev@edtechcrm.com"].id,
                created_by_id=user_objs["pm@edtechcrm.com"].id,
                status="IN_PROGRESS",
                priority="HIGH",
                estimated_hours=24.0,
                actual_hours=12.0,
                start_date=date.today(),
                due_date=date.today() + timedelta(days=10),
            )
            db.add_all([t1, t2])
            db.flush()

            # QA Test Suite
            suite = TestSuite(
                project_id=demo_project.id,
                name="KIT Student Portal & Fees Verification Suite",
                description="End-to-end verification of student onboarding, fee receipts, and grade cards",
                module="Examination & Fees",
                status="ACTIVE",
                created_by_id=user_objs["qa@edtechcrm.com"].id,
            )
            db.add(suite)
            db.flush()

            # QA Test Case
            tc1 = TestCase(
                test_case_number=f"TC-{current_year}-0001",
                test_suite_id=suite.id,
                project_id=demo_project.id,
                title="Verify student online semester fee payment through payment gateway",
                description="Student selects pending term fee, completes Razorpay sandbox payment, and receives receipt PDF.",
                preconditions="Student account enrolled with active pending fee invoice.",
                test_steps="1. Log in as student.\n2. Navigate to Fees.\n3. Click Pay Now.\n4. Complete sandbox UPI transaction.\n5. Verify status is Paid.",
                expected_result="Transaction succeeds, receipt is generated with valid GST invoice number.",
                priority="CRITICAL",
                status="PASSED",
                created_by_id=user_objs["qa@edtechcrm.com"].id,
                assigned_to_id=user_objs["qa@edtechcrm.com"].id,
            )
            db.add(tc1)
            db.flush()

            # Test Execution
            ex1 = TestExecution(
                test_case_id=tc1.id,
                executed_by_id=user_objs["qa@edtechcrm.com"].id,
                execution_date=datetime.now(timezone.utc) - timedelta(hours=6),
                result="PASS",
                actual_result="Payment completed in 1.4s. Invoice generated with correct 18% GST.",
                comments="Tested on Chrome 124 on KIT Sandbox environment.",
                environment="College Sandbox",
                build_version="v2.4.0-rc1",
            )
            db.add(ex1)

            # Bug
            bug1 = Bug(
                bug_number=f"BUG-{current_year}-0001",
                project_id=demo_project.id,
                test_case_id=tc1.id,
                title="Receipt PDF shows truncated transaction ID on high-resolution displays",
                description="When printing or downloading receipt PDF on Retina/4K displays, the 24-character bank UTR wraps awkwardly.",
                severity="LOW",
                priority="LOW",
                status="RESOLVED",
                assigned_to_id=user_objs["dev@edtechcrm.com"].id,
                reported_by_id=user_objs["qa@edtechcrm.com"].id,
                environment="College Sandbox",
                steps_to_reproduce="Download receipt PDF on screen with scale > 150%. Inspect transaction ID header block.",
                expected_result="UTR fits within receipt header table column.",
                actual_result="UTR wrapped onto 2 lines.",
                resolved_at=datetime.now(timezone.utc) - timedelta(hours=2),
            )
            db.add(bug1)
            db.flush()

            comm1 = BugComment(
                bug_id=bug1.id,
                user_id=user_objs["dev@edtechcrm.com"].id,
                comment="Adjusted CSS table layout with overflow-wrap: break-word and widened reference column to 180px.",
            )
            db.add(comm1)

        print("Seeding service categories & subcategories...")
        categories_data = [
            ("Technical Issue", "TECH", "Platform bugs, runtime errors, and performance degradation", [
                ("Application Crash", "CRASH", "System unhandled exception or 500 error"),
                ("Performance Issue", "PERF", "Slow response time or page timeout"),
                ("Error Message", "ERR", "Validation or unexpected error banner"),
            ]),
            ("Application Issue", "APP", "Core higher ed modules and functionality queries", [
                ("Login/Auth", "LOGIN", "Authentication or MFA issue"),
                ("Gradebook", "GRADES", "Marks calculation, GPA, or gradebook sheet"),
                ("Attendance", "ATTEND", "RFID biometric or faculty attendance logging"),
                ("Student Info System", "SIS", "Student profile, enrollment, or section allocation"),
            ]),
            ("Integration", "INTG", "Third-party and institutional integrations", [
                ("Payment Gateway", "PAY", "Razorpay, PayU, or Bank gateway reconciliation"),
                ("Single Sign-On (SSO)", "SSO", "SAML, OAuth2, or Google Workspace login"),
                ("API Connector", "API", "REST API webhooks or college ERP export"),
            ]),
            ("User Access", "ACCESS", "Account provisioning and role permission requests", [
                ("Password Reset", "PWD", "Admin or faculty credential reset"),
                ("Role Permissions", "ROLE", "Elevated role or module permission changes"),
                ("Account Locked", "LOCK", "Locked due to consecutive failed attempts"),
            ]),
            ("Data Issue", "DATA", "Data integrity, migration, and reporting issues", [
                ("Data Sync", "SYNC", "Discrepancy between staging and production records"),
                ("Missing Records", "MISSING", "Student or faculty entries not appearing"),
                ("Import/Export Error", "IMP_EXP", "Excel/CSV upload format failure"),
            ]),
            ("Configuration", "CONFIG", "Institutional preferences and academic setup", [
                ("College Settings", "SETTINGS", "Institution logo, letterhead, or timezone"),
                ("Academic Year Setup", "AY_SETUP", "New academic calendar and term boundaries"),
                ("Term Grading Rules", "RULES", "Relative vs absolute grading scheme config"),
            ]),
            ("Training", "TRAIN", "Admin, faculty, and student onboarding support", [
                ("Faculty Training", "FACULTY", "Hands-on demo for department faculty"),
                ("Admin Onboarding", "ADMIN", "Registrar and dean walkthrough session"),
                ("Product Walkthrough", "WALKTHROUGH", "Recorded video or live guided tour"),
            ]),
            ("Billing Query", "BILLING", "Commercial, invoices, and AMC support", [
                ("Invoice Clarification", "INV", "GST breakdown or TDS deduction questions"),
                ("AMC Renewal", "AMC", "Annual maintenance contract extension queries"),
                ("Payment Confirmation", "CONFIRM", "Bank payment receipt issuance"),
            ]),
            ("Feature Request", "FEATURE", "Client requested enhancements and suggestions", [
                ("New Feature", "NEW", "Novel institutional workflow addition"),
                ("Workflow Enhancement", "ENHANCE", "Simplification of existing screen"),
            ]),
            ("Other", "OTHER", "General institutional correspondence and inquiries", [
                ("General Inquiry", "GENERAL", "Miscellaneous non-technical questions"),
            ]),
        ]

        for cat_name, cat_code, cat_desc, subs in categories_data:
            cat = db.query(ServiceCategory).filter(ServiceCategory.code == cat_code).first()
            if not cat:
                cat = ServiceCategory(name=cat_name, code=cat_code, description=cat_desc, is_active=True)
                db.add(cat)
                db.flush()

            for sub_name, sub_code, sub_desc in subs:
                sub = db.query(ServiceSubcategory).filter(
                    ServiceSubcategory.category_id == cat.id,
                    ServiceSubcategory.code == sub_code
                ).first()
                if not sub:
                    sub = ServiceSubcategory(
                        category_id=cat.id,
                        name=sub_name,
                        code=sub_code,
                        description=sub_desc,
                        is_active=True,
                    )
                    db.add(sub)
                    db.flush()

        print("Seeding SLA policies...")
        sla_policies_data = [
            ("Critical & Urgent 24/7 SLA", "CRITICAL", "URGENT", 15, 120, False),
            ("High Priority Business SLA", "HIGH", "HIGH", 30, 240, True),
            ("Standard Operational Support SLA", "MEDIUM", "MEDIUM", 60, 480, True),
            ("Low Priority General SLA", "LOW", "LOW", 120, 1440, True),
            ("Global Default Service SLA", "ALL", "ALL", 60, 480, True),
        ]

        for p_name, p_sev, p_pri, resp_m, res_m, b_hours in sla_policies_data:
            policy = db.query(SLAPolicy).filter(SLAPolicy.name == p_name).first()
            if not policy:
                policy = SLAPolicy(
                    name=p_name,
                    description=f"{p_name}: Response in {resp_m}m, Resolution in {res_m}m",
                    severity=p_sev,
                    priority=p_pri,
                    first_response_minutes=resp_m,
                    resolution_minutes=res_m,
                    business_hours_only=b_hours,
                    active=True,
                )
                db.add(policy)
                db.flush()

        print("Seeding Chart of Accounts...")
        coa_data = [
            # ASSETS
            ("1000", "Cash on Hand", "ASSET", None, False, True, "Physical cash in office petty cash"),
            ("1010", "HDFC Bank Operating Account", "ASSET", None, False, True, "Primary operating bank account for college receipts and operations"),
            ("1020", "ICICI Bank Client Escrow", "ASSET", None, False, True, "Secondary escrow account"),
            ("1200", "Accounts Receivable", "ASSET", None, True, False, "Accounts Receivable control account for customer invoices"),
            ("1300", "Prepaid Expenses", "ASSET", None, False, False, "Prepaid software subscriptions and annual cloud commitments"),
            ("1500", "Computer & Office Equipment", "ASSET", None, False, False, "Servers, laptops, office hardware assets"),
            ("2110", "GST / Input Tax Credit", "ASSET", None, False, False, "Input GST eligible for tax credit against vendor bills"),
            # LIABILITIES
            ("2000", "Accounts Payable", "LIABILITY", None, True, False, "Accounts Payable control account for vendor bills"),
            ("2100", "GST / Tax Output Payable", "LIABILITY", None, False, False, "Tax collected on customer sales invoices payable to authorities"),
            ("2200", "Salaries & Employee Dues Payable", "LIABILITY", None, False, False, "Accrued payroll and engineering wages"),
            # EQUITY
            ("3000", "Founder Equity & Paid-in Capital", "EQUITY", None, False, False, "Initial founder seed equity and paid-in institutional capital"),
            ("3100", "Retained Earnings", "EQUITY", None, False, False, "Cumulative retained profits and operating reserves"),
            # REVENUE
            ("4000", "Software & Product License Revenue", "REVENUE", None, False, False, "EdTech ERP platform license fees and college subscriptions"),
            ("4100", "Implementation & Professional Services", "REVENUE", None, False, False, "College campus onboarding, SIS data migration and custom connectors"),
            ("4200", "AMC & Annual Maintenance", "REVENUE", None, False, False, "Annual maintenance contracts and 24/7 SLA renewals"),
            # EXPENSES
            ("5000", "Salaries & Wages", "EXPENSE", None, False, False, "Core engineering, customer support, and administrative salaries"),
            ("5100", "Cloud Infrastructure & Hosting", "EXPENSE", None, False, False, "AWS/Azure/GCP cloud server instances, CDN, databases"),
            ("5200", "Software Subscriptions & Tooling", "EXPENSE", None, False, False, "Developer tooling, GitHub, Jira, CI/CD pipelines"),
            ("5300", "Office & Operating Expenses", "EXPENSE", None, False, False, "Office supplies, high-speed fiber internet, electricity"),
            ("5400", "Marketing & Institutional Events", "EXPENSE", None, False, False, "College conferences, edtech summits, institutional brand campaigns"),
            ("5500", "Legal & Professional Fees", "EXPENSE", None, False, False, "Legal counsel, audit fees, compliance certifications"),
            ("5600", "Travel & Campus Demonstrations", "EXPENSE", None, False, False, "Sales rep visits to college campuses, demo travel, boarding"),
        ]

        for code, name, atype, parent, is_ctrl, is_bc, desc in coa_data:
            acc = db.query(Account).filter(Account.account_code == code).first()
            if not acc:
                acc = Account(
                    account_code=code,
                    account_name=name,
                    account_type=atype,
                    parent_account_id=parent,
                    is_control_account=is_ctrl,
                    is_bank_or_cash=is_bc,
                    description=desc,
                    currency="INR",
                    is_active=True,
                )
                db.add(acc)
                db.flush()

        print("Seeding Fiscal Periods...")
        current_year = date.today().year
        fp = db.query(FiscalPeriod).filter(FiscalPeriod.name == f"FY {current_year}-{current_year+1}").first()
        if not fp:
            fp = FiscalPeriod(
                name=f"FY {current_year}-{current_year+1}",
                start_date=date(current_year, 4, 1),
                end_date=date(current_year + 1, 3, 31),
                status="OPEN",
                notes="Standard institutional financial year",
            )
            db.add(fp)
            db.flush()

        print("Seeding Tax Rates...")
        taxes = [
            ("GST 18%", "GST_18", Decimal("18.00"), "Standard software and cloud ERP services tax rate"),
            ("GST 12%", "GST_12", Decimal("12.00"), "Hardware and auxiliary educational tooling"),
            ("GST 5%", "GST_5", Decimal("5.00"), "Concessional institutional services"),
            ("Exempt / Zero Rated", "EXEMPT", Decimal("0.00"), "Government grants and tax-exempt services"),
        ]
        tax_payable_acc = db.query(Account).filter(Account.account_code == "2100").first()
        for t_name, t_code, t_rate, t_desc in taxes:
            tx = db.query(TaxRate).filter(TaxRate.code == t_code).first()
            if not tx:
                tx = TaxRate(
                    name=t_name,
                    code=t_code,
                    rate=t_rate,
                    tax_account_id=tax_payable_acc.id if tax_payable_acc else None,
                    description=t_desc,
                    is_active=True,
                )
                db.add(tx)
                db.flush()

        print("Seeding default automation rules...")
        from app.notifications.automation import ensure_default_rules
        ensure_default_rules(db)

        db.commit()
        print("[SUCCESS] Database successfully seeded with production foundation and clearly marked demo data!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error during seed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
