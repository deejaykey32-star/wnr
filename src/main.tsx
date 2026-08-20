import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Global async error guard (BEFORE React even mounts) ──────────────────────
// Catches "Failed to fetch dynamically imported module" and similar chunk-load
// errors that happen outside React's render cycle and therefore bypass
// ErrorBoundary. On detection we clear ALL caches and reload once.
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

class ErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;

  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error in eMBiK365:", error, errorInfo);

    // Secondary guard: if the error still slipped through to React rendering,
    // try silent auto-recovery for chunk/import errors
    const errorStr = (error.message || error.toString() || '').toLowerCase();
    const isChunk =
      errorStr.includes('chunk') ||
      errorStr.includes('dynamically imported') ||
      errorStr.includes('failed to fetch') ||
      errorStr.includes('load failed') ||
      errorStr.includes('import');

    if (isChunk) {
      console.warn('[eMBiK365] Chunk error in React render — triggering silent recovery...');
      this.handleResetSilent();
    }
  }

  private handleResetSilent = async () => {
    if (typeof window === 'undefined') return;
    const RELOAD_FLAG = '__eMBiK_reload_once__';
    if (sessionStorage.getItem(RELOAD_FLAG)) return; // already attempted
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

  private handleReset = async () => {
    if (typeof window === 'undefined') return;

    // Clear Service Worker caches and unregister SW
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

    // Preserve user progress, settings and auth
    const preservedKeys = [
      'completed_rhz365_days',
      'completed_wnr365_days',
      'theme',
      'prayer-editor-theme',
      'local_editor_auth',
      'rhz_shortened_mode'
    ];

    try {
      const saved: Record<string, string> = {};
      preservedKeys.forEach(k => {
        const val = localStorage.getItem(k);
        if (val !== null) saved[k] = val;
      });
      localStorage.clear();
      Object.entries(saved).forEach(([k, val]) => {
        localStorage.setItem(k, val);
      });
    } catch (e) {
      console.warn("Failed to clear localStorage selectively:", e);
    }

    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold mb-4">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">eMBiK365 — Widoki na Raj</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Wystąpił problem podczas wczytywania pamięci podręcznej. Kliknij przycisk poniżej, aby zresetować pamięć i uruchomić czystą aplikację.
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
          >
            🔄 Odśwież i zresetuj pamięć podręczną
          </button>
          {this.state.error && (
            <pre className="mt-6 text-[10px] font-mono text-slate-500 max-w-lg overflow-x-auto p-3 bg-slate-900 rounded-lg text-left">
              {this.state.error.toString()}
            </pre>
          )}
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

