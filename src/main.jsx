import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global handler for Vite dynamic import & CSS preload errors after new deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error intercepted (new deployment detected). Auto-refreshing...', event);
  // Prevent unhandled rejection / error bubbling to ErrorBoundary
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

// Resilient handler for non-fatal background promise rejections (e.g. cancelled analytics, network drop)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || (typeof event.reason === 'string' ? event.reason : '');
  if (
    reason.includes('network') || 
    reason.includes('Failed to fetch') || 
    reason.includes('aborted') || 
    reason.includes('cancelled')
  ) {
    // Gracefully handle expected network hiccups without crashing
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
