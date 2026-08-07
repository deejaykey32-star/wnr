import { BeadData, PrayerStep } from '../types';

export const DEFAULT_PRAYERS: Record<string, { title: string; text: string }> = {
  signOfCross: {
    title: "Znak Krzyża Świętego",
    text: "W imię Ojca i Syna, i Ducha Świętego. Amen."
  },
  creed: {
    title: "Skład Apostolski (Wierzę w Boga)",
    text: "Wierzę w Boga, Ojca wszechmogącego, Stworzyciela nieba i ziemi. I w Jezusa Chrystusa, Syna Jego jedynego, Pana naszego, który się począł z Ducha Świętego, narodził się z Maryi Panny. Umęczon pod Ponckim Piłatem, ukrzyżowan, umarł i pogrzebion. Zstąpił do piekieł, trzeciego dnia zmartwychwstał. Wstąpił na niebiosa, siedzi po prawicy Boga Ojca wszechmogącego. Stamtąd przyjdzie sądzić żywych i umarłych. Wierzę w Ducha Świętego, święty Kościół powszechny, świętych obcowanie, grzechów odpuszczenie, ciała zmartwychwstanie, żywot wieczny. Amen."
  },
  ourFather: {
    title: "Modlitwa Pańska (Ojcze Nasz)",
    text: "Ojcze nasz, któryś jest w niebie, święć się imię Twoje. Przyjdź królestwo Twoje, bądź wola Twoja, jako w niebie, tak i na ziemi. Chleba naszego powszedniego daj nam dzisiaj i odpuść nam nasze winy, jako i my odpuszczamy naszym winowajcom. I nie wódź nas na pokuszenie, ale nas zbaw ode złego. Amen."
  },
  hailMary: {
    title: "Pozdrowienie Anielskie (Zdrowaś Maryjo)",
    text: "Zdrowaś Maryjo, łaski pełna, Pan z Tobą. Błogosławionaś Ty między niewiastami i błogosławiony owoc żywota Twojego, Jezus. Święta Maryjo, Matko Boża, módl się za nami grzesznikami, teraz i w godzinę śmierci naszej. Amen."
  },
  gloryBe: {
    title: "Uwielbienie Trójcy Świętej (Chwała Ojcu)",
    text: "Chwała Ojcu i Synowi, i Duchowi Świętemu, jak była na początku, teraz i zawsze, i na wieki wieków. Amen."
  },
  fatima: {
    title: "Modlitwa Fatimska (O mój Jezu)",
    text: "O mój Jezu, przebacz nam nasze grzechy, zachowaj nas od ognia piekielnego, zaprowadź wszystkie dusze do nieba i dopomóż szczególnie tym, którzy najbardziej potrzebują Twojego miłosierdzia."
  },
  hailQueen: {
    title: "Antyfona Maryjna (Witaj Królowo / Pod Twoją obronę)",
    text: "Pod Twoją obronę uciekamy się, święta Boża Rodzicielko, naszymi prośbami racz nie gardzić w potrzebach naszych, ale od wszelakich złych przygód racz nas zawsze wybawiać, Panno chwalebna i błogosławiona. O Pani nasza, Orędowniczko nasza, Pośredniczko nasza, Pocieszycielko nasza! Z Synem swoim nas pojednaj, Synowi swojemu nas polecaj, swojemu Synowi nas oddawaj. Amen."
  }
};

