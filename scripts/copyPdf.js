import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootPdf = path.resolve(__dirname, '../WnR365.pdf');
const publicPdf = path.resolve(__dirname, '../public/WnR365.pdf');

try {
  if (fs.existsSync(rootPdf)) {
    fs.copyFileSync(rootPdf, publicPdf);
    console.log('[copyPdf] Skopiowano WnR365.pdf z korzenia do public/WnR365.pdf');
  } else {
    console.warn('[copyPdf] Ostrzeżenie: Plik WnR365.pdf nie istnieje w korzeniu projektu.');
  }
} catch (err) {
  console.error('[copyPdf] Błąd podczas kopiowania WnR365.pdf:', err);
}
