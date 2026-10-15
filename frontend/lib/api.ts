export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface DatabaseHealth {
  status: string;
  latency_ms: number;
  database_type?: string;
  error?: string | null;
}

export interface SystemInfo {
  os?: string;
  python_version?: string;
  cpu_architecture?: string;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptime_seconds: number;
  database: DatabaseHealth;
  system?: SystemInfo;
  modules?: Record<string, string>;
}

export function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealth(): Promise<SystemHealth> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch health check: ${response.statusText}`);
  }
  return response.json();
}