// Calculate the cycle details starting from December 25th of the current or previous year
export const getCycleDayInfo = (selectedDate: Date) => {
  const d = new Date(selectedDate);
  d.setHours(12, 0, 0, 0); // avoid timezone shifts
  const year = d.getFullYear();
  
  // Dec 25 of current calendar year
  let startYear = year;
  const currentDec25 = new Date(year, 11, 25, 12, 0, 0, 0);
  
  if (d < currentDec25) {
    startYear = year - 1;
  }
  
  const cycleStart = new Date(startYear, 11, 25, 12, 0, 0, 0);
  
  // Calculate difference in days (using Math.round to avoid DST timezone hour shifts)
  const diffTime = d.getTime() - cycleStart.getTime();
  const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)); // 0 to 364/365
  
  let cycleType: 'cycle1' | 'cycle2' | 'break' | 'break2' = 'cycle1';
  let dayOfCycle = 1;
  let cycleName = "";
  
  if (dayIndex >= 0 && dayIndex < 175) {
    cycleType = 'cycle1';
    dayOfCycle = dayIndex + 1;
    cycleName = `Cykl I - Dzień ${dayOfCycle} z 175 (Różaniec Tradycyjny)`;
  } else if (dayIndex >= 175 && dayIndex < 182) {
    cycleType = 'break';
    dayOfCycle = dayIndex - 174; // 1 to 7
    cycleName = `7 Dni Przerwy (Dzień ${dayOfCycle} z 7)`;
  } else if (dayIndex >= 182 && dayIndex < 357) {
    cycleType = 'cycle2';
    dayOfCycle = dayIndex - 181; // 1 to 175
    cycleName = `Cykl II - Dzień ${dayOfCycle} z 175 (Różaniec do Boga Ojca)`;
  } else {
    cycleType = 'break2';
    dayOfCycle = dayIndex - 356;
    cycleName = `Okres Przygotowania (Dzień ${dayOfCycle})`;
  }
  
  return {
    dayIndex,
    dayOfCycle,
    cycleType,
    cycleName,
    startYear,
    endYear: startYear + 1
  };
};

// Algorithmic generator for Cykl I Love Contemplations (RGBA)
export const getLoveMystery = (dayNum: number, decIdx: number) => {
  const themes = [
    "Przymierza Miłości", "Serca Jezusowego", "Ofiary Krzyża", "Ducha Pocieszyciela", "Maryi Królowej Pokoju",
    "Miłosierdzia Bożego", "Wieczności w Bogu", "Stworzenia Świata", "Łaski Uświęcającej", "Jedności Chrześcijan",
    "Służby Pokornej", "Zwycięstwa nad Złem", "Prawdy Objawionej", "Nadziei Chrześcijańskiej", "Mądrości Bożej"
  ];
  const theme = themes[(dayNum - 1) % themes.length];
  
  const titles = [
    `Kontemplacja Miłości Stwórczej w Duchu ${theme} (Alpha/Czerń)`,
    `Rozpalenie Ognia Miłości Bożej w Tajemnicy ${theme} (Czerwień)`,
    `Zjednoczenie z Ofiarą Miłości Chrystusa w Duchu ${theme} (Zieleń)`,
    `Ożywcze Tchnienie Miłości Ducha Świętego w ${theme} (Niebieski)`,
    `Pełnia Wiecznej Miłości i Chwały Bożej w ${theme} (Biel)`
  ];
  
  const texts = [
    `Rozważamy bezwarunkową Miłość Boga Ojca (Dzień ${dayNum} cyklu I), który powołuje nas ze stanu czerni i nicości do pełnego światła łaski. Doświadczamy radości z bycia dzieckiem Bożym, wybranym i ukochanym przed stworzeniem świata.`,
    `Kontemplujemy miłość Chrystusa (Dzień ${dayNum} cyklu I), która rozlewa się jako zbawcza czerwień na krzyżu. Uczymy się pasji, ofiarności oraz przebaczania nieprzyjaciołom, naśladując gorejące miłością Serce Zbawiciela.`,
    `Otwieramy się na zielone tchnienie nadziei i życia duchowego (Dzień ${dayNum} cyklu I), które przynosi Duch Święty. Prosimy o owoce miłości, pokoju i cierpliwości, aby nasze codzienne życie stawało się świadectwem Ewangelii.`,
    `Wpatrujemy się w błękitną głębię niebios (Dzień ${dayNum} cyklu I), która symbolizuje pokój Maryi i całego Kościoła. Prosimy o łaskę cichego oddania i zaufania Bożej Opatrzności we wszelkich przeciwnościach życia.`,
    `Radujemy się chwałą zmartwychwstania i wiecznego zjednoczenia (Dzień ${dayNum} cyklu I), reprezentowaną przez czyste białe światło. Wierzymy, że miłość nigdy nie ustaje i doprowadzi nas do wiecznej komunii z Bogiem.`
  ];
  
  return {
    title: titles[decIdx - 1] || `Tajemnica Miłości - Dziesiątek ${decIdx}`,
    text: texts[decIdx - 1] || `Rozważanie Miłości Bożej.`
  };
};

