"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Building2, User, Target, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SearchResult {
  id: string;
  type: "company" | "contact" | "lead" | "opportunity";
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<SearchResponse>(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.results || []);
      } catch (err) {
        console.error("Global search failed", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "company":
        return <Building2 className="w-4 h-4 text-indigo-600" />;
      case "contact":
        return <User className="w-4 h-4 text-emerald-600" />;
      case "lead":
        return <Target className="w-4 h-4 text-blue-600" />;
      case "opportunity":
        return <TrendingUp className="w-4 h-4 text-amber-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10">
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search companies, contacts, leads, or opportunities... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-base outline-hidden text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent"
          />
          {loading && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() && !loading && results.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching records found for "{query}".
            </div>
          )}

          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item.url)}
              className="w-full text-left p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                  {getIcon(item.type)}
                </div>
                <div className="truncate">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 ml-4">
                <span className="capitalize">{item.type}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}

          {!query.trim() && (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Type at least 1 character to search across companies, contacts, leads, and active deals.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
