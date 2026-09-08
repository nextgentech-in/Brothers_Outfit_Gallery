/**
 * Helper to dynamically resolve the backend URL:
 * - Uses VITE_BACKEND_URL if provided
 * - Defaults to http://localhost:3001 for local dev
 * - Returns relative path (empty string) in production on Vercel so requests hit the same origin /api/*
 */
export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3001';
  }
  return '';
};
