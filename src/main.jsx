import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global handler for Vite dynamic import & CSS preload errors after new deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error intercepted (new deployment detected). Auto-refreshing...', event);
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const lastReload = sessionStorage.getItem('vite_preload_reload');
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 8000) {
    sessionStorage.setItem('vite_preload_reload', String(now));
    window.location.reload();
  }
});

// Resilient handler for non-fatal background promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || (typeof reason === 'string' ? reason : '');

  // Gracefully suppress expected non-fatal errors
  const suppressPatterns = [
    'network', 'Failed to fetch', 'aborted', 'cancelled',
    'ResizeObserver', 'Loading chunk', 'Unable to preload CSS',
    'Failed to fetch dynamically imported module',
    'PERMISSION_DENIED', 'quota-exceeded', 'auth/',
    'firestore/', 'deadline-exceeded', 'unavailable',
    'Load failed', 'NetworkError', 'TypeError: Load failed',
    'The play() request was interrupted'
  ];

  if (suppressPatterns.some(p => msg.includes(p))) {
    event.preventDefault();
    return;
  }

  // Log non-suppressed rejections for debugging
  console.warn('[Unhandled Rejection]', msg || reason);
});

// Catch uncaught runtime errors globally
window.addEventListener('error', (event) => {
  const msg = event.message || '';

  // Suppress known benign browser errors
  const benignPatterns = [
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    'Script error.',
    'Loading chunk',
    'Unable to preload CSS',
    'Non-Error promise rejection'
  ];

  if (benignPatterns.some(p => msg.includes(p))) {
    event.preventDefault();
    return true;
  }
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

