import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { handleClientDemoRequest } from '../utils/mockData';

function getApiBase(): string {
  // 1. Explicit environment variable override (if set)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Web environment: dynamically match the host being visited
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // If running on Expo dev server (port 8081) or local static preview, point to port 8000 on the same host
    if (port === '8081' || port === '19006') {
      return `${protocol}//${hostname}:8000`;
    }
    // If served directly by FastAPI (port 8000) or via a public tunnel (Cloudflare/ngrok/Codespaces), use same origin
    if (
      port === '8000' ||
      hostname.includes('trycloudflare.com') ||
      hostname.includes('ngrok') ||
      hostname.includes('github.dev') ||
      hostname.includes('app.github.dev') ||
      hostname.includes('github.io') ||
      hostname.includes('vercel.app') ||
      hostname.includes('netlify.app')
    ) {
      return `${protocol}//${window.location.host}`;
    }
    return `${protocol}//${hostname}:8000`;
  }

  // 3. Mobile (Expo Go): extract LAN IP from Expo hostUri
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const lanIp = debuggerHost.split(':')[0];
    return `http://${lanIp}:8000`;
  }

  return 'http://127.0.0.1:8000';
}

export const API_BASE = getApiBase();
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';

// Track whether we are running in standalone client-side demo mode (e.g., GitHub Pages or backend offline)
export let isStandaloneDemo = false;

export async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  // If hosted on static GitHub Pages / Vercel / Netlify without a backend, use client-side mock engine immediately
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.io') ||
      window.location.search.includes('demo=1'))
  ) {
    isStandaloneDemo = true;
    return handleClientDemoRequest(path, options);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    isStandaloneDemo = data?.mode === 'demo';
    return data;
  } catch (err) {
    // Automatic fallback to built-in demo engine if backend server is unreachable
    isStandaloneDemo = true;
    return handleClientDemoRequest(path, options);
  }
}

