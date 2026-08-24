import { Capacitor } from '@capacitor/core';

/**
 * Authoritative Backend Production Base URL for Native Android APKs & Cloud Sync
 */
export const DEFAULT_PRODUCTION_BACKEND_URL =
  'https://ais-pre-nxj4dis7zld3t6vcse6vjb-915023145069.europe-west2.run.app';

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
  if (Capacitor.isNativePlatform()) {
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // 3. If running in a local webview or Capacitor WebView
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
  ) {
    // If running in development with standard port 3000
    if (window.location.port === '3000') {
      return '';
    }
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  // 4. Standard Web Browser Environment - Relative URLs work directly
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