// Algorithmic generator for Cykl I Pokuta / Hate Contemplations (CMYK)
export const getHateMystery = (dayNum: number, decIdx: number) => {
  const penanceThemes = [
    "pychy i egoizmu", "braku miłosierdzia", "podziałów i gniewu", "obojętności i chłodu", "kłamstwa i zdrady",
    "zatwardziałości serca", "zazdrości i kłótni", "odrzucenia łaski", "pogardy dla słabych", "zaniedbania dobra"
  ];
  const theme = penanceThemes[(dayNum - 1) % penanceThemes.length];
  
  const titles = [
    `Pokuta za grzechy ${theme} (Biel skruchy)`,
    `Przebłaganie za oziębłość i brak miłości (Cyan)`,
    `Zadośćuczynienie za rany zadane nienawiścią (Magenta)`,
    `Przeproszenie za odejście od prawdy i pokoju (Yellow)`,
    `Błaganie o ocalenie przed mrokami zatwardziałości (Czerń Key)`
  ];
  
  const texts = [
    `Pragniemy obmyć nasze serca w bieli pokuty (Dzień ${dayNum} cyklu I), przepraszając za wszelką pychę i egoizm, które niszczą miłość i oddalają nas od Boga. Stajemy w prawdzie i uniżeniu przed Panem.`,
    `Rozważamy chłód serca i brak miłosierdzia (Cyan) (Dzień ${dayNum} cyklu I). Wynagradzamy Bogu za wszelkie chwile obojętności wobec cierpiących, ubogich i opuszczonych, prosząc o serce wrażliwe na bliźnich.`,
    `Wpatrujemy się w rany Chrystusa zadane przez ludzki gniew i przemoc (Magenta) (Dzień ${dayNum} cyklu I). Pokutujemy za wszelkie słowa nienawiści, osądy i kłótnie, błagając o łaskę pojednania i przebaczenia.`,
    `Przepraszamy za grzechy zazdrości, kłamstwa i siania niezgody (Yellow) (Dzień ${dayNum} cyklu I). Prosimy o oczyszczenie naszych intencji, abyśmy zawsze poszukiwali prawdy i budowali pokój w naszych rodzinach.`,
    `Stajemy w obliczu powagi grzechu i ostatecznego odrzucenia miłości (Czerń Key) (Dzień ${dayNum} cyklu I). Błagamy o miłosierdzie nad światem i o łaskę nawrócenia dla zatwardziałych grzeszników, aby nienawiść została pokonana przez miłość.`
  ];
  
  return {
    title: titles[decIdx - 1] || `Tajemnica Pokuty - Dziesiątek ${decIdx}`,
    text: texts[decIdx - 1] || `Rozważanie Pokutne.`
  };
};

