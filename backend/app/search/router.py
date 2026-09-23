from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.users.models import User
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity, Quotation, Product
from app.communication.models import CommunicationMessage

router = APIRouter()

class SearchResultItem(BaseModel):
    id: str
    type: str  # 'company', 'contact', 'lead', 'opportunity', 'quotation', 'product'
    title: str
    subtitle: str
    url: str

class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]
    tickets: List[Dict[str, Any]] = []

@router.get("/search", response_model=SearchResponse)
def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    perms = current_user.get_permission_codes()
    is_super = "*" in perms
    results: List[SearchResultItem] = []
    s = f"%{q}%"

    # Companies
    if is_super or "crm.companies.view" in perms:
        companies = db.query(Company).filter(
            Company.is_deleted == False,
            (Company.organization_name.ilike(s)) | (Company.code.ilike(s)) | (Company.city.ilike(s))
        ).limit(limit).all()
        for comp in companies:
            results.append(SearchResultItem(
                id=comp.id,
                type="company",
                title=comp.organization_name,
                subtitle=f"Code: {comp.code} | {comp.type} | {comp.city or 'India'}",
                url=f"/companies/{comp.id}",
            ))

    # Contacts
    if is_super or "crm.companies.view" in perms:
        contacts = db.query(Contact).filter(
            Contact.is_deleted == False,
            (Contact.name.ilike(s)) | (Contact.email.ilike(s)) | (Contact.phone.ilike(s))
        ).limit(limit).all()
        for con in contacts:
            company_name = con.company.organization_name if con.company else "Independent"
            results.append(SearchResultItem(
                id=con.id,
                type="contact",
                title=con.name,
                subtitle=f"{con.designation or 'Contact'} at {company_name} ({con.email or con.phone or ''})",
                url=f"/companies/{con.company_id}?tab=contacts",
            ))

    # Leads
    if is_super or "crm.leads.view" in perms:
        leads = db.query(Lead).filter(
            Lead.is_deleted == False,
            (Lead.title.ilike(s)) | (Lead.description.ilike(s))
        ).limit(limit).all()
        for lead in leads:
            results.append(SearchResultItem(
                id=lead.id,
                type="lead",
                title=lead.title,
                subtitle=f"Status: {lead.status} | Priority: {lead.priority} | Est: ₹{lead.expected_value:,.2f}",
                url=f"/leads/{lead.id}",
            ))

    # Opportunities
    if is_super or "crm.opportunities.view" in perms:
        opps = db.query(Opportunity).filter(
            Opportunity.is_deleted == False,
            (Opportunity.title.ilike(s)) | (Opportunity.description.ilike(s))
        ).limit(limit).all()
        for opp in opps:
            stage_name = opp.stage.name if opp.stage else "Open"
            results.append(SearchResultItem(
                id=opp.id,
                type="opportunity",
                title=opp.title,
                subtitle=f"Stage: {stage_name} | Value: ₹{opp.value:,.2f} | Status: {opp.status}",
                url=f"/opportunities/{opp.id}",
            ))

    # Quotations
    if is_super or "sales.quotations.view" in perms:
        quotes = db.query(Quotation).filter(
            Quotation.is_deleted == False,
            (Quotation.quotation_number.ilike(s)) | (Quotation.notes.ilike(s))
        ).limit(limit).all()
        for q_obj in quotes:
            comp_name = q_obj.company.organization_name if q_obj.company else "Company"
            results.append(SearchResultItem(
                id=q_obj.id,
                type="quotation",
                title=f"Quotation {q_obj.quotation_number}",
                subtitle=f"{comp_name} | Total: ₹{float(q_obj.total_amount):,.2f} | Status: {q_obj.status}",
                url=f"/sales/quotations/{q_obj.id}",
            ))

    # Products
    if is_super or "sales.products.view" in perms:
        prods = db.query(Product).filter(
            Product.is_deleted == False,
            (Product.name.ilike(s)) | (Product.code.ilike(s))
        ).limit(limit).all()
        for p_obj in prods:
            results.append(SearchResultItem(
                id=p_obj.id,
                type="product",
                title=p_obj.name,
                subtitle=f"Code: {p_obj.code} | Price: ₹{float(p_obj.base_price):,.2f} | {p_obj.type}",
                url=f"/sales/products",
            ))

    # Projects
    if is_super or "projects.view" in perms:
        from app.projects.models import Project
        projects = db.query(Project).filter(
            Project.is_deleted == False,
            (Project.name.ilike(s)) | (Project.project_number.ilike(s))
        ).limit(limit).all()
        for prj in projects:
            comp_name = prj.company.organization_name if prj.company else "Company"
            results.append(SearchResultItem(
                id=prj.id,
                type="project",
                title=f"{prj.project_number}: {prj.name}",
                subtitle=f"{comp_name} | Status: {prj.status} | Progress: {float(prj.progress_percentage):.0f}%",
                url=f"/projects/{prj.id}",
            ))

    # Bugs
    if is_super or "bugs.view" in perms:
        from app.qa.models import Bug
        bugs = db.query(Bug).filter(
            Bug.is_deleted == False,
            (Bug.title.ilike(s)) | (Bug.bug_number.ilike(s))
        ).limit(limit).all()
        for bg in bugs:
            results.append(SearchResultItem(
                id=bg.id,
                type="bug",
                title=f"{bg.bug_number}: {bg.title}",
                subtitle=f"Severity: {bg.severity} | Priority: {bg.priority} | Status: {bg.status}",
                url=f"/bugs/{bg.id}",
            ))

    # Service Tickets
    ticket_items = []
    if is_super or "service.view" in perms or "crm.companies.view" in perms:
        from app.service.models import Ticket
        tickets = db.query(Ticket).filter(
            Ticket.is_deleted == False,
            (Ticket.subject.ilike(s)) | (Ticket.ticket_number.ilike(s)) | (Ticket.description.ilike(s))
        ).limit(limit).all()
        for tk in tickets:
            comp_name = tk.company.organization_name if tk.company else "Company"
            results.append(SearchResultItem(
                id=tk.id,
                type="ticket",
                title=f"{tk.ticket_number}: {tk.subject}",
                subtitle=f"{comp_name} | Priority: {tk.priority} | Status: {tk.status} | SLA: {tk.sla_status}",
                url=f"/service/tickets/{tk.id}",
            ))
            ticket_items.append({
                "id": tk.id,
                "ticket_number": tk.ticket_number,
                "subject": tk.subject,
                "status": tk.status,
                "priority": tk.priority,
                "severity": tk.severity,
                "company_id": tk.company_id,
                "company_name": comp_name,
                "due_at": tk.due_at.isoformat() if tk.due_at else None,
                "created_at": tk.created_at.isoformat() if tk.created_at else None,
            })

    # Accounting: Invoices
    if is_super or "accounting.view" in perms:
        from app.accounting.models import Invoice, Bill, CustomerPayment, Expense, Account
        invoices = db.query(Invoice).filter(
            Invoice.is_deleted == False,
            (Invoice.invoice_number.ilike(s)) | (Invoice.notes.ilike(s))
        ).limit(limit).all()
        for inv in invoices:
            comp_name = inv.company.organization_name if inv.company else "Company"
            results.append(SearchResultItem(
                id=inv.id,
                type="invoice",
                title=f"Invoice {inv.invoice_number}",
                subtitle=f"{comp_name} | Total: ₹{float(inv.total_amount):,.2f} | Status: {inv.status}",
                url=f"/accounting/invoices/{inv.id}",
            ))

        # Bills
        bills = db.query(Bill).filter(
            Bill.is_deleted == False,
            (Bill.bill_number.ilike(s)) | (Bill.reference.ilike(s))
        ).limit(limit).all()
        for b in bills:
            v_name = b.vendor.name if b.vendor else "Vendor"
            results.append(SearchResultItem(
                id=b.id,
                type="bill",
                title=f"Bill {b.bill_number}",
                subtitle=f"{v_name} | Total: ₹{float(b.total_amount):,.2f} | Status: {b.status}",
                url=f"/accounting/bills",
            ))

        # Payments
        payments = db.query(CustomerPayment).filter(
            (CustomerPayment.payment_number.ilike(s)) | (CustomerPayment.reference.ilike(s))
        ).limit(limit).all()
        for pay in payments:
            comp_name = pay.company.organization_name if pay.company else "Company"
            results.append(SearchResultItem(
                id=pay.id,
                type="payment",
                title=f"Payment {pay.payment_number}",
                subtitle=f"{comp_name} | Amount: ₹{float(pay.amount):,.2f} | Method: {pay.payment_method}",
                url=f"/accounting/payments",
            ))

        # Accounts
        accounts = db.query(Account).filter(
            Account.is_active == True,
            (Account.account_code.ilike(s)) | (Account.account_name.ilike(s))
        ).limit(limit).all()
        for acc in accounts:
            results.append(SearchResultItem(
                id=acc.id,
                type="account",
                title=f"{acc.account_code} - {acc.account_name}",
                subtitle=f"Type: {acc.account_type}",
                url=f"/accounting/accounts",
            ))

    # Communications (Email, WhatsApp, Calls)
    if is_super or "communications.view" in perms:
        comms = db.query(CommunicationMessage).filter(
            CommunicationMessage.is_deleted == False,
            or_(
                CommunicationMessage.subject.ilike(s),
                CommunicationMessage.body_text.ilike(s),
                CommunicationMessage.sender.ilike(s),
                CommunicationMessage.recipient.ilike(s),
                CommunicationMessage.provider_message_id.ilike(s),
            )
        ).limit(limit).all()
        for c in comms:
            title_text = c.subject or f"{c.channel.title()} Message"
            sub_text = f"{c.channel} {c.direction} | {c.sender} -> {c.recipient} | Status: {c.status}"
            url_path = "/communications/email" if c.channel == "EMAIL" else ("/communications/whatsapp" if c.channel == "WHATSAPP" else "/communications/calls")
            results.append(SearchResultItem(
                id=c.id,
                type="communication",
                title=title_text,
                subtitle=sub_text,
                url=url_path,
            ))

    return SearchResponse(
        query=q,
        total_results=len(results),
        results=results[:limit],
        tickets=ticket_items,
    )
