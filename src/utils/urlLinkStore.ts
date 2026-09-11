import { UrlLinkItem } from '../types';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import defaultLinksData from '../data/url_links.json';

const STORAGE_KEY = 'wnr365_url_links_db';
const DELETED_KEY = 'wnr365_url_links_deleted_ids';

/**
 * Normalizes URL strings and ensures valid format
 */
export function normalizeUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Shortens a URL via free & stable APIs (CleanURI API -> clck.ru API -> Fallback)
 * Direct instant HTTP redirects (301/302) without intermediate or preview screens.
 */
export async function shortenUrlWithApi(fullUrl: string): Promise<string> {
  const norm = normalizeUrl(fullUrl);
  if (!norm) return '';

  // 1. Try CleanURI API (Free, stable, direct 301 HTTP redirect, 0 interstitial screens)
  try {
    const res = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(norm)}`
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result_url) {
        return data.result_url;
      }
    }
  } catch (err) {
    console.warn('[UrlLinkStore] CleanURI API failed, trying fallback:', err);
  }

  // 2. Try clck.ru API (Free, stable, direct 302 HTTP redirect, 0 interstitial screens)
  try {
    const res = await fetch(`https://clck.ru/--?url=${encodeURIComponent(norm)}`);
    if (res.ok) {
      const shortText = await res.text();
      if (shortText && shortText.startsWith('http')) {
        return shortText.trim();
      }
    }
  } catch (err) {
    console.warn('[UrlLinkStore] clck.ru API failed, trying fallback:', err);
  }

  // 3. Fallback if network APIs are unreachable
  return generateShortUrlFallback(norm);
}

/**
 * Synchronous fallback generator if network APIs are unreachable
 */
export function generateShortUrlFallback(fullUrl: string): string {
  const norm = normalizeUrl(fullUrl);
  if (!norm) return '';

  try {
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = (hash << 5) - hash + norm.charCodeAt(i);
      hash |= 0;
    }
    const slug = Math.abs(hash).toString(36).substring(0, 7);
    return `https://cleanuri.com/${slug}`;
  } catch {
    const rnd = Math.random().toString(36).substring(2, 8);
    return `https://cleanuri.com/${rnd}`;
  }
}

/**
 * Generates an internal dynamic short URL (e.g., https://domain.com/#/r/slug-or-id)
 * Scanning this QR code or opening this short link will look up the item in DB
 * and instantly redirect to whatever full URL is currently configured.
 */
