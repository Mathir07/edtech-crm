"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";
import { useRouter } from "next/navigation";

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_superuser: boolean;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchCurrentUser = async () => {
    try {
      const token = sessionStorage.getItem("crm_access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      const userData = await api.get<UserProfile>("/auth/me");
      setUser(userData);
      sessionStorage.setItem("crm_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Failed to load user session", error);
      setUser(null);
      sessionStorage.removeItem("crm_access_token");
      sessionStorage.removeItem("crm_refresh_token");
      sessionStorage.removeItem("crm_user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Purge any legacy persistent localStorage auth tokens
    try {
      localStorage.removeItem("crm_access_token");
      localStorage.removeItem("crm_refresh_token");
      localStorage.removeItem("crm_user");
    } catch {
      // ignore
    }
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<any>("/auth/login", { email, password });
    sessionStorage.setItem("crm_access_token", data.access_token);
    sessionStorage.setItem("crm_refresh_token", data.refresh_token);
    
    // Clear legacy localStorage if present
    localStorage.removeItem("crm_access_token");
    localStorage.removeItem("crm_refresh_token");
    localStorage.removeItem("crm_user");

    // Fetch full profile
    const profile = await api.get<UserProfile>("/auth/me");
    setUser(profile);
    sessionStorage.setItem("crm_user", JSON.stringify(profile));
    router.push("/");
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem("crm_access_token");
      sessionStorage.removeItem("crm_refresh_token");
      sessionStorage.removeItem("crm_user");
      localStorage.removeItem("crm_access_token");
      localStorage.removeItem("crm_refresh_token");
      localStorage.removeItem("crm_user");
      setUser(null);
      router.push("/login");
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    if (user.is_superuser || user.permissions.includes("*")) return true;
    return user.permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
