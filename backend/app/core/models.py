# Central model registry for SQLAlchemy and Alembic
from app.core.database import Base
from app.audit.models import AuditLog
from app.users.models import Department, Team, Permission, Role, User, role_permissions, user_roles
from app.organizations.models import Company, Contact
from app.crm.models import LeadSource, Lead
from app.sales.models import (
    Pipeline, PipelineStage, Opportunity,
    ProductCategory, Product, NumberSequence,
    Quotation, QuotationItem, Contract,
    SalesOrder, SalesOrderItem,
)
from app.activities.models import Activity, Task, Meeting, Note
from app.projects.models import Project, ProjectMember, Milestone, ProjectTask
from app.qa.models import TestSuite, TestCase, TestExecution, Bug, BugComment, BugAttachment
from app.service.models import (
    ServiceCategory, ServiceSubcategory, SLAPolicy,
    Ticket, TicketComment, TicketAttachment,
    TicketStatusHistory, TicketAssignment, TicketEscalation,
)
from app.accounting.models import (
    Account, FiscalPeriod, JournalEntry, JournalLine,
    TaxRate, Invoice, InvoiceItem, CustomerPayment,
    PaymentAllocation, Vendor, Bill, BillItem,
    VendorPayment, BillAllocation, Expense,
    BankReconciliation, BankReconciliationItem,
)
from app.communication.models import (
    EmailAccount, EmailThread, CommunicationMessage,
    CommunicationTemplate, WhatsAppConfig, PhoneConfig,
    CommunicationAttachment,
)
from app.reports.models import SavedReport
from app.notifications.models import Notification, NotificationPreference, AutomationRule, AutomationJobLog
from app.ai.models import AIConversation, AIMessage

__all__ = [
    "Base",
    "AuditLog",
    "Department",
    "Team",
    "Permission",
    "Role",
    "User",
    "role_permissions",
    "user_roles",
    "Company",
    "Contact",
    "LeadSource",
    "Lead",
    "Pipeline",
    "PipelineStage",
    "Opportunity",
    "ProductCategory",
    "Product",
    "NumberSequence",
    "Quotation",
    "QuotationItem",
    "Contract",
    "SalesOrder",
    "SalesOrderItem",
    "Activity",
    "Task",
    "Meeting",
    "Note",
    "Project",
    "ProjectMember",
    "Milestone",
    "ProjectTask",
    "TestSuite",
    "TestCase",
    "TestExecution",
    "Bug",
    "BugComment",
    "BugAttachment",
    "ServiceCategory",
    "ServiceSubcategory",
    "SLAPolicy",
    "Ticket",
    "TicketComment",
    "TicketAttachment",
    "TicketStatusHistory",
    "TicketAssignment",
    "TicketEscalation",
    "Account",
    "FiscalPeriod",
    "JournalEntry",
    "JournalLine",
    "TaxRate",
    "Invoice",
    "InvoiceItem",
    "CustomerPayment",
    "PaymentAllocation",
    "Vendor",
    "Bill",
    "BillItem",
    "VendorPayment",
    "BillAllocation",
    "Expense",
    "BankReconciliation",
    "BankReconciliationItem",
    "EmailAccount",
    "EmailThread",
    "CommunicationMessage",
    "CommunicationTemplate",
    "WhatsAppConfig",
    "PhoneConfig",
    "CommunicationAttachment",
    "SavedReport",
    "Notification",
    "NotificationPreference",
    "AutomationRule",
    "AutomationJobLog",
    "AIConversation",
    "AIMessage",
]


