"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Send,
  Building2,
  User,
  Search,
  Check,
  CheckCheck,
  RefreshCw,
  Phone,
  FileCode,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface WhatsAppConversation {
  phone_number: string;
  contact_id?: string;
  contact_name?: string;
  company_id?: string;
  college_name?: string;
  last_message?: string;
  last_message_at: string;
  unread_count: number;
}

interface WhatsAppMessage {
  id: string;
  direction: string;
  sender: string;
  recipient: string;
  body_text: string;
  status: string;
  sent_at: string;
}

interface TemplateOption {
  id: string;
  name: string;
  body_text: string;
}

export default function WhatsAppPage() {
  const toast = useToast();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [inputText, setInputText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const fetchConversations = async () => {
    try {
      setLoadingConv(true);
      const data = await api.get<WhatsAppConversation[]>("/communications/whatsapp/conversations");
      setConversations(data || []);
      if (!activePhone && data && data.length > 0) {
        setActivePhone(data[0].phone_number);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp conversations", err);
    } finally {
      setLoadingConv(false);
    }
  };

  const fetchMessages = async (phone: string) => {
    try {
      setLoadingMsgs(true);
      const data = await api.get<WhatsAppMessage[]>(`/communications/whatsapp/messages?phone_number=${encodeURIComponent(phone)}`);
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to load WhatsApp messages", err);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await api.get<TemplateOption[]>("/communications/templates?channel=WHATSAPP");
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates", err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (activePhone) {
      fetchMessages(activePhone);
    }
  }, [activePhone]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePhone || !inputText.trim()) return;

    try {
      setSending(true);
      await api.post("/communications/whatsapp/send", {
        to_phone: activePhone,
        message_text: inputText,
      });
      toast.success("WhatsApp message sent");
      setInputText("");
      await fetchMessages(activePhone);
      await fetchConversations();
    } catch (err: any) {
      toast.error(err.detail || "Failed to send WhatsApp message");
    } finally {
      setSending(false);
    }
  };

  const handleStartNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;
    setActivePhone(newPhone.trim());
    setShowNewChatModal(false);
    setNewPhone("");
  };

  const activeConv = conversations.find((c) => c.phone_number === activePhone);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            WhatsApp Business Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Direct institutional messaging via Official WhatsApp Business Cloud API
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchConversations();
              if (activePhone) fetchMessages(activePhone);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </button>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg transition-colors shadow-xs"
          >
            <MessageSquare className="w-4 h-4" />
            New Chat
          </button>
        </div>
      </div>

      {/* Two Column Chat Interface */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-3 min-h-[580px] overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className="border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversations ({conversations.length})
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loadingConv ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">Loading chats...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No active conversations yet. Click "New Chat" to initiate WhatsApp outreach.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = c.phone_number === activePhone;
                return (
                  <button
                    key={c.phone_number}
                    onClick={() => setActivePhone(c.phone_number)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-l-4 border-emerald-600 dark:border-emerald-500" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {c.contact_name || c.phone_number}
                      </div>
                      {c.college_name && (
                        <div className="text-2xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {c.college_name}
                        </div>
                      )}
                      <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 mt-1 font-sans">
                        {c.last_message || "No messages"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xs text-slate-400 dark:text-slate-500">{formatDateTime(c.last_message_at).split(" ")[0]}</div>
                      {c.unread_count > 0 && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-3xs font-bold bg-emerald-600 dark:bg-emerald-500 text-white rounded-full">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat History & Input */}
        <div className="md:col-span-2 flex flex-col h-[580px] bg-slate-50/30 dark:bg-slate-950/40">
          {activePhone ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                    {activeConv?.contact_name ? activeConv.contact_name[0] : <Phone className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {activeConv?.contact_name || activePhone}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span>{activePhone}</span>
                      {activeConv?.college_name && (
                        <>
                          <span>•</span>
                          <span>{activeConv.college_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="success">WhatsApp Cloud API</Badge>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-8">Loading message history...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-8">
                    No messages yet in this conversation. Send a message below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOutbound = m.direction === "OUTBOUND";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed ${
                            isOutbound
                              ? "bg-emerald-600 dark:bg-emerald-500 text-white rounded-br-xs shadow-xs"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-xs"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{m.body_text}</div>
                          <div
                            className={`flex items-center justify-end gap-1 text-3xs mt-1 ${
                              isOutbound ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <span>{formatDateTime(m.sent_at)}</span>
                            {isOutbound && (
                              <span>
                                {m.status === "READ" ? (
                                  <CheckCheck className="w-3 h-3 text-sky-200" />
                                ) : (
                                  <Check className="w-3 h-3 text-emerald-200" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input & Template Dropdown */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                {templates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                      <FileCode className="w-3 h-3" /> Quick Template:
                    </span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) setInputText(e.target.value);
                      }}
                      className="text-xs p-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.body_text}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a WhatsApp message..."
                    className="flex-1 p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "..." : "Send"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
              <div>
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Select a conversation</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">or click "New Chat" to begin institutional messaging</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Start WhatsApp Conversation</h3>
            <form onSubmit={handleStartNewChat} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Phone Number (with country code)
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg"
                >
                  Open Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
