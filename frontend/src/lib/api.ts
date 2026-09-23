export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/+$/, "");

export function getFullApiUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

export interface ApiError {
  detail: string;
  status: number;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("crm_access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = getFullApiUrl(endpoint);
    const headers = { ...this.getHeaders(), ...options.headers };

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          localStorage.removeItem("crm_access_token");
          localStorage.removeItem("crm_refresh_token");
          localStorage.removeItem("crm_user");
          window.location.href = "/login";
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: "An unexpected error occurred." }));
        const error: ApiError = {
          detail: errorBody.detail || response.statusText,
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
      if (err.status) throw err;
      throw { detail: err.message || "Network error. Is the backend server running?", status: 0 };
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
    const url = getFullApiUrl(endpoint);
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("crm_access_token");
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
          localStorage.removeItem("crm_access_token");
          localStorage.removeItem("crm_refresh_token");
          localStorage.removeItem("crm_user");
          window.location.href = "/login";
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: "An unexpected error occurred." }));
        throw { detail: errorBody.detail || response.statusText, status: response.status };
      }

      return await response.json();
    } catch (err: any) {
      if (err.status) throw err;
      throw { detail: err.message || "Network error.", status: 0 };
    }
  }

  async download(endpoint: string): Promise<Blob> {
    const url = getFullApiUrl(endpoint);
    const headers = { ...this.getHeaders() };
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: "Export failed." }));
      throw new Error(errorBody.detail || `Export failed with status ${response.status}`);
    }
    return await response.blob();
  }

  async downloadFile(endpoint: string, fallbackFilename?: string): Promise<void> {
    const url = getFullApiUrl(endpoint);
    const headers = { ...this.getHeaders() };
    const response = await fetch(url, { method: "GET", headers });

    if (response.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        localStorage.removeItem("crm_access_token");
        localStorage.removeItem("crm_refresh_token");
        localStorage.removeItem("crm_user");
        window.location.href = "/login";
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: "Download failed." }));
      throw new Error(errorBody.detail || `Download failed with status ${response.status}`);
    }

    let filename = fallbackFilename || "download";
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "").trim();
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
}

export const api = new ApiClient();
