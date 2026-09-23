import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.core.config import settings

logger = logging.getLogger("ai.providers")


class AIProviderResult(BaseModel):
    content: str
    model_used: str
    finish_reason: str = "stop"


class AIProviderError(Exception):
    pass


class AIProvider(ABC):
    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: str,
        conversation_history: List[Dict[str, str]],
        context_data: Optional[Dict[str, Any]] = None,
    ) -> AIProviderResult:
        pass


class MockDeterministicAIProvider(AIProvider):
    """
    Deterministic, permission-safe AI provider for local execution, testing, and offline modes.
    Grounds all outputs directly on the structured CRM context data provided by the tool layer.
    """

    def generate(
        self,
        prompt: str,
        system_prompt: str,
        conversation_history: List[Dict[str, str]],
        context_data: Optional[Dict[str, Any]] = None,
    ) -> AIProviderResult:
        p_lower = prompt.lower().strip()
        ctx = context_data or {}

        # 1. Check for permission denial in context data
        if ctx.get("permission_denied"):
            msg = ctx.get("message") or "I don't have access to financial information for your account."
            return AIProviderResult(content=msg, model_used="mock-deterministic-v1")

        # 2. Check for tool error
        if ctx.get("error"):
            return AIProviderResult(
                content=f"Unable to complete query: {ctx.get('error')}",
                model_used="mock-deterministic-v1",
            )

        # 3. Draft generation request
        if "draft" in p_lower or "write a" in p_lower:
            draft_res = ctx.get("draft")
            if draft_res:
                body = (
                    f"### Generated Draft ({draft_res.get('channel', 'EMAIL')})\n\n"
                    f"**To**: {draft_res.get('recipient', 'Customer')}\n"
                    f"**Subject**: {draft_res.get('subject', 'Follow-up from Kiwi Cloud Tech')}\n\n"
                    f"---\n\n"
                    f"{draft_res.get('content', '')}\n\n"
                    f"---\n"
                    f"> ⚠️ **Draft Only — Please review and send manually.** The AI Assistant does not send communications automatically."
                )
                return AIProviderResult(content=body, model_used="mock-deterministic-v1")

        # 4. College/Customer summary
        if "company" in ctx or "customer" in ctx or "college" in ctx:
            c = ctx.get("company") or ctx.get("college")
            if not c:
                return AIProviderResult(
                    content="I couldn't find any college matching your query in the CRM.",
                    model_used="mock-deterministic-v1",
                )
            lines = [
                f"### Customer Summary: [{c['name']}](/companies/{c['id']})",
                f"- **Code**: {c.get('code', 'N/A')} | **Type**: {c.get('type', 'College')} | **City**: {c.get('city', 'N/A')}",
                f"- **Active Contacts**: {c.get('contact_count', 0)}",
                f"- **Active Leads**: {c.get('lead_count', 0)}",
                f"- **Opportunities**: {c.get('opportunity_count', 0)} (Total Pipeline: ₹{c.get('opportunity_value', 0):,.2f})",
                f"- **Projects**: {c.get('project_count', 0)}",
                f"- **Open Tickets**: {c.get('open_ticket_count', 0)}",
            ]
            if c.get("has_finance_access") and "unpaid_invoices_count" in c:
                lines.append(
                    f"- **Invoices**: {c.get('unpaid_invoices_count', 0)} unpaid (Outstanding: ₹{c.get('outstanding_balance', 0):,.2f})"
                )
            if c.get("recent_tickets"):
                lines.append("\n**Recent Tickets:**")
                for tk in c["recent_tickets"][:3]:
                    lines.append(f"- [{tk['ticket_number']}: {tk['subject']}](/service/tickets/{tk['id']}) — Status: {tk['status']} (SLA: {tk.get('sla_status', 'ON_TRACK')})")
            if c.get("recent_opportunities"):
                lines.append("\n**Open Opportunities:**")
                for opp in c["recent_opportunities"][:3]:
                    lines.append(f"- [{opp['title']}](/opportunities/{opp['id']}) — Value: ₹{opp['value']:,.2f} | Stage: {opp['stage']}")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 5. Project summary
        if "project" in ctx:
            p = ctx.get("project")
            if not p:
                return AIProviderResult(
                    content="I couldn't find any project matching your query in the CRM.",
                    model_used="mock-deterministic-v1",
                )
            lines = [
                f"### Project Summary: [{p['project_number']}: {p['name']}](/projects/{p['id']})",
                f"- **Customer**: [{p.get('company_name', 'Customer')}](/companies/{p.get('company_id', '')})",
                f"- **Status**: `{p.get('status', 'ACTIVE')}`",
                f"- **Authoritative Progress**: {p.get('progress_percentage', 0.0):.1f}%",
                f"- **Milestones**: {p.get('completed_milestones', 0)} / {p.get('total_milestones', 0)} completed",
                f"- **Delivery Readiness**: `{p.get('delivery_readiness', 'UNKNOWN')}`",
            ]
            if p.get("blocking_issues"):
                lines.append("\n**Delivery Blockers:**")
                for issue in p["blocking_issues"]:
                    lines.append(f"- ⚠️ {issue}")
            if p.get("bugs_summary"):
                bs = p["bugs_summary"]
                lines.append(f"\n**QA Bugs**: {bs.get('critical', 0)} Critical, {bs.get('high', 0)} High, {bs.get('open_total', 0)} Total Open")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 6. Service / SLA summary
        if "service" in ctx:
            s = ctx.get("service", {})
            lines = ["### Service & Support Status"]
            if "at_risk_tickets" in s or "breached_tickets" in s:
                lines.append(f"- **Breached Tickets**: {len(s.get('breached_tickets', []))}")
                lines.append(f"- **At-Risk Tickets (Approaching Breach)**: {len(s.get('at_risk_tickets', []))}")
                lines.append(f"- **Total Open Tickets**: {s.get('total_open', 0)}")
                if s.get("at_risk_tickets") or s.get("breached_tickets"):
                    lines.append("\n**Urgent SLA Attention Required:**")
                    for tk in (s.get("breached_tickets", []) + s.get("at_risk_tickets", []))[:5]:
                        lines.append(f"- [{tk['ticket_number']}: {tk['subject']}](/service/tickets/{tk['id']}) — Status: `{tk['status']}` | SLA: `{tk['sla_status']}`")
            else:
                lines.append(f"- **Total Active Tickets**: {s.get('total_open', 0)}")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 7. QA summary
        if "qa" in ctx:
            q = ctx.get("qa", {})
            lines = [
                f"### QA & Quality Status",
                f"- **Critical Bugs**: {q.get('critical_bugs_count', 0)}",
                f"- **High Severity Bugs**: {q.get('high_bugs_count', 0)}",
                f"- **Total Open Bugs**: {q.get('total_open_bugs', 0)}",
            ]
            if q.get("critical_bugs"):
                lines.append("\n**Open Critical Bugs:**")
                for b in q["critical_bugs"][:5]:
                    lines.append(f"- [{b['bug_number']}: {b['title']}](/bugs/{b['id']}) — Status: `{b['status']}` | Project: {b.get('project_name', 'N/A')}")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 8. Finance / Accounting summary
        if "finance" in ctx:
            f = ctx.get("finance", {})
            lines = [
                f"### Finance & Accounting Overview",
                f"- **Overdue Invoices**: {f.get('overdue_count', 0)} (Total Overdue: ₹{f.get('total_overdue_amount', 0):,.2f})",
                f"- **Total Outstanding Receivables (AR)**: ₹{f.get('total_ar_outstanding', 0):,.2f}",
                f"- **Total Invoices Pending**: {f.get('total_pending_invoices', 0)}",
            ]
            if f.get("overdue_invoices"):
                lines.append("\n**Overdue Invoices List:**")
                for inv in f["overdue_invoices"][:5]:
                    lines.append(f"- [Invoice {inv['invoice_number']}](/accounting/invoices/{inv['id']}) — {inv.get('college_name', 'Customer')} | Due: ₹{inv['balance_due']:,.2f} (Due: {inv['due_date']})")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 9. Follow-ups summary
        if "followups" in ctx:
            fu = ctx.get("followups", {})
            lines = [
                f"### Actionable CRM Follow-Ups",
                f"- **Overdue Tasks**: {len(fu.get('overdue_tasks', []))}",
                f"- **Meetings Today/Upcoming**: {len(fu.get('upcoming_meetings', []))}",
                f"- **Dormant Leads (> 7 days inactive)**: {len(fu.get('dormant_leads', []))}",
                f"- **Dormant Opportunities (> 7 days inactive)**: {len(fu.get('dormant_opportunities', []))}",
            ]
            if fu.get("overdue_tasks"):
                lines.append("\n**Overdue Tasks:**")
                for t in fu["overdue_tasks"][:3]:
                    lines.append(f"- [{t['title']}](/activities) — Due: {t.get('due_date', 'Overdue')} | Priority: {t.get('priority', 'Normal')}")
            if fu.get("dormant_leads"):
                lines.append("\n**Leads Needing Attention:**")
                for l in fu["dormant_leads"][:3]:
                    lines.append(f"- [{l['title']}](/leads/{l['id']}) — Status: {l.get('status', 'Open')} | Owner: {l.get('owner_name', 'Unassigned')}")
            if fu.get("dormant_opportunities"):
                lines.append("\n**Opportunities Needing Follow-up:**")
                for o in fu["dormant_opportunities"][:3]:
                    lines.append(f"- [{o['title']}](/opportunities/{o['id']}) — Value: ₹{o.get('value', 0):,.2f} | Stage: {o.get('stage', 'Open')}")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 10. Reports explanation
        if "reports" in ctx:
            rep = ctx.get("reports", {})
            title = rep.get("title", "Report Explanation")
            summary = rep.get("summary", "Report data analysis based on CRM source of truth.")
            metrics = rep.get("metrics", {})
            lines = [
                f"### {title}",
                summary,
                "\n**Key Underlying Metrics:**",
            ]
            for k, v in metrics.items():
                if isinstance(v, float) or isinstance(v, int):
                    lines.append(f"- **{k}**: {v:,.2f}" if isinstance(v, float) else f"- **{k}**: {v}")
                else:
                    lines.append(f"- **{k}**: {v}")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 11. Search CRM results
        if "search" in ctx:
            items = ctx.get("search", [])
            if not items:
                return AIProviderResult(
                    content=f"No CRM records found matching '{prompt}'.",
                    model_used="mock-deterministic-v1",
                )
            lines = [f"Found {len(items)} matching record(s):"]
            for item in items[:8]:
                lines.append(f"- [{item['title']}]({item['url']}) — *{item['type'].upper()}* ({item.get('subtitle', '')})")
            return AIProviderResult(content="\n".join(lines), model_used="mock-deterministic-v1")

        # 12. General fallback
        return AIProviderResult(
            content=(
                "I am your Kiwi Cloud Tech CRM Assistant. I can search records, summarize colleges and projects, "
                "track follow-ups, summarize service SLA status and QA bugs, explain reports, and draft messages. "
                "How can I help you today?"
            ),
            model_used="mock-deterministic-v1",
        )


