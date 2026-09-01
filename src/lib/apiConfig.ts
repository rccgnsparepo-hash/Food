import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

/**
 * Authoritative Backend Production Base URL for Native Android APKs, Electron Desktop EXE & External Web Deployments (Vercel, Netlify, etc.)
 */
export const DEFAULT_PRODUCTION_BACKEND_URL =
  'https://ais-pre-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app';

/**
 * Resolve the appropriate API Base URL for Web (Cloud Run vs Vercel / External), Desktop EXE and Native Android APKs
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Explicit environment variable override
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Native Capacitor App (Android / iOS) or Electron Desktop App loaded from file://
  const isElectron =
    typeof navigator !== 'undefined' &&
    (/electron/i.test(navigator.userAgent) || Boolean((window as any).electronAPI));

  if (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.protocol === 'file:' ||
    isElectron
  ) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // 3. Localhost development environment (Vite dev server or local Express on port 3000)
  if (
    typeof window.location !== 'undefined' &&
    window.location.origin &&
    window.location.origin.startsWith('http') &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return window.location.origin;
  }

  // 4. Co-hosted Full-Stack Cloud Run container (Frontend + Node Express Backend served together)
  const hostname = window.location.hostname || '';
  const isCloudRunDirect =
    hostname.endsWith('.run.app') ||
    hostname.includes('googleusercontent.com') ||
    hostname.includes('aistudio.google.com') ||
    hostname.includes('cloudfunctions.net');

  if (isCloudRunDirect) {
    return '';
  }

  // 5. External Web Hosting (e.g. *.vercel.app, *.netlify.app, *.github.io, *.pages.dev, *.web.app, or custom domain)
  // These hosts only serve static frontend assets, so all /api/* requests must target the live Cloud Run backend
  return DEFAULT_PRODUCTION_BACKEND_URL;
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
 * Standardized API fetch wrapper ensuring proper URLs, Bearer Auth headers, and error handling across Web, Desktop EXE and Native APKs
 */
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const fullUrl = apiUrl(endpoint);
  const headers = new Headers(init?.headers || {});
  
  // Ensure JSON acceptance
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  // Attach Firebase Auth Bearer token if user is signed in
  if (!headers.has('Authorization') && auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // Non-blocking token retrieval
    }
  }

  return fetch(fullUrl, {
    ...init,
    headers
  });
}

/**
 * Robust error message extractor that guarantees a clean, human-readable string (never [object Object])
 */
export function formatApiErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim().length > 0) return err.message.trim();
  if (typeof err.error === 'string' && err.error.trim().length > 0) return err.error.trim();
  if (typeof err.error?.message === 'string') return err.error.message.trim();
  if (typeof err.data?.error === 'string') return err.data.error.trim();
  if (typeof err.data?.message === 'string') return err.data.message.trim();
  if (typeof err.data?.error?.message === 'string') return err.data.error.message.trim();
  
  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // Ignore serialization failure
  }
  return String(err || 'Server communication error');
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
        const rawErr = (data as any)?.error || (data as any)?.message || (data as any)?.detail || `Request failed with status ${res.status}`;
        const errMessage = formatApiErrorMessage(rawErr);
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
    return { ok: false, status: 0, error: formatApiErrorMessage(err) || 'Network request failed' };
  }
}
