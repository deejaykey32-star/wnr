import { BeadData, PrayerStep } from '../types';
import rhzData from '../../RHZ365_pierwszy_cykl_175_dni.json';

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

export type CycleType = 'cycle1' | 'cycle2' | 'break' | 'break2' | 'life_way' | 'divine_mercy' | 'silent_contemplation';

export interface LifeWayStation {
  stationNumber: number;
  dateStr: string;
  title: string;
  scripture: string;
  defaultText: string;
}

export const LIFE_WAY_STATIONS: LifeWayStation[] = [
  {
    stationNumber: 1,
    dateStr: "18 Czerwca",
    title: "Stacja I — Zwiastowanie Najświętszej Maryi Panny",
    scripture: "(Ewangelia wg św. Łukasza 1, 26–38)",
    defaultText: `Stacja I — Zwiastowanie Najświętszej Maryi Panny\n(Ewangelia wg św. Łukasza 1, 26–38)\n\nAnioł Gabriel został posłany od Boga do Miasta w Galilei, zwanego Nazaret, do Dziewicy poślubionej mężowi, imieniem Józef, z domu Dawida; a Dziewicy było na imię Maryja.\nAnioł wszedł do Niej i rzekł: „Bądź pozdrowiona, pełna łaski, Pan z Tobą”.\n\nRozważanie:\nBoży plan zbawienia rozpoczyna się od cichego, pokornego słowa „TAK” wypowiedzianego przez Maryję. W momencie Zwiastowania Słowo stało się Ciałem i zamieszkało między nami. Droga Życia Jezusa i każdego z nas bierze swój początek z całkowitego zaufania Bożej Opatrzności i przyjęcia Jego woli w codziennym życiu.\n\nModlitwa:\nPanie Jezu, który przyjąłeś ludzkie ciało w łonie Maryi, naucz nas odpowiadać z wiarą na każde Boże wezwanie i nieść Twoją obecność w szarych dniach naszego życia. Amen.`
  },
  {
    stationNumber: 2,
    dateStr: "19 Czerwca",
    title: "Stacja II — Nawiedzenie świętej Elżbiety",
    scripture: "(Ewangelia wg św. Łukasza 1, 39–56)",
    defaultText: `Stacja II — Nawiedzenie świętej Elżbiety\n(Ewangelia wg św. Łukasza 1, 39–56)\n\nW tym czasie Maryja wybrała się i poszła z pośpiechem w góry do pewnego miasta w pokoleniu Judy. Weszła do domu Zachariasza i pozdrowiła Elżbietę.\nGdy Elżbieta usłyszała pozdrowienie Maryi, poruszyło się dzieciątko w jej łonie, a Duch Święty napełnił Elżbietę.\n\nRozważanie:\nMaryja, nosząca pod sercem Zbawiciela, nie zatrzymuje się na sobie. Wyrusza w drogę służby i miłości bratniej do potrzebującej krewnej. Prawdziwa wiara zawsze przynosi pośpiech w czynieniu dobra i budzi w sercu hymn uwielbienia — Magnificat.\n\nModlitwa:\nChryste, spraw, abyśmy tak jak Maryja potrafili dostrzegać potrzeby bliźnich i nieśli im Twoją radość, pokój oraz pomoc. Amen.`
  },
  {
    stationNumber: 3,
    dateStr: "20 Czerwca",
    title: "Stacja III — Narodzenie Jezusa w Betlejem",
    scripture: "(Ewangelia wg św. Łukasza 2, 1–20)",
    defaultText: `Stacja III — Narodzenie Jezusa w Betlejem\n(Ewangelia wg św. Łukasza 2, 1–20)\n\nKiedy tam przebywali, nadszedł dla Maryi czas rozwiązania. Urodziła swego pierworodnego Syna, owinęła Go w pieluszki i położyła w żłobie, gdyż nie było dla nich miejsca w gospodzie.\n\nRozważanie:\nKról Wszechświata przychodzi na świat w cichości, ubóstwie i pokorze stajenki betlejemskiej. Bóg staje się bezbronnym Dziecięciem, aby nikt nie bał się do Niego zbliżyć. W Betlejem objawia się światło, które rozprasza wszelkie mroki grzechu.\n\nModlitwa:\nJezu cichy i pokornego serca, otwórz drzwi naszych serc i domów, aby nigdy nie zabrakło w nich miejsca dla Ciebie i Twojej miłości. Amen.`
  },
  {
    stationNumber: 4,
    dateStr: "21 Czerwca",
    title: "Stacja IV — Ofiarowanie Jezusa w Świątyni",
    scripture: "(Ewangelia wg św. Łukasza 2, 22–38)",
    defaultText: `Stacja IV — Ofiarowanie Jezusa w Świątyni\n(Ewangelia wg św. Łukasza 2, 22–38)\n\nGdy przynieśli Dziecię Jezus do Świątyni, starzec Symeon wziął Go w objęcia i błogosławił Boga mówiąc: „Teraz, o Panie, pozwól odejść Twojemu słudze w pokoju... Bo moje oczy ujrzały Twoje zbawienie”.\n\nRozważanie:\nMaryja i Józef przedstawiają Bogu Najwyższemu najcenniejszy Dar — Jezusa. W świątyni Symeon i Anna rozpoznają Światłość Świata. Ofiarowanie przypomina nam, że wszystko, co posiadamy, jest darem Ojca i winno być oddane na Jego służbę.\n\nModlitwa:\nPanie Jezu, Światło na oświecenie pogan, pomóż nam składać nasze codzienne prace i cierpienia w ofierze czystej Bogu Ojcu. Amen.`
  },
  {
    stationNumber: 5,
    dateStr: "22 Czerwca",
    title: "Stacja V — Ucieczka do Egiptu i Życie w Nazarecie",
    scripture: "(Ewangelia wg św. Mateusza 2, 13–23)",
    defaultText: `Stacja V — Ucieczka do Egiptu i Życie w Nazarecie\n(Ewangelia wg św. Mateusza 2, 13–23)\n\nOto anioł Pański ukazał się Józefowi we śnie i rzekł: „Wstań, weź Dziecię i Jego Matkę i uciekaj do Egiptu; bądź tam, aż ci powiem; albowiem Herod będzie szukał Dziecięcia, aby Je zgładzić”.\n\nRozważanie:\nŚwięta Rodzina doświadcza losu wygnańców i uchodźców, ale pozostaje zjednoczona w wierności Bogu. Lata spędzone w cichym Nazarecie uświęcają codzienną ludzką pracę, milczenie i życie rodzinne.\n\nModlitwa:\nJezu, opiekunie i wzorze rodzin, ochraniaj nasze domy przed niebezpieczeństwami, obdarzaj je pokojem oraz łaską wspólnej modlitwy i pracy. Amen.`
  },
  {
    stationNumber: 6,
    dateStr: "23 Czerwca",
    title: "Stacja VI — Odnalezienie dwunastoletniego Jezusa w Świątyni",
    scripture: "(Ewangelia wg św. Łukasza 2, 41–52)",
    defaultText: `Stacja VI — Odnalezienie dwunastoletniego Jezusa w Świątyni\n(Ewangelia wg św. Łukasza 2, 41–52)\n\nDopiero po trzech dniach odnaleźli Go w świątyni, gdzie siedział między nauczycielami, przysłuchiwał się im i zadawał pytania.\nA Jego Matka rzekła do Niego: „Synu, dlaczego nam to uczyniłeś?” Odpowiedział im: „Czemuście Mnie szukali? Czy nie wiedzieliście, że powinienem być w tym, co należy do mego Ojca?”\n\nRozważanie:\nPoszukiwanie Jezusa przez Maryję i Józefa to obraz duszy poszukującej Boga pośród niepokojów. Jezus przypomina o priorytecie spraw Bożych w naszym życiu i wzywa do ciągłego wzrastania w mądrości.\n\nModlitwa:\nPanie Jezu, daj nam pragnienie nieustannego szukania Ciebie w Słowie Bożym, Sakramentach i w sercach bliźnich. Amen.`
  },
  {
    stationNumber: 7,
    dateStr: "24 Czerwca",
    title: "Stacja VII — Chrzest Jezusa w Jordanie i Początek Posługi",
    scripture: "(Ewangelia wg św. Mateusza 3, 13–17)",
    defaultText: `Stacja VII — Chrzest Jezusa w Jordanie i Początek Posługi\n(Ewangelia wg św. Mateusza 3, 13–17)\n\nA gdy Jezus został ochrzczony, natychmiast wyszedł z wody. A oto otworzyły Mu się niebiosa i ujrzał Ducha Bożego zstępującego jak gołębica i przychodzącego na Niego. A głos z nieba mówił: „Ten jest mój Syn umiłowany, w którym mam upodobanie”.\n\nRozważanie:\nJezus wstępuje w wody Jordanu, solidaryzując się z grzesznym człowiekiem. Głos Ojca z nieba potwierdza Jego Boską godność, a Duch Święty namaszcza Go do wypełnienia misji zbawienia. Chrzest jest bramą naszego nowego życia w Chrystusie.\n\nModlitwa:\nJezu Umiłowany Synu Ojca, odnawiaj w nas łaskę Świętego Chrztu i uzdalniaj nas do odważnego świadczenia o Ewangelii każdego dnia. Amen.`
  },
  {
    stationNumber: 8,
    dateStr: "18 Grudnia",
    title: "Stacja VIII — Cud w Kanie Galilejskiej i Głoszenie Królestwa Bożego",
    scripture: "(Ewangelia wg św. Jana 2, 1–11)",
    defaultText: `Stacja VIII — Cud w Kanie Galilejskiej i Głoszenie Królestwa Bożego\n(Ewangelia wg św. Jana 2, 1–11)\n\nJezus uczynił ten początek znaków w Kanie Galilejskiej. Objawił swoją chwałę i uwierzyli w Niego Jego uczniowie.\nWtedy Matka Jego rzekła do sług: „Zróbcie wszystko, cokolwiek wam powie”.\n\nRozważanie:\nW Kanie Jezus przemienia wodę w wyborne wino, uświęcając małżeństwo i ludzką radość. Słowa Maryi stanowią uniwersalny drogowskaz dla każdego chrześcijanina: całkowite posłuszeństwo Chrystusowi przynosi pełnię Bożych cudów.\n\nModlitwa:\nPanie Jezu, przemieniaj oschłość naszych serc w gorącą miłość, a nasze słabości w moc Twojej łaski. Amen.`
  },
  {
    stationNumber: 9,
    dateStr: "19 Grudnia",
    title: "Stacja IX — Powołanie Uczniów i Kazanie na Górze (Osiem Błogosławieństw)",
    scripture: "(Ewangelia wg św. Mateusza 5, 1–12)",
    defaultText: `Stacja IX — Powołanie Uczniów i Kazanie na Górze\n(Ewangelia wg św. Mateusza 5, 1–12)\n\nJezus widząc tłumy, wstąpił na górę. A gdy usiadł, przystąpili do Niego Jego uczniowie. Otworzył więc swoje usta i nauczał ich mówiąc: „Błogosławieni ubodzy w duchu, albowiem do nich należy królestwo niebieskie...”\n\nRozważanie:\nJezus ogłasza nową konstytucję Bożego Królestwa — Osiem Błogosławieństw. Powołuje zwykłych ludzi, by stali się solą ziemi i światłością świata. Droga Życia to droga cichości, miłosierdzia i czystego serca.\n\nModlitwa:\nNauczycielu i Panie, obdarz nas mądrością żyć według Ewangelii Błogosławieństw i budować Twój pokój pośród świata. Amen.`
  },
  {
    stationNumber: 10,
    dateStr: "20 Grudnia",
    title: "Stacja X — Uzdrowienia, Cuda i Przemienienie na Górze Tabor",
    scripture: "(Ewangelia wg św. Mateusza 17, 1–8)",
    defaultText: `Stacja X — Uzdrowienia, Cuda i Przemienienie na Górze Tabor\n(Ewangelia wg św. Mateusza 17, 1–8)\n\nJezus wziął ze sobą Piotra, Jakuba i brata jego Jana i zaprowadził ich na górę wysoką, osobno. Tam przemienił się wobec nich: twarz Jego zajaśniała jak słońce, odzienie zaś stało się białe jak światło.\n\nRozważanie:\nNa Taborze Jezus ukazuje uczniom blask swojej Boskiej chwały, by umocnić ich wiarę przed nadchodzącą próbą krzyża. Pośród codziennych zmagań Pan daje nam momenty doświadczenia Swojej światłości i uleczenia naszych ran.\n\nModlitwa:\nChryste, Przemieniony Panie, odnawiaj w nas nadzieję życia wiecznego i dodawaj sił w trudnych chwilach ziemskiego pielgrzymowania. Amen.`
  },
  {
    stationNumber: 11,
    dateStr: "21 Grudnia",
    title: "Stacja XI — Wskrzeszenie Łazarza i Zwycięstwo Życia nad Śmiercią",
    scripture: "(Ewangelia wg św. Jana 11, 1–44)",
    defaultText: `Stacja XI — Wskrzeszenie Łazarza\n(Ewangelia wg św. Jana 11, 1–44)\n\nJezus zawołał donośnym głosem: „Łazarzu, wyjdź na zewnątrz!” I wyszedł zmarły, mając nogi i ręce powiązane opaskami, a twarz jego była owinięta chustą.\nJezus rzekł: „Ja jestem zmartwychwstanie i życie. Kto we Mnie wierzy, choćby i umarł, żyć będzie”.\n\nRozważanie:\nWskrzeszenie Łazarza jest zapowiedzią Ostatecznego Zmartwychwstania. Jezus płacze nad grobem przyjaciela, ukazując współczujące serce Boga, a następnie objawia swoją Boską władzę nad śmiercią i otchłanią.\n\nModlitwa:\nJezu, Zmartwychwstanie i Życie, podnoś nas z grzechowych grobów i wlewaj w nasze dusze Twoje nieśmiertelne Życie. Amen.`
  },
  {
    stationNumber: 12,
    dateStr: "22 Grudnia",
    title: "Stacja XII — Namaszczenie w Betanii i Ofiara Miłości",
    scripture: "(Ewangelia wg św. Jana 12, 1–8)",
    defaultText: `Stacja XII — Namaszczenie w Betanii\n(Ewangelia wg św. Jana 12, 1–8)\n\nMaria wzięła funt nardowego oleju wylewanego, bardzo drogocennego, i namaściła stopy Jezusa, a włosami swymi je otarła. A dom napełnił się wonią olejków.\nJezus rzekł: „Zostaw ją! Przechowała to na dzień mego pogrzebu”.\n\nRozważanie:\nGest Marii w Betanii to bezinteresowna, bezgraniczna miłość i uwielbienie dla Pana. Nie liczy kosztów ani osądów innych ludzi. Nasze życie osiąga pełnię sensu, gdy w całości zostaje oddane Chrystusowi.\n\nModlitwa:\nPanie Jezu, przyjmij wonny olejek naszych serc — naszą modlitwę, dziękczynienie i pełne oddanie Twojemu Świętemu Imieniu. Amen.`
  },
  {
    stationNumber: 13,
    dateStr: "23 Grudnia",
    title: "Stacja XIII — Przygotowanie Ostatniej Wieczerzy i Ustanowienie Eucharystii",
    scripture: "(Ewangelia wg św. Łukasza 22, 7–20)",
    defaultText: `Stacja XIII — Przygotowanie Ostatniej Wieczerzy i Ustanowienie Eucharystii\n(Ewangelia wg św. Łukasza 22, 7–20)\n\nJezus wziął chleb, odmówiwszy dziękczynienie połamał go i dał im mówiąc: „To jest Ciało moje, które za was będzie wydane: to czyńcie na moją pamiątkę!”\nTak samo i kielich po wieczerzy, mówiąc: „Ten kielich to Nowe Przymierze we Krwi mojej...”\n\nRozważanie:\nW Wieczerniku Jezus zostawia nam Sakrament Swojej Najświętszej Obecności — Eucharystię i Kapłaństwo. Daje uczniom przykład pokornej służby przez umycie nóg, wzywając nas do wzajemnej miłości aż do darmowego daru z siebie.\n\nModlitwa:\nJezu Chlebie Żywy, daj nam zawsze z czystym i wdzięcznym sercem uczestniczyć we Mszy Świętej i być chlebem dla łaknących braci. Amen.`
  },
  {
    stationNumber: 14,
    dateStr: "24 Grudnia",
    title: "Stacja XIV — Uroczysty Wjazd Jezusa do Jerozolimy (Niedziela Palmowa)",
    scripture: "(Ewangelia wg św. Mateusza 21, 1–11)",
    defaultText: `Stacja XIV — Uroczysty Wjazd Jezusa do Jerozolimy\n(Ewangelia wg św. Mateusza 21, 1–11)\n\nA wielki tłum ścielił swe szaty na drodze, inni obcinali gałązki z drzew i ścielili na drodze.\nA tłumy, które Go poprzedzały i które szły za Nim, wołały głośno: „Hosanna Synowi Dawidowemu! Błogosławiony, który przychodzi w imię Pańskie! Hosanna na wysokościach!”\n\nRozważanie:\nJezus wjeżdża do Świętego Miasta jako Król Pokoju — nie na koniu bojowym, lecz na źrebięciu oślicy. Lud wita Go okrzykiem „Hosanna!”. To ukoronowanie Drogi Życia Jezusa na ziemi i wrota otwierające czas wielkiej Paschy.\n\nModlitwa:\nKrólu Pokoju i Panie Zbawicielu, wjedź uroczyście do naszych serc, bądź naszym jedynym Królem i prowadź nas do wiecznej Jerozolimy w Niebie. Amen.`
  }
];

