export interface ApiError {
  detail: string;
  status: number;
  message: string;
}

class ApiClient {
  public getApiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host !== "localhost" && host !== "127.0.0.1") {
        return "/api/v1";
      }
    }
    if (process.env.NODE_ENV === "production") {
      return "/api/v1";
    }
    return "http://localhost:8000/api/v1";
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("crm_access_token") || localStorage.getItem("crm_access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const apiBase = this.getApiBase();
    const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;
    const headers = { ...this.getHeaders(), ...options.headers };

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          sessionStorage.removeItem("crm_access_token");
          sessionStorage.removeItem("crm_refresh_token");
          sessionStorage.removeItem("crm_user");
          localStorage.removeItem("crm_access_token");
          localStorage.removeItem("crm_refresh_token");
          localStorage.removeItem("crm_user");
          window.location.href = "/login";
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: "An unexpected error occurred." }));
        const detailMsg = typeof errorBody.detail === "string"
          ? errorBody.detail
          : (Array.isArray(errorBody.detail) ? errorBody.detail.map((e: any) => e.msg || e).join(", ") : response.statusText);
        const error: ApiError = {
          detail: detailMsg,
          message: detailMsg,
          status: response.status,
        };
        throw error;
      }

      // If no content returned (e.g. 204)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      if (err.status !== undefined) throw err;
      const netMsg = err.message || "Network error. Is the backend server running?";
      const error: ApiError = {
        detail: netMsg,
        message: netMsg,
        status: 0,
      };
      throw error;
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const apiBase = this.getApiBase();
    const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("crm_access_token") || localStorage.getItem("crm_access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (response.status === 401) {
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          sessionStorage.removeItem("crm_access_token");
          sessionStorage.removeItem("crm_refresh_token");
          sessionStorage.removeItem("crm_user");
          localStorage.removeItem("crm_access_token");
          localStorage.removeItem("crm_refresh_token");
          localStorage.removeItem("crm_user");
          window.location.href = "/login";
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: "An unexpected error occurred." }));
        const detailMsg = typeof errorBody.detail === "string"
          ? errorBody.detail
          : (Array.isArray(errorBody.detail) ? errorBody.detail.map((e: any) => e.msg || e).join(", ") : response.statusText);
        throw { detail: detailMsg, message: detailMsg, status: response.status };
      }

      return await response.json();
    } catch (err: any) {
      if (err.status !== undefined) throw err;
      const netMsg = err.message || "Network error.";
      throw { detail: netMsg, message: netMsg, status: 0 };
    }
  }

  async download(endpoint: string): Promise<Blob> {
    const apiBase = this.getApiBase();
    const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;
    const headers = { ...this.getHeaders() };
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: "Export failed." }));
      throw new Error(errorBody.detail || `Export failed with status ${response.status}`);
    }
    return await response.blob();
  }

  async downloadAndSave(endpoint: string, defaultFilename: string = "export.csv"): Promise<void> {
    const blob = await this.download(endpoint);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const api = new ApiClient();
