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
  }

  private handleReset = () => {
    // Clear legacy caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    localStorage.clear();
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
