from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class Citation(BaseModel):
    title: str
    url: str
    type: str  # "company", "project", "ticket", "bug", "invoice", "lead", "opportunity"
    id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatMessageSchema(BaseModel):
    id: str
    conversation_id: str
    role: str  # "user", "assistant", "system"
    content: str
    citations: Optional[List[Citation]] = None
    tool_calls: Optional[List[str]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessageSchema
    tools_used: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    model_config = ConfigDict(from_attributes=True)


class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageSchema]

    model_config = ConfigDict(from_attributes=True)


class QuickAction(BaseModel):
    id: str
    label: str
    prompt: str
    category: str  # "general", "sales", "service", "projects", "qa", "finance"
    icon: str
    permission_required: Optional[str] = None