export const DIVINE_MERCY_DEC_17 = {
  dateStr: "17 Grudnia",
  title: "Koronka do Miłosierdzia Bożego (Dzień 17 Grudnia)",
  scripture: "(Dzienniczek św. Siostry Faustyny Kowalskiej)",
  defaultText: `Koronka do Miłosierdzia Bożego (Dzień 17 Grudnia)\n\nModlitwa podyktowana przez Pana Jezusa św. Siostrze Faustynie w Wilnie w dniach 13–14 września 1935 roku jako modlitwa o przebłaganie i uśmierzenie gniewu Bożego za grzechy całego świata.\n\nStruktura Modlitwy Koronki:\n1. Znak Krzyża Świętego\n2. Modlitwa Wstępna (Ojcze Nasz, Zdrowaś Maryjo, Wierzę w Boga)\n3. Na dużych paciorkach (5 razy):\n   „Ojcze Przedwieczny, ofiaruję Ci Ciało i Krew, Duszę i Bóstwo najmilszego Syna Twojego, a Pana naszego Jezusa Chrystusa, na przebłaganie za grzechy nasze i całego świata.”\n4. Na 10 małych paciorkach (50 razy):\n   „Dla Jego bolesnej męki, miej miłosierdzie dla nas i całego świata.”\n5. Zakończenie (3 razy):\n   „Święty Boże, Święty Mocny, Święty Nieśmiertelny, zmiłuj się nad nami i nad całym światem.”\n6. Modlitwa Końcowa:\n   „O Krew i Wodo, któraś wypłynęła z Najświętszego Serca Jezusowego jako zdrój miłosierdzia dla nas — ufam Tobie!”\n\nRozważanie i Intencja:\nW tym dniu modlimy się o zdanie się na nieskończone Miłosierdzie Boże dla nas, naszych rodzin, Kościoła i całego świata, prosząc o łaskę nawrócenia grzeszników i pokój dla świata.`
};

