import { api } from "./api";

export interface AICitation {
  title: string;
  url: string;
  type: string;
  id?: string | null;
}

export interface AIChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: AICitation[] | null;
  tool_calls?: string[] | null;
  created_at: string;
}

export interface AIChatResponse {
  conversation_id: string;
  message: AIChatMessage;
  tools_used: string[];
}

export interface AIConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AIConversationDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: AIChatMessage[];
}

export interface AIQuickAction {
  id: string;
  label: string;
  prompt: string;
  category: "general" | "sales" | "service" | "projects" | "qa" | "finance";
  icon: string;
  permission_required?: string | null;
}

export const aiApi = {
  // Status check
  getStatus: (): Promise<{ module: string; status: string; version: string }> => {
    return api.get<{ module: string; status: string; version: string }>("/ai/status");
  },

  // Send message
  sendMessage: (message: string, conversationId?: string): Promise<AIChatResponse> => {
    return api.post<AIChatResponse>("/ai/chat", {
      message,
      conversation_id: conversationId || undefined,
    });
  },

  // List recent user conversations
  listConversations: (): Promise<AIConversationSummary[]> => {
    return api.get<AIConversationSummary[]>("/ai/conversations");
  },

  // Get conversation detail with all messages
  getConversation: (id: string): Promise<AIConversationDetail> => {
    return api.get<AIConversationDetail>(`/ai/conversations/${id}`);
  },

  // Delete conversation
  deleteConversation: (id: string): Promise<{ status: string; id: string }> => {
    return api.delete<{ status: string; id: string }>(`/ai/conversations/${id}`);
  },

  // Quick actions based on RBAC permissions
  getQuickActions: (): Promise<AIQuickAction[]> => {
    return api.get<AIQuickAction[]>("/ai/quick-actions");
  },
};
