import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

const BOUNDARY_RELOAD_FLAG = '__eMBiK_boundary_reload__';

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, errorMessage: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      errorMessage: error?.message || String(error) || 'Wystąpił błąd inicjalizacji' 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[eMBiK365] React render error caught:', error, errorInfo);
    try {
      if ('caches' in window) {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())));
      }
    } catch {}
  }

  private handleHardReset = () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister())));
      }
    } catch {}
    window.location.href = window.location.origin + window.location.pathname + '?cb=' + Date.now();
  };

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
            width: 54,
            height: 54,
            borderRadius: '20px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '16px'
          }}>
            ✨
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>Widoki na Raj (eMBiK365)</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '420px', marginBottom: '16px', lineHeight: 1.5 }}>
            Wycyszczono i zaktualizowano dane aplikacji. Kliknij poniżej, aby zrestartować rozważania.
          </p>
          {this.state.errorMessage && (
            <div style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#f43f5e',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '20px',
              maxWidth: '480px',
              wordBreak: 'break-word'
            }}>
              {this.state.errorMessage}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleHardReset}
              style={{
                padding: '12px 24px',
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
              Odśwież i wyczyść pamięć 🔄
            </button>
          </div>
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
  </StrictMode>
);