export const SILENT_CONTEMPLATION_DEC_25 = {
  dateStr: "25 Grudnia",
  title: "Kontemplacja w ciszy (25 Grudnia — Narodzenie Pańskie)",
  scripture: "(Święta Noc Narodzenia Pańskiego)",
  defaultText: `Kontemplacja w ciszy (25 Grudnia — Narodzenie Pańskie)\n\nKontempluj ciszę.\n\nW cichości i świętej nocy Narodzenia Pańskiego zamilknijmy przed Bożą Tajemnicą Wcielenia. Trwamy na cichej adoracji, dziękczynieniu i kontemplacji Bożej Obecności.`
};

// Calculate the cycle details starting from December 25th of the current or previous year
export const getCycleDayInfo = (
  selectedDate: Date,
  options?: { explicitRhzDay?: number; isExplicitRhzRoute?: boolean }
) => {
  const d = new Date(selectedDate);
  d.setHours(12, 0, 0, 0); // avoid timezone shifts
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed: 5 = June, 11 = Dec
  const day = d.getDate();
  
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

  // Direct RHZ365 explicit route or day override (/rhz365-day-X) MUST ALWAYS open RHZ365 Cykl I
  if (options?.explicitRhzDay && options.explicitRhzDay >= 1 && options.explicitRhzDay <= 175) {
    const dayNum = options.explicitRhzDay;
    return {
      dayIndex: dayNum - 1,
      dayOfCycle: dayNum,
      cycleType: 'cycle1' as CycleType,
      cycleName: `Cykl I - Dzień ${dayNum} z 175 (Różaniec Tradycyjny)`,
      startYear,
      endYear: startYear + 1
    };
  }

  if (options?.isExplicitRhzRoute && dayIndex >= 0 && dayIndex < 175) {
    const dayOfCycle = dayIndex + 1;
    return {
      dayIndex,
      dayOfCycle,
      cycleType: 'cycle1' as CycleType,
      cycleName: `Cykl I - Dzień ${dayOfCycle} z 175 (Różaniec Tradycyjny)`,
      startYear,
      endYear: startYear + 1
    };
  }

  // 18 June - 24 June: 7 Stations of Droga Życia (Stations 1 to 7)
  if (month === 5 && day >= 18 && day <= 24) {
    const stationNumber = day - 17; // 1..7
    const st = LIFE_WAY_STATIONS[stationNumber - 1];
    return {
      dayIndex,
      dayOfCycle: stationNumber,
      cycleType: 'life_way' as CycleType,
      stationNumber,
      cycleName: `Droga Życia — ${st.title}`,
      startYear,
      endYear: startYear + 1
    };
  }

  // 17 December: Koronka do Miłosierdzia Bożego (zamiast RHZ365)
  if (month === 11 && day === 17) {
    return {
      dayIndex,
      dayOfCycle: 1,
      cycleType: 'divine_mercy' as CycleType,
      stationNumber: 0,
      cycleName: `Koronka do Miłosierdzia Bożego (17 Grudnia)`,
      startYear,
      endYear: startYear + 1
    };
  }

  // 18 December - 24 December: 7 Stations of Droga Życia (Stations 8 to 14)
  if (month === 11 && day >= 18 && day <= 24) {
    const stationNumber = day - 10; // 18 -> 8, 24 -> 14
    const st = LIFE_WAY_STATIONS[stationNumber - 1];
    return {
      dayIndex,
      dayOfCycle: stationNumber,
      cycleType: 'life_way' as CycleType,
      stationNumber,
      cycleName: `Droga Życia — ${st.title}`,
      startYear,
      endYear: startYear + 1
    };
  }
  
  let cycleType: CycleType = 'cycle1';
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

// Authentic RHZ365 Record retriever for Cykl I (RGBA)
export const getLoveMystery = (dayNum: number, decIdx?: number) => {
  const jsonRecord = (rhzData as any[]).find(r => r.dayNumber === dayNum) || rhzData[(dayNum - 1) % rhzData.length];
  if (jsonRecord) {
    return {
      title: jsonRecord.title,
      text: jsonRecord.text
    };
  }
  return {
    title: `RHZ365 — Dzień ${dayNum}`,
    text: `Rozważanie RHZ365.`
  };
};

// Algorithmic generator for Cykl I Pokuta / Hate Contemplations (CMYK)
export const getHateMystery = (dayNum: number, decIdx?: number) => {
  return getLoveMystery(dayNum, decIdx);
};

// Algorithmic generator for Cykl II Father Mysteries (Bóg Ojciec)
export const getFatherMystery = (dayNum: number, decIdx?: number) => {
  return getLoveMystery(dayNum, decIdx);
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
export const getPrayerSteps = (
  cycleType: CycleType,
  dayOfCycle: number,
  prayers: Record<string, { title: string; text: string }> = {}
): PrayerStep[] => {
  const steps: PrayerStep[] = [];
  const rgbaBeads = getRGBABeads();
  const cmykBeads = getCMYKBeads();

  const getRGBAId = (idx: number) => rgbaBeads[idx]?.id || '';
  const getCMYKId = (idx: number) => cmykBeads[idx]?.id || '';

  if (cycleType === 'life_way') {
    const stationNumber = (dayOfCycle >= 1 && dayOfCycle <= 14) ? dayOfCycle : 1;
    const st = LIFE_WAY_STATIONS[stationNumber - 1] || LIFE_WAY_STATIONS[0];

    // Step 0: Sign of the Cross
    steps.push({
      id: 'step-sign-1',
      label: "Rozpoczęcie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    // Step 1: Apostles' Creed on Cross
    steps.push({
      id: 'step-creed',
      label: "Krzyż — Skład Apostolski (Wierzę w Boga)",
      beadIndex: 0,
      prayerType: 'creed',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    // Step 2: Main Station Bead
    steps.push({
      id: `step-station-${stationNumber}`,
      label: `Stacja ${stationNumber}/14 Drogi Życia — ${st.title}`,
      beadIndex: 1,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(1),
      cmykBeadId: getCMYKId(1),
      decadeIndex: 1
    });

    // Step 3: Our Father
    steps.push({
      id: 'step-station-father',
      label: "Paciorek 2 — Ojcze Nasz (W intencjach Papieża i Kościoła)",
      beadIndex: 2,
      prayerType: 'ourFather',
      rgbaBeadId: getRGBAId(2),
      cmykBeadId: getCMYKId(2)
    });

    // Steps 4, 5, 6: Hail Marys
    steps.push({
      id: 'step-station-hailmary-1',
      label: "Paciorek 3 — Zdrowaś Maryjo (O Wiarę)",
      beadIndex: 3,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(3),
      cmykBeadId: getCMYKId(3)
    });
    steps.push({
      id: 'step-station-hailmary-2',
      label: "Paciorek 4 — Zdrowaś Maryjo (O Nadzieję)",
      beadIndex: 4,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(4),
      cmykBeadId: getCMYKId(4)
    });
    steps.push({
      id: 'step-station-hailmary-3',
      label: "Paciorek 5 — Zdrowaś Maryjo (O Miłość)",
      beadIndex: 5,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(5),
      cmykBeadId: getCMYKId(5)
    });

    // Step 7: Glory Be & Praise
    steps.push({
      id: 'step-station-glory',
      label: "Łącznik — Uwielbienie Drogi Życia & Chwała Ojcu",
      beadIndex: 6,
      prayerType: 'gloryBe',
      rgbaBeadId: getRGBAId(6),
      cmykBeadId: getCMYKId(6)
    });

    // Step 8: Final Sign of Cross
    steps.push({
      id: 'step-final-sign',
      label: "Zakończenie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    return steps;
  }

  if (cycleType === 'divine_mercy') {
    // Koronka do Miłosierdzia Bożego steps
    steps.push({
      id: 'step-sign-1',
      label: "Rozpoczęcie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    steps.push({
      id: 'step-mercy-father',
      label: "Paciorek 1 — Ojcze Nasz",
      beadIndex: 1,
      prayerType: 'ourFather',
      rgbaBeadId: getRGBAId(1),
      cmykBeadId: getCMYKId(1)
    });

    steps.push({
      id: 'step-mercy-hailmary',
      label: "Paciorek 2 — Zdrowaś Maryjo",
      beadIndex: 2,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(2),
      cmykBeadId: getCMYKId(2)
    });

    steps.push({
      id: 'step-mercy-creed',
      label: "Paciorek 3 — Skład Apostolski (Wierzę w Boga)",
      beadIndex: 3,
      prayerType: 'creed',
      rgbaBeadId: getRGBAId(3),
      cmykBeadId: getCMYKId(3)
    });

    // Duży paciorek: Ojcze Przedwieczny...
    steps.push({
      id: 'step-mercy-eternal-father',
      label: "Duży Paciorek — Ojcze Przedwieczny, ofiaruję Ci Ciało i Krew...",
      beadIndex: 6,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(6),
      cmykBeadId: getCMYKId(6)
    });

    // 10 Małych paciorków: Dla Jego bolesnej męki...
    for (let m = 1; m <= 10; m++) {
      steps.push({
        id: `step-mercy-passion-${m}`,
        label: `Dziesiątek Koronki (${m}/10) — Dla Jego bolesnej męki...`,
        beadIndex: 6 + m,
        prayerType: 'hailMary',
        rgbaBeadId: getRGBAId(6 + m),
        cmykBeadId: getCMYKId(6 + m)
      });
    }

    // Święty Boże (3x)
    steps.push({
      id: 'step-mercy-holy-god',
      label: "Zakończenie — Święty Boże, Święty Mocny, Święty Nieśmiertelny... (3x)",
      beadIndex: 17,
      prayerType: 'gloryBe',
      rgbaBeadId: getRGBAId(17),
      cmykBeadId: getCMYKId(17)
    });

    steps.push({
      id: 'step-final-sign',
      label: "Zakończenie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    return steps;
  }

  if (cycleType === 'silent_contemplation') {
    steps.push({
      id: 'step-sign-1',
      label: "Rozpoczęcie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    steps.push({
      id: 'step-creed',
      label: "Krzyż — Skład Apostolski (Wierzę w Boga)",
      beadIndex: 0,
      prayerType: 'creed',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    steps.push({
      id: 'step-silence-main',
      label: "25 Grudnia — Kontemplacja w ciszy",
      beadIndex: 1,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(1),
      cmykBeadId: getCMYKId(1),
      decadeIndex: 1
    });

    steps.push({
      id: 'step-silence-father',
      label: "Paciorek 2 — Ojcze Nasz",
      beadIndex: 2,
      prayerType: 'ourFather',
      rgbaBeadId: getRGBAId(2),
      cmykBeadId: getCMYKId(2)
    });

    steps.push({
      id: 'step-silence-hailmary-1',
      label: "Paciorek 3 — Zdrowaś Maryjo (O Wiarę)",
      beadIndex: 3,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(3),
      cmykBeadId: getCMYKId(3)
    });
    steps.push({
      id: 'step-silence-hailmary-2',
      label: "Paciorek 4 — Zdrowaś Maryjo (O Nadzieję)",
      beadIndex: 4,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(4),
      cmykBeadId: getCMYKId(4)
    });
    steps.push({
      id: 'step-silence-hailmary-3',
      label: "Paciorek 5 — Zdrowaś Maryjo (O Miłość)",
      beadIndex: 5,
      prayerType: 'hailMary',
      rgbaBeadId: getRGBAId(5),
      cmykBeadId: getCMYKId(5)
    });

    steps.push({
      id: 'step-silence-glory',
      label: "Łącznik — Uwielbienie w ciszy & Chwała Ojcu",
      beadIndex: 6,
      prayerType: 'gloryBe',
      rgbaBeadId: getRGBAId(6),
      cmykBeadId: getCMYKId(6)
    });

    steps.push({
      id: 'step-final-sign',
      label: "Zakończenie — W imię Ojca...",
      beadIndex: 0,
      prayerType: 'signOfCross',
      rgbaBeadId: getRGBAId(0),
      cmykBeadId: getCMYKId(0)
    });

    return steps;
  }

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

  // Only generate the single active decade for this day
  const d = activeDecadeNum - 1; // 0-indexed
  const { start, sep } = decadeBeadIndices[d];
  const decNum = activeDecadeNum;
  const triggerBeadIdx = d === 0 ? 6 : decadeBeadIndices[d - 1].sep;

  if (cycleType === 'cycle2') {
    // CYKL II: Różaniec do Boga Ojca — jeden dziesiątek na dzień
    steps.push({
      id: `step-mystery-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Rozważanie i Zdrowaś Maryjo (Duży Paciorek)`,
      beadIndex: triggerBeadIdx,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

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
    // CYKL I (lub Dni Przerwy): Różaniec Tradycyjny — jeden dziesiątek na dzień
    steps.push({
      id: `step-mystery-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Rozważanie`,
      beadIndex: triggerBeadIdx,
      prayerType: 'mystery',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

    steps.push({
      id: `step-father-dec-${decNum}`,
      label: `Tajemnica ${decNum} — Ojcze Nasz`,
      beadIndex: triggerBeadIdx,
      prayerType: 'ourFather',
      rgbaBeadId: getRGBAId(triggerBeadIdx),
      cmykBeadId: getCMYKId(triggerBeadIdx),
      decadeIndex: decNum
    });

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

  steps.push({
    id: 'step-hail-queen',
    label: "Zakończenie — Pod Twoją obronę",
    beadIndex: 6,
    prayerType: 'hailQueen',
    rgbaBeadId: getRGBAId(6),
    cmykBeadId: getCMYKId(6)
  });

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
  cycleType: CycleType,
  dayOfCycle: number,
  decIdx: number,
  prayers: Record<string, { title: string; text: string }>
) => {
  if (cycleType === 'life_way') {
    const stationNumber = (dayOfCycle >= 1 && dayOfCycle <= 14) ? dayOfCycle : 1;
    const defaultSt = LIFE_WAY_STATIONS[stationNumber - 1] || LIFE_WAY_STATIONS[0];
    const key = `life_way_station_${stationNumber}`;
    const custom = prayers[key] || prayers[`day_${dayOfCycle}_station_${stationNumber}`];

    return {
      rgba: custom || { title: defaultSt.title, text: defaultSt.defaultText },
      cmyk: { title: "Droga Życia", text: defaultSt.defaultText }
    };
  }

  if (cycleType === 'divine_mercy') {
    const key = `divine_mercy_dec_17`;
    const custom = prayers[key] || prayers[`day_357_divine_mercy`];
    return {
      rgba: custom || { title: DIVINE_MERCY_DEC_17.title, text: DIVINE_MERCY_DEC_17.defaultText },
      cmyk: { title: "Koronka do Miłosierdzia Bożego", text: DIVINE_MERCY_DEC_17.defaultText }
    };
  }

  if (cycleType === 'silent_contemplation') {
    const key = `silent_contemplation_dec_25`;
    const custom = prayers[key];
    return {
      rgba: custom || { title: SILENT_CONTEMPLATION_DEC_25.title, text: SILENT_CONTEMPLATION_DEC_25.defaultText },
      cmyk: { title: "Kontemplacja w ciszy", text: SILENT_CONTEMPLATION_DEC_25.defaultText }
    };
  }

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