// Algorithmic generator for Cykl II Father Mysteries (Bóg Ojciec)
export const getFatherMystery = (dayNum: number, decIdx: number) => {
  const fatherThemes = [
    "Ojcowskiego Przymierza", "Opatrzności Bożej", "Nieskończonego Miłosierdzia", "Darów Ducha", "Chwały Niebiańskiej",
    "Ukochanego Stworzenia", "Troski o Słabych", "Przebaczającego Serca", "Wskazywania Drogi Prawdy", "Kojenia Wszelkiego Bólu"
  ];
  const theme = fatherThemes[(dayNum - 1) % fatherThemes.length];
  
  const titles = [
    `Ojcostwo Boże jako Źródło Życia w Duchu ${theme}`,
    `Ojcowskie Miłosierdzie i Przebaczenie w Duchu ${theme}`,
    `Prowadzenie Ojcowskie przez Syna w Duchu ${theme}`,
    `Ojcowskie Pocieszenie w Każdym Cierpieniu w Duchu ${theme}`,
    `Dziedzictwo Królestwa Ojca i Obietnica Nieba w Duchu ${theme}`
  ];
  
  const texts = [
    `Bądź uwielbiony, Ojcze (Dzień ${dayNum} cyklu II), w Twojej stwórczej potędze i ojcowskiej opiece. Dziękujemy Ci za dar istnienia i ufnie oddajemy się pod Twoją Opatrzność, która czuwa nad każdym naszym krokiem.`,
    `Uwielbiamy Cię, Ojcze pełen miłosierdzia (Dzień ${dayNum} cyklu II), który z miłością wybiegasz na spotkanie marnotrawnego dziecka. Dziękujemy za sakrament przebaczenia i łaskę, która podnosi nas z każdego upadku.`,
    `Składamy Ci dziękczynienie, Ojcze (Dzień ${dayNum} cyklu II), za posłanie Twojego Syna Jezusa Chrystusa jako Drogi, Prawdy i Życia. W Duchu Świętym wołamy z miłością: Abba, Ojcze!`,
    `Wychwalamy Cię, Ojcze pocieszenia (Dzień ${dayNum} cyklu II), który ocierasz wszelką łzę i jesteś blisko skruszonych w sercu. W Twoich ojcowskich ramionach znajdujemy pokój, ukojenie i męstwo w chwilach doświadczeń.`,
    `Tęsknimy za Twoim Królestwem, Ojcze (Dzień ${dayNum} cyklu II), które przygotowałeś dla nas od założenia świata. Prosimy o łaskę wytrwania w miłości do końca, abyśmy mogli zamieszkać w Twoim domu na wieki.`
  ];
  
  return {
    title: titles[decIdx - 1] || `Tajemnica Boga Ojca - Dziesiątek ${decIdx}`,
    text: texts[decIdx - 1] || `Rozważanie Ojcowskie.`
  };
};

// Maps a dayOfCycle (1-175) to the active decade number (1-5)
export const getDecadeForDay = (dayOfCycle: number): number => {
  return ((dayOfCycle - 1) % 5) + 1;
};

// Generate beads arrays
export const getRGBABeads = (): BeadData[] => {
  const beads: BeadData[] = [];
  
  // Intro Chain (0 to 5)
  beads.push({ id: 'rgba-cross', index: 0, type: 'cross', colorType: 'white' });
  beads.push({ id: 'rgba-b1', index: 1, type: 'intro-father', colorType: 'black' });
  beads.push({ id: 'rgba-b2', index: 2, type: 'intro-virtue', colorType: 'red' });
  beads.push({ id: 'rgba-b3', index: 3, type: 'intro-virtue', colorType: 'green' });
  beads.push({ id: 'rgba-b4', index: 4, type: 'intro-virtue', colorType: 'blue' });
  beads.push({ id: 'rgba-b5', index: 5, type: 'intro-glory', colorType: 'white' });
  
  // Connector (6)
  beads.push({ id: 'rgba-connector', index: 6, type: 'connector', colorType: 'white' });
  
  // Decades (7 to 60)
  // Decade 1: 10 black beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `rgba-dec1-${i}`, index: beads.length, type: 'decade-bead', colorType: 'black', decadeIndex: 0 });
  }
  // Separator 1: 1 transparent
  beads.push({ id: 'rgba-sep1', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 0 });
  
  // Decade 2: 10 red beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `rgba-dec2-${i}`, index: beads.length, type: 'decade-bead', colorType: 'red', decadeIndex: 1 });
  }
  // Separator 2: 1 transparent
  beads.push({ id: 'rgba-sep2', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 1 });
  
  // Decade 3: 10 green beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `rgba-dec3-${i}`, index: beads.length, type: 'decade-bead', colorType: 'green', decadeIndex: 2 });
  }
  // Separator 3: 1 transparent
  beads.push({ id: 'rgba-sep3', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 2 });
  
  // Decade 4: 10 blue beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `rgba-dec4-${i}`, index: beads.length, type: 'decade-bead', colorType: 'blue', decadeIndex: 3 });
  }
  // Separator 4: 1 transparent
  beads.push({ id: 'rgba-sep4', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 3 });
  
  // Decade 5: 10 white beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `rgba-dec5-${i}`, index: beads.length, type: 'decade-bead', colorType: 'white', decadeIndex: 4 });
  }

  return beads;
};