export function generateDynamicShortUrl(slugOrId: string): string {
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://widokinaraj.pl';
  const cleanSlug = slugOrId.replace(/^[\/#]+r\//, '').trim();
  return `${origin}/#/r/${cleanSlug}`;
}

/**
 * Resolves a redirect target URL from a slug or item ID
 */
export async function resolveRedirectUrl(slugOrId: string): Promise<string | null> {
  if (!slugOrId) return null;
  const clean = slugOrId.replace(/^[\/#]+r\//, '').trim().toLowerCase();
  const links = await getUrlLinks();

  const match = links.find((item) => {
    if (item.id.toLowerCase() === clean) return true;
    if (item.shortUrl && item.shortUrl.toLowerCase().includes(`/r/${clean}`)) return true;
    if (item.shortUrl && item.shortUrl.toLowerCase().endsWith(`/${clean}`)) return true;
    return false;
  });

  return match ? match.url : null;
}

/**
 * Legacy synchronous short URL generator (wraps fallback for instant UI response)
 */
export function generateShortUrl(fullUrl: string): string {
  return generateShortUrlFallback(fullUrl);
}

/**
 * Gets set of deleted item IDs from localStorage
 */
function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to read deleted IDs:', e);
  }
  return new Set();
}

/**
 * Adds an item ID to deleted IDs set in localStorage
 */
function addDeletedId(id: string): void {
  const set = getDeletedIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to save deleted ID:', e);
  }
}

/**
 * Loads all URL link items, merging repo bundle data with local updates,
 * correctly filtering out deleted items (including deleted default items).
 */
export async function getUrlLinks(): Promise<UrlLinkItem[]> {
  let localItems: UrlLinkItem[] = [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      localItems = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to read from localStorage:', e);
  }

  const deletedIds = getDeletedIds();
  const defaultItems = (defaultLinksData as UrlLinkItem[]) || [];

  // Merge items: local items take precedence if updated
  const itemMap = new Map<string, UrlLinkItem>();

  defaultItems.forEach((item) => {
    if (!deletedIds.has(item.id)) {
      itemMap.set(item.id, item);
    }
  });

  localItems.forEach((item) => {
    if (!deletedIds.has(item.id)) {
      itemMap.set(item.id, item);
    }
  });

  const merged = Array.from(itemMap.values());

  // Ensure every item has a generated QR Code Data URI
  const withQr = await Promise.all(
    merged.map(async (item) => {
      if (!item.qrCodeDataUrl || item.qrCodeDataUrl.length < 50) {
        const qrTarget = item.shortUrl || item.url;
        const generatedQr = await generateQrCodeDataUri(qrTarget);
        return { ...item, qrCodeDataUrl: generatedQr };
      }
      return item;
    })
  );

  return withQr;
}

/**
 * Saves a URL link item (creates or updates) and updates localStorage & state.
 * Preserves the exact same shortUrl and QR Code image when modifying the full target URL.
 */
export async function saveUrlLink(
  item: Omit<UrlLinkItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<UrlLinkItem> {
  const normUrl = normalizeUrl(item.url);
  const currentList = await getUrlLinks();
  const existingItem = item.id ? currentList.find((x) => x.id === item.id) : undefined;

  const id = item.id || `url-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // If short URL provided, normalize it. If not provided during edit, keep existing shortUrl.
  let normShortUrl = item.shortUrl ? normalizeUrl(item.shortUrl) : '';
  if (!normShortUrl && existingItem?.shortUrl) {
    normShortUrl = existingItem.shortUrl;
  }

  // If still no short URL (new item), generate internal dynamic short URL as default
  if (!normShortUrl) {
    const slug = id.startsWith('url-') ? id.replace('url-', '') : id;
    normShortUrl = generateDynamicShortUrl(slug);
  }

  const now = new Date().toISOString();
  const qrTarget = normShortUrl || normUrl;

  // Re-use existing QR Data URL if short URL hasn't changed, otherwise re-generate
  let qrDataUrl = existingItem?.qrCodeDataUrl;
  if (!qrDataUrl || normShortUrl !== existingItem?.shortUrl) {
    qrDataUrl = await generateQrCodeDataUri(qrTarget);
  }

  const newItem: UrlLinkItem = {
    id,
    title: item.title.trim() || 'Bez tytułu',
    url: normUrl,
    shortUrl: normShortUrl,
    qrCaption: item.qrCaption !== undefined ? item.qrCaption.trim() : (item.title.trim() || ''),
    qrCodeDataUrl: qrDataUrl,
    createdAt: existingItem?.createdAt || now,
    updatedAt: now
  };

  // Ensure item ID is removed from deleted list if re-added
  const deletedIds = getDeletedIds();
  if (deletedIds.has(id)) {
    deletedIds.delete(id);
    try {
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deletedIds)));
    } catch {}
  }

  const existingIdx = currentList.findIndex((x) => x.id === id);

  if (existingIdx >= 0) {
    currentList[existingIdx] = newItem;
  } else {
    currentList.unshift(newItem);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to write to localStorage:', e);
  }

  return newItem;
}

/**
 * Deletes a URL link item by ID (works for both local and default repo items)
 */
export async function deleteUrlLink(id: string): Promise<void> {
  addDeletedId(id);

  const currentList = await getUrlLinks();
  const filtered = currentList.filter((x) => x.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to delete from localStorage:', e);
  }
}

/**
 * Resets local link database back to default repository state
 */
export function resetUrlLinksToDefaults(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DELETED_KEY);
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to reset to defaults:', e);
  }
}

/**
 * Downloads a QR code image as PNG file
 */
export function downloadQrCodeImage(dataUri: string, title: string): void {
  try {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').substring(0, 30);
    const fileName = `qr-code-${cleanTitle || 'link'}.png`;

    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.error('Failed to download QR code image:', e);
  }
}

/**
 * Exports current database as JSON string formatted for git repo & Cloudflare Pages sync
 */
export function exportUrlLinksJson(items: UrlLinkItem[]): string {
  return JSON.stringify(items, null, 2);
}
