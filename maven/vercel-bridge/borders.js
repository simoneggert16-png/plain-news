/**
 * Country borders (Natural Earth 1:10m + exact Swisstopo St. Galler Rheintal /
 * Alter Rhein / Diepoldsau / Liechtenstein / Bodensee boundary).
 */

const URL_10M =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_land.geojson';
const URL_50M =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_boundary_lines_land.geojson';
const CACHE_MS = 24 * 60 * 60 * 1000;

/** @type {{at:number, body:object|null}} */
const cache = { at: 0, body: null };

/**
 * Exact Swiss–Austrian (CH–AT) border in the St. Galler Rheintal from Sennwald /
 * Rüthi / Oberriet / Kriessern around the Alter Rhein loop of Diepoldsau (against
 * Hohenems & Lustenau), past Widnau, Au, St. Margrethen and Rheineck into the
 * Bodensee (Altenrhein).
 */
const EXACT_RHEINTAL_CH_AT_BORDER = [
  [9.5322, 47.2698], // Bangs / Rüthi (Illspitz CH-AT-LI tripoint)
  [9.5418, 47.2835], // Rüthi / Meiningen (Rhein)
  [9.5554, 47.2995], // Oberriet / Meiningen
  [9.5665, 47.3175], // Oberriet / Koblach
  [9.5782, 47.3338], // Kriessern / Mäder (Rhein)
  [9.5898, 47.3492], // Kriessern / Mäder – Beginn Alter Rhein Süd (Diepoldsau)
  [9.6025, 47.3522], // Alter Rhein Südostbogen (Diepoldsau / Koblach)
  [9.6195, 47.3555], // Alter Rhein (Diepoldsau / Hohenems Zoll)
  [9.6368, 47.3612], // Alter Rhein Ostbogen (Diepoldsau / Hohenems)
  [9.6512, 47.3688], // Alter Rhein (Diepoldsau / Hohenems-Bauern)
  [9.6625, 47.3765], // Alter Rhein Ostspitze (Diepoldsau / Hohenems)
  [9.6682, 47.3848], // Alter Rhein (Diepoldsau-Schmitter / Lustenau)
  [9.6665, 47.3925], // Schmitter / Lustenau (Schmitterbrücke)
  [9.6612, 47.3992], // Schmitter / Lustenau
  [9.6548, 47.4048], // Widnau / Lustenau (Wiesenrainbrücke / Rhein)
  [9.6478, 47.4125], // Widnau-Au / Lustenau (Neuer Rhein)
  [9.6462, 47.4215], // Au SG / Lustenau (Zollbrücke Au–Lustenau)
  [9.6502, 47.4312], // Au-Monstein / Lustenau
  [9.6585, 47.4418], // St. Margrethen / Höchst (Zoll St. Margrethen)
  [9.6495, 47.4488], // St. Margrethen / Bruggerhorn (Alter Rhein Nord)
  [9.6345, 47.4545], // St. Margrethen / Höchst (Eselschwanz)
  [9.6145, 47.4608], // Walzenhausen-Lachen / Gaissau
  [9.5912, 47.4675], // Rheineck / Gaissau
  [9.5795, 47.4792], // Altenrhein / Gaissau
  [9.5665, 47.4925], // Altenrhein Mündung in den Bodensee
];

/**
 * Exact Fürstentum Liechtenstein (CH–LI–AT) boundary loop from Illspitz (Bangs/Rüthi)
 * south along the Rhine (Sennwald, Buchs, Sevelen, Trübbach/Balzers) and east/north
 * along the Rätikon ridge (Naafkopf, Malbun, Schaanwald/Tisis) back to Illspitz.
 */
const EXACT_LIECHTENSTEIN_BORDER = [
  [9.5322, 47.2698], // Illspitz (Dreiländereck CH–FL–AT, Rüthi / Bangs / Ruggell)
  [9.5245, 47.2535], // Rhein Ruggell / Sennwald
  [9.5152, 47.2348], // Rhein Gamprin-Bendern / Haag SG
  [9.4988, 47.2115], // Rhein Eschen / Salez
  [9.4895, 47.1855], // Rhein Schaan / Buchs SG
  [9.4978, 47.1658], // Rhein Vaduz / Buchs-Räfis
  [9.5065, 47.1412], // Rhein Vaduz / Sevelen
  [9.5112, 47.1155], // Rhein Triesen / Wartau
  [9.4955, 47.0885], // Rhein Balzers / Trübbach
  [9.4765, 47.0652], // Rhein Balzers / Fläsch (Südspitze FL–CH)
  [9.5218, 47.0545], // Falknis / Fläscherberg (FL–GR)
  [9.5612, 47.0588], // Mazorakopf
  [9.6075, 47.0608], // Naafkopf (Dreiländereck CH–FL–AT, 2570 m)
  [9.6248, 47.0882], // Ochsenkopf / Sareiserjoch (Malbun / Nenzinger Himmel)
  [9.6195, 47.1245], // Mattlerjoch / Guschgfiel
  [9.5882, 47.1635], // Drei Schwestern / Frastanz
  [9.5745, 47.1945], // Schaanwald / Tisis (Zollamt Schaanwald–Feldkirch)
  [9.5592, 47.2155], // Mauren / Tosters (Eschnerberg)
  [9.5468, 47.2395], // Schellenberg / Nofels
  [9.5322, 47.2698], // Illspitz (Dreiländereck CH–FL–AT)
];

