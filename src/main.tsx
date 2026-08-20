import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
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

    // Auto-reload once silently — never show an error screen
    const alreadyReloaded = sessionStorage.getItem(BOUNDARY_RELOAD_FLAG);
    if (!alreadyReloaded) {
      sessionStorage.setItem(BOUNDARY_RELOAD_FLAG, '1');
      setTimeout(() => {
        window.location.reload();
      }, 100);
      this.setState({ reloadAttempted: true });
    } else {
      // Second crash after reload — clear session flag so next visit is clean
      sessionStorage.removeItem(BOUNDARY_RELOAD_FLAG);
    }
  }

  public render() {
    if (this.state.hasError) {
      // Show minimal spinner while reloading, never show error text
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #334155',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
