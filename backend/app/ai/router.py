from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.users.models import User
from app.ai.models import AIConversation, AIMessage
from app.ai.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    ConversationDetail,
    QuickAction,
    ChatMessageSchema,
    Citation,
)
from app.ai.assistant import AIAssistant

router = APIRouter()


def _has_permission(user: User, perm: str) -> bool:
    if getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN":
        return True
    codes = user.get_permission_codes() if hasattr(user, "get_permission_codes") else []
    return "*" in codes or perm in codes


@router.get("/status")
def ai_status():
    """Module health check and status extension endpoint."""
    return {"module": "ai", "status": "active", "version": "2.0", "provider": "deterministic-mock"}


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Interact with the Kiwi Cloud Tech CRM AI Assistant.
    Translates natural language questions into permission-safe, read-only CRM queries.
    """
    if not _has_permission(current_user, "ai.chat"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: You do not have permission to access the AI Assistant (ai.chat).",
        )

    try:
        assistant = AIAssistant(db, current_user)
        return assistant.process_chat(message=req.message, conversation_id=req.conversation_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI processing error: {str(e)}"
        )


@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent AI Assistant conversations for the authenticated user."""
    convs = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.updated_at.desc()).limit(30).all()

    res: List[ConversationSummary] = []
    for c in convs:
        count = db.query(AIMessage).filter(AIMessage.conversation_id == c.id).count()
        res.append(ConversationSummary(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=count,
        ))
    return res


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full message history for a specific conversation."""
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == current_user.id
    ).first()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    msgs = db.query(AIMessage).filter(
        AIMessage.conversation_id == conv.id
    ).order_by(AIMessage.created_at.asc()).all()

    msg_schemas = []
    for m in msgs:
        cit_objs = []
        if m.citations and isinstance(m.citations, list):
            for c in m.citations:
                if isinstance(c, dict):
                    cit_objs.append(Citation(
                        title=c.get("title", ""),
                        url=c.get("url", ""),
                        type=c.get("type", "general"),
                        id=c.get("id"),
                    ))

        msg_schemas.append(ChatMessageSchema(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            citations=cit_objs if cit_objs else None,
            tool_calls=m.tool_calls,
            created_at=m.created_at,
        ))

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=msg_schemas,
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an AI conversation thread."""
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == current_user.id
    ).first()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": conversation_id}


@router.get("/quick-actions", response_model=List[QuickAction])
def get_quick_actions(
    current_user: User = Depends(get_current_user),
):
    """
    Returns suggested quick action prompts customized for the user's specific RBAC permissions.
    Finance quick actions are strictly omitted for users without accounting permission.
    """
    actions: List[QuickAction] = [
        QuickAction(
            id="today_followups",
            label="Today's Follow-ups",
            prompt="What should I follow up on today?",
            category="general",
            icon="clock",
        ),
        QuickAction(
            id="summarize_customer",
            label="Summarize a Customer",
            prompt="Summarize ABC College.",
            category="sales",
            icon="building",
        ),
        QuickAction(
            id="project_status",
            label="Project Status",
            prompt="Summarize the ABC College project.",
            category="projects",
            icon="folder",
        ),
        QuickAction(
            id="sla_issues",
            label="SLA Warnings",
            prompt="Which tickets are close to SLA breach?",
            category="service",
            icon="alert-circle",
        ),
        QuickAction(
            id="critical_bugs",
            label="Open Critical Bugs",
            prompt="Show critical bugs.",
            category="qa",
            icon="bug",
        ),
    ]

    # Only include finance quick action if authorized
    if _has_permission(current_user, "accounting.view"):
        actions.append(QuickAction(
            id="overdue_invoices",
            label="Overdue Invoices",
            prompt="Show overdue invoices.",
            category="finance",
            icon="credit-card",
            permission_required="accounting.view",
        ))

    # Sales report explanation
    if _has_permission(current_user, "reports.view_sales") or _has_permission(current_user, "reports.view"):
        actions.append(QuickAction(
            id="explain_sales_report",
            label="Explain Sales Report",
            prompt="Explain the sales report.",
            category="sales",
            icon="bar-chart",
        ))

    return actions
