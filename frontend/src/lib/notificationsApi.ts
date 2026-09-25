import { api } from "./api";

export interface NotificationItem {
  id: string;
  organization_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  is_read: boolean;
  read_at?: string | null;
  dedup_key?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;

  tasks_in_app: boolean;
  tasks_email: boolean;

  meetings_in_app: boolean;
  meetings_email: boolean;

  sales_in_app: boolean;
  sales_email: boolean;

  finance_in_app: boolean;
  finance_email: boolean;

  service_in_app: boolean;
  service_email: boolean;

  projects_in_app: boolean;
  projects_email: boolean;

  qa_in_app: boolean;
  qa_email: boolean;

  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  organization_id: string;
  rule_key: string;
  name: string;
  description?: string | null;
  is_enabled: boolean;
  config_json?: Record<string, any> | null;
  last_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationJobLog {
  id: string;
  organization_id: string;
  job_name: string;
  status: "SUCCESS" | "FAILED" | "RUNNING";
  items_processed: number;
  notifications_created: number;
  emails_sent: number;
  error_message?: string | null;
  started_at: string;
  finished_at?: string | null;
}

export interface AutomationRunResponse {
  status: string;
  jobs_executed: number;
  total_notifications_created: number;
  total_emails_sent: number;
  logs: AutomationJobLog[];
}

export const notificationsApi = {
  getNotifications: (params?: {
    is_read?: boolean;
    notification_type?: string;
    priority?: string;
    page?: number;
    page_size?: number;
  }): Promise<NotificationListResponse> => {
    const query = new URLSearchParams();
    if (params?.is_read !== undefined) query.append("is_read", String(params.is_read));
    if (params?.notification_type) query.append("notification_type", params.notification_type);
    if (params?.priority) query.append("priority", params.priority);
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));

    return api.get<NotificationListResponse>(`/notifications?${query.toString()}`);
  },

  getUnreadCount: (): Promise<{ unread_count: number }> => {
    return api.get<{ unread_count: number }>("/notifications/unread-count");
  },

  markRead: (payload: { notification_ids?: string[]; mark_all?: boolean }): Promise<{ success: boolean; marked_count: number }> => {
    return api.post<{ success: boolean; marked_count: number }>("/notifications/mark-read", payload);
  },

  deleteNotification: (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/notifications/${id}`);
  },

  getPreferences: (): Promise<NotificationPreference> => {
    return api.get<NotificationPreference>("/notifications/preferences");
  },

  updatePreferences: (payload: Partial<NotificationPreference>): Promise<NotificationPreference> => {
    return api.put<NotificationPreference>("/notifications/preferences", payload);
  },

  triggerTestNotification: (payload?: {
    title?: string;
    message?: string;
    priority?: string;
    notification_type?: string;
    entity_type?: string;
    entity_id?: string;
  }): Promise<NotificationItem> => {
    return api.post<NotificationItem>("/notifications/test", payload || {});
  },

  // Automation endpoints
  getAutomationRules: (): Promise<AutomationRule[]> => {
    return api.get<AutomationRule[]>("/automation/rules");
  },

  toggleAutomationRule: (ruleId: string, isEnabled: boolean): Promise<AutomationRule> => {
    return api.put<AutomationRule>(`/automation/rules/${ruleId}/toggle`, { is_enabled: isEnabled });
  },

  updateAutomationRule: (
    ruleId: string,
    payload: { name?: string; description?: string; is_enabled?: boolean; config_json?: Record<string, any> }
  ): Promise<AutomationRule> => {
    return api.put<AutomationRule>(`/automation/rules/${ruleId}`, payload);
  },

  triggerAutomations: (ruleKey?: string): Promise<AutomationRunResponse> => {
    const query = ruleKey ? `?rule_key=${encodeURIComponent(ruleKey)}` : "";
    return api.post<AutomationRunResponse>(`/automation/run${query}`);
  },

  getAutomationLogs: (limit: number = 50): Promise<AutomationJobLog[]> => {
    return api.get<AutomationJobLog[]>(`/automation/logs?limit=${limit}`);
  },
};
