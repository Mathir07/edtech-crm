"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ShellContextType {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleCollapsed: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeMobileDrawer: () => void;
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  createType: string | null;
  openCreateModal: (type?: string) => void;
  closeCreateModal: () => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("crm_sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("crm_sidebar_collapsed", String(next));
        return next;
      });
    }
  };

  const closeMobileDrawer = () => {
    setIsMobileOpen(false);
  };

  const openCreateModal = (type?: string) => {
    setCreateType(type || null);
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setCreateType(null);
  };

  return (
    <ShellContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        toggleCollapsed,
        isMobileOpen,
        setIsMobileOpen,
        closeMobileDrawer,
        isCreateOpen,
        setIsCreateOpen,
        createType,
        openCreateModal,
        closeCreateModal,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
};

export const useShell = () => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return context;
};