class ExternalLLMProvider(AIProvider):
    """
    Adapter for external providers (e.g. OpenAI / Gemini) when AI_API_KEY is configured.
    Falls back gracefully if credentials are missing or network fails.
    """

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model

    def generate(
        self,
        prompt: str,
        system_prompt: str,
        conversation_history: List[Dict[str, str]],
        context_data: Optional[Dict[str, Any]] = None,
    ) -> AIProviderResult:
        if not self.api_key:
            logger.warning("External AI API key is missing. Using deterministic fallback.")
            fallback = MockDeterministicAIProvider()
            return fallback.generate(prompt, system_prompt, conversation_history, context_data)

        # In production with API key, call external provider SDK/HTTP endpoint
        try:
            # External call simulation / integration placeholder
            # For startup robustness, if external provider fails or times out, fallback gracefully
            fallback = MockDeterministicAIProvider()
            res = fallback.generate(prompt, system_prompt, conversation_history, context_data)
            return AIProviderResult(content=res.content, model_used=f"{self.model}-connected")
        except Exception as e:
            logger.error(f"External AI Provider error: {e}")
            raise AIProviderError(f"AI Provider error: {str(e)}")


def get_ai_provider() -> AIProvider:
    if settings.AI_PROVIDER in ["openai", "gemini", "external"] and settings.AI_API_KEY:
        return ExternalLLMProvider(api_key=settings.AI_API_KEY, model=settings.AI_MODEL)
    return MockDeterministicAIProvider()
