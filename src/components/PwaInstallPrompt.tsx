import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, CheckCircle2, Share, PlusSquare, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallPromptProps {
  isOpenForce?: boolean;
  onCloseForce?: () => void;
  theme?: string;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  isOpenForce = false,
  onCloseForce,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return localStorage.getItem('pwa_prompt_dismissed') === 'true';
  });

  useEffect(() => {
    // Detect if app is already running in standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for beforeinstallprompt event on Android / Chrome / Edge / Windows
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Błąd instalacji PWA:', err);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    if (onCloseForce) onCloseForce();
  };

  // If already installed or dismissed (unless forced open via header button), do not render
  if (isStandalone && !isOpenForce) return null;
  if (dismissed && !isOpenForce) return null;
  if (!deferredPrompt && !isIos && !isOpenForce) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-2xl relative overflow-hidden text-left transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50' : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
      }`}>
        {/* Top gradient accent */}
        <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-sky-400 via-indigo-500 to-amber-400" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          aria-label="Zamknij"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pt-1">
          {/* App Icon */}
          <img
            src="/icon-192.png"
            alt="eMBiK365 Logo"
            className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-lg border border-amber-400/40"
          />

          <div className="flex-1 pr-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                PWA App
              </span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h4 className="text-sm sm:text-base font-bold mt-1 leading-tight">
              Zainstaluj Aplikację eMBiK365
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Zainstaluj aplikację na telefonie lub komputerze, aby korzystać z niej bez paska przeglądarki i w trybie offline!
            </p>
          </div>
        </div>

        {/* Feature bullets */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/60 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Pełny dostęp offline do modlitw i rozważań</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Szybki start prosto z ikony na ekranie głównym</span>
          </div>
        </div>

        {/* iOS Instruction vs Native Install Button vs Desktop/General Instruction */}
        <div className="mt-4">
          {isIos ? (
            <div className="p-3 bg-indigo-950/50 border border-indigo-800/60 rounded-xl text-xs text-indigo-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 text-sky-400" /> Instrukcja instalacji dla iPhone / iPad:
              </p>
              <p className="opacity-90">
                1. Stuknij ikonę <strong className="text-white font-mono">Udostępnij <Share className="inline w-3 h-3" /></strong> w dolnym pasku Safari.
              </p>
              <p className="opacity-90">
                2. Wybierz opcję <strong className="text-white font-mono">Do ekranu początkowego <PlusSquare className="inline w-3 h-3" /></strong>.
              </p>
            </div>
          ) : deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Zainstaluj Aplikację PWA</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-slate-950/70 border border-indigo-800/60 rounded-xl text-xs text-indigo-200 space-y-1 text-left">
                <p className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Jak zainstalować PWA na tym urządzeniu:
                </p>
                <p className="opacity-90">
                  • <strong>Chrome / Edge / Brave:</strong> Kliknij ikonę instalacji <strong className="text-sky-300 font-mono">[⊕]</strong> po prawej stronie paska adresu przeglądarki lub otwórz <strong className="text-sky-300 font-mono">Menu (⋮) ➔ Zainstaluj eMBiK365</strong>.
                </p>
                <p className="opacity-90">
                  • <strong>Android / Mobile:</strong> Wybierz <strong className="text-sky-300 font-mono">Menu (⋮) ➔ Dodaj do ekranu głównego / Zainstaluj aplikację</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