const BORDER_CROSSINGS = [
  // --- St. Galler Rheintal / Vorarlberg / Liechtenstein (DACH Core) ---
  {
    id: 'crossing-au-lustenau',
    name: 'Grenzübergang Au SG – Lustenau (Rheinbrücke)',
    countries: 'CH ↔ AT',
    corridor: 'St. Galler Rheintal / Vorarlberg (L203 / H13)',
    lat: 47.4215,
    lon: 9.6462,
    lanes: 'PKW / Bus / LKW (Zollamt Au / Lustenau)',
    peakWaitMin: 18,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG & Zollamt Österreich',
  },
  {
    id: 'crossing-widnau-wiesenrain',
    name: 'Grenzübergang Widnau – Lustenau (Wiesenrainbrücke)',
    countries: 'CH ↔ AT',
    corridor: 'Widnau / Lustenau Süd (Pendlerkorridor)',
    lat: 47.4048,
    lon: 9.6548,
    lanes: 'PKW bis 3.5t / Fahrrad / Fussgänger (05:00–23:00)',
    peakWaitMin: 16,
    baseWaitMin: 2,
    regime: 'Schengen / Pendlerübergang',
  },
  {
    id: 'crossing-schmitter-lustenau',
    name: 'Grenzübergang Diepoldsau-Schmitter – Lustenau (Schmitterbrücke)',
    countries: 'CH ↔ AT',
    corridor: 'Diepoldsau-Schmitter / Lustenau (Alter Rhein)',
    lat: 47.3925,
    lon: 9.6665,
    lanes: 'Lokaler Grenzverkehr / Veloroute Rheintal',
    peakWaitMin: 8,
    baseWaitMin: 1,
    regime: 'Schengen / Nebenübergang',
  },
  {
    id: 'crossing-diepoldsau-hohenems',
    name: 'Grenzübergang Diepoldsau – Hohenems (Zollamt Alter Rhein)',
    countries: 'CH ↔ AT',
    corridor: 'Diepoldsau / Hohenems (L46 / A14 Anschluss)',
    lat: 47.3555,
    lon: 9.6195,
    lanes: 'PKW / LKW-Abfertigung / Bus',
    peakWaitMin: 15,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Zollamt Österreich',
  },
  {
    id: 'crossing-kriessern-maeder',
    name: 'Grenzübergang Kriessern – Mäder (Rheinbrücke)',
    countries: 'CH ↔ AT',
    corridor: 'Oberriet-Kriessern / Mäder (A13 ↔ L55)',
    lat: 47.3338,
    lon: 9.5782,
    lanes: 'PKW / Schwerverkehr / Pendler',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-oberriet-meiningen',
    name: 'Grenzübergang Oberriet – Meiningen (Rheinbrücke)',
    countries: 'CH ↔ AT',
    corridor: 'Oberriet SG / Meiningen-Feldkirch (L53)',
    lat: 47.2995,
    lon: 9.5554,
    lanes: 'PKW / Regionalverkehr',
    peakWaitMin: 11,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-ruethi-bangs',
    name: 'Grenzübergang Rüthi SG – Feldkirch-Bangs (Illspitz)',
    countries: 'CH ↔ AT',
    corridor: 'Rüthi / Bangs (Dreiländereck CH–AT–LI)',
    lat: 47.2718,
    lon: 9.5355,
    lanes: 'PKW / Regionalverkehr',
    peakWaitMin: 9,
    baseWaitMin: 1,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-st-margrethen-hoechst',
    name: 'Hauptzollamt St. Margrethen – Höchst',
    countries: 'CH ↔ AT',
    corridor: 'A1 / A13 St. Margrethen ↔ L202 Höchst / Bregenz',
    lat: 47.4418,
    lon: 9.6585,
    lanes: 'PKW / Internationaler Schwerverkehr (TIR / LKW-Terminal)',
    peakWaitMin: 24,
    baseWaitMin: 5,
    regime: 'Schengen / BAZG Hauptzollamt',
  },
  {
    id: 'crossing-rheineck-gaissau',
    name: 'Grenzübergang Rheineck – Gaissau (Alter Rhein)',
    countries: 'CH ↔ AT',
    corridor: 'Rheineck / Gaissau-Bodensee',
    lat: 47.4675,
    lon: 9.5912,
    lanes: 'PKW / Fussgänger / Radverkehr',
    peakWaitMin: 10,
    baseWaitMin: 1,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-schaanwald-tisis',
    name: 'Hauptzollamt Schaanwald – Feldkirch-Tisis',
    countries: 'LI (CH-Zollgebiet) ↔ AT',
    corridor: 'Schaan–Schaanwald ↔ Feldkirch (B191)',
    lat: 47.1945,
    lon: 9.5745,
    lanes: 'PKW / LKW / Bus (Hauptkorridor Liechtenstein–Vorarlberg)',
    peakWaitMin: 22,
    baseWaitMin: 4,
    regime: 'BAZG (Zollvertrag CH–FL) & Zollamt Österreich',
  },
  {
    id: 'crossing-ruggell-nofels',
    name: 'Grenzübergang Ruggell – Feldkirch-Nofels',
    countries: 'LI ↔ AT',
    corridor: 'Unterland Liechtenstein / Feldkirch-Nofels',
    lat: 47.2412,
    lon: 9.5442,
    lanes: 'PKW / Pendlerkorridor',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'BAZG / Zollamt Österreich',
  },
  {
    id: 'crossing-buchs-schaan',
    name: 'Rheinbrücke Buchs SG – Schaan (Zollunion CH–LI)',
    countries: 'CH ↔ LI',
    corridor: 'A13 Buchs SG ↔ Schaan / Vaduz',
    lat: 47.1705,
    lon: 9.4938,
    lanes: 'Offene Zollgrenze (Zollunion Schweiz–Liechtenstein seit 1924)',
    peakWaitMin: 6,
    baseWaitMin: 0,
    regime: 'Offene Binnengrenze CH–FL',
  },
  {
    id: 'crossing-haag-bendern',
    name: 'Rheinbrücke Haag SG – Gamprin-Bendern',
    countries: 'CH ↔ LI',
    corridor: 'A13 Haag / Sennwald ↔ Bendern / Eschen',
    lat: 47.2122,
    lon: 9.5015,
    lanes: 'Offene Zollgrenze (Pendlerachse Werdenberg–Liechtenstein)',
    peakWaitMin: 8,
    baseWaitMin: 0,
    regime: 'Offene Binnengrenze CH–FL',
  },
  // --- Weitere Schweizer Hauptgrenzübergänge (CH ↔ DE / FR / IT / AT) ---
  {
    id: 'crossing-basel-weil',
    name: 'Autobahnzoll Basel – Weil am Rhein (A2 / A5)',
    countries: 'CH ↔ DE',
    corridor: 'Nord-Süd-Hauptachse A2 (Basel) ↔ A5 (Baden-Württemberg)',
    lat: 47.5882,
    lon: 7.6062,
    lanes: 'PKW (6 Spuren) / LKW-Zollanlage / Grenzkontrolle Bundespolizei',
    peakWaitMin: 28,
    baseWaitMin: 6,
    regime: 'Schengen + Temporäre Binnengrenzkontrollen DE / BAZG',
  },
  {
    id: 'crossing-basel-st-louis',
    name: 'Autobahnzoll Basel – Saint-Louis (A3 / A35)',
    countries: 'CH ↔ FR',
    corridor: 'Basel-St. Johann ↔ Elsass / EuroAirport (A35)',
    lat: 47.5742,
    lon: 7.5578,
    lanes: 'PKW / LKW / Grenzgänger Elsass–Basel',
    peakWaitMin: 20,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG & Douane Française',
  },
  {
    id: 'crossing-rheinfelden',
    name: 'Autobahnzoll Rheinfelden (A3 / A861)',
    countries: 'CH ↔ DE',
    corridor: 'Hochrhein A3 (Aargau) ↔ A98/A861 (Südbaden)',
    lat: 47.5625,
    lon: 7.7712,
    lanes: 'PKW / LKW-Abfertigung',
    peakWaitMin: 16,
    baseWaitMin: 3,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-koblenz-waldshut',
    name: 'Grenzübergang Koblenz AG – Waldshut (Rheinbrücke)',
    countries: 'CH ↔ DE',
    corridor: 'B5 / B34 Hochrhein',
    lat: 47.6095,
    lon: 8.2348,
    lanes: 'PKW / Bus / LKW',
    peakWaitMin: 15,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG & Zoll DE',
  },
  {
    id: 'crossing-bargen-neuhaus',
    name: 'Grenzübergang Bargen SH – Neuhaus am Randen (A4 / B27)',
    countries: 'CH ↔ DE',
    corridor: 'Schaffhausen–Stuttgart (A4 / B27 / A81)',
    lat: 47.7985,
    lon: 8.5872,
    lanes: 'PKW / LKW',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Bundespolizei DE',
  },
  {
    id: 'crossing-thaingen-bietingen',
    name: 'Autobahnzoll Thayngen – Bietingen (A4 / E41)',
    countries: 'CH ↔ DE',
    corridor: 'Zürich / Schaffhausen ↔ Singen / Stuttgart (A81)',
    lat: 47.7522,
    lon: 8.7295,
    lanes: 'PKW / LKW-Hauptabfertigung Nordostschweiz',
    peakWaitMin: 24,
    baseWaitMin: 5,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-kreuzlingen-konstanz',
    name: 'Autobahnzoll Kreuzlingen – Konstanz (A7 / B33)',
    countries: 'CH ↔ DE',
    corridor: 'Thurgau A7 ↔ Konstanz / Bodensee',
    lat: 47.6562,
    lon: 9.1688,
    lanes: 'PKW / LKW-Terminal',
    peakWaitMin: 22,
    baseWaitMin: 4,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-martina-nauders',
    name: 'Grenzübergang Martina GR – Pfunds/Nauders (Unterengadin)',
    countries: 'CH ↔ AT',
    corridor: 'Engadin H27 ↔ Reschenpass B180 (CH–AT–IT)',
    lat: 46.8855,
    lon: 10.4648,
    lanes: 'PKW / Reisebusse / Alpentourismus',
    peakWaitMin: 10,
    baseWaitMin: 1,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-chiasso-brogeda',
    name: 'Autobahnzoll Chiasso-Brogeda – Como (A2 / A9)',
    countries: 'CH ↔ IT',
    corridor: 'Gotthard-Südportal A2 (Tessin) ↔ Mailand A9',
    lat: 45.8342,
    lon: 9.0355,
    lanes: 'PKW / Internationaler Alpentransit (TIR / Schwerverkehr)',
    peakWaitMin: 32,
    baseWaitMin: 7,
    regime: 'Schengen / BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-gondo-isella',
    name: 'Grenzübergang Gondo VS – Iselle (Simplonpass A9 / SS33)',
    countries: 'CH ↔ IT',
    corridor: 'Wallis (Brig / Simplon) ↔ Domodossola / Piemont',
    lat: 46.1972,
    lon: 8.1518,
    lanes: 'PKW / LKW-Alpentransit',
    peakWaitMin: 12,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG',
  },
  {
    id: 'crossing-grand-st-bernard',
    name: 'Tunnel du Grand-Saint-Bernard (VS ↔ Aostatal)',
    countries: 'CH ↔ IT',
    corridor: 'Martigny (E27) ↔ Aosta',
    lat: 45.8688,
    lon: 7.1712,
    lanes: 'PKW / LKW (Straßentunnel)',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Dogana IT',
  },
  {
    id: 'crossing-bardonnex-st-julien',
    name: 'Douane de Bardonnex – Saint-Julien-en-Genevois (A1 / A41)',
    countries: 'CH ↔ FR',
    corridor: 'Genf (A1) ↔ Annecy / Lyon / Chamonix (A40/A41)',
    lat: 46.1445,
    lon: 6.1025,
    lanes: 'PKW (Frontaliers) / LKW-Terminal',
    peakWaitMin: 26,
    baseWaitMin: 5,
    regime: 'Schengen / BAZG & Douane Française',
  },
  // --- Zentraleuropäische & Globale Strategische Grenzübergänge ---
  {
    id: 'crossing-lindau-hoerbranz',
    name: 'Grenzübergang Lindau – Hörbranz (A96 / A14 Pfändertunnel)',
    countries: 'DE ↔ AT',
    corridor: 'München / Allgäu (A96) ↔ Vorarlberg / Rheintal (A14)',
    lat: 47.5568,
    lon: 9.7425,
    lanes: 'PKW / LKW-Transitkorridor Bodensee–Rheintal',
    peakWaitMin: 20,
    baseWaitMin: 3,
    regime: 'Schengen + Grenzkontrolle Bundespolizei DE',
  },
  {
    id: 'crossing-kiefersfelden-kufstein',
    name: 'Autobahngrenzübergang Kiefersfelden – Kufstein (A93 / A12 Inntal)',
    countries: 'DE ↔ AT',
    corridor: 'München ↔ Innsbruck / Brenner-Nordzulauf',
    lat: 47.6075,
    lon: 12.1852,
    lanes: 'PKW / LKW-Blockabfertigung Tirol',
    peakWaitMin: 35,
    baseWaitMin: 6,
    regime: 'Schengen + Grenzkontrolle DE & LKW-Dosierung AT',
  },
  {
    id: 'crossing-walserberg-salzburg',
    name: 'Autobahngrenzübergang Walserberg – Salzburg (A8 / A1)',
    countries: 'DE ↔ AT',
    corridor: 'München (A8) ↔ Salzburg / Wien / Tauernautobahn',
    lat: 47.7815,
    lon: 12.9462,
    lanes: 'PKW / LKW (Kontrollstelle Bundespolizei)',
    peakWaitMin: 30,
    baseWaitMin: 5,
    regime: 'Schengen + Permanente Grenzkontrolle DE',
  },
  {
    id: 'crossing-suben-passau',
    name: 'Autobahngrenzübergang Suben – Passau (A3 / A8)',
    countries: 'DE ↔ AT',
    corridor: 'Nürnberg/Regensburg (A3) ↔ Linz/Wien (A8)',
    lat: 48.4312,
    lon: 13.4185,
    lanes: 'PKW / Haupt-LKW-Achse Südosteuropa',
    peakWaitMin: 28,
    baseWaitMin: 5,
    regime: 'Schengen + Grenzkontrolle Bundespolizei DE',
  },
  {
    id: 'crossing-brennerpass',
    name: 'Brennerpass / Passo del Brennero (A13 / A22)',
    countries: 'AT ↔ IT',
    corridor: 'Innsbruck (A13) ↔ Südtirol / Verona (A22)',
    lat: 47.0025,
    lon: 11.5062,
    lanes: 'PKW / Wichtigster Alpentransitkorridor für LKW & RoLa',
    peakWaitMin: 26,
    baseWaitMin: 4,
    regime: 'Schengen / LKW-Nachtfahrverbot & Dosiersystem',
  },
  {
    id: 'crossing-nickelsdorf-hegyeshalom',
    name: 'Grenzübergang Nickelsdorf – Hegyeshalom (A4 / M1)',
    countries: 'AT ↔ HU',
    corridor: 'Wien (A4) ↔ Budapest (M1)',
    lat: 47.9255,
    lon: 17.1105,
    lanes: 'PKW / LKW / Bundesheer-Assistenzeinsatz',
    peakWaitMin: 25,
    baseWaitMin: 5,
    regime: 'Schengen + Grenzkontrolle AT',
  },
  {
    id: 'crossing-frankfurt-oder-swiecko',
    name: 'Autobahngrenzübergang Frankfurt (Oder) – Świecko (A12 / A2)',
    countries: 'DE ↔ PL',
    corridor: 'Berlin (A12) ↔ Poznań / Warschau (A2)',
    lat: 52.3095,
    lon: 14.5968,
    lanes: 'PKW / Ost-West-LKW-Hauptkorridor',
    peakWaitMin: 28,
    baseWaitMin: 5,
    regime: 'Schengen + Grenzkontrolle Bundespolizei DE',
  },
  {
    id: 'crossing-medyka-shehyni',
    name: 'EU-Außengrenze Medyka – Schehyni / Korczowa – Krakovets',
    countries: 'PL ↔ UA',
    corridor: 'Rzeszów / Przemyśl (A4) ↔ Lwiw / Kiew (M10)',
    lat: 49.7985,
    lon: 22.9482,
    lanes: 'PKW / Humanitärer & Militärlogistik-Korridor / LKW',
    peakWaitMin: 95,
    baseWaitMin: 35,
    regime: 'EU/Schengen-Außengrenze (Frontex / Straż Graniczna / DPSU)',
  },
  {
    id: 'crossing-terespol-brest',
    name: 'EU/NATO-Außengrenze Kukuryki / Terespol – Brest',
    countries: 'PL ↔ BY',
    corridor: 'Warschau (E30) ↔ Brest / Minsk',
    lat: 52.0785,
    lon: 23.6052,
    lanes: 'Stark restringierter Güter- und Personenverkehr (Sanktionsregime)',
    peakWaitMin: 180,
    baseWaitMin: 90,
    regime: 'Befestigte EU/NATO-Ostflanke (Electronic Barrier)',
  },
  {
    id: 'crossing-narva-ivangorod',
    name: 'NATO-Außengrenze Narva – Iwangorod (Brücke der Freundschaft)',
    countries: 'EE ↔ RU',
    corridor: 'Tallinn (E20) ↔ Sankt Petersburg',
    lat: 59.3765,
    lon: 28.2042,
    lanes: 'Nur Fussgänger (Fahrzeugspur durch Russland/Estland gesperrt)',
    peakWaitMin: 120,
    baseWaitMin: 45,
    regime: 'NATO/EU-Außengrenze (PPA Estland / FSB Grenzschutz)',
  },
  {
    id: 'crossing-kapikule-kapitan-andreevo',
    name: 'Grenzübergang Kapıkule – Kapitan Andreevo (E80)',
    countries: 'TR ↔ BG',
    corridor: 'Istanbul / Edirne ↔ Sofia / Mitteleuropa (Größter Landzoll Europas)',
    lat: 41.7165,
    lon: 26.3525,
    lanes: 'PKW / Groß-LKW-Terminal (Europa–Nahost)',
    peakWaitMin: 110,
    baseWaitMin: 40,
    regime: 'EU-Außengrenze Bulgarien / Türkei',
  },
  {
    id: 'crossing-dover-calais',
    name: 'Eurotunnel & Port of Dover – Calais',
    countries: 'GB ↔ FR',
    corridor: 'M20 Folkestone/Dover ↔ A16 Calais (Ärmelkanal)',
    lat: 51.1185,
    lon: 1.3225,
    lanes: 'Juxtaposed Controls (UK Border Force & PAF France / EES)',
    peakWaitMin: 45,
    baseWaitMin: 15,
    regime: 'UK–Schengen Außengrenze (Post-Brexit Zoll & Biometrie)',
  },
  {
    id: 'crossing-rafah',
    name: 'Grenzübergang Rafah & Kerem Shalom (Philadelphi-Korridor)',
    countries: 'EG / IL ↔ Gaza',
    corridor: 'Nordsinai (Al-Arisch) ↔ Südlicher Gazastreifen',
    lat: 31.2485,
    lon: 34.2592,
    lanes: 'Militärisch kontrollierter Hilfsgüter- & Sicherheitskorridor',
    peakWaitMin: 240,
    baseWaitMin: 180,
    regime: 'Militärische Sperrzone (IDF / COGAT / Ägypten)',
  },
  {
    id: 'crossing-allenby-king-hussein',
    name: 'Allenby-Brücke / King Hussein Bridge',
    countries: 'IL / Westjordanland ↔ JO',
    corridor: 'Jericho (Route 90) ↔ Amman',
    lat: 31.8742,
    lon: 35.5408,
    lanes: 'Personen- & Frachtterminal (Israel Airport Authority / Jordanien)',
    peakWaitMin: 75,
    baseWaitMin: 30,
    regime: 'Hochsicherheits-Grenzterminal',
  },
  {
    id: 'crossing-san-ysidro-tijuana',
    name: 'San Ysidro / Otay Mesa Port of Entry (San Diego – Tijuana)',
    countries: 'US ↔ MX',
    corridor: 'I-5 / I-805 Kalifornien ↔ Tijuana (Baja California)',
    lat: 32.5425,
    lon: -117.0292,
    lanes: '24+ PKW-Spuren / SENTRI / Otay Mesa Commercial Cargo',
    peakWaitMin: 85,
    baseWaitMin: 25,
    regime: 'US Customs and Border Protection (CBP)',
  },
  {
    id: 'crossing-el-paso-juarez',
    name: 'Paso del Norte / Bridge of the Americas (El Paso – Ciudad Juárez)',
    countries: 'US ↔ MX',
    corridor: 'I-10 / I-110 Texas ↔ Chihuahua (MX-45)',
    lat: 31.7645,
    lon: -106.4512,
    lanes: 'PKW / Commercial FAST Cargo Lanes',
    peakWaitMin: 70,
    baseWaitMin: 20,
    regime: 'US Customs and Border Protection (CBP)',
  },
  {
    id: 'crossing-detroit-windsor',
    name: 'Ambassador Bridge & Detroit-Windsor Tunnel',
    countries: 'US ↔ CA',
    corridor: 'I-75 / I-96 Michigan ↔ Highway 401 Ontario (Größter US–CA Handelskorridor)',
    lat: 42.3118,
    lon: -83.0742,
    lanes: 'PKW / NEXUS / Just-in-Time Automotive Freight',
    peakWaitMin: 35,
    baseWaitMin: 10,
    regime: 'CBP / CBSA (Canada Border Services Agency)',
  },
  // --- Wave 11 Expansion: Additional Alpine & DACH Border Crossings ---
  {
    id: 'crossing-kreuzlingen-konstanz-hza',
    name: 'Kreuzlingen / Konstanz (Hauptzollamt Emmishofen)',
    countries: 'CH ↔ DE',
    corridor: 'Kreuzlingen Hauptzollamt (H13) ↔ Konstanz-Altstadt / Emmishofer Zoll',
    lat: 47.6558,
    lon: 9.1732,
    lanes: 'PKW / Stadtbus / Fussgänger / Zollabfertigung',
    peakWaitMin: 19,
    baseWaitMin: 3,
    regime: 'Schengen + Binnengrenzkontrolle Bundespolizei DE / BAZG',
  },
  {
    id: 'crossing-vallorbe-jougne',
    name: 'Vallorbe / Jougne (N9 / RN57)',
    countries: 'CH ↔ FR',
    corridor: 'Lausanne / Orbe (A9 / N9) ↔ Pontarlier / Besançon (RN57 / E23)',
    lat: 46.7278,
    lon: 6.3785,
    lanes: 'PKW / LKW-Abfertigung Jura-Korridor',
    peakWaitMin: 16,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG & Douane Française',
  },
  {
    id: 'crossing-castasegna-chiavenna',
    name: 'Castasegna / Villa di Chiavenna (Bergell H3 / SS37)',
    countries: 'CH ↔ IT',
    corridor: 'St. Moritz / Malojapass (Bergell H3) ↔ Chiavenna / Comer See (SS37)',
    lat: 46.3338,
    lon: 9.5125,
    lanes: 'PKW / Regionaler Güterverkehr / Alpentourismus',
    peakWaitMin: 13,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-muestair-taufers',
    name: 'Müstair / Taufers (Val Müstair / Vinschgau H28 / SS41)',
    countries: 'CH ↔ IT',
    corridor: 'Ofenpass / Val Müstair (H28) ↔ Taufers im Münstertal / Südtirol (SS41)',
    lat: 46.6372,
    lon: 10.4638,
    lanes: 'PKW / Reisebusse / Regionalverkehr Graubünden–Südtirol',
    peakWaitMin: 11,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Dogana IT',
  },
  {
    id: 'crossing-stein-bad-saeckingen',
    name: 'Grenzübergang Stein AG – Bad Säckingen (Fridolinsbrücke H7 / B34)',
    countries: 'CH ↔ DE',
    corridor: 'Fricktal (A3 / H7) ↔ Hochrhein Bad Säckingen (B34)',
    lat: 47.5488,
    lon: 7.9492,
    lanes: 'PKW / LKW / Pendlerkorridor Fricktal–Südbaden',
    peakWaitMin: 17,
    baseWaitMin: 3,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-schaffhausen-neuhausen-jestetten',
    name: 'Grenzübergang Neuhausen am Rheinfall – Jestetten (H4 / B27)',
    countries: 'CH ↔ DE',
    corridor: 'Schaffhausen / Rheinfall ↔ Jestetten / Rafzerfeld (H4 / B27)',
    lat: 47.6695,
    lon: 8.5975,
    lanes: 'PKW / LKW / Transitkorridor Klettgau–Zürich',
    peakWaitMin: 15,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Bundespolizei DE',
  },
  {
    id: 'crossing-boncourt-delle',
    name: 'Autobahnzoll Boncourt – Delle (A16 Transjurane / N1019)',
    countries: 'CH ↔ FR',
    corridor: 'Biel / Delémont / Porrentruy (A16) ↔ Belfort / Montbéliard (A36)',
    lat: 47.5038,
    lon: 7.0115,
    lanes: 'PKW / LKW-Terminal Jura–Franche-Comté',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Douane Française',
  },
  {
    id: 'crossing-ferney-voltaire',
    name: 'Douane de Ferney-Voltaire – Genève-Grand-Saconnex',
    countries: 'CH ↔ FR',
    corridor: 'Pays de Gex (D1005) ↔ Genève-Aéroport / UNO-Viertel',
    lat: 46.2508,
    lon: 6.1162,
    lanes: 'PKW / TPG-Busspur / Frontaliers',
    peakWaitMin: 22,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG & Douane Française',
  },
  {
    id: 'crossing-stabio-gaggiolo',
    name: 'Dogana Stabio-Gaggiolo – Cantello (Mendrisiotto ↔ Varese)',
    countries: 'CH ↔ IT',
    corridor: 'Mendrisio / Stabio (H394) ↔ Varese / Malpensa (SP3)',
    lat: 45.8422,
    lon: 8.9185,
    lanes: 'PKW (Frontaliers) / LKW-Zollanlage',
    peakWaitMin: 25,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-ponte-tresa',
    name: 'Dogana Ponte Tresa (Malcantone ↔ Luino SS233)',
    countries: 'CH ↔ IT',
    corridor: 'Lugano / Agno ↔ Lavena Ponte Tresa / Varese (SS233)',
    lat: 45.9668,
    lon: 8.8595,
    lanes: 'PKW / starker Grenzgängerverkehr Luganese',
    peakWaitMin: 23,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-campocologno-tirano',
    name: 'Dogana Campocologno – Tirano (Berninapass H29 / SS38)',
    countries: 'CH ↔ IT',
    corridor: 'Engadin / Berninapass / Poschiavo (H29) ↔ Tirano / Veltlin (SS38)',
    lat: 46.2305,
    lon: 10.1462,
    lanes: 'PKW / Holz- & Güterverkehr / Alpentourismus',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Agenzia delle Dogane',
  },
  {
    id: 'crossing-reschenpass-resia',
    name: 'Reschenpass / Passo di Resia (Nauders B180 ↔ Vinschgau SS40)',
    countries: 'AT ↔ IT',
    corridor: 'Oberinntal / Landeck (B180) ↔ Vinschgau / Meran (SS40)',
    lat: 46.8475,
    lon: 10.5058,
    lanes: 'PKW / Reisebusse / Regionaler Güterverkehr',
    peakWaitMin: 16,
    baseWaitMin: 2,
    regime: 'Schengen / Zollamt Österreich & Guardia di Finanza',
  },
  {
    id: 'crossing-arnoldstein-tarvisio',
    name: 'Autobahngrenzübergang Arnoldstein – Tarvisio (A2 / A23)',
    countries: 'AT ↔ IT',
    corridor: 'Wien / Graz / Villach (A2 Südautobahn) ↔ Udine / Venedig (A23)',
    lat: 46.5355,
    lon: 13.6942,
    lanes: 'PKW / Haupt-Alpentransitkorridor Südost (Adria–Baltikum)',
    peakWaitMin: 21,
    baseWaitMin: 3,
    regime: 'Schengen / Schwerverkehrskontrolle Kärnten–Friaul',
  },
  {
    id: 'crossing-fuessen-reutte',
    name: 'Grenztunnel Füssen – Vils/Reutte (A7 ↔ Fernpass B179)',
    countries: 'DE ↔ AT',
    corridor: 'Ulm / Allgäu (A7) ↔ Reutte / Fernpass / Imst (B179)',
    lat: 47.5592,
    lon: 10.6725,
    lanes: 'PKW / LKW (Dosierampel Grenztunnel & Blockabfertigung Fernpass)',
    peakWaitMin: 29,
    baseWaitMin: 4,
    regime: 'Schengen + Grenzkontrolle Bundespolizei DE & Dosiersystem Tirol',
  },
  // Wave 15 — Additional Swiss/German/Italian/Austrian/Central European Border Crossings
  {
    id: 'crossing-koblenz-waldshut-tiengen',
    name: 'Koblenz / Waldshut (CH/DE) – Zollanlage Waldshut-Tiengen',
    countries: 'CH ↔ DE',
    corridor: 'Aargau H5/H7 (Koblenz) ↔ Hochrhein B34 / Waldshut-Tiengen',
    lat: 47.6122,
    lon: 8.2385,
    lanes: 'PKW / LKW-Zollhof / Busspur (4 Spuren)',
    peakWaitMin: 16,
    baseWaitMin: 3,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG AFV',
  },
  {
    id: 'crossing-laufenburg',
    name: 'Laufenburg (CH/DE) – Hochrheinbrücke & Laufenbrücke',
    countries: 'CH ↔ DE',
    corridor: 'Fricktal H7 (Laufenburg AG) ↔ Südbaden B34 / A98 (Laufenburg Baden)',
    lat: 47.5628,
    lon: 8.0615,
    lanes: 'PKW / LKW-Terminal Neue Hochrheinbrücke (4 Spuren)',
    peakWaitMin: 15,
    baseWaitMin: 2,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-grenzach-wyhlen-basel-ost',
    name: 'Grenzach-Wyhlen / Basel-Ost (DE/CH) – Hörnli / B34',
    countries: 'DE ↔ CH',
    corridor: 'Rheinfelden / Grenzach-Wyhlen (B34) ↔ Basel-Ost / Riehen (Grenzacherstrasse)',
    lat: 47.5515,
    lon: 7.6412,
    lanes: 'PKW / Grenzgänger / Buslinie 38 / Veloroute (2 Spuren)',
    peakWaitMin: 21,
    baseWaitMin: 4,
    regime: 'Schengen + Temporäre Grenzkontrolle DE / BAZG',
  },
  {
    id: 'crossing-gondo-iselle-di-trasquera',
    name: 'Gondo / Iselle di Trasquera Simplon (CH/IT) – Val Divedro',
    countries: 'CH ↔ IT',
    corridor: 'Simplonpass & Simplontunnel Autoverlad (A9/N9) ↔ Iselle di Trasquera / Domodossola (SS33)',
    lat: 46.2065,
    lon: 8.2015,
    lanes: 'PKW / LKW-Alpentransit & BLS Autoverlad Simplon (3 Spuren)',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG AFV & Dogana Iselle',
  },
  {
    id: 'crossing-fornasette-luino',
    name: 'Fornasette / Luino (CH/IT) – Malcantone / Val Veddasca',
    countries: 'CH ↔ IT',
    corridor: 'Lugano / Monteggio-Fornasette (SP6) ↔ Dumenza / Luino (Lago Maggiore)',
    lat: 45.9958,
    lon: 8.7825,
    lanes: 'PKW / Grenzgänger (Frontaliers) / Regionalverkehr (2 Spuren)',
    peakWaitMin: 19,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Dogana IT',
  },
  {
    id: 'crossing-muestair-taufers-puntweil',
    name: 'Müstair / Taufers im Münstertal (CH/IT) – Zollamt Puntweil',
    countries: 'CH ↔ IT',
    corridor: 'Val Müstair / Ofenpass (H28) ↔ Taufers im Münstertal / Vinschgau (SS41)',
    lat: 46.6435,
    lon: 10.4712,
    lanes: 'PKW / Reisebusse / Regionaler Güterverkehr (2 Spuren)',
    peakWaitMin: 12,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG AFV & Dogana Tubre',
  },
  {
    id: 'crossing-pfunds-kajetansbruecke',
    name: 'Pfunds / Kajetansbrücke (AT/CH/IT) – Dreiländerknoten Oberinntal',
    countries: 'AT ↔ CH / IT',
    corridor: 'Landeck / Pfunds (B180 Reschenstraße) ↔ Engadin (B184/H27) & Reschenpass (SS40)',
    lat: 46.9425,
    lon: 10.5312,
    lanes: 'PKW / LKW / Alpentourismus-Knotenpunkt (2 Spuren)',
    peakWaitMin: 15,
    baseWaitMin: 2,
    regime: 'Schengen / Strategischer Alpentransit-Knotenpunkt AT–CH–IT',
  },
  {
    id: 'crossing-scharnitz-mittenwald',
    name: 'Scharnitz / Mittenwald (AT/DE) – Seefelder Sattel B177 / B2',
    countries: 'AT ↔ DE',
    corridor: 'Innsbruck / Zirl / Seefeld (B177) ↔ Mittenwald / Garmisch-Partenkirchen (B2)',
    lat: 47.4015,
    lon: 11.2642,
    lanes: 'PKW / Reisebusse / Regionaler LKW-Verkehr bis 7.5t (2 Spuren)',
    peakWaitMin: 22,
    baseWaitMin: 3,
    regime: 'Schengen + Temporäre Grenzkontrolle DE & Wochenend-Fahrverbote Tirol',
  },
  {
    id: 'crossing-achenpass-tegernsee',
    name: 'Achenpass / Tegernsee (AT/DE) – Wildbad Kreuth / Achenkirch (B181 / B307)',
    countries: 'AT ↔ DE',
    corridor: 'Inntal / Achensee (B181) ↔ Wildbad Kreuth / Tegernsee / Holzkirchen (B307)',
    lat: 47.5938,
    lon: 11.6352,
    lanes: 'PKW / Ausflugs- und Regionalverkehr (2 Spuren)',
    peakWaitMin: 18,
    baseWaitMin: 2,
    regime: 'Schengen / Ausweichkorridor-Überwachung A8/A93',
  },
  {
    id: 'crossing-suben-passau-rottal',
    name: 'Suben / Passau A3/A8 (AT/DE) – Kontrollstelle Passau-Rottal',
    countries: 'AT ↔ DE',
    corridor: 'Wels / Linz (A8 Innkreisautobahn) ↔ Passau / Regensburg (A3)',
    lat: 48.4368,
    lon: 13.4112,
    lanes: 'PKW / Groß-LKW-Korridor Donau-Balkan (4 Spuren)',
    peakWaitMin: 30,
    baseWaitMin: 6,
    regime: 'Schengen + Permanente Binnengrenzkontrolle Bundespolizei DE',
  },
  {
    id: 'crossing-nickelsdorf-hegyeshalom-b10',
    name: 'Nickelsdorf / Hegyeshalom M1/A4 (AT/HU) – Grenzterminal & B10',
    countries: 'AT ↔ HU',
    corridor: 'Wien / Bruck an der Leitha (A4 / B10) ↔ Győr / Budapest (M1 / Route 1)',
    lat: 47.9318,
    lon: 17.1082,
    lanes: 'PKW / Schwerverkehr / Bus-Kontrollspur (6 Spuren)',
    peakWaitMin: 27,
    baseWaitMin: 5,
    regime: 'Schengen + Permanente Grenzkontrolle Österreich (AT–HU)',
  },
  {
    id: 'crossing-spielfeld-sentilj',
    name: 'Spielfeld / Šentilj A9/A1 (AT/SI) – Pyhrnautobahn / Südsteiermark',
    countries: 'AT ↔ SI',
    corridor: 'Graz (A9 Pyhrnautobahn) ↔ Maribor / Ljubljana / Zagreb (A1 Slowenien)',
    lat: 46.6975,
    lon: 15.6482,
    lanes: 'PKW / Internationaler Balkan- & Adria-Schwerverkehr (6 Spuren)',
    peakWaitMin: 28,
    baseWaitMin: 5,
    regime: 'Schengen + Permanente Grenzkontrolle Österreich (AT–SI)',
  },
  // --- Wave 18 Expansion: Additional Alpine & European Border Crossings ---
  {
    id: 'crossing-ramsen-rielasingen',
    name: 'Grenzübergang Ramsen SH – Rielasingen-Worblingen (H332 / L191)',
    countries: 'CH ↔ DE',
    corridor: 'Stein am Rhein / Ramsen (SH) ↔ Singen / Hegau (L191 / A81)',
    lat: 47.7115,
    lon: 8.8125,
    lanes: 'PKW / LKW-Zollanlage / Pendlerkorridor Hegau (3 Spuren)',
    peakWaitMin: 16,
    baseWaitMin: 3,
    regime: 'Schengen + Binnengrenzkontrolle DE / BAZG AFV',
  },
  {
    id: 'crossing-rafz-lottstetten',
    name: 'Zollamt Rafz – Lottstetten / Solgen (H4 / B27 Zürcher Unterland)',
    countries: 'CH ↔ DE',
    corridor: 'Bülach / Eglisau (H4) ↔ Lottstetten / Jestetter Zipfel (B27)',
    lat: 47.6195,
    lon: 8.5542,
    lanes: 'PKW / LKW-Transitkorridor Zürich–Schaffhausen (2 Spuren)',
    peakWaitMin: 17,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Bundespolizei DE',
  },
  {
    id: 'crossing-le-locle-col-des-roches',
    name: 'Douane du Col-des-Roches – Le Locle / Villers-le-Lac (H20 / D461)',
    countries: 'CH ↔ FR',
    corridor: 'Neuchâtel / La Chaux-de-Fonds (H20) ↔ Morteau / Besançon (D461)',
    lat: 47.0485,
    lon: 6.7215,
    lanes: 'PKW (Frontaliers Uhrenindustrie) / LKW-Abfertigung (3 Spuren)',
    peakWaitMin: 24,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-st-gingolph',
    name: 'Douane de Saint-Gingolph (Unterwallis H21 ↔ Haute-Savoie D1005)',
    countries: 'CH ↔ FR',
    corridor: 'Monthey / Villeneuve (H21) ↔ Évian-les-Bains / Thonon (D1005)',
    lat: 46.3928,
    lon: 6.8042,
    lanes: 'PKW / Grenzgänger Südufer Genfersee / Regionalverkehr (2 Spuren)',
    peakWaitMin: 19,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-brissago-cannobio',
    name: 'Dogana di Brissago-Madonna di Ponte – Cannobio (H13 / SS34)',
    countries: 'CH ↔ IT',
    corridor: 'Locarno / Ascona (H13) ↔ Cannobio / Verbania (Lago Maggiore SS34)',
    lat: 46.1065,
    lon: 8.7012,
    lanes: 'PKW (Frontaliers) / Reisebusse / Regionalverkehr (2 Spuren)',
    peakWaitMin: 21,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG AFV & Guardia di Finanza',
  },
  {
    id: 'crossing-spluegenpass-montespluga',
    name: 'Splügenpass / Passo dello Spluga (Rheinwald H567 ↔ Valchiavenna SS36)',
    countries: 'CH ↔ IT',
    corridor: 'Splügen / A13 Hinterrhein (H567) ↔ Montespluga / Chiavenna (SS36)',
    lat: 46.5055,
    lon: 9.3302,
    lanes: 'PKW / Alpentourismus & Passverkehr (2 Spuren, saisonal)',
    peakWaitMin: 11,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Guardia di Finanza Hochalpin',
  },
  {
    id: 'crossing-frejus-modane-bardonecchia',
    name: 'Tunnel du Fréjus – Modane / Bardonecchia (A43 ↔ A32)',
    countries: 'FR ↔ IT',
    corridor: 'Lyon / Chambéry (A43 Maurienne) ↔ Turin / Mailand (A32 Susatal)',
    lat: 45.1408,
    lon: 6.6962,
    lanes: 'PKW / Schwerverkehr-Haupttunnel Westalpen (2 Röhren)',
    peakWaitMin: 34,
    baseWaitMin: 7,
    regime: 'Schengen + Grenzkontrolle PAF France & Polizia di Frontiera',
  },
  {
    id: 'crossing-mont-blanc-chamonix-courmayeur',
    name: 'Tunnel du Mont-Blanc – Chamonix / Courmayeur (RN205 ↔ A5)',
    countries: 'FR ↔ IT',
    corridor: 'Genf / Chamonix (A40 / RN205) ↔ Courmayeur / Aostatal (A5)',
    lat: 45.8542,
    lon: 6.8855,
    lanes: 'PKW / LKW mit Thermoportal & Sicherheitsdosierung',
    peakWaitMin: 38,
    baseWaitMin: 8,
    regime: 'Schengen + Bi-nationale Tunnel- & Grenzkontrolle FR/IT',
  },
  {
    id: 'crossing-karawankentunnel-rosenbach-jesenice',
    name: 'Karawankentunnel – St. Jakob im Rosental / Jesenice (A11 ↔ A2)',
    countries: 'AT ↔ SI',
    corridor: 'Villach (A11 Karawankenautobahn) ↔ Jesenice / Ljubljana (A2 Slowenien)',
    lat: 46.4812,
    lon: 14.0415,
    lanes: 'PKW / Südosteuropa-Alpentransit & Mautstelle Rosenbach',
    peakWaitMin: 32,
    baseWaitMin: 6,
    regime: 'Schengen + Permanente Binnengrenzkontrolle Österreich (AT–SI)',
  },
  {
    id: 'crossing-kittsee-jarovce',
    name: 'Autobahngrenzübergang Kittsee – Bratislava-Jarovce (A6 ↔ D4/D2)',
    countries: 'AT ↔ SK',
    corridor: 'Wien / Bruckneudorf (A6 Nordost Autobahn) ↔ Bratislava (D4/D2)',
    lat: 48.0785,
    lon: 17.0715,
    lanes: 'PKW / LKW-Korridor Twin-City Wien–Bratislava (4 Spuren)',
    peakWaitMin: 22,
    baseWaitMin: 4,
    regime: 'Schengen + Temporäre Grenzkontrolle Österreich (AT–SK)',
  },
  // --- Wave 21 Expansion: Additional Alpine Passes & European Border Checkpoints ---
  {
    id: 'crossing-umbrailpass-stelvio',
    name: 'Umbrailpass / Giogo di Santa Maria (Val Müstair H559 ↔ Stilfser Joch SS38)',
    countries: 'CH ↔ IT',
    corridor: 'Sta. Maria Val Müstair (H559, 2501 m) ↔ Bormio / Stilfser Joch (SS38)',
    lat: 46.5415,
    lon: 10.4332,
    lanes: 'PKW / Motorrad / Hochalpiner Passverkehr (Höchster Strassengrenzübergang CH)',
    peakWaitMin: 12,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG & Guardia di Finanza Hochalpin',
  },
  {
    id: 'crossing-forcola-di-livigno',
    name: 'Dogana Forcola di Livigno / La Motta (Berninapass H29 ↔ Livigno SP301)',
    countries: 'CH ↔ IT',
    corridor: 'Pontresina / Poschiavo (Berninapass H29) ↔ Zollfreizone Livigno (SP301)',
    lat: 46.4408,
    lon: 10.0562,
    lanes: 'PKW / Reisebusse / Zollfreizone-Kontrolle (2 Spuren)',
    peakWaitMin: 22,
    baseWaitMin: 4,
    regime: 'Zollfreizone Livigno – Permanente Zollkontrolle BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-chatelard-vallorcine',
    name: 'Douane de Châtelard-Frontière – Vallorcine (Col de la Forclaz H203 ↔ RN506)',
    countries: 'CH ↔ FR',
    corridor: 'Martigny / Trient (H203) ↔ Vallorcine / Chamonix-Mont-Blanc (RN506)',
    lat: 46.0585,
    lon: 6.9525,
    lanes: 'PKW / Alpentourismus Mont-Blanc-Korridor (2 Spuren)',
    peakWaitMin: 17,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-la-cure-les-rousses',
    name: 'Douane de La Cure – Les Rousses (Col de la Givrine H123 ↔ RN5)',
    countries: 'CH ↔ FR',
    corridor: 'Nyon / Saint-Cergue (H123 Waadtländer Jura) ↔ Les Rousses / Morez (RN5)',
    lat: 46.4648,
    lon: 6.0715,
    lanes: 'PKW (Frontaliers) / Regionaler Güterverkehr Haut-Jura (2 Spuren)',
    peakWaitMin: 18,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-timmelsjoch-passo-rombo',
    name: 'Timmelsjoch / Passo del Rombo (Ötztal B186 ↔ Passeiertal SS44bis)',
    countries: 'AT ↔ IT',
    corridor: 'Sölden / Hochgurgl (B186, 2474 m) ↔ St. Leonhard in Passeier / Meran (SS44bis)',
    lat: 46.9052,
    lon: 11.0975,
    lanes: 'PKW / Motorrad / Hochalpenstraße Mautstation (2 Spuren)',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / Hochalpiner Grenzpass Tirol–Südtirol',
  },
  {
    id: 'crossing-ploeckenpass-monte-croce-carnico',
    name: 'Plöckenpass / Passo di Monte Croce Carnico (B110 ↔ SS52bis)',
    countries: 'AT ↔ IT',
    corridor: 'Kötschach-Mauthen / Gailtal (B110) ↔ Paluzza / Tolmezzo Friaul (SS52bis)',
    lat: 46.6035,
    lon: 12.9452,
    lanes: 'PKW / Regionaler Alpenübergang Karnische Alpen (2 Spuren)',
    peakWaitMin: 13,
    baseWaitMin: 2,
    regime: 'Schengen / Karnischer Gebirgsgrenzübergang AT–IT',
  },
  {
    id: 'crossing-loiblpass-ljubelj',
    name: 'Loiblpass / Prelaz Ljubelj – Loibltunnel (B91 ↔ G101 Karawanken)',
    countries: 'AT ↔ SI',
    corridor: 'Klagenfurt / Ferlach (B91 Loiblpass Straße) ↔ Tržič / Kranj (G101)',
    lat: 46.4385,
    lon: 14.2635,
    lanes: 'PKW / Busse bis 3.5t (Grenztunnel Karawanken)',
    peakWaitMin: 24,
    baseWaitMin: 4,
    regime: 'Schengen + Permanente Grenzkontrolle Österreich (AT–SI)',
  },
  {
    id: 'crossing-oberjoch-schattwald',
    name: 'Grenzübergang Oberjoch – Schattwald / Tannheimer Tal (B308 ↔ B199)',
    countries: 'DE ↔ AT',
    corridor: 'Sonthofen / Bad Hindelang (B308 Oberjochpass) ↔ Tannheimer Tal / Reutte (B199)',
    lat: 47.5162,
    lon: 10.4385,
    lanes: 'PKW / Ausflugs- und Regionalverkehr Allgäuer Alpen (2 Spuren)',
    peakWaitMin: 19,
    baseWaitMin: 3,
    regime: 'Schengen + Temporäre Grenzkontrolle Bayern & Dosierung Tirol',
  },
  {
    id: 'crossing-kehl-strasbourg-europabruecke',
    name: 'Europabrücke Kehl – Strasbourg (B28 ↔ RN4 Oberrhein)',
    countries: 'DE ↔ FR',
    corridor: 'Appenweier / Kehl (A5 / B28) ↔ Strasbourg / EU-Parlamentsviertel (RN4 / M35)',
    lat: 48.5715,
    lon: 7.8042,
    lanes: 'PKW / LKW / Tramlinie D / Grenzgänger Oberrhein (4 Spuren)',
    peakWaitMin: 26,
    baseWaitMin: 5,
    regime: 'Schengen + Permanente Binnengrenzkontrolle Bundespolizei DE & PAF France',
  },
  {
    id: 'crossing-waidhaus-rozvadov',
    name: 'Autobahngrenzübergang Waidhaus – Rozvadov (A6 ↔ D5 Via Carolina)',
    countries: 'DE ↔ CZ',
    corridor: 'Nürnberg / Amberg (A6) ↔ Pilsen / Prag (D5 Hauptachse Deutschland–Tschechien)',
    lat: 49.6385,
    lon: 12.5292,
    lanes: 'PKW / Ost-West-Schwerverkehrskorridor (4 Spuren + LKW-Terminal)',
    peakWaitMin: 27,
    baseWaitMin: 5,
    regime: 'Schengen + Permanente Binnengrenzkontrolle Bundespolizei DE',
  },
  // --- Wave 23 Expansion: Additional Alpine, Rhine, Jura & Central European Border Crossings ---
  {
    id: 'crossing-chancy-pougny',
    name: 'Douane de Chancy – Pougny (Genève-Ouest H110 ↔ Pays de Gex D984B)',
    countries: 'CH ↔ FR',
    corridor: 'Genève-Bernex / Chancy (H110) ↔ Pougny / Valleiry / Bellegarde (D984B)',
    lat: 46.1465,
    lon: 5.9712,
    lanes: 'PKW (Frontaliers Rhône-Korridor) / Regionalverkehr (2 Spuren)',
    peakWaitMin: 19,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-meyrin-st-genis-pouilly',
    name: 'Douane de Meyrin / CERN – Saint-Genis-Pouilly (H101 ↔ D984F)',
    countries: 'CH ↔ FR',
    corridor: 'Genève-Meyrin / CERN (Route de Meyrin H101) ↔ Saint-Genis-Pouilly / Pays de Gex (D984F)',
    lat: 46.2342,
    lon: 6.0485,
    lanes: 'PKW / Tramlinie 18 / Grenzgänger CERN & Pays de Gex (3 Spuren)',
    peakWaitMin: 24,
    baseWaitMin: 4,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-les-verrieres-pontarlier',
    name: 'Douane des Verrières – Les Verrières-de-Joux (Val-de-Travers H10 ↔ RN57)',
    countries: 'CH ↔ FR',
    corridor: 'Neuchâtel / Fleurier (H10) ↔ Pontarlier / Besançon (D67B / RN57)',
    lat: 46.9015,
    lon: 6.4585,
    lanes: 'PKW (Frontaliers) / LKW-Zollabfertigung Jura (2 Spuren)',
    peakWaitMin: 18,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Douane Française',
  },
  {
    id: 'crossing-kaiserstuhl-hohentengen',
    name: 'Zollamt Kaiserstuhl AG – Hohentengen am Hochrhein (Rheinbrücke H7 ↔ L161)',
    countries: 'CH ↔ DE',
    corridor: 'Zürcher Unterland / Glattfelden (H7) ↔ Hohentengen / Klettgau (L161)',
    lat: 47.5705,
    lon: 8.4192,
    lanes: 'PKW / Regionalverkehr Hochrheinbrücke (2 Spuren)',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG AFV & Zoll DE',
  },
  {
    id: 'crossing-stein-am-rhein-oehningen',
    name: 'Zollamt Stein am Rhein – Öhningen / Schienen (H13 ↔ L192 Untersee)',
    countries: 'CH ↔ DE',
    corridor: 'Stein am Rhein (SH) ↔ Öhningen / Halbinsel Höri am Bodensee (L192)',
    lat: 47.6615,
    lon: 8.8785,
    lanes: 'PKW / Ausflugs- und Pendlerverkehr Untersee–Höri (2 Spuren)',
    peakWaitMin: 15,
    baseWaitMin: 2,
    regime: 'Schengen / BAZG AFV & Bundespolizei DE',
  },
  {
    id: 'crossing-munt-la-schera-livigno',
    name: 'Tunnel Munt La Schera – Punt la Drossa / Livigno (Ofenpass H28 ↔ Gallo-Tunnel)',
    countries: 'CH ↔ IT',
    corridor: 'Zernez / Ofenpass (H28) ↔ Lago di Livigno / Zollfreizone Livigno (SP28)',
    lat: 46.6542,
    lon: 10.1945,
    lanes: 'Einbaustreifiger Mauttunnel mit Ampeldosierung (PKW / Reisebusse)',
    peakWaitMin: 28,
    baseWaitMin: 5,
    regime: 'Zollfreizone Livigno – Permanente Zollkontrolle BAZG & Guardia di Finanza',
  },
  {
    id: 'crossing-dirinella-zenna',
    name: 'Dogana di Dirinella – Pino sulla Sponda del Lago Maggiore (Gambarogno H406 ↔ SS394)',
    countries: 'CH ↔ IT',
    corridor: 'Bellinzona / Magadino / Gambarogno (H406) ↔ Zenna / Maccagno / Luino (SS394)',
    lat: 46.0985,
    lon: 8.7425,
    lanes: 'PKW (Frontaliers) / Regionalverkehr Ostufer Lago Maggiore (2 Spuren)',
    peakWaitMin: 20,
    baseWaitMin: 3,
    regime: 'Schengen / BAZG AFV & Guardia di Finanza',
  },
  {
    id: 'crossing-nassfeldpass-pramollo',
    name: 'Nassfeldpass / Passo di Pramollo (Gailtal B90 ↔ Pontebba SP110)',
    countries: 'AT ↔ IT',
    corridor: 'Hermagor / Tröpolach (B90, 1530 m) ↔ Pontebba / Kanaltal Friaul (SP110)',
    lat: 46.5605,
    lon: 13.2755,
    lanes: 'PKW / Motorrad / Alpentourismus Karnische Alpen (2 Spuren)',
    peakWaitMin: 14,
    baseWaitMin: 2,
    regime: 'Schengen / Karnischer Gebirgspass Kärnten–Friaul',
  },
  {
    id: 'crossing-sillian-arnbach-innichen',
    name: 'Grenzübergang Sillian-Arnbach – Innichen / San Candido (Drautal B100 ↔ Pustertal SS49)',
    countries: 'AT ↔ IT',
    corridor: 'Lienz / Sillian Osttirol (B100 Drautalstraße) ↔ Innichen / Bruneck Südtirol (SS49)',
    lat: 46.7425,
    lon: 12.3785,
    lanes: 'PKW / LKW / Pustertal–Drautal-Alpenkorridor (2 Spuren)',
    peakWaitMin: 18,
    baseWaitMin: 3,
    regime: 'Schengen / Zollamt Österreich & Guardia di Finanza Südtirol',
  },
  {
    id: 'crossing-schirnding-pomezi',
    name: 'Grenzübergang Schirnding – Pomezí nad Ohří (B303 ↔ I/6 Egerland)',
    countries: 'DE ↔ CZ',
    corridor: 'Marktredwitz / Bayreuth (A93 / B303) ↔ Cheb (Eger) / Karlsbad (I/6 / D6)',
    lat: 50.0785,
    lon: 12.2465,
    lanes: 'PKW / LKW-Korridor Oberfranken–Westböhmen (3 Spuren)',
    peakWaitMin: 23,
    baseWaitMin: 4,
    regime: 'Schengen + Permanente Binnengrenzkontrolle Bundespolizei DE',
  },
];

