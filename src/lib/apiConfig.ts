import { Capacitor } from '@capacitor/core';

/**
 * Authoritative Backend Production Base URL for Native Android APKs & Cloud Sync
 */
export const DEFAULT_PRODUCTION_BACKEND_URL =
  'https://ais-dev-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app';

/**
 * Resolve the appropriate API Base URL for Web and Native Android APKs
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Explicit environment variable override
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Native Capacitor App (Android / iOS)
  if (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.protocol === 'file:'
  ) {
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // 3. Standard Web Browser Environment (all ports & hosts) - Relative URLs talk directly to current server
  return '';
}

/**
 * Build a full API endpoint URL
 */
export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

/**
 * Standardized API fetch wrapper ensuring proper URLs and headers across Web and Native APKs
 */
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const fullUrl = apiUrl(endpoint);
  return fetch(fullUrl, init);
}

/**
 * Safe JSON fetch helper with descriptive error parsing and fallback handling
 */
export async function apiFetchJson<T = any>(
  endpoint: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await apiFetch(endpoint, init);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = (await res.json()) as T;
      if (!res.ok) {
        const errMessage = (data as any)?.error || (data as any)?.message || `Request failed with status ${res.status}`;
        return { ok: false, status: res.status, data, error: errMessage };
      }
      return { ok: true, status: res.status, data };
    }

    // Non-JSON response (e.g. HTML error page or plain text)
    const text = await res.text();
    if (!res.ok) {
      let cleanError = `Server returned ${res.status}`;
      if (text.includes('<title>')) {
        const match = text.match(/<title>(.*?)<\/title>/i);
        if (match && match[1]) cleanError += `: ${match[1]}`;
      } else if (text.length > 0 && text.length < 120) {
        cleanError += `: ${text.trim()}`;
      }
      return { ok: false, status: res.status, error: cleanError };
    }

    return { ok: true, status: res.status, data: text as any };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || 'Network request failed' };
  }
}