export const getCMYKBeads = (): BeadData[] => {
  const beads: BeadData[] = [];
  
  // Intro Chain (0 to 5)
  beads.push({ id: 'cmyk-cross', index: 0, type: 'cross', colorType: 'black' });
  beads.push({ id: 'cmyk-b1', index: 1, type: 'intro-father', colorType: 'white' });
  beads.push({ id: 'cmyk-b2', index: 2, type: 'intro-virtue', colorType: 'cyan' });
  beads.push({ id: 'cmyk-b3', index: 3, type: 'intro-virtue', colorType: 'magenta' });
  beads.push({ id: 'cmyk-b4', index: 4, type: 'intro-virtue', colorType: 'yellow' });
  beads.push({ id: 'cmyk-b5', index: 5, type: 'intro-glory', colorType: 'black' });
  
  // Connector (6)
  beads.push({ id: 'cmyk-connector', index: 6, type: 'connector', colorType: 'white' });
  
  // Decades (7 to 60)
  // Decade 1: 10 white beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `cmyk-dec1-${i}`, index: beads.length, type: 'decade-bead', colorType: 'white', decadeIndex: 0 });
  }
  // Separator 1: 1 transparent
  beads.push({ id: 'cmyk-sep1', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 0 });
  
  // Decade 2: 10 cyan beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `cmyk-dec2-${i}`, index: beads.length, type: 'decade-bead', colorType: 'cyan', decadeIndex: 1 });
  }
  // Separator 2: 1 transparent
  beads.push({ id: 'cmyk-sep2', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 1 });
  
  // Decade 3: 10 magenta beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `cmyk-dec3-${i}`, index: beads.length, type: 'decade-bead', colorType: 'magenta', decadeIndex: 2 });
  }
  // Separator 3: 1 transparent
  beads.push({ id: 'cmyk-sep3', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 2 });
  
  // Decade 4: 10 yellow beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `cmyk-dec4-${i}`, index: beads.length, type: 'decade-bead', colorType: 'yellow', decadeIndex: 3 });
  }
  // Separator 4: 1 transparent
  beads.push({ id: 'cmyk-sep4', index: beads.length, type: 'decade-separator', colorType: 'transparent', decadeIndex: 3 });
  
  // Decade 5: 10 black beads
  for (let i = 1; i <= 10; i++) {
    beads.push({ id: `cmyk-dec5-${i}`, index: beads.length, type: 'decade-bead', colorType: 'black', decadeIndex: 4 });
  }

  return beads;
};

