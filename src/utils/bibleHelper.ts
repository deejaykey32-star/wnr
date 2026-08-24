interface BibleBook {
  name: string;
  shortName: string;
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Stary Testament
  { name: 'Księga Rodzaju', shortName: 'Rdz', chapters: 50 },
  { name: 'Księga Wyjścia', shortName: 'Wj', chapters: 40 },
  { name: 'Księga Kapłańska', shortName: 'Kpł', chapters: 27 },
  { name: 'Księga Liczb', shortName: 'Lb', chapters: 36 },
  { name: 'Księga Powtórzonego Prawa', shortName: 'Pwt', chapters: 34 },
  { name: 'Księga Jozuego', shortName: 'Joz', chapters: 24 },
  { name: 'Księga Sędziów', shortName: 'Sdz', chapters: 21 },
  { name: 'Księga Rut', shortName: 'Rt', chapters: 4 },
  { name: '1 Księga Samuela', shortName: '1 Sm', chapters: 31 },
  { name: '2 Księga Samuela', shortName: '2 Sm', chapters: 24 },
  { name: '1 Księga Królewska', shortName: '1 Król', chapters: 22 },
  { name: '2 Księga Królewska', shortName: '2 Król', chapters: 25 },
  { name: '1 Księga Kronik', shortName: '1 Krn', chapters: 29 },
  { name: '2 Księga Kronik', shortName: '2 Krn', chapters: 36 },
  { name: 'Księga Ezdrasza', shortName: 'Ezd', chapters: 10 },
  { name: 'Księga Nehemiasza', shortName: 'Ne', chapters: 13 },
  { name: 'Księga Tobiasza', shortName: 'Tb', chapters: 14 },
  { name: 'Księga Judyty', shortName: 'Jdt', chapters: 16 },
  { name: 'Księga Estery', shortName: 'Est', chapters: 10 },
  { name: '1 Księga Machabejska', shortName: '1 Mch', chapters: 16 },
  { name: '2 Księga Machabejska', shortName: '2 Mch', chapters: 15 },
  { name: 'Księga Hioba', shortName: 'Hi', chapters: 42 },
  { name: 'Księga Psalmów', shortName: 'Ps', chapters: 150 },
  { name: 'Księga Przysłów', shortName: 'Prz', chapters: 31 },
  { name: 'Księga Koheleta', shortName: 'Koh', chapters: 12 },
  { name: 'Pieśń nad Pieśniami', shortName: 'Pnp', chapters: 8 },
  { name: 'Księga Mądrości', shortName: 'Mdr', chapters: 19 },
  { name: 'Mądrość Syracha', shortName: 'Syr', chapters: 51 },
  { name: 'Księga Izajasza', shortName: 'Iz', chapters: 66 },
  { name: 'Księga Jeremiasza', shortName: 'Jr', chapters: 52 },
  { name: 'Lamentacje Jeremiasza', shortName: 'Lm', chapters: 5 },
  { name: 'Księga Barucha', shortName: 'Bar', chapters: 6 },
  { name: 'Księga Ezechiela', shortName: 'Ez', chapters: 48 },
  { name: 'Księga Daniela', shortName: 'Dn', chapters: 14 },
  { name: 'Księga Ozeasza', shortName: 'Oz', chapters: 14 },
  { name: 'Księga Joela', shortName: 'Jl', chapters: 4 },
  { name: 'Księga Amosa', shortName: 'Am', chapters: 9 },
  { name: 'Księga Abdiasza', shortName: 'Ab', chapters: 1 },
  { name: 'Księga Jonasza', shortName: 'Jon', chapters: 4 },
  { name: 'Księga Micheasza', shortName: 'Mi', chapters: 7 },
  { name: 'Księga Nahuma', shortName: 'Na', chapters: 3 },
  { name: 'Księga Habakuka', shortName: 'Hab', chapters: 3 },
  { name: 'Księga Sofoniasza', shortName: 'So', chapters: 3 },
  { name: 'Księga Aggeusza', shortName: 'Ag', chapters: 2 },
  { name: 'Księga Zachariasza', shortName: 'Za', chapters: 14 },
  { name: 'Księga Malachiasza', shortName: 'Ml', chapters: 3 },

  // Nowy Testament
  { name: 'Ewangelia wg św. Mateusza', shortName: 'Mt', chapters: 28 },
  { name: 'Ewangelia wg św. Marka', shortName: 'Mk', chapters: 16 },
  { name: 'Ewangelia wg św. Łukasza', shortName: 'Łk', chapters: 24 },
  { name: 'Ewangelia wg św. Jana', shortName: 'J', chapters: 21 },
  { name: 'Dzieje Apostolskie', shortName: 'Dz', chapters: 28 },
  { name: 'List do Rzymian', shortName: 'Rz', chapters: 16 },
  { name: '1 List do Koryntian', shortName: '1 Kor', chapters: 16 },
  { name: '2 List do Koryntian', shortName: '2 Kor', chapters: 13 },
  { name: 'List do Galatów', shortName: 'Ga', chapters: 6 },
  { name: 'List do Efezjan', shortName: 'Ef', chapters: 6 },
  { name: 'List do Filipian', shortName: 'Flp', chapters: 4 },
  { name: 'List do Kolosan', shortName: 'Kol', chapters: 4 },
  { name: '1 List do Tesaloniczan', shortName: '1 Tes', chapters: 5 },
  { name: '2 List do Tesaloniczan', shortName: '2 Tes', chapters: 3 },
  { name: '1 List do Tymoteusza', shortName: '1 Tm', chapters: 6 },
  { name: '2 List do Tymoteusza', shortName: '2 Tm', chapters: 4 },
  { name: 'List do Tytusa', shortName: 'Tt', chapters: 3 },
  { name: 'List do Filemona', shortName: 'Flm', chapters: 1 },
  { name: 'List do Hebrajczyków', shortName: 'Hbr', chapters: 13 },
  { name: 'List św. Jakuba', shortName: 'Jk', chapters: 5 },
  { name: '1 List św. Piotra', shortName: '1 Pt', chapters: 5 },
  { name: '2 List św. Piotra', shortName: '2 Pt', chapters: 3 },
  { name: '1 List św. Jana', shortName: '1 J', chapters: 5 },
  { name: '2 List św. Jana', shortName: '2 J', chapters: 1 },
  { name: '3 List św. Jana', shortName: '3 J', chapters: 1 },
  { name: 'List św. Judy', shortName: 'Jud', chapters: 1 },
  { name: 'Apokalipsa św. Jana', shortName: 'Ap', chapters: 22 }
];

