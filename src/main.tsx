import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  reloadAttempted: boolean;
}

// ─── Global async error guard (BEFORE React even mounts) ──────────────────────
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
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
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
      console.warn('[eMBiK365] Chunk load error — auto-recovering:', msg);
      autoRecover();
    }
  });

  window.addEventListener('error', (event) => {
    if (event.filename?.includes('/assets/') || isChunkError(event.message)) {
      console.warn('[eMBiK365] Script load error — auto-recovering:', event.message);
      autoRecover();
    }
  });
}

installGlobalChunkErrorGuard();
// ─────────────────────────────────────────────────────────────────────────────

const BOUNDARY_RELOAD_FLAG = '__eMBiK_boundary_reload__';

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, reloadAttempted: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true, reloadAttempted: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[eMBiK365] React render error caught:', error, errorInfo);
    if (!sessionStorage.getItem(BOUNDARY_RELOAD_FLAG)) {
      sessionStorage.setItem(BOUNDARY_RELOAD_FLAG, '1');
      try {
        if ('caches' in window) {
          caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())));
        }
      } catch {}
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '16px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginBottom: '16px'
          }}>
            ✨
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Widoki na Raj (eMBiK365)</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '360px', marginBottom: '20px', lineHeight: 1.5 }}>
            Zaktualizowano wersję aplikacji. Kliknij poniżej, aby załadować najnowsze rozważania.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(BOUNDARY_RELOAD_FLAG);
              try {
                if ('caches' in window) {
                  caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
                }
              } catch {}
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
            }}
          >
            Odśwież aplikację 🔄
          </button>
        </div>
      );
    }
    return (this.props as Props).children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
