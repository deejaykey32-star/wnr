import { UrlLinkItem } from '../types';
import { generateQrCodeDataUri } from './qrCodeGenerator';
import defaultLinksData from '../data/url_links.json';

const STORAGE_KEY = 'wnr365_url_links_db';

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
 * Generates an automatic short URL for a given full URL
 */
export function generateShortUrl(fullUrl: string): string {
  const norm = normalizeUrl(fullUrl);
  if (!norm) return '';

  try {
    const parsed = new URL(norm);
    const host = parsed.hostname.replace('www.', '');
    // Hash path
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = (hash << 5) - hash + norm.charCodeAt(i);
      hash |= 0;
    }
    const slug = Math.abs(hash).toString(36).substring(0, 7);
    
    // Domain preference
    const baseDomain = host.includes('widokinaraj') ? 'https://widokinaraj.pl/s' : 'https://wnr.pl/s';
    return `${baseDomain}/${slug}`;
  } catch {
    const rnd = Math.random().toString(36).substring(2, 8);
    return `https://widokinaraj.pl/s/${rnd}`;
  }
}

/**
 * Loads all URL link items, merging repo bundle data with local updates
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

  // Fallback / initial seed from repo bundle
  const defaultItems = (defaultLinksData as UrlLinkItem[]) || [];

  // Merge items: local items take precedence if newer or added
  const itemMap = new Map<string, UrlLinkItem>();

  defaultItems.forEach((item) => {
    itemMap.set(item.id, item);
  });

  localItems.forEach((item) => {
    itemMap.set(item.id, item);
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
 * Saves a URL link item (creates or updates) and updates localStorage & state
 */
export async function saveUrlLink(
  item: Omit<UrlLinkItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<UrlLinkItem> {
  const normUrl = normalizeUrl(item.url);
  const normShortUrl = item.shortUrl ? normalizeUrl(item.shortUrl) : generateShortUrl(normUrl);
  const now = new Date().toISOString();

  const id = item.id || `url-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const qrTarget = normShortUrl || normUrl;
  const qrDataUrl = await generateQrCodeDataUri(qrTarget);

  const newItem: UrlLinkItem = {
    id,
    title: item.title.trim() || 'Bez tytułu',
    url: normUrl,
    shortUrl: normShortUrl,
    qrCaption: item.qrCaption !== undefined ? item.qrCaption.trim() : (item.title.trim() || ''),
    qrCodeDataUrl: qrDataUrl,
    createdAt: now,
    updatedAt: now
  };

  const currentList = await getUrlLinks();
  const existingIdx = currentList.findIndex((x) => x.id === id);

  if (existingIdx >= 0) {
    currentList[existingIdx] = {
      ...currentList[existingIdx],
      ...newItem,
      createdAt: currentList[existingIdx].createdAt,
      updatedAt: now
    };
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
 * Deletes a URL link item by ID
 */
export async function deleteUrlLink(id: string): Promise<void> {
  const currentList = await getUrlLinks();
  const filtered = currentList.filter((x) => x.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[UrlLinkStore] Failed to delete from localStorage:', e);
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
