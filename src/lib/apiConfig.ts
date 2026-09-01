import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

/**
 * Authoritative Backend Production Base URL for Native Android APKs, Electron Desktop EXE & External Web Deployments (Vercel, Netlify, etc.)
 */
export const DEFAULT_DEV_BACKEND_URL =
  'https://ais-dev-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app';
export const DEFAULT_PREVIEW_BACKEND_URL =
  'https://ais-pre-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app';

export const DEFAULT_PRODUCTION_BACKEND_URL = DEFAULT_DEV_BACKEND_URL;

/**
 * Get candidate backend URLs in priority order
 */
export function getCandidateBackendUrls(): string[] {
  const candidates: string[] = [];

  // 1. Explicit environment variable override
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    candidates.push(envUrl.replace(/\/+$/, ''));
  }

  // 2. Local storage override (for testing or custom backend connections)
  if (typeof window !== 'undefined') {
    try {
      const customUrl = localStorage.getItem('BUKKIT_API_URL');
      if (customUrl && customUrl.trim().startsWith('http')) {
        candidates.push(customUrl.trim().replace(/\/+$/, ''));
      }
    } catch {}
  }

  // 3. Localhost or same-origin Cloud Run
  if (typeof window !== 'undefined' && window.location?.origin) {
    const hostname = window.location.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isCloudRun =
      hostname.endsWith('.run.app') ||
      hostname.includes('googleusercontent.com') ||
      hostname.includes('aistudio.google.com') ||
      hostname.includes('cloudfunctions.net');

    if (isLocalhost) {
      candidates.push(window.location.origin);
    } else if (isCloudRun) {
      candidates.push(''); // Relative paths for same-container fullstack
    }
  }

  // 4. Primary Live Dev Cloud Run container
  candidates.push(DEFAULT_DEV_BACKEND_URL);

  // 5. Shared Preview container
  candidates.push(DEFAULT_PREVIEW_BACKEND_URL);

  // 6. Relative path (for Vercel rewrites or proxies)
  candidates.push('');

  // Remove duplicates
  return Array.from(new Set(candidates));
}

/**
 * Resolve the primary API Base URL for Web, Desktop EXE and Native Android APKs
 */
export function getApiBaseUrl(): string {
  const candidates = getCandidateBackendUrls();
  return candidates[0] || '';
}

/**
 * Build a full API endpoint URL
 */
export function apiUrl(endpoint: string, baseUrl?: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = baseUrl !== undefined ? baseUrl : getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

/**
 * Standardized API fetch wrapper ensuring proper URLs, Bearer Auth headers, and automatic multi-candidate fallback
 */
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
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

  const candidates = getCandidateBackendUrls();
  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidateBase = candidates[i];
    const candidateUrl = apiUrl(endpoint, candidateBase);

    try {
      const res = await fetch(candidateUrl, {
        ...init,
        headers
      });

      // If server responded (even 4xx/5xx), return the response (not a network connectivity error)
      return res;
    } catch (err: any) {
      lastError = err;
      // Network failure (e.g. Failed to fetch / CORS / container sleeping), continue to next candidate
      console.warn(`[apiFetch] Network attempt failed for ${candidateUrl}, trying next fallback...`, err);
    }
  }

  throw lastError || new Error('Network error: Unable to reach backend server');
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