function buildBorderCrossingsFeatures(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const cetHour = (d.getUTCHours() + 1) % 24;
  const day = d.getUTCDay();
  const isWeekday = day >= 1 && day <= 5;
  const isRushHour =
    isWeekday && ((cetHour >= 6 && cetHour <= 9) || (cetHour >= 16 && cetHour <= 19));
  const isDaytime = cetHour >= 6 && cetHour <= 21;

  return BORDER_CROSSINGS.map((c) => {
    const waitMin = isRushHour
      ? c.peakWaitMin
      : isDaytime
        ? Math.max(c.baseWaitMin, Math.round((c.baseWaitMin + c.peakWaitMin) * 0.45))
        : c.baseWaitMin;
    const status =
      waitMin >= 60
        ? 'Restringiert / Lange Abfertigung'
        : waitMin >= 15
          ? `Erhöhtes Verkehrsaufkommen (~${waitMin} Min.)`
          : waitMin <= 2
            ? 'Freie Fahrt (Keine Wartezeit)'
            : `Fließend (~${waitMin} Min.)`;
    return {
      type: 'Feature',
      properties: {
        id: c.id,
        kind: 'border_crossing',
        name: `🛂 ${c.name}`,
        countries: c.countries,
        corridor: c.corridor,
        lanes: c.lanes,
        waitMinutes: waitMin,
        status,
        regime: c.regime,
        details: `${c.countries} · ${c.corridor} · Spurprofil: ${c.lanes} · Aktuelle Lage: ${status} · Grenzregime: ${c.regime}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [c.lon, c.lat],
      },
    };
  });
}

function isInRheintalOverrideBox(pt) {
  const lon = Number(pt?.[0]);
  const lat = Number(pt?.[1]);
  return lon >= 9.52 && lon <= 9.69 && lat >= 47.265 && lat <= 47.495;
}

function isHighDetailRegion(lon, lat) {
  // Full 1:10m vertex resolution in Europe & Middle East
  if (lon >= -12 && lon <= 45 && lat >= 34 && lat <= 71) return true;
  if (lon >= 24 && lon <= 64 && lat >= 12 && lat <= 42) return true;
  return false;
}

function filterOutCoarseRheintal(geometry) {
  if (!geometry) return null;
  const lines =
    geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  if (!lines.length) return geometry;
  const outLines = [];
  for (const line of lines) {
    let current = [];
    const len = (line || []).length;
    for (let i = 0; i < len; i += 1) {
      const pt = line[i];
      if (isInRheintalOverrideBox(pt)) {
        if (current.length >= 2) outLines.push(current);
        current = [];
        continue;
      }
      const lon = Number(pt?.[0]);
      const lat = Number(pt?.[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const keep =
        i === 0 ||
        i === len - 1 ||
        isHighDetailRegion(lon, lat) ||
        i % 3 === 0;
      if (keep) {
        current.push([Number(lon.toFixed(4)), Number(lat.toFixed(4))]);
      }
    }
    if (current.length >= 2) outLines.push(current);
  }
  if (!outLines.length) return null;
  return outLines.length === 1
    ? { type: 'LineString', coordinates: outLines[0] }
    : { type: 'MultiLineString', coordinates: outLines };
}

export async function bordersSnapshot() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  for (const url of [URL_10M, URL_50M]) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'gods-eye-view/1.0',
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];
      if (!features.length) continue;
      const cleaned = [];
      for (const feature of features) {
        const geom = filterOutCoarseRheintal(feature?.geometry);
        if (!geom) continue;
        cleaned.push({
          type: 'Feature',
          properties: {
            name: String(
              feature?.properties?.NAME || feature?.properties?.name || '',
            ),
          },
          geometry: geom,
        });
      }
      cleaned.push({
        type: 'Feature',
        properties: {
          name: 'Staatsgrenze Schweiz – Österreich (St. Galler Rheintal / Alter Rhein Diepoldsau)',
        },
        geometry: {
          type: 'LineString',
          coordinates: EXACT_RHEINTAL_CH_AT_BORDER,
        },
      });
      cleaned.push({
        type: 'Feature',
        properties: {
          name: 'Staatsgrenze Fürstentum Liechtenstein (CH – FL – AT)',
        },
        geometry: {
          type: 'LineString',
          coordinates: EXACT_LIECHTENSTEIN_BORDER,
        },
      });
      const body = {
        type: 'FeatureCollection',
        features: [...cleaned, ...buildBorderCrossingsFeatures()],
      };
      cache.at = Date.now();
      cache.body = body;
      return body;
    } catch {
      /* try next fallback */
    }
  }
  if (cache.body) return cache.body;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Staatsgrenze Schweiz – Österreich (St. Galler Rheintal / Alter Rhein Diepoldsau)',
        },
        geometry: {
          type: 'LineString',
          coordinates: EXACT_RHEINTAL_CH_AT_BORDER,
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Staatsgrenze Fürstentum Liechtenstein (CH – FL – AT)',
        },
        geometry: {
          type: 'LineString',
          coordinates: EXACT_LIECHTENSTEIN_BORDER,
        },
      },
      ...buildBorderCrossingsFeatures(),
    ],
  };
}
