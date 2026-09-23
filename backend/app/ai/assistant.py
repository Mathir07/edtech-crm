import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.users.models import User
from app.audit.models import AuditLog
from app.ai.models import AIConversation, AIMessage
from app.ai.schemas import ChatResponse, ChatMessageSchema, Citation
from app.ai.providers import get_ai_provider, AIProviderResult
from app.ai.tools import (
    tool_search_crm,
    tool_company_summary,
    tool_college_summary,
    tool_project_summary,
    tool_service_summary,
    tool_qa_summary,
    tool_finance_summary,
    tool_followups,
    tool_reports_explanation,
    tool_draft_communication,
)

logger = logging.getLogger("ai.assistant")


class AIAssistant:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user

    def process_chat(self, message: str, conversation_id: Optional[str] = None) -> ChatResponse:
        clean_msg = message.strip()
        if len(clean_msg) > settings.AI_MAX_PROMPT_LENGTH:
            raise ValueError(f"Prompt exceeds maximum allowed length of {settings.AI_MAX_PROMPT_LENGTH} characters.")

        # 1. Retrieve or create conversation
        conv = None
        if conversation_id:
            conv = self.db.query(AIConversation).filter(
                AIConversation.id == conversation_id,
                AIConversation.user_id == self.user.id
            ).first()

        if not conv:
            # Generate descriptive initial title
            title = clean_msg[:40] + ("..." if len(clean_msg) > 40 else "")
            conv = AIConversation(
                user_id=self.user.id,
                organization_id="kct-default",
                title=title,
            )
            self.db.add(conv)
            self.db.commit()
            self.db.refresh(conv)

        # 2. Fetch recent conversation history for multi-turn context
        past_msgs = self.db.query(AIMessage).filter(
            AIMessage.conversation_id == conv.id
        ).order_by(AIMessage.created_at.asc()).all()

        history_payload: List[Dict[str, str]] = []
        last_entity_mentioned: Optional[str] = None

        for m in past_msgs[-6:]:
            history_payload.append({"role": m.role, "content": m.content})
            # Try to identify previously mentioned entity names
            if m.citations:
                for cit in m.citations:
                    if isinstance(cit, dict) and cit.get("title"):
                        last_entity_mentioned = cit.get("title")

        # 3. Save incoming user message
        user_msg_record = AIMessage(
            conversation_id=conv.id,
            role="user",
            content=clean_msg,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(user_msg_record)
        self.db.commit()

        # 4. Resolve intent & dispatch authoritative CRM tools
        context_data, citations, tools_used = self._resolve_intent_and_execute_tools(
            clean_msg, history_payload, last_entity_mentioned
        )

        # 5. Call Provider Abstraction
        provider = get_ai_provider()
        sys_prompt = (
            "You are the Kiwi Cloud Tech CRM AI Assistant. Provide helpful, accurate, and concise "
            "answers strictly grounded in the retrieved CRM context data. Never invent records or metrics. "
            "For communication drafts, always label them as drafts requiring manual user review."
        )

        provider_result = provider.generate(
            prompt=clean_msg,
            system_prompt=sys_prompt,
            conversation_history=history_payload,
            context_data=context_data,
        )

        # 6. Save assistant response
        citations_data = [c.model_dump() for c in citations] if citations else None
        asst_msg_record = AIMessage(
            conversation_id=conv.id,
            role="assistant",
            content=provider_result.content,
            citations=citations_data,
            tool_calls=tools_used,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(asst_msg_record)
        conv.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(asst_msg_record)

        # 7. Record Audit Log
        try:
            audit = AuditLog(
                user_id=self.user.id,
                user_email=getattr(self.user, "email", "user@kiwicloudtech.co.in"),
                action="AI_QUERY",
                entity_type="AI_ASSISTANT",
                entity_id=conv.id,
                new_values={
                    "tools_used": tools_used,
                    "model": provider_result.model_used,
                    "prompt_snippet": clean_msg[:80],
                },
                created_at=datetime.now(timezone.utc),
            )
            self.db.add(audit)
            self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to record AI audit log: {e}")

        # 8. Build response
        msg_schema = ChatMessageSchema(
            id=asst_msg_record.id,
            conversation_id=conv.id,
            role="assistant",
            content=asst_msg_record.content,
            citations=citations,
            tool_calls=tools_used,
            created_at=asst_msg_record.created_at,
        )

        return ChatResponse(
            conversation_id=conv.id,
            message=msg_schema,
            tools_used=tools_used,
        )

    def _resolve_intent_and_execute_tools(
        self,
        prompt: str,
        history: List[Dict[str, str]],
        last_entity: Optional[str],
    ) -> Tuple[Dict[str, Any], List[Citation], List[str]]:
        p_lower = prompt.lower().strip()
        citations: List[Citation] = []
        tools_used: List[str] = []

        # A. Draft communication request
        if "draft" in p_lower or "write a" in p_lower:
            tools_used.append("draft_communication")
            channel = "WHATSAPP" if "whatsapp" in p_lower else "EMAIL"
            topic = "follow-up"
            if "payment" in p_lower or "invoice" in p_lower:
                topic = "payment reminder"
            elif "service" in p_lower or "ticket" in p_lower:
                topic = "service ticket response"
            elif "project" in p_lower:
                topic = "project update"

            recipient = "Customer"
            match = re.search(r"(?:to|for)\s+([A-Za-z0-9\s]+?)(?:\.|$|,|regarding)", prompt, re.IGNORECASE)
            if match:
                recipient = match.group(1).strip()
            elif last_entity:
                recipient = last_entity

            ctx = tool_draft_communication(self.db, self.user, channel=channel, recipient=recipient, topic=topic)
            return ctx, citations, tools_used

        # B. Finance & Invoice queries (STRICT RBAC ENFORCEMENT)
        if any(term in p_lower for term in ["overdue invoice", "invoices", "ar aging", "outstanding", "unpaid invoice", "financial"]):
            tools_used.append("get_finance_summary")
            ctx = tool_finance_summary(self.db, self.user)
            if ctx.get("finance") and ctx["finance"].get("overdue_invoices"):
                for inv in ctx["finance"]["overdue_invoices"][:3]:
                    citations.append(Citation(
                        title=f"Invoice {inv['invoice_number']}",
                        url=f"/accounting/invoices/{inv['id']}",
                        type="invoice",
                        id=inv["id"],
                    ))
            return ctx, citations, tools_used

        # C. Follow-up assistant
        if any(term in p_lower for term in ["follow up", "follow-up", "needs attention", "gone quiet", "tasks are overdue", "what should i do"]):
            tools_used.append("get_followups")
            ctx = tool_followups(self.db, self.user)
            if ctx.get("followups"):
                fu = ctx["followups"]
                for l in fu.get("dormant_leads", [])[:2]:
                    citations.append(Citation(title=l["title"], url=f"/leads/{l['id']}", type="lead", id=l["id"]))
                for o in fu.get("dormant_opportunities", [])[:2]:
                    citations.append(Citation(title=o["title"], url=f"/opportunities/{o['id']}", type="opportunity", id=o["id"]))
            return ctx, citations, tools_used

        # D. Service / SLA queries
        if any(term in p_lower for term in ["sla", "breach", "ticket", "service workload"]):
            tools_used.append("get_service_summary")
            ctx = tool_service_summary(self.db, self.user)
            if ctx.get("service"):
                s = ctx["service"]
                for tk in (s.get("breached_tickets", []) + s.get("at_risk_tickets", []))[:3]:
                    citations.append(Citation(
                        title=f"{tk['ticket_number']}: {tk['subject']}",
                        url=f"/service/tickets/{tk['id']}",
                        type="ticket",
                        id=tk["id"],
                    ))
            return ctx, citations, tools_used

        # E. QA & Bug queries
        if any(term in p_lower for term in ["bug", "qa status", "test suite", "qa report"]):
            tools_used.append("get_qa_summary")
            ctx = tool_qa_summary(self.db, self.user)
            if ctx.get("qa") and ctx["qa"].get("critical_bugs"):
                for b in ctx["qa"]["critical_bugs"][:3]:
                    citations.append(Citation(
                        title=f"{b['bug_number']}: {b['title']}",
                        url=f"/bugs/{b['id']}",
                        type="bug",
                        id=b["id"],
                    ))
            return ctx, citations, tools_used

        # F. Report explanation
        if any(term in p_lower for term in ["explain", "sales report", "dashboard", "report explanation"]):
            tools_used.append("get_reports_explanation")
            rep_type = "executive"
            if "sales" in p_lower or "pipeline" in p_lower:
                rep_type = "sales"
            elif "finance" in p_lower or "aging" in p_lower:
                rep_type = "finance"
            elif "service" in p_lower:
                rep_type = "service"
            ctx = tool_reports_explanation(self.db, self.user, rep_type)
            return ctx, citations, tools_used

        # G. Project Summary
        if "project" in p_lower:
            tools_used.append("get_project_summary")
            # Extract project target
            target = re.sub(r"^(?:summarize\s+)?(?:the\s+)?(?:project\s+)?", "", prompt, flags=re.IGNORECASE)
            target = re.sub(r"\s+project\b", "", target, flags=re.IGNORECASE)
            target = target.rstrip(".?! ").strip() or (last_entity or "Project")
            ctx = tool_project_summary(self.db, self.user, target)
            if ctx.get("project"):
                prj = ctx["project"]
                citations.append(Citation(
                    title=f"{prj['project_number']}: {prj['name']}",
                    url=f"/projects/{prj['id']}",
                    type="project",
                    id=prj["id"],
                ))
            return ctx, citations, tools_used

        # H. College / Customer Summary
        if any(term in p_lower for term in ["company", "customer", "college", "summarize", "about them"]):
            tools_used.append("get_company_summary")
            target = last_entity or "ABC College"
            clean_target = prompt.strip()
            for prefix in ["summarize", "tell me about", "what about", "who is", "customer", "find"]:
                clean_target = re.sub(rf"^{prefix}\s+", "", clean_target, flags=re.IGNORECASE)
            target = clean_target.rstrip(".?! ").strip() or (last_entity or "ABC College")

            ctx = tool_company_summary(self.db, self.user, target)
            if ctx.get("company"):
                col = ctx["company"]
                citations.append(Citation(
                    title=col["name"],
                    url=f"/companies/{col['id']}",
                    type="company",
                    id=col["id"],
                ))
            return ctx, citations, tools_used

        # I. Global Search fallback
        tools_used.append("search_crm")
        ctx = tool_search_crm(self.db, self.user, prompt)
        if ctx.get("search"):
            for item in ctx["search"][:4]:
                citations.append(Citation(
                    title=item["title"],
                    url=item["url"],
                    type=item["type"],
                    id=item["id"],
                ))
        return ctx, citations, tools_used