// Generate list of steps for the Rosary Prayer (dynamic based on cycle type and day)
// Each day = ONE decade/mystery (the decade rotates: day 1 → dec 1, day 2 → dec 2, ..., day 6 → dec 1, ...)
export const getPrayerSteps = (
  cycleType: 'cycle1' | 'cycle2' | 'break' | 'break2',
  dayOfCycle: number,
  prayers: Record<string, { title: string; text: string }> = {}
): PrayerStep[] => {
  const steps: PrayerStep[] = [];
  const rgbaBeads = getRGBABeads();
  const cmykBeads = getCMYKBeads();

  const getRGBAId = (idx: number) => rgbaBeads[idx]?.id || '';
  const getCMYKId = (idx: number) => cmykBeads[idx]?.id || '';

  // Determine which single decade this day is assigned to
  const activeDecadeNum = getDecadeForDay(dayOfCycle);

  // Step 0: Sign of the Cross
  steps.push({
    id: 'step-sign-1',
    label: "Rozpoczęcie - W imię Ojca...",
    beadIndex: 0,
    prayerType: 'signOfCross',
    rgbaBeadId: getRGBAId(0),
    cmykBeadId: getCMYKId(0)
  });

  // Step 1: Apostles' Creed on Cross
  steps.push({
    id: 'step-creed',
    label: "Krzyż - Wierzę w Boga",
    beadIndex: 0,
    prayerType: 'creed',
    rgbaBeadId: getRGBAId(0),
    cmykBeadId: getCMYKId(0)
  });

  // Step 2: Our Father (bead 1)
  steps.push({
    id: 'step-intro-father',
    label: "Paciorek 1 - Ojcze Nasz",
    beadIndex: 1,
    prayerType: 'ourFather',
    rgbaBeadId: getRGBAId(1),
    cmykBeadId: getCMYKId(1)
  });

  // Step 3, 4, 5: Virtues (beads 2, 3, 4)
  // In Cycle II, small beads are "Ojcze Nasz"
  const smallBeadPrayer = cycleType === 'cycle2' ? 'ourFather' : 'hailMary';
  const virtueLabels = cycleType === 'cycle2'
    ? ["Paciorek 2 - Ojcze Nasz (O Wiarę)", "Paciorek 3 - Ojcze Nasz (O Nadzieję)", "Paciorek 4 - Ojcze Nasz (O Miłość)"]
    : ["Paciorek 2 - Zdrowaś Maryjo (O Wiarę)", "Paciorek 3 - Zdrowaś Maryjo (O Nadzieję)", "Paciorek 4 - Zdrowaś Maryjo (O Miłość)"];

  steps.push({
    id: 'step-intro-virtue-1',
    label: virtueLabels[0],
    beadIndex: 2,
    prayerType: smallBeadPrayer,
    rgbaBeadId: getRGBAId(2),
    cmykBeadId: getCMYKId(2)
  });

  steps.push({
    id: 'step-intro-virtue-2',
    label: virtueLabels[1],
    beadIndex: 3,
    prayerType: smallBeadPrayer,
    rgbaBeadId: getRGBAId(3),
    cmykBeadId: getCMYKId(3)
  });

  steps.push({
    id: 'step-intro-virtue-3',
    label: virtueLabels[2],
    beadIndex: 4,
    prayerType: smallBeadPrayer,
    rgbaBeadId: getRGBAId(4),
    cmykBeadId: getCMYKId(4)
  });

  // Step 6: Glory Be & Fatima (bead 5)
  steps.push({
    id: 'step-intro-glory',
    label: "Paciorek 5 - Chwała Ojcu & O mój Jezu",
    beadIndex: 5,
    prayerType: 'gloryBe',
    rgbaBeadId: getRGBAId(5),
    cmykBeadId: getCMYKId(5)
  });

  // Decades positioning (all 5 decades bead positions defined, but only ONE is used per day)
  const decadeBeadIndices = [
    { start: 7, end: 16, sep: 17 },
    { start: 18, end: 27, sep: 28 },
    { start: 29, end: 38, sep: 39 },
    { start: 40, end: 49, sep: 50 },
    { start: 51, end: 60, sep: -1 }
  ];

  const colorsList = [
    { rgba: "Czerń / Alpha", cmyk: "Biel" },
    { rgba: "Czerwień (Red)", cmyk: "Cyan" },
    { rgba: "Zieleń (Green)", cmyk: "Magenta" },
    { rgba: "Błękit (Blue)", cmyk: "Żółty (Yellow)" },
    { rgba: "Biel", cmyk: "Czerń / Key" }
  ];

  // Only generate the single active decade for this day
  const d = activeDecadeNum - 1; // 0-indexed
  const { start, sep } = decadeBeadIndices[d];
  const decNum = activeDecadeNum;
  const colors = colorsList[d];
  // The "trigger" bead (large bead / separator before the decade)
  // For decade 1 it's the connector (index 6); for others it's the previous separator
  const triggerBeadIdx = d === 0 ? 6 : decadeBeadIndices[d - 1].sep;

  if (cycleType === 'cycle2') {
    // -----------------------------------------------------------------
    // CYKL II: Różaniec do Boga Ojca — jeden dziesiątek na dzień
    // -----------------------------------------------------------------

    // Large bead: Mystery + Reflection on God the Father
    steps.push({
      id: `step-mystery-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Rozważanie i Zdrowaś Maryjo (Duży Paciorek)`,
      beadIndex: triggerBeadIdx,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

    // 10 Small beads: Ojcze Nasz
    for (let h = 0; h < 10; h++) {
      const bIdx = start + h;
      steps.push({
        id: `step-hailmary-dec-${decNum}-${h + 1}`,
        label: `Tajemnica ${decNum}, Ojcze Nasz ${h + 1}/10 (Odpust i Uwielbienie)`,
        beadIndex: bIdx,
        prayerType: 'ourFather',
        rgbaBeadId: getRGBAId(bIdx),
        cmykBeadId: getCMYKId(bIdx),
        decadeIndex: decNum,
        beadNumber: h + 1
      });
    }

  } else {
    // -----------------------------------------------------------------
    // CYKL I (lub Dni Przerwy): Różaniec Tradycyjny — jeden dziesiątek na dzień
    // -----------------------------------------------------------------

    // Mystery announcement
    steps.push({
      id: `step-mystery-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Rozważanie`,
      beadIndex: triggerBeadIdx,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

    // Large bead: Our Father
    steps.push({
      id: `step-father-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Ojcze Nasz`,
      beadIndex: triggerBeadIdx,
      prayerType: 'ourFather',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

    // 10 Small beads: Zdrowaś Maryjo
    for (let h = 0; h < 10; h++) {
      const bIdx = start + h;
      steps.push({
        id: `step-hailmary-dec-${decNum}-${h + 1}`,
        label: `Tajemnica ${decNum}, Zdrowaś Maryjo ${h + 1}/10`,
        beadIndex: bIdx,
        prayerType: 'hailMary',
        rgbaBeadId: getRGBAId(bIdx),
        cmykBeadId: getCMYKId(bIdx),
        decadeIndex: decNum,
        beadNumber: h + 1
      });
    }

    // Glory Be & Fatima at the end of the decade
    const gloryBeadIdx = sep !== -1 ? sep : 6;
    steps.push({
      id: `step-glory-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Chwała Ojcu & O mój Jezu`,
      beadIndex: gloryBeadIdx,
      prayerType: 'gloryBe',
      rgbaBeadId: getRGBAId(gloryBeadIdx),
      cmykBeadId: getCMYKId(gloryBeadIdx),
      decadeIndex: decNum
    });
  }

  // Witaj Królowo / Pod Twoją obronę on Connector
  steps.push({
    id: 'step-hail-queen',
    label: "Zakończenie — Pod Twoją obronę",
    beadIndex: 6,
    prayerType: 'hailQueen',
    rgbaBeadId: getRGBAId(6),
    cmykBeadId: getCMYKId(6)
  });

  // Final Sign of the Cross
  steps.push({
    id: 'step-final-sign',
    label: "Zakończenie — W imię Ojca...",
    beadIndex: 0,
    prayerType: 'signOfCross',
    rgbaBeadId: getRGBAId(0),
    cmykBeadId: getCMYKId(0)
  });

  return steps;
};

// Helper to retrieve active title and text for a specific decade
export const getActiveDecadeMystery = (
  cycleType: 'cycle1' | 'cycle2' | 'break' | 'break2',
  dayOfCycle: number,
  decIdx: number,
  prayers: Record<string, { title: string; text: string }>
) => {
  const keyRgba = `day_${dayOfCycle}_decade_rgba_${decIdx}`;
  const keyCmyk = `day_${dayOfCycle}_decade_cmyk_${decIdx}`;

  if (cycleType === 'cycle2') {
    // Cykl II: Różaniec do Boga Ojca
    const defaultRgba = getFatherMystery(dayOfCycle, decIdx);
    const customRgba = prayers[keyRgba];
    return {
      rgba: customRgba || defaultRgba,
      cmyk: { title: "Różaniec do Boga Ojca", text: "W tym cyklu rozważamy nieskończoną miłość i opatrzność Boga Ojca na wszystkich paciorkach." }
    };
  }

  // Cykl I or Break: Traditional Rosary (Love / Hate)
  const defaultRgba = getLoveMystery(dayOfCycle, decIdx);
  const defaultCmyk = getHateMystery(dayOfCycle, decIdx);

  const customRgba = prayers[keyRgba];
  const customCmyk = prayers[keyCmyk];

  return {
    rgba: customRgba || defaultRgba,
    cmyk: customCmyk || defaultCmyk
  };
};
