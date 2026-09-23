"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Clock,
  Building,
  Folder,
  AlertCircle,
  Bug,
  CreditCard,
  BarChart,
  Copy,
  Check,
  ShieldAlert,
  Bot,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";
import {
  aiApi,
  AIChatMessage,
  AIConversationSummary,
  AIQuickAction,
  AICitation,
} from "@/lib/aiApi";
import { useToast } from "@/components/ui/Toast";

export default function AIAssistantPage() {
  const toast = useToast();
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [quickActions, setQuickActions] = useState<AIQuickAction[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadInitialData = async () => {
    setInitialLoading(true);
    try {
      const [convs, actions] = await Promise.all([
        aiApi.listConversations().catch(() => []),
        aiApi.getQuickActions().catch(() => []),
      ]);
      setConversations(convs);
      setQuickActions(actions);
      if (convs.length > 0) {
        selectConversation(convs[0].id);
      }
    } catch (e: any) {
      setErrorBanner("Failed to initialize AI Assistant session.");
    } finally {
      setInitialLoading(false);
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setLoading(true);
    setErrorBanner(null);
    try {
      const detail = await aiApi.getConversation(convId);
      setMessages(detail.messages || []);
    } catch (e: any) {
      setErrorBanner("Failed to load conversation history.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setErrorBanner(null);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await aiApi.deleteConversation(convId);
      toast.success("Conversation deleted");
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
    } catch (err: any) {
      setErrorBanner("Could not delete conversation.");
    }
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputMessage).trim();
    if (!text || loading) return;

    setErrorBanner(null);
    setInputMessage("");

    // Optimistic user message
    const tempUserMsg: AIChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || "",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await aiApi.sendMessage(text, activeConversationId || undefined);
      if (!activeConversationId) {
        setActiveConversationId(response.conversation_id);
        // Refresh conversations list to show new thread
        aiApi.listConversations().then(setConversations).catch(() => {});
      }
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, response.message]);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to process request. Please try again.";
      setErrorBanner(detail);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyDraft = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("AI draft copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getQuickActionIcon = (iconName: string) => {
    switch (iconName) {
      case "clock":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "building":
        return <Building className="w-4 h-4 text-sky-500" />;
      case "folder":
        return <Folder className="w-4 h-4 text-emerald-500" />;
      case "alert-circle":
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case "bug":
        return <Bug className="w-4 h-4 text-red-500" />;
      case "credit-card":
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      case "bar-chart":
        return <BarChart className="w-4 h-4 text-indigo-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Kiwi CRM AI Copilot</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/50 rounded-full">
              Kiwi AI v2.0
            </span>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800/50 rounded-full">
              Read + Draft Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Permission-aware CRM search, institutional customer/project summaries, follow-up alerts, report explanations, and draft assistance.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleNewChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="my-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-xs underline font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden mt-3 space-x-4">
        {/* Left Sidebar: Conversations */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 pr-3 flex flex-col justify-between">
          <div className="overflow-y-auto flex-1 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
              Conversations ({conversations.length})
            </div>

            {conversations.length === 0 && !initialLoading ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500 italic">No past conversations</div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800/60"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="truncate pr-2">{conv.title || "Conversation"}</div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      title="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 space-y-1">
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Backend RBAC Active</span>
            </div>
            <div>Strictly zero autonomous write actions</div>
          </div>
        </div>

        {/* Center: Chat Window */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto text-center py-10">
                <div className="inline-flex p-3 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
                  <Bot className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">How can I assist your CRM workflow today?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
                  Ask questions in plain English. Responses are retrieved authoritatively from active CRM records with strict permission enforcement.
                </p>

                {/* Quick Actions Grid */}
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
                    Suggested Quick Actions
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quickActions.map((qa) => (
                      <button
                        key={qa.id}
                        onClick={() => handleSendMessage(qa.prompt)}
                        className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-left transition-all group bg-white dark:bg-slate-900/60"
                      >
                        <div className="mt-0.5 p-1 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors">
                          {getQuickActionIcon(qa.icon)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {qa.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            &quot;{qa.prompt}&quot;
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const isDraft = msg.content.includes("### Generated Draft");

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                        isUser
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 dark:bg-slate-800 text-indigo-400 border border-slate-700 dark:border-slate-700"
                      }`}
                    >
                      {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div className={`max-w-2xl space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-none shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700/60 shadow-xs"
                        }`}
                      >
                        {/* Message Content */}
                        <div className="whitespace-pre-wrap font-sans text-xs">
                          {msg.content}
                        </div>

                        {/* Copy draft action if present */}
                        {isDraft && (
                          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button
                              onClick={() => handleCopyDraft(msg.content, msg.id)}
                              className="flex items-center space-x-1 px-2 py-1 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-300" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Draft</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Citations / Source Links */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium self-center mr-1">
                            Sources:
                          </span>
                          {msg.citations.map((c: AICitation, i: number) => (
                            <Link
                              key={i}
                              href={c.url}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 hover:underline"
                            >
                              <span>{c.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </Link>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 text-xs py-2">
                <Bot className="w-4 h-4 animate-bounce text-indigo-500" />
                <span>Thinking and searching CRM records...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative flex items-center">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a customer, project status, overdue invoices, SLA breach, or draft an email..."
                rows={1}
                maxLength={2000}
                className="w-full resize-none pl-3 pr-24 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
              <div className="absolute right-2 flex items-center space-x-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {inputMessage.length}/2000
                </span>
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || loading}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
              <span>Press <kbd className="font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 rounded">Enter</kbd> to send, <kbd className="font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 rounded">Shift + Enter</kbd> for newline</span>
              <span>All queries logged in audit trail</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