export interface BibleChapterData {
  slotIndex: number; // 1 do 1460
  defaultTitle: string;
  defaultText: string;
}

let cachedBibleChapters: BibleChapterData[] = [];

/**
 * Generuje statyczną listę wszystkich 1460 czytań (1278 rozdziałów Biblii + 182 rozważania uzupełniające)
 */
export function getBibleChapters(): BibleChapterData[] {
  if (cachedBibleChapters.length > 0) return cachedBibleChapters;

  const list: BibleChapterData[] = [];
  let slotIndex = 1;

  for (const book of BIBLE_BOOKS) {
    for (let c = 1; c <= book.chapters; c++) {
      list.push({
        slotIndex,
        defaultTitle: `${book.name} — Rozdział ${c}`,
        defaultText: `<p>Treść rozdziału ${c} Księgi: <strong>${book.name}</strong>. Wklej tutaj pełny tekst z Biblii Tysiąclecia w panelu edycji.</p>`
      });
      slotIndex++;
    }
  }

  while (slotIndex <= 1460) {
    const extraNum = slotIndex - 1278;
    list.push({
      slotIndex,
      defaultTitle: `Rozważanie Biblijne — Dzień uzupełniający ${extraNum}`,
      defaultText: `<p>Rozważanie biblijne i podsumowanie lektury Pisma Świętego. Dzień uzupełniający ${extraNum} z 182.</p>`
    });
    slotIndex++;
  }

  cachedBibleChapters = list;
  return list;
}

/**
 * Mapuje datę kalendarzową na slot w 4-letnim planie czytania Pisma Świętego.
 */
export function getBibleSlotForDate(selectedDate: Date): { slotIndex: number; cycleYear: number; dayIndex: number } {
  const d = new Date(selectedDate);
  d.setHours(12, 0, 0, 0);
  const year = d.getFullYear();

  let startYear = year;
  const dec25 = new Date(year, 11, 25, 12, 0, 0, 0);
  if (d < dec25) {
    startYear = year - 1;
  }

  const cycleStart = new Date(startYear, 11, 25, 12, 0, 0, 0);
  const diffTime = d.getTime() - cycleStart.getTime();
  let dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)); // 0 do 364/365

  dayIndex = Math.min(364, Math.max(0, dayIndex));

  // Bazowy rok to 2025 (od 25 grudnia 2025 zaczynamy Rok 1)
  const cycleYear = ((startYear - 2025) % 4 + 4) % 4 + 1; // Zawsze 1, 2, 3, 4

  const slotIndex = (cycleYear - 1) * 365 + dayIndex + 1; // 1 do 1460

  return { slotIndex, cycleYear, dayIndex };
}
