import React, { useState, useEffect } from 'react';
import {
  QrCode, Link as LinkIcon, Download, Copy, Check, Plus, Trash2,
  Edit, RefreshCw, X, Sparkles, CloudCheck, Github, Search, ExternalLink,
  Save, FileCode, CheckCircle2
} from 'lucide-react';
import { UrlLinkItem } from '../types';
import {
  getUrlLinks, saveUrlLink, deleteUrlLink,
  shortenUrlWithApi, resetUrlLinksToDefaults,
  downloadQrCodeImage, exportUrlLinksJson, normalizeUrl,
  generateDynamicShortUrl
} from '../utils/urlLinkStore';
import { generateQrCodeDataUri } from '../utils/qrCodeGenerator';

interface UrlQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToWysiwyg?: (snippet: string) => void;
  theme?: 'dark' | 'light';
}

export const UrlQrModal: React.FC<UrlQrModalProps> = ({
  isOpen,
  onClose,
  onInsertToWysiwyg,
  theme = 'dark'
}) => {
  const [links, setLinks] = useState<UrlLinkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'sync'>('list');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formShortUrl, setFormShortUrl] = useState<string>('');
  const [formQrCaption, setFormQrCaption] = useState<string>('');
  const [liveQrUri, setLiveQrUri] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isShortening, setIsShortening] = useState<boolean>(false);

  // Status feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('');

  const isDark = theme === 'dark';

  // Load links on open
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getUrlLinks();
      setLinks(data);
    } catch (e) {
      console.error('Błąd ładowania bazy URL/QR:', e);
    } finally {
      setLoading(false);
    }
  };

  // Live update QR preview as user types URL or shortUrl
  useEffect(() => {
    let isCancelled = false;
    const target = formShortUrl.trim() || formUrl.trim();
    if (target) {
      generateQrCodeDataUri(normalizeUrl(target)).then((uri) => {
        if (!isCancelled) setLiveQrUri(uri);
      });
    } else {
      setLiveQrUri('');
    }
    return () => {
      isCancelled = true;
    };
  }, [formUrl, formShortUrl]);

  if (!isOpen) return null;

  const handleGenerateInternalShort = () => {
    const slug = (formTitle || 'link')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .substring(0, 20);
    const dyn = generateDynamicShortUrl(slug || 'wnr');
    setFormShortUrl(dyn);
  };

  const handleAutoShorten = async () => {
    if (!formUrl.trim()) return;
    setIsShortening(true);
    try {
      const generated = await shortenUrlWithApi(formUrl);
      setFormShortUrl(generated);
    } catch (e) {
      console.warn('Błąd skracania przez API:', e);
    } finally {
      setIsShortening(false);
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Czy na pewno chcesz przywrócić domyślne wpisy z repozytorium (odblokowuje usunięte domyślne kody QR)?')) {
      resetUrlLinksToDefaults();
      await loadData();
      setSyncStatusMessage('Przywrócono domyślne kody QR z repozytorium!');
      setTimeout(() => setSyncStatusMessage(''), 4000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim() || !formTitle.trim()) return;

    setIsSaving(true);
    try {
      await saveUrlLink({
        id: editingId || undefined,
        title: formTitle,
        url: formUrl,
        shortUrl: formShortUrl,
        qrCaption: formQrCaption || formTitle
      });
      await loadData();
      resetForm();
      setActiveTab('list');
      setSyncStatusMessage('Zapisano pomyślnie w lokalnej bazie danych repozytorium!');
      setTimeout(() => setSyncStatusMessage(''), 4000);
    } catch (err) {
      console.error('Błąd zapisu linku:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: UrlLinkItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormShortUrl(item.shortUrl);
    setFormQrCaption(item.qrCaption || item.title);
    setActiveTab('add');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten link z bazy?')) {
      await deleteUrlLink(id);
      await loadData();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormUrl('');
    setFormShortUrl('');
    setFormQrCaption('');
    setLiveQrUri('');
  };

  const handleCopyShortUrl = (shortUrl: string, id: string) => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleInsertQrCode = (item: UrlLinkItem) => {
    if (!onInsertToWysiwyg) return;
    const targetUrl = item.shortUrl || item.url;
    const captionText = item.qrCaption || item.title;
    const snippet = `\n[qr:${targetUrl}]${captionText ? `[caption:${captionText}]` : ''}\n`;
    onInsertToWysiwyg(snippet);
    setInsertedId(`qr-${item.id}`);
    setTimeout(() => setInsertedId(null), 2500);
  };

  const handleInsertShortUrlLink = (item: UrlLinkItem) => {
    if (!onInsertToWysiwyg) return;
    const targetUrl = item.shortUrl || item.url;
    const snippet = `[${item.title}](${targetUrl})`;
    onInsertToWysiwyg(snippet);
    setInsertedId(`link-${item.id}`);
    setTimeout(() => setInsertedId(null), 2500);
  };

  const handleDownloadQr = (item: UrlLinkItem) => {
    const dataUri = item.qrCodeDataUrl || liveQrUri;
    if (dataUri) {
      downloadQrCodeImage(dataUri, item.title);
    }
  };

  const handleExportJson = () => {
    const jsonStr = exportUrlLinksJson(links);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'url_links.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLinks = links.filter(
    (l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.shortUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 sm:p-5 border-b select-none ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Moduł Linków, Skróconych URL & Grafik QR
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Github className="w-3.5 h-3.5 inline text-emerald-400" />
                Synchronizacja: Repozytorium GitHub & Cloudflare Pages
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex items-center justify-between px-4 pt-2 border-b select-none ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                activeTab === 'list'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Baza Linków ({links.length})
            </button>
            <button
              onClick={() => {
                resetForm();
                setActiveTab('add');
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                activeTab === 'add'
                  ? 'border-amber-500 text-amber-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              {editingId ? 'Edytuj Link' : 'Dodaj Nowy Link / QR'}
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                activeTab === 'sync'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudCheck className="w-4 h-4 text-emerald-400" />
              Status & Sync Cloudflare
            </button>
          </div>

          {syncStatusMessage && (
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/50 animate-pulse hidden sm:inline-block">
              {syncStatusMessage}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: BAZA LINKÓW LISTA */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Search & Action bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj po tytule, URL lub skrócie..."
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleResetDefaults}
                    className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition flex items-center gap-1.5"
                    title="Przywróć domyślne kody QR i linki z repozytorium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Przywróć domyślne
                  </button>
                  <button
                    onClick={loadData}
                    className="p-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
                    title="Odśwież dane"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Odśwież
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setActiveTab('add');
                    }}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    Nowy Link
                  </button>
                </div>
              </div>

              {/* Loading Indicator */}
              {loading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                  <p className="text-xs font-mono">Ładowanie parametrów z bazy danych...</p>
                </div>
              ) : filteredLinks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/50 p-6">
                  <QrCode className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold">Brak wpisów w bazie danych linków i QR kodów.</p>
                  <p className="text-xs text-slate-500">
                    Kliknij button poniżej, aby dodać swój pierwszy zsynchronizowany adres URL.
                  </p>
                  <button
                    onClick={() => {
                      resetForm();
                      setActiveTab('add');
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj Pierwszy Link
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLinks.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition duration-200 flex flex-col justify-between space-y-3 ${
                        isDark
                          ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top part: QR code preview + Title & Links */}
                      <div className="flex items-start gap-3">
                        {/* QR Code graphic preview + Title under QR */}
                        <div className="flex flex-col items-center shrink-0 max-w-[110px]">
                          {item.qrCodeDataUrl ? (
                            <a
                              href={item.shortUrl || item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Kliknij, aby otworzyć stronę: ${item.shortUrl || item.url}`}
                              className="group block cursor-pointer"
                            >
                              <img
                                src={item.qrCodeDataUrl}
                                alt={`Kod QR dla ${item.title}`}
                                className="w-24 h-24 bg-white p-1.5 rounded-xl border border-slate-300 shadow-md group-hover:scale-105 transition duration-200"
                              />
                            </a>
                          ) : (
                            <div className="w-24 h-24 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                              <QrCode className="w-8 h-8" />
                            </div>
                          )}
                          <p className="text-[10px] font-bold text-amber-300 text-center mt-1.5 leading-tight break-words max-w-[105px]">
                            {item.qrCaption || item.title}
                          </p>
                        </div>

                        {/* Title & Url info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm text-amber-400 truncate">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1 text-slate-400 hover:text-indigo-400 transition"
                                title="Edytuj"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition"
                                title="Usuń"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Full URL */}
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              Pełny URL:
                            </span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-300 hover:underline truncate flex items-center gap-1"
                            >
                              <span className="truncate">{item.url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>

                          {/* Shortened URL */}
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                              Skrócony URL:
                            </span>
                            <div className="flex items-center gap-1">
                              <code className="text-xs text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60 truncate">
                                {item.shortUrl}
                              </code>
                              <button
                                onClick={() => handleCopyShortUrl(item.shortUrl, item.id)}
                                className="p-1 text-slate-400 hover:text-emerald-400 transition shrink-0"
                                title="Kopiuj skrót"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 select-none">
                        {/* Download QR Button */}
                        <button
                          onClick={() => handleDownloadQr(item)}
                          className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
                          title="Pobierz grafikę QR Kod jako PNG"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                          Pobierz QR
                        </button>

                        {/* Insert options if WYSIWYG integration enabled */}
                        {onInsertToWysiwyg && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleInsertQrCode(item)}
                              className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition flex items-center gap-1"
                              title="Wstaw tag QR Kod do edytora WYSIWYG"
                            >
                              <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                              {insertedId === `qr-${item.id}` ? 'Wstawiono!' : '+ WYSIWYG (QR)'}
                            </button>

                            <button
                              onClick={() => handleInsertShortUrlLink(item)}
                              className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition flex items-center gap-1"
                              title="Wstaw skrócony URL do edytora WYSIWYG"
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                              {insertedId === `link-${item.id}` ? 'Wstawiono!' : '+ URL'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DODAJ / EDYTUJ LINK */}
          {activeTab === 'add' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {editingId ? 'Edycja Parametrów Linku & QR' : 'Nowy Wpis Linku, Skrótu i QR'}
                </h3>

                {editingId && (
                  <div className="p-3 bg-indigo-950/60 border border-indigo-800/80 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-300">Tryb Dynamicznego Kodu QR:</strong> Zmiana pełnego adresu URL zaktualizuje cel przekierowania, ale <strong>zachowa w 100% ten sam skrócony adres i wygenerowany Kod QR</strong> (nie trzeba go ponownie drukować!).
                    </div>
                  </div>
                )}

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Tytuł / Opis Linku *
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="np. Strona Główna Widoki Na Raj"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Pełny adres URL (Docelowy) *
                      </label>
                      <input
                        type="url"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://widokinaraj.pl/#/wnr365-day-1"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <label className="block text-xs font-bold text-emerald-400 uppercase">
                          Skrócony adres URL (Kodowany w QR)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleGenerateInternalShort}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold uppercase flex items-center gap-1"
                            title="Wygeneruj dynamiczny link wewnętrzny (rekomendowane - pozwala zmieniać cel bez zmiany QR)"
                          >
                            ⚡ Dynamiczny QR (/#/r/...)
                          </button>
                          <button
                            type="button"
                            onClick={handleAutoShorten}
                            disabled={!formUrl.trim() || isShortening}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase disabled:opacity-40 flex items-center gap-1"
                            title="Wygeneruj skrót zewnętrzny z API"
                          >
                            {isShortening ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                                API...
                              </>
                            ) : (
                              <>API (TinyURL)</>
                            )}
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={formShortUrl}
                        onChange={(e) => setFormShortUrl(e.target.value)}
                        placeholder="https://widokinaraj.pl/#/r/moj-link"
                        className="w-full bg-slate-900 border border-emerald-800/80 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        * Jeśli użyjesz formatu domeny z <code className="text-amber-300">/#/r/...</code>, zmiana adresu docelowego wyżej natychmiast przekieruje użytkowników bez zmiany drukowanego Kodu QR.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-400 uppercase mb-1">
                        Tytuł wyświetlany pod kodem QR (podpis)
                      </label>
                      <input
                        type="text"
                        value={formQrCaption}
                        onChange={(e) => setFormQrCaption(e.target.value)}
                        placeholder="np. Zeskanuj QR aby otworzyć stronę"
                        className="w-full bg-slate-900 border border-amber-800/80 rounded-xl px-3 py-2 text-xs text-amber-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* QR Preview Box */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Podgląd Grafiki QR Kod w czasie rzeczywistym
                    </span>

                    {liveQrUri ? (
                      <div className="space-y-1 text-center">
                        <img
                          src={liveQrUri}
                          alt="Podgląd kodu QR"
                          className="w-36 h-36 bg-white p-2 rounded-xl shadow-xl mx-auto border border-slate-700"
                        />
                        <p className="text-xs font-bold text-amber-300 max-w-xs mx-auto pt-1">
                          {formQrCaption || formTitle || 'Tytuł pod kodem QR'}
                        </p>
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-950 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600">
                        <QrCode className="w-12 h-12 opacity-50" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    Anuluj
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || !formUrl.trim() || !formTitle.trim()}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? 'Zapisz Zmiany' : 'Dodaj do Bazy i Wygeneruj QR'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: STATUS SYNCHRONIZACJI GITHUB & CLOUDFLARE PAGES */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CloudCheck className="w-5 h-5 text-emerald-400" />
                    Status Synchronizacji Repozytorium GitHub & Cloudflare Pages
                  </h3>
                  <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Aktywne Wdrożenie Pages
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Baza danych URL i kodów QR jest zamieszczona jako plik w repozytorium GitHub (
                  <code className="text-amber-400 font-mono">src/data/url_links.json</code> i{' '}
                  <code className="text-emerald-400 font-mono">public/data/url_links.json</code>
                  ) oraz przechowywana w lokalnej pamięci podręcznej i synchronizowana z aplikacją Cloudflare Pages.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                      <Github className="w-4 h-4" />
                      Ścieżka w Repozytorium Git
                    </div>
                    <code className="text-[11px] text-slate-300 font-mono block truncate">
                      c:\proj\wnr1\src\data\url_links.json
                    </code>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <CloudCheck className="w-4 h-4" />
                      Ścieżka dla Cloudflare Pages
                    </div>
                    <code className="text-[11px] text-slate-300 font-mono block truncate">
                      c:\proj\wnr1\public\data\url_links.json
                    </code>
                  </div>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                  <button
                    onClick={handleExportJson}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition flex items-center gap-2"
                  >
                    <FileCode className="w-4 h-4 text-amber-400" />
                    Pobierz Baze (url_links.json)
                  </button>

                  <p className="text-[10px] text-slate-400 italic">
                    Wszystkie zmiany w bazie są uwzględniane podczas budowy Vite i komend Wrangler Pages.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
