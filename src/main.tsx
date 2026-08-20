import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ─── Global async error guard (BEFORE React even mounts) ──────────────────────
// Catches "Failed to fetch dynamically imported module" and similar chunk-load
// errors that happen outside React's render cycle.
// On detection we clear ALL caches and reload once (guarded against infinite loops).
function installGlobalChunkErrorGuard() {
  const RELOAD_FLAG = '__eMBiK_reload_once__';

  const isChunkError = (msg: string): boolean => {
    const m = (msg || '').toLowerCase();
    return (
      m.includes('failed to fetch') ||
      m.includes('dynamically imported') ||
      m.includes('importing a module') ||
      m.includes('load failed') ||
      m.includes('loading chunk') ||
      m.includes('loading css chunk')
    );
  };

  const autoRecover = async () => {
    if (sessionStorage.getItem(RELOAD_FLAG)) return; // guard against infinite loop
    sessionStorage.setItem(RELOAD_FLAG, '1');
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}
    window.location.reload();
  };

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isChunkError(msg)) {
      event.preventDefault();
      console.warn('[eMBiK365] Chunk load error caught globally — auto-recovering:', msg);
      autoRecover();
    }
  });

  window.addEventListener('error', (event) => {
    if (event.filename?.includes('/assets/') || isChunkError(event.message)) {
      console.warn('[eMBiK365] Script load error caught globally — auto-recovering:', event.message);
      autoRecover();
    }
  });
}

installGlobalChunkErrorGuard();
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
