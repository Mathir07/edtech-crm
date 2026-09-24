import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.security import get_password_hash
from app.users.models import User, Role, Permission, Department

from app.core.config import settings
DATABASE_URL = os.getenv("DATABASE_URL", settings.DATABASE_URL)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        existing_admin = db.query(User).filter(User.email == "admin@kiwicloudtech.co.in").first()
        if existing_admin:
            print("Admin already exists:", existing_admin.email)
            return

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
            ("projects.view", "View Projects", "projects"),
            ("projects.create", "Create Projects", "projects"),
            ("projects.edit", "Edit Projects", "projects"),
            ("projects.delete", "Delete Projects", "projects"),
            ("projects.assign", "Assign Team Members", "projects"),
            ("projects.manage", "Manage Milestones", "projects"),
            ("projects.complete", "Complete Projects", "projects"),
            ("tasks.view", "View Tasks", "tasks"),
            ("tasks.create", "Create Tasks", "tasks"),
            ("tasks.edit", "Edit Tasks", "tasks"),
            ("tasks.assign", "Assign Tasks", "tasks"),
            ("tasks.manage", "Manage Tasks", "tasks"),
            ("qa.view", "View QA", "qa"),
            ("qa.create", "Create QA", "qa"),
            ("qa.execute", "Execute Tests", "qa"),
            ("qa.edit", "Edit QA", "qa"),
            ("qa.manage", "Manage QA", "qa"),
            ("bugs.view", "View Bugs", "bugs"),
            ("bugs.create", "Create Bugs", "bugs"),
            ("bugs.edit", "Edit Bugs", "bugs"),
            ("bugs.assign", "Assign Bugs", "bugs"),
            ("bugs.resolve", "Resolve Bugs", "bugs"),
            ("bugs.retest", "Retest Bugs", "bugs"),
            ("bugs.close", "Close Bugs", "bugs"),
            ("bugs.manage", "Manage Bugs", "bugs"),
            ("delivery.manage", "Manage Delivery", "projects"),
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
            ("notifications.view", "View Notifications", "notifications"),
            ("notifications.manage", "Manage Notifications", "notifications"),
            ("automation.view", "View Automation", "automation"),
            ("automation.manage", "Manage Automation", "automation"),
            ("ai.chat", "Interact with AI Assistant", "ai"),
            ("ai.manage", "Manage AI Assistant", "ai"),
        ]

        print("Adding permissions...")
        perm_objs = [Permission(code=c, name=n, module=m) for c, n, m in all_permissions]
        db.add_all(perm_objs)

        print("Adding departments...")
        depts = [
            Department(name="Executive Management"),
            Department(name="Sales Department"),
            Department(name="Engineering"),
            Department(name="Client Services"),
            Department(name="Finance & Accounting"),
        ]
        db.add_all(depts)

        print("Adding admin role...")
        admin_role = Role(name="Super Admin", description="Super Administrator with all permissions", is_system=True)
        admin_role.permissions = perm_objs
        db.add(admin_role)

        print("Adding admin user...")
        admin_user = User(
            email="admin@kiwicloudtech.co.in",
            hashed_password=get_password_hash("Admin@123"),
            first_name="Kiwi",
            last_name="Administrator",
            is_active=True,
            is_superuser=True,
            roles=[admin_role],
            department=depts[0],
        )
        db.add(admin_user)

        print("Committing all changes to database...")
        db.commit()
        print("SEED SUCCESS: Admin user created -> admin@kiwicloudtech.co.in / Admin@123")
    except Exception as e:
        db.rollback()
        print("SEED ERROR:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
