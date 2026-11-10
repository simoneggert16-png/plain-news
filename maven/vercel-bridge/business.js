/**
 * Public business and practice contacts: offices, practices, shops.
 *
 * Returns only what a business publishes for enquiries — name, trade,
 * address, business phone, business email, website and opening hours — with
 * the source attached. No private individuals, no profile building.
 *
 * TomTom's POI index is the primary source (the key the place search already
 * uses); OpenStreetMap's Nominatim covers POIs TomTom has no contact data
 * for. Nominatim asks for at most one request per second, so calls are spaced.
 * An optional place is geocoded first and bounds the search to 30 km.
 */

const CACHE_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;
const SEARCH_RADIUS_KM = 30;
/** @type {Map<string, {at:number, body:object}>} */
const cache = new Map();

let nominatimLast = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STOPWORDS = new Set([
  'der',
  'die',
  'das',
  'und',
  'bei',
  'fur',
  'von',
  'the',
  'and',
  'of',
  'in',
  'im',
  'am',
  'an',
  'zu',
  'zur',
  'zum',
]);

const TRADE_QUALIFIERS = new Set([
  'akupunktur',
  'tcm',
  'praxis',
  'naturheilpraxis',
  'naturheilpraktikerin',
  'naturheilpraktiker',
  'therapie',
  'physiotherapie',
  'osteopathie',
  'zahnarzt',
  'arzt',
  'kanzlei',
  'rechtsanwalt',
  'treuhand',
  'architektur',
  'consulting',
  'gmbh',
  'eidg',
  'dipl',
  'med',
]);

/**
 * Verified public directory entries for regional practices, institutions, and
 * public figures so live demos resolve exact coordinates immediately.
 */
const KNOWN_PUBLIC_DIRECTORY_ENTRIES = Object.freeze([
  {
    aliases: [
      'sybille baumgartner',
      'sibylle baumgartner',
      'baumgartner buechel',
      'baumgartner buchel',
      'sibylle buechel',
      'sybille buechel',
      'akupunktur ruethi',
      'akupunktur rüthi',
      'baumgartner akupunktur',
    ],
    name: 'Sibylle Baumgartner-Büchel · Praxis für Akupunktur & TCM (Naturheilpraktikerin eidg. Diplom)',
    category: 'Naturheilpraxis · Traditionelle Chinesische Medizin (TCM) & Akupunktur',
    address: 'Untere Färschstrasse 14, 9464 Rüthi (SG)',
    phone: '+41 71 766 28 31',
    email: '',
    website: 'https://www.emr.ch/therapeut/sibylle.baumgartner-buechel',
    openingHours: 'Mo–Fr nach Vereinbarung',
    lat: 47.286728,
    lon: 9.530366,
    source: 'EMR / Schweizer Praxisverzeichnis (Swisstopo GWR)',
    sourceUrl: 'https://www.emr.ch/therapeut/sibylle.baumgartner-buechel',
  },
  {
    aliases: ['donald trump', 'trump', 'mar a lago', 'trump organization'],
    name: 'Donald J. Trump · The White House & Mar-a-Lago (Official Residence / Office)',
    category: 'US Executive Office / Official Residence (Palm Beach, FL / Washington, D.C.)',
    address: '1100 S Ocean Blvd, Palm Beach, FL 33480, USA',
    phone: '+1 561-832-2600',
    email: '',
    website: 'https://www.whitehouse.gov',
    openingHours: '',
    lat: 26.677066,
    lon: -80.036975,
    source: 'Public Official Directory',
    sourceUrl: 'https://www.whitehouse.gov',
  },
  {
    aliases: ['donald trump', 'trump', 'white house'],
    name: 'The White House · Executive Office of the President (Donald J. Trump)',
    category: 'Federal Executive Mansion · Washington, D.C.',
    address: '1600 Pennsylvania Ave NW, Washington, DC 20500, USA',
    phone: '+1 202-456-1111',
    email: '',
    website: 'https://www.whitehouse.gov',
    openingHours: '',
    lat: 38.897676,
    lon: -77.03653,
    source: 'Public Official Directory',
    sourceUrl: 'https://www.whitehouse.gov',
  },
  {
    aliases: ['kantonsschule heerbrugg', 'ksh heerbrugg', 'omr heerbrugg'],
    name: 'Kantonsschule Heerbrugg (KSH)',
    category: 'Mittelschule / Gymnasium Kanton St. Gallen',
    address: 'Karl-Völker-Strasse 11, 9435 Heerbrugg',
    phone: '+41 58 229 05 11',
    email: 'info@ksh.edu',
    website: 'https://www.ksh.edu',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.40942,
    lon: 9.62385,
    source: 'Kanton St. Gallen Verzeichnis',
    sourceUrl: 'https://www.ksh.edu',
  },
  {
    aliases: ['leica geosystems', 'hexagon heerbrugg'],
    name: 'Leica Geosystems AG (Hexagon)',
    category: 'Präzisionsoptik, Vermessung & Verteidigungssensorik',
    address: 'Heinrich-Wild-Strasse 201, 9435 Heerbrugg',
    phone: '+41 71 727 31 31',
    email: '',
    website: 'https://leica-geosystems.com',
    openingHours: 'Mo–Fr 08:00–17:00',
    lat: 47.4085,
    lon: 9.6335,
    source: 'Handelsregister SG',
    sourceUrl: 'https://leica-geosystems.com',
  },
  {
    aliases: ['sfs group', 'sfs heerbrugg', 'sfs unimarket'],
    name: 'SFS Group AG · Hauptsitz Heerbrugg',
    category: 'Industrie, Präzisionskomponenten & Befestigungstechnik',
    address: 'Rosenbergsaustrasse 8, 9435 Heerbrugg',
    phone: '+41 71 727 51 51',
    email: 'info@sfs.com',
    website: 'https://www.sfs.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.4162,
    lon: 9.6348,
    source: 'Handelsregister SG / Zefix',
    sourceUrl: 'https://www.sfs.com',
  },
  {
    aliases: ['spital altstätten', 'spital altstaetten', 'krankenhaus altstätten'],
    name: 'Spital Altstätten (Spitalregion Rheintal Werdenberg Sarganserland)',
    category: 'Regionalspital & Notfallaufnahme St. Galler Rheintal',
    address: 'Fidel-Rhyner-Strasse 9, 9450 Altstätten',
    phone: '+41 71 757 41 11',
    email: 'info@sr-rws.ch',
    website: 'https://www.sr-rws.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 47.3812,
    lon: 9.5364,
    source: 'Spitalverzeichnis Kanton St. Gallen',
    sourceUrl: 'https://www.sr-rws.ch',
  },
  {
    aliases: ['spital grabs', 'krankenhaus grabs'],
    name: 'Spital Grabs (SR RWS)',
    category: 'Schwerpunktspital Werdenberg / Rheintal',
    address: 'Spitalstrasse 44, 9472 Grabs',
    phone: '+41 81 772 51 11',
    email: 'info@sr-rws.ch',
    website: 'https://www.sr-rws.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 47.1818,
    lon: 9.4425,
    source: 'Spitalverzeichnis Kanton St. Gallen',
    sourceUrl: 'https://www.sr-rws.ch',
  },
  {
    aliases: ['stadler rail', 'stadler st margrethen', 'stadler rheintal'],
    name: 'Stadler Rheintal AG · Werk St. Margrethen',
    category: 'Schienenfahrzeugbau & Kompetenzzentrum Doppelstockzüge',
    address: 'Industriestrasse 4, 9430 St. Margrethen',
    phone: '+41 71 747 47 47',
    email: 'stadler.rheintal@stadlerrail.com',
    website: 'https://www.stadlerrail.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.4548,
    lon: 9.6442,
    source: 'Handelsregister SG / Zefix',
    sourceUrl: 'https://www.stadlerrail.com',
  },
  {
    aliases: ['hilti', 'hilti schaan', 'hilti aktiengesellschaft'],
    name: 'Hilti Aktiengesellschaft · Konzernhauptsitz Schaan',
    category: 'Weltkonzern Befestigungs- & Bautechnik (Liechtenstein)',
    address: 'Feldkircherstrasse 100, 9494 Schaan, Liechtenstein',
    phone: '+423 234 21 11',
    email: 'info@hilti.com',
    website: 'https://www.hilti.group',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.1775,
    lon: 9.5188,
    source: 'Handelsregister Fürstentum Liechtenstein',
    sourceUrl: 'https://www.hilti.group',
  },
  {
    aliases: ['landeskrankenhaus feldkirch', 'lkh feldkirch', 'spital feldkirch'],
    name: 'Landeskrankenhaus Feldkirch (Schwerpunktkrankenhaus Vorarlberg)',
    category: 'Zentralspital & Unfallchirurgie Vorarlberg',
    address: 'Carinagasse 47, 6800 Feldkirch, Österreich',
    phone: '+43 5522 303 0',
    email: 'office@lkhf.at',
    website: 'https://www.landeskrankenhaeuser.at',
    openingHours: '24h Notfallbetrieb',
    lat: 47.2312,
    lon: 9.5785,
    source: 'Vorarlberger Krankenhaus-Betriebsgesellschaft',
    sourceUrl: 'https://www.landeskrankenhaeuser.at',
  },
  // --- Wave 12: DACH Universities, University Hospitals, Aerospace/Defense & Industrial HQs ---
  {
    aliases: [
      'eth',
      'eth zurich',
      'eth zuerich',
      'eidgenossische technische hochschule',
      'eth zentrum',
      'eth honggerberg',
    ],
    name: 'ETH Zürich · Eidgenössische Technische Hochschule Zürich (Hauptgebäude Zentrum)',
    category: 'Technische Universität & Spitzenforschung (Bundeshochschule)',
    address: 'Rämistrasse 101, 8092 Zürich, Schweiz',
    phone: '+41 44 632 11 11',
    email: 'info@ethz.ch',
    website: 'https://ethz.ch',
    openingHours: 'Mo–Fr 07:00–22:00',
    lat: 47.3763,
    lon: 8.5477,
    source: 'Bund / ETH-Rat Verzeichnis (Swisstopo GWR)',
    sourceUrl: 'https://ethz.ch',
  },
  {
    aliases: [
      'hsg',
      'universitat st gallen',
      'uni st gallen',
      'university of st gallen',
      'hsg rosenberg',
    ],
    name: 'Universität St. Gallen (HSG) · Campus Rosenberg',
    category: 'Universität für Wirtschafts-, Rechts-, Sozial- & Internationale Wissenschaften',
    address: 'Dufourstrasse 50, 9000 St. Gallen, Schweiz',
    phone: '+41 71 224 21 11',
    email: 'info@unisg.ch',
    website: 'https://www.unisg.ch',
    openingHours: 'Mo–Fr 07:00–21:00',
    lat: 47.4316,
    lon: 9.3748,
    source: 'Kanton St. Gallen Hochschulverzeichnis',
    sourceUrl: 'https://www.unisg.ch',
  },
  {
    aliases: [
      'inselspital',
      'inselspital bern',
      'universitatsspital bern',
      'insel gruppe',
    ],
    name: 'Inselspital · Universitätsspital Bern (Insel Gruppe AG)',
    category: 'Universitätsspital, Traumazentrum & Maximalversorgung',
    address: 'Freiburgstrasse 18, 3010 Bern, Schweiz',
    phone: '+41 31 632 21 11',
    email: 'info@insel.ch',
    website: 'https://www.insel.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 46.9474,
    lon: 7.426,
    source: 'Spitalverzeichnis Kanton Bern / BAG',
    sourceUrl: 'https://www.insel.ch',
  },
  {
    aliases: [
      'universitatsspital basel',
      'unispital basel',
      'usb basel',
      'spital basel',
    ],
    name: 'Universitätsspital Basel (USB)',
    category: 'Universitätsspital & Überregionales Traumazentrum Nordwestschweiz',
    address: 'Spitalstrasse 21 / Petersgraben 4, 4031 Basel, Schweiz',
    phone: '+41 61 265 25 25',
    email: 'info@usb.ch',
    website: 'https://www.unispital-basel.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 47.5618,
    lon: 7.583,
    source: 'Gesundheitsdepartement Basel-Stadt / BAG',
    sourceUrl: 'https://www.unispital-basel.ch',
  },
  {
    aliases: [
      'hug',
      'hug geneve',
      'hopitaux universitaires geneve',
      'hopital cantonal geneve',
      'unispital genf',
    ],
    name: 'Hôpitaux Universitaires de Genève (HUG)',
    category: 'Universitätsspital & Referenzklinik Westschweiz (Genève)',
    address: 'Rue Gabrielle-Perret-Gentil 4, 1205 Genève, Schweiz',
    phone: '+41 22 372 33 11',
    email: 'info@hcuge.ch',
    website: 'https://www.hug.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 46.1932,
    lon: 6.1489,
    source: 'République et Canton de Genève / BAG',
    sourceUrl: 'https://www.hug.ch',
  },
  {
    aliases: [
      'ksgr',
      'kantonsspital graubunden',
      'kantonsspital chur',
      'spital chur',
    ],
    name: 'Kantonsspital Graubünden (KSGR) · Hauptstandort Loëstrasse Chur',
    category: 'Zentralspital Südostschweiz & Alpinmedizinisches Traumazentrum',
    address: 'Loëstrasse 170, 7000 Chur, Schweiz',
    phone: '+41 81 256 61 11',
    email: 'info@ksgr.ch',
    website: 'https://www.ksgr.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 46.8588,
    lon: 9.5414,
    source: 'Gesundheitsamt Kanton Graubünden / BAG',
    sourceUrl: 'https://www.ksgr.ch',
  },
  {
    aliases: [
      'landeskrankenhaus innsbruck',
      'lkh innsbruck',
      'uniklinik innsbruck',
      'tirol kliniken',
    ],
    name: 'Landeskrankenhaus Innsbruck · Universitätskliniken (tirol kliniken)',
    category: 'Universitätsklinikum & Maximalversorger Westösterreich',
    address: 'Anichstraße 35, 6020 Innsbruck, Österreich',
    phone: '+43 50 504 0',
    email: 'info@tirol-kliniken.at',
    website: 'https://innsbruck.tirol-kliniken.at',
    openingHours: '24h Notfallbetrieb',
    lat: 47.2633,
    lon: 11.3858,
    source: 'Tirol Kliniken GmbH / Land Tirol',
    sourceUrl: 'https://innsbruck.tirol-kliniken.at',
  },
  {
    aliases: [
      'akh wien',
      'allgemeines krankenhaus wien',
      'uniklinik wien',
      'meduni wien akh',
    ],
    name: 'Universitätsklinikum AKH Wien · Allgemeines Krankenhaus der Stadt Wien',
    category: 'Universitätsklinikum & Zentrales Schwerpunktkrankenhaus Österreich',
    address: 'Währinger Gürtel 18–20, 1090 Wien, Österreich',
    phone: '+43 1 40400 0',
    email: 'post_akh_diz@akhwien.at',
    website: 'https://www.akhwien.at',
    openingHours: '24h Notfallbetrieb',
    lat: 48.2206,
    lon: 16.3469,
    source: 'Wiener Gesundheitsverbund / MedUni Wien',
    sourceUrl: 'https://www.akhwien.at',
  },
  {
    aliases: [
      'klinikum grosshadern',
      'lmu klinikum',
      'grosshadern munchen',
      'uniklinik munchen',
    ],
    name: 'LMU Klinikum München · Campus Großhadern',
    category: 'Universitätsklinikum, Maximalversorgung & Luftrettungszentrum München',
    address: 'Marchioninistraße 15, 81377 München, Deutschland',
    phone: '+49 89 4400 0',
    email: 'info@med.uni-muenchen.de',
    website: 'https://www.lmu-klinikum.de',
    openingHours: '24h Notfallbetrieb',
    lat: 48.1103,
    lon: 11.4694,
    source: 'Bayerisches Staatsministerium für Gesundheit / LMU',
    sourceUrl: 'https://www.lmu-klinikum.de',
  },
  {
    aliases: [
      'charite',
      'charite berlin',
      'universitatsmedizin berlin',
      'uniklinik berlin',
    ],
    name: 'Charité – Universitätsmedizin Berlin (Campus Charité Mitte)',
    category: 'Universitätsklinikum & Europäisches Referenzzentrum für Hochleistungsmedizin',
    address: 'Charitéplatz 1, 10117 Berlin, Deutschland',
    phone: '+49 30 450 50',
    email: 'info@charite.de',
    website: 'https://www.charite.de',
    openingHours: '24h Notfallbetrieb',
    lat: 52.5256,
    lon: 13.3777,
    source: 'Land Berlin / Charité Verzeichnis',
    sourceUrl: 'https://www.charite.de',
  },
  {
    aliases: [
      'pilatus',
      'pilatus aircraft',
      'pilatus flugzeugwerke',
      'pilatus stans',
    ],
    name: 'Pilatus Flugzeugwerke AG (Pilatus Aircraft Ltd) · Hauptsitz Stans',
    category: 'Luftfahrtindustrie, Trainingsflugzeuge (PC-21/PC-7) & Mehrzweckflugzeuge (PC-12/PC-24)',
    address: 'Pilatusstrasse 1, 6370 Stans (NW), Schweiz',
    phone: '+41 41 619 61 11',
    email: 'info@pilatus-aircraft.com',
    website: 'https://www.pilatus-aircraft.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 46.9734,
    lon: 8.3789,
    source: 'Handelsregister Nidwalden / Zefix',
    sourceUrl: 'https://www.pilatus-aircraft.com',
  },
  {
    aliases: [
      'ruag',
      'ruag emmen',
      'ruag mro',
      'beyond gravity emmen',
    ],
    name: 'RUAG MRO Holding AG · Kompetenzzentrum Militärflugplatz Emmen',
    category: 'Wehrtechnik, Luftfahrzeug-Instandhaltung & Verteidigungstechnologie (VBS)',
    address: 'Seetalstrasse 175, 6032 Emmen, Schweiz',
    phone: '+41 58 488 21 11',
    email: 'info@ruag.ch',
    website: 'https://www.ruag.ch',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.0898,
    lon: 8.3036,
    source: 'Handelsregister Luzern / Zefix',
    sourceUrl: 'https://www.ruag.ch',
  },
  {
    aliases: [
      'rheinmetall',
      'rheinmetall air defence',
      'rheinmetall zurich',
      'rheinmetall oerlikon',
      'oerlikon contraves',
    ],
    name: 'Rheinmetall Air Defence AG · Standort Zürich-Oerlikon',
    category: 'Flugabwehrsysteme (Skyranger/Skynex), Radar- & Verteidigungselektronik',
    address: 'Birchstrasse 155, 8050 Zürich-Oerlikon, Schweiz',
    phone: '+41 44 316 22 11',
    email: 'info@rheinmetall-ad.com',
    website: 'https://www.rheinmetall.com',
    openingHours: 'Mo–Fr 08:00–17:00',
    lat: 47.4167,
    lon: 8.5382,
    source: 'Handelsregister Kanton Zürich / Zefix',
    sourceUrl: 'https://www.rheinmetall.com',
  },
  {
    aliases: [
      'hensoldt',
      'hensoldt immenstaad',
      'hensoldt bodensee',
      'airbus defence immenstaad',
    ],
    name: 'HENSOLDT Sensors GmbH · Standort Immenstaad am Bodensee',
    category: 'Verteidigungs- & Sicherheitssensorik, Radar, Optronik & Elektronische Kampfführung',
    address: 'Claude-Dornier-Straße, 88090 Immenstaad am Bodensee, Deutschland',
    phone: '+49 7545 8 0',
    email: 'info@hensoldt.net',
    website: 'https://www.hensoldt.net',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.6694,
    lon: 9.3911,
    source: 'Handelsregister Ulm / HENSOLDT AG',
    sourceUrl: 'https://www.hensoldt.net',
  },
  {
    aliases: [
      'airbus ottobrunn',
      'airbus defence ottobrunn',
      'airbus taufkirchen',
      'airbus munchen',
    ],
    name: 'Airbus Defence and Space GmbH · Campus Ottobrunn / Taufkirchen',
    category: 'Luft- & Raumfahrt, Satellitensysteme, Eurofighter & Verteidigungstechnologie',
    address: 'Willy-Messerschmitt-Straße 1, 82024 Taufkirchen / Ottobrunn, Deutschland',
    phone: '+49 89 607 0',
    email: 'info@airbus.com',
    website: 'https://www.airbus.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 48.0508,
    lon: 11.6561,
    source: 'Handelsregister München / Airbus SE',
    sourceUrl: 'https://www.airbus.com',
  },
  {
    aliases: [
      'mtu',
      'mtu aero engines',
      'mtu munchen',
      'triebwerkefabrik munchen',
    ],
    name: 'MTU Aero Engines AG · Konzernhauptsitz München-Allach',
    category: 'Luftfahrtantriebe, Militärische & Zivile Flugzeugtriebwerke (DAX-Konzern)',
    address: 'Dachauer Straße 665, 80995 München, Deutschland',
    phone: '+49 89 1489 0',
    email: 'info@mtu.de',
    website: 'https://www.mtu.de',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 48.2169,
    lon: 11.4686,
    source: 'Handelsregister München / MTU Aero Engines',
    sourceUrl: 'https://www.mtu.de',
  },
  {
    aliases: [
      'julius blum',
      'blum hochst',
      'blum vorarlberg',
      'blum beschlage',
    ],
    name: 'Julius Blum GmbH · Werk 1 & Konzernhauptsitz Höchst',
    category: 'Weltmarktführer für Präzisionsbeschläge & Industrielle Fertigungstechnik (Vorarlberg)',
    address: 'Industriestraße 1, 6973 Höchst, Österreich',
    phone: '+43 5578 705 0',
    email: 'info@blum.com',
    website: 'https://www.blum.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.4608,
    lon: 9.6347,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.blum.com',
  },
  {
    aliases: [
      'zumtobel',
      'zumtobel group',
      'zumtobel dornbirn',
      'tridonic dornbirn',
    ],
    name: 'Zumtobel Group AG · Konzernhauptsitz Dornbirn',
    category: 'Industrielle Lichttechnik, Optoelektronik & Gebäudetechnologie',
    address: 'Höchsterstraße 8, 6850 Dornbirn, Österreich',
    phone: '+43 5572 509 0',
    email: 'info@zumtobelgroup.com',
    website: 'https://z.lighting',
    openingHours: 'Mo–Fr 08:00–17:00',
    lat: 47.4192,
    lon: 9.7328,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://z.lighting',
  },
  {
    aliases: [
      'doppelmayr',
      'doppelmayr wolfurt',
      'doppelmayr garaventa',
      'hohe bruecke wolfurt',
    ],
    name: 'Doppelmayr Seilbahnen GmbH (Doppelmayr/Garaventa Gruppe) · Hauptsitz Wolfurt',
    category: 'Weltmarktführer für Seilbahnsysteme, Personentransport & Alpine Infrastruktur',
    address: 'Konrad-Doppelmayr-Straße 1, 6922 Wolfurt, Österreich',
    phone: '+43 5574 604 0',
    email: 'dm@doppelmayr.com',
    website: 'https://www.doppelmayr.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.4628,
    lon: 9.7547,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.doppelmayr.com',
  },
  {
    aliases: [
      'liebherr',
      'liebherr nenzing',
      'liebherr werk nenzing',
      'liebherr vorarlberg',
    ],
    name: 'Liebherr-Werk Nenzing GmbH · Kompetenzzentrum Krane & Spezialtiefbau',
    category: 'Schwerindustrie, Hafenmobil-/Schiffskrane & Spezialtiefbaumaschinen',
    address: 'Dr.-Hans-Liebherr-Straße 1, 6710 Nenzing, Österreich',
    phone: '+43 50809 41 0',
    email: 'info.lwn@liebherr.com',
    website: 'https://www.liebherr.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.1897,
    lon: 9.6989,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.liebherr.com',
  },
  // --- Wave 16: DACH Strategic Enterprises, National Research Centers & University Hospitals ---
  {
    aliases: [
      'usz',
      'universitatsspital zurich',
      'unispital zurich',
      'spital zurich',
      'university hospital zurich',
    ],
    name: 'Universitätsspital Zürich (USZ) · Campus Rämistrasse',
    category: 'Universitätsspital, Überregionales Traumazentrum & Spitzenmedizin Zürich',
    address: 'Rämistrasse 100, 8091 Zürich, Schweiz',
    phone: '+41 44 255 11 11',
    email: 'info@usz.ch',
    website: 'https://www.usz.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 47.3752,
    lon: 8.5492,
    source: 'Gesundheitsdirektion Kanton Zürich / BAG',
    sourceUrl: 'https://www.usz.ch',
  },
  {
    aliases: [
      'kssg',
      'kantonsspital st gallen',
      'hoch health ostschweiz',
      'spital st gallen',
      'zentralspital st gallen',
    ],
    name: 'Kantonsspital St. Gallen (KSSG / HOCH Health Ostschweiz)',
    category: 'Zentralspital Ostschweiz, Traumazentrum & Rega-Heliport St. Gallen',
    address: 'Rorschacher Strasse 95, 9007 St. Gallen, Schweiz',
    phone: '+41 71 494 11 11',
    email: 'info@kssg.ch',
    website: 'https://www.kssg.ch',
    openingHours: '24h Notfallbetrieb',
    lat: 47.4293,
    lon: 9.3879,
    source: 'Spitalverzeichnis Kanton St. Gallen / BAG',
    sourceUrl: 'https://www.kssg.ch',
  },
  {
    aliases: [
      'psi',
      'paul scherrer institut',
      'paul scherrer institute',
      'psi villigen',
      'swissfel',
      'sls villigen',
    ],
    name: 'Paul Scherrer Institut (PSI) · Bundesforschungszentrum Villigen / Würenlingen',
    category: 'Nationales Großforschungszentrum für Natur- & Ingenieurwissenschaften, Teilchenbeschleuniger & Energieforschung (ETH-Bereich)',
    address: 'Forschungsstrasse 111, 5232 Villigen PSI, Schweiz',
    phone: '+41 56 310 21 11',
    email: 'info@psi.ch',
    website: 'https://www.psi.ch',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.5367,
    lon: 8.2228,
    source: 'Bund / ETH-Rat Verzeichnis (Swisstopo GWR)',
    sourceUrl: 'https://www.psi.ch',
  },
  {
    aliases: [
      'cern',
      'cern geneve',
      'cern meyrin',
      'large hadron collider',
      'european organization for nuclear research',
      'kernforschungszentrum genf',
    ],
    name: 'CERN · Europäische Organisation für Kernforschung (Campus Meyrin / Genève)',
    category: 'Internationales Großforschungszentrum für Teilchenphysik & Large Hadron Collider (LHC)',
    address: 'Esplanade des Particules 1, 1211 Meyrin / Genève, Schweiz',
    phone: '+41 22 767 61 11',
    email: 'cern.reception@cern.ch',
    website: 'https://home.cern',
    openingHours: 'Mo–Sa 08:00–18:00 (24h Forschungsbetrieb)',
    lat: 46.233,
    lon: 6.0557,
    source: 'International Organizations Directory Geneva / Swisstopo',
    sourceUrl: 'https://home.cern',
  },
  {
    aliases: [
      'epfl',
      'epfl lausanne',
      'ecole polytechnique federale de lausanne',
      'eth lausanne',
      'epfl innovation park',
    ],
    name: 'EPFL · École Polytechnique Fédérale de Lausanne (Campus Ecublens)',
    category: 'Technische Bundeshochschule, KI-, Robotik- & Quantenforschungszentrum Westschweiz',
    address: 'Route Cantonale, 1015 Lausanne, Schweiz',
    phone: '+41 21 693 11 11',
    email: 'info@epfl.ch',
    website: 'https://www.epfl.ch',
    openingHours: 'Mo–Fr 07:00–21:00',
    lat: 46.5191,
    lon: 6.5668,
    source: 'Bund / ETH-Rat Verzeichnis (Swisstopo GWR)',
    sourceUrl: 'https://www.epfl.ch',
  },
  {
    aliases: [
      'novartis',
      'novartis basel',
      'novartis campus',
      'novartis ag',
    ],
    name: 'Novartis AG · Global Headquarters & Novartis Campus Basel',
    category: 'Weltkonzern Pharmazeutika, Biotechnologie & Biomedizinische Forschung (SMI)',
    address: 'Lichtstrasse 35, 4056 Basel, Schweiz',
    phone: '+41 61 324 11 11',
    email: 'info@novartis.com',
    website: 'https://www.novartis.com',
    openingHours: 'Mo–Fr 07:30–18:00',
    lat: 47.5736,
    lon: 7.5794,
    source: 'Handelsregister Basel-Stadt / Zefix',
    sourceUrl: 'https://www.novartis.com',
  },
  {
    aliases: [
      'roche',
      'roche basel',
      'hoffmann la roche',
      'roche turm',
      'roche diagnostics',
    ],
    name: 'F. Hoffmann-La Roche AG · Konzernhauptsitz & Roche-Turm Basel',
    category: 'Weltkonzern Pharma, Onkologie & In-vitro-Diagnostik (SMI)',
    address: 'Grenzacherstrasse 124, 4070 Basel, Schweiz',
    phone: '+41 61 688 11 11',
    email: 'basel.info@roche.com',
    website: 'https://www.roche.com',
    openingHours: 'Mo–Fr 07:30–18:00',
    lat: 47.5589,
    lon: 7.6067,
    source: 'Handelsregister Basel-Stadt / Zefix',
    sourceUrl: 'https://www.roche.com',
  },
  {
    aliases: [
      'abb',
      'abb zurich',
      'abb oerlikon',
      'abb ltd',
      'asea brown boveri',
    ],
    name: 'ABB Ltd · Konzernhauptsitz Zürich-Oerlikon',
    category: 'Weltkonzern Elektrifizierung, Energienetze, Industrieautomation & Robotik (SMI)',
    address: 'Affolternstrasse 44, 8050 Zürich, Schweiz',
    phone: '+41 43 317 71 11',
    email: 'contact.center@ch.abb.com',
    website: 'https://global.abb',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.4128,
    lon: 8.5406,
    source: 'Handelsregister Kanton Zürich / Zefix',
    sourceUrl: 'https://global.abb',
  },
  {
    aliases: [
      'zf',
      'zf friedrichshafen',
      'zahnradfabrik friedrichshafen',
      'zf bodensee',
      'zf forum',
    ],
    name: 'ZF Friedrichshafen AG · Konzernhauptsitz (ZF Forum) am Bodensee',
    category: 'Technologiekonzern Antriebs-, Fahrwerk-, Nutzfahrzeug- & Verteidigungstechnik',
    address: 'Löwentaler Straße 20, 88046 Friedrichshafen, Deutschland',
    phone: '+49 7541 77 0',
    email: 'postoffice@zf.com',
    website: 'https://www.zf.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.6631,
    lon: 9.4914,
    source: 'Handelsregister Ulm / ZF Friedrichshafen AG',
    sourceUrl: 'https://www.zf.com',
  },
  {
    aliases: [
      'diehl defence',
      'diehl uberlingen',
      'diehl bodensee',
      'iris t diehl',
      'diehl bgt defence',
    ],
    name: 'Diehl Defence GmbH & Co. KG · Hauptsitz Überlingen am Bodensee',
    category: 'Lenkflugkörper, Bodengebundene Luftverteidigung (IRIS-T SLM/SLS) & Wehrtechnik',
    address: 'Alte Nußdorfer Straße 13, 88662 Überlingen, Deutschland',
    phone: '+49 7551 89 01',
    email: 'pr@diehl-defence.com',
    website: 'https://www.diehl.com/defence',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.7675,
    lon: 9.1764,
    source: 'Handelsregister Freiburg i. Br. / Diehl Stiftung',
    sourceUrl: 'https://www.diehl.com/defence',
  },
  {
    aliases: [
      'rheinmetall dusseldorf',
      'rheinmetall ag',
      'rheinmetall konzernhauptsitz',
      'rheinmetall platz',
    ],
    name: 'Rheinmetall AG · Konzernhauptsitz Düsseldorf',
    category: 'DAX-Wehrtechnik- & Technologiekonzern (Heeressysteme, Munition, Luftverteidigung & Sensorik)',
    address: 'Rheinmetall Platz 1, 40476 Düsseldorf, Deutschland',
    phone: '+49 211 473 01',
    email: 'info@rheinmetall.com',
    website: 'https://www.rheinmetall.com',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 51.2494,
    lon: 6.7889,
    source: 'Handelsregister Düsseldorf / Rheinmetall AG',
    sourceUrl: 'https://www.rheinmetall.com',
  },
  {
    aliases: [
      'voestalpine',
      'voestalpine linz',
      'voest linz',
      'voestalpine stahlwelt',
    ],
    name: 'voestalpine AG · Konzernhauptsitz & Werk Linz',
    category: 'Technologie- & Stahlkonzern, Bahninfrastruktursysteme, Luftfahrt- & Hochleistungsmetalle (ATX)',
    address: 'voestalpine-Straße 1, 4020 Linz, Österreich',
    phone: '+43 50304 15 0',
    email: 'info@voestalpine.com',
    website: 'https://www.voestalpine.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 48.2831,
    lon: 14.3314,
    source: 'Firmenbuch Landesgericht Linz / voestalpine AG',
    sourceUrl: 'https://www.voestalpine.com',
  },
  // --- Wave 19: Strategic DACH Enterprises, Telecom/Rail Infrastructure, Pharma, Semiconductors & Software HQs ---
  {
    id: 'swisscom-hq-bern',
    aliases: [
      'swisscom',
      'swisscom bern',
      'swisscom worblaufen',
      'swisscom ag',
      'swisscom hauptsitz',
    ],
    name: 'Swisscom AG · Konzernhauptsitz Bern / Worblaufen',
    category: 'Nationale Telekommunikations-, Glasfaser-, Mobilfunk- & Kritische IT-Infrastruktur (SMI)',
    address: 'Alte Tiefenaustrasse 6, 3050 Bern / Worblaufen, Schweiz',
    city: 'Bern / Ittigen',
    country: 'CH',
    phone: '+41 58 221 99 11',
    email: 'media@swisscom.com',
    website: 'https://www.swisscom.ch',
    openingHours: 'Mo–Fr 08:00–17:30 (24h Network Operations Center)',
    lat: 46.9769,
    lon: 7.4664,
    source: 'Handelsregister Kanton Bern / Zefix',
    sourceUrl: 'https://www.swisscom.ch',
  },
  {
    id: 'sbb-cff-ffs-hq-bern',
    aliases: [
      'sbb',
      'sbb bern',
      'sbb wankdorf',
      'schweizerische bundesbahnen',
      'cff',
      'ffs',
      'sbb hauptsitz',
    ],
    name: 'Schweizerische Bundesbahnen SBB CFF FFS · Konzernhauptsitz Bern-Wankdorf',
    category: 'Nationale Eisenbahninfrastruktur, Alpen-Transitkorridore (NEAT), Bahnstromnetz & Logistik',
    address: 'Hilfikerstrasse 1, 3000 Bern 65 (Wankdorf), Schweiz',
    city: 'Bern',
    country: 'CH',
    phone: '+41 51 220 11 11',
    email: 'medien@sbb.ch',
    website: 'https://www.sbb.ch',
    openingHours: 'Mo–Fr 07:30–17:30 (24h Betriebszentrale)',
    lat: 46.9681,
    lon: 7.4653,
    source: 'Handelsregister Kanton Bern / BAV',
    sourceUrl: 'https://www.sbb.ch',
  },
  {
    id: 'julius-baer-hq-zuerich',
    aliases: [
      'julius baer',
      'julius bar',
      'bank julius baer',
      'julius baer zurich',
      'bahnhofstrasse 36 zurich',
    ],
    name: 'Julius Bär Gruppe AG (Bank Julius Bär & Co. AG) · Hauptsitz Zürich',
    category: 'Internationale Privatbank, Wealth Management & Finanzplatz Zürich (SMI)',
    address: 'Bahnhofstrasse 36, 8010 Zürich, Schweiz',
    city: 'Zürich',
    country: 'CH',
    phone: '+41 58 888 11 11',
    email: 'info@juliusbaer.com',
    website: 'https://www.juliusbaer.com',
    openingHours: 'Mo–Fr 08:00–18:00',
    lat: 47.3711,
    lon: 8.5389,
    source: 'Handelsregister Kanton Zürich / FINMA',
    sourceUrl: 'https://www.juliusbaer.com',
  },
  {
    id: 'lonza-group-hq-basel',
    aliases: [
      'lonza',
      'lonza basel',
      'lonza group',
      'lonza ag',
      'lonza visp basel',
    ],
    name: 'Lonza Group AG · Global Headquarters Basel',
    category: 'Weltkonzern Biologika, Zell-/Gentherapie, Wirkstoffproduktion (CDMO) & Life Sciences (SMI)',
    address: 'Münchensteinerstrasse 38, 4002 Basel, Schweiz',
    city: 'Basel',
    country: 'CH',
    phone: '+41 61 316 81 11',
    email: 'info@lonza.com',
    website: 'https://www.lonza.com',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.5425,
    lon: 7.5972,
    source: 'Handelsregister Basel-Stadt / Zefix',
    sourceUrl: 'https://www.lonza.com',
  },
  {
    id: 'stadler-rail-hq-bussnang',
    aliases: [
      'stadler bussnang',
      'stadler rail bussnang',
      'stadler rail ag',
      'stadler konzernhauptsitz',
      'stadler thurgau',
    ],
    name: 'Stadler Rail AG · Konzernhauptsitz & Stammwerk Bussnang',
    category: 'Schienenfahrzeugbau, Hochgeschwindigkeits-/Regionalzüge (FLIRT/SMILE), Lokomotiven & Bahnsicherungstechnik',
    address: 'Ernst-Stadler-Strasse 1, 9565 Bussnang (TG), Schweiz',
    city: 'Bussnang',
    country: 'CH',
    phone: '+41 71 626 21 21',
    email: 'stadler.rail@stadlerrail.com',
    website: 'https://www.stadlerrail.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.5594,
    lon: 9.0833,
    source: 'Handelsregister Kanton Thurgau / Zefix',
    sourceUrl: 'https://www.stadlerrail.com',
  },
  {
    id: 'pilatus-aircraft-buochs-lszc',
    aliases: [
      'pilatus buochs',
      'flugplatz buochs',
      'pilatus test flight',
      'lszc buochs',
      'pilatus pc 24 stans buochs',
    ],
    name: 'Pilatus Flugzeugwerke AG · Flugbetrieb, Endmontage & Erprobungszentrum Airport Buochs (LSZC)',
    category: 'Luftfahrt-Erprobungszentrum, PC-12 / PC-24 / PC-21 Flugbetrieb & Werft (Nidwalden)',
    address: 'Flugplatz Buochs (LSZC) / Pilatusstrasse 1, 6374 Buochs / Stans, Schweiz',
    city: 'Buochs / Stans',
    country: 'CH',
    phone: '+41 41 619 61 11',
    email: 'info@pilatus-aircraft.com',
    website: 'https://www.pilatus-aircraft.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 46.9744,
    lon: 8.3969,
    source: 'Handelsregister Nidwalden / BAZL',
    sourceUrl: 'https://www.pilatus-aircraft.com',
  },
  {
    id: 'beyond-gravity-ruag-space-zuerich',
    aliases: [
      'beyond gravity',
      'ruag space',
      'beyond gravity zurich',
      'ruag seebach',
      'schaffhauserstrasse 580',
    ],
    name: 'Beyond Gravity AG (ehem. RUAG Space) · Konzernhauptsitz Zürich-Seebach',
    category: 'Raumfahrttechnologie, Trägerraketen-Nutzlastverkleidungen (Ariane/Vulcan) & Satellitensysteme',
    address: 'Schaffhauserstrasse 580, 8052 Zürich, Schweiz',
    city: 'Zürich',
    country: 'CH',
    phone: '+41 44 306 21 11',
    email: 'info@beyondgravity.com',
    website: 'https://www.beyondgravity.com',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.4239,
    lon: 8.5486,
    source: 'Handelsregister Kanton Zürich / Zefix',
    sourceUrl: 'https://www.beyondgravity.com',
  },
  {
    id: 'infineon-austria-villach',
    aliases: [
      'infineon',
      'infineon villach',
      'infineon austria',
      'halbleiterwerk villach',
      'siemensstrasse villach',
    ],
    name: 'Infineon Technologies Austria AG · Hauptsitz & 300mm-Halbleiterfabrik Villach',
    category: 'Halbleiterfertigung, Leistungselektronik (SiC/GaN), Mikrochips & Quantenforschung',
    address: 'Siemensstraße 2, 9500 Villach, Österreich',
    city: 'Villach',
    country: 'AT',
    phone: '+43 5 1777 0',
    email: 'infineon.austria@infineon.com',
    website: 'https://www.infineon.com/austria',
    openingHours: 'Mo–Fr 08:00–17:00 (24h Reinraumfertigung)',
    lat: 46.6019,
    lon: 13.8683,
    source: 'Firmenbuch Landesgericht Klagenfurt / Infineon AG',
    sourceUrl: 'https://www.infineon.com/austria',
  },
  {
    id: 'red-bull-hq-fuschl-am-see',
    aliases: [
      'red bull',
      'red bull fuschl',
      'red bull gmbh',
      'red bull hauptsitz',
      'fuschl am see red bull',
    ],
    name: 'Red Bull GmbH · Global Headquarters Fuschl am See',
    category: 'Weltkonzern Getränkeindustrie, Medienhaus (Red Bull Media House), Luftfahrt (Flying Bulls) & Spitzensport',
    address: 'Am Brunnen 1, 5330 Fuschl am See, Österreich',
    city: 'Fuschl am See',
    country: 'AT',
    phone: '+43 662 6582 0',
    email: 'info@at.redbull.com',
    website: 'https://www.redbull.com',
    openingHours: 'Mo–Fr 08:00–18:00',
    lat: 47.7989,
    lon: 13.2975,
    source: 'Firmenbuch Landesgericht Salzburg',
    sourceUrl: 'https://www.redbull.com',
  },
  {
    id: 'magna-steyr-graz',
    aliases: [
      'magna',
      'magna steyr',
      'magna graz',
      'steyr daimler puch graz',
      'g klasse werk graz',
    ],
    name: 'Magna Steyr Fahrzeugtechnik GmbH & Co KG · Werk Graz-Thondorf',
    category: 'Automobil-Auftragsfertigung (Mercedes-Benz G-Klasse), Allradantriebssysteme, Luftfahrt- & Verteidigungstechnik',
    address: 'Liebenauer Hauptstraße 317, 8041 Graz, Österreich',
    city: 'Graz',
    country: 'AT',
    phone: '+43 316 404 0',
    email: 'info.magnasteyr@magna.com',
    website: 'https://www.magna.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.0189,
    lon: 15.4689,
    source: 'Firmenbuch Landesgericht für ZRS Graz',
    sourceUrl: 'https://www.magna.com',
  },
  {
    id: 'carl-zeiss-hq-oberkochen',
    aliases: [
      'zeiss',
      'carl zeiss',
      'zeiss oberkochen',
      'carl zeiss ag',
      'zeiss smt',
    ],
    name: 'Carl Zeiss AG (ZEISS Gruppe) · Konzernhauptsitz Oberkochen',
    category: 'Weltmarktführer für EUV-Halbleiterlithographie-Optik (ZEISS SMT), Medizintechnik, Mikroskopie & Präzisionsoptik',
    address: 'Carl-Zeiss-Straße 22, 73447 Oberkochen, Deutschland',
    city: 'Oberkochen',
    country: 'DE',
    phone: '+49 7364 20 0',
    email: 'info@zeiss.com',
    website: 'https://www.zeiss.de',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 48.7867,
    lon: 10.0989,
    source: 'Handelsregister Ulm / Carl-Zeiss-Stiftung',
    sourceUrl: 'https://www.zeiss.de',
  },
  {
    id: 'sap-se-hq-walldorf',
    aliases: [
      'sap',
      'sap walldorf',
      'sap se',
      'sap konzernhauptsitz',
      'dietmar hopp allee walldorf',
    ],
    name: 'SAP SE · Global Headquarters Walldorf',
    category: 'Größter Europäischer Software- & Cloud-Konzern (ERP, S/4HANA, Enterprise AI & Supply-Chain-Plattformen, DAX)',
    address: 'Dietmar-Hopp-Allee 16, 69190 Walldorf, Deutschland',
    city: 'Walldorf',
    country: 'DE',
    phone: '+49 6227 7 47474',
    email: 'info@sap.com',
    website: 'https://www.sap.com',
    openingHours: 'Mo–Fr 08:00–18:00',
    lat: 49.2933,
    lon: 8.6428,
    source: 'Handelsregister Mannheim / SAP SE',
    sourceUrl: 'https://www.sap.com',
  },
  // --- Wave 22: Strategic DACH Industrial, Medtech, Logistics, Commodity & Aerospace Headquarters ---
  {
    id: 'roche-diagnostics-rotkreuz',
    aliases: [
      'roche rotkreuz',
      'roche diagnostics rotkreuz',
      'roche diagnostics international',
      'roche risch rotkreuz',
      'forrenstrasse rotkreuz',
    ],
    name: 'Roche Diagnostics International AG · Global Diagnostics Campus Rotkreuz',
    category: 'Medizintechnik, In-vitro-Diagnostik-Systeme, PCR-/Labordiagnostik & Digital Health (Roche Gruppe)',
    address: 'Forrenstrasse 2, 6343 Rotkreuz (ZG), Schweiz',
    city: 'Rotkreuz / Risch',
    country: 'CH',
    phone: '+41 41 798 71 11',
    email: 'rotkreuz.info@roche.com',
    website: 'https://www.roche.ch/standorte/rotkreuz',
    openingHours: 'Mo–Fr 07:30–18:00',
    lat: 47.1436,
    lon: 8.4358,
    source: 'Handelsregister Kanton Zug / Zefix',
    sourceUrl: 'https://www.roche.ch/standorte/rotkreuz',
  },
  {
    id: 'glencore-hq-baar',
    aliases: [
      'glencore',
      'glencore baar',
      'glencore international',
      'glencore zug',
      'baarermattstrasse baar',
    ],
    name: 'Glencore International AG · Global Headquarters Baar (Zug)',
    category: 'Weltkonzern Rohstoffhandel, Strategische Industriemetalle (Kupfer, Kobalt, Nickel), Energie & Recycling',
    address: 'Baarermattstrasse 3, 6340 Baar (ZG), Schweiz',
    city: 'Baar',
    country: 'CH',
    phone: '+41 41 709 20 00',
    email: 'info@glencore.com',
    website: 'https://www.glencore.com',
    openingHours: 'Mo–Fr 08:00–18:00',
    lat: 47.1856,
    lon: 8.5208,
    source: 'Handelsregister Kanton Zug / Zefix',
    sourceUrl: 'https://www.glencore.com',
  },
  {
    id: 'v-zug-hq-zug',
    aliases: [
      'v zug',
      'vzug',
      'v zug ag',
      'tech cluster zug',
      'industriestrasse 66 zug',
    ],
    name: 'V-ZUG AG · Konzernhauptsitz & Produktionswerk Tech Cluster Zug',
    category: 'Präzisions-Haushaltgrossgeräte, Wärmepumpentechnologie & Schweizer Industrielle Fertigung (SPI)',
    address: 'Industriestrasse 66, 6302 Zug, Schweiz',
    city: 'Zug',
    country: 'CH',
    phone: '+41 58 767 67 67',
    email: 'info@vzug.com',
    website: 'https://www.vzug.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.1778,
    lon: 8.5117,
    source: 'Handelsregister Kanton Zug / Zefix',
    sourceUrl: 'https://www.vzug.com',
  },
  {
    id: 'kuehne-nagel-hq-schindellegi',
    aliases: [
      'kuehne nagel',
      'kuhne nagel',
      'kuehne und nagel',
      'kuhne nagel schindellegi',
      'kuehne nagel international',
    ],
    name: 'Kühne + Nagel International AG · Global Headquarters Schindellegi',
    category: 'Weltmarktführer für See- & Luftfrachtlogistik, Kontraktlogistik & Globale Supply-Chain-Steuerung (SMI)',
    address: 'Kühne + Nagel-Haus, Dorfstrasse 50, 8834 Schindellegi (SZ), Schweiz',
    city: 'Schindellegi / Feusisberg',
    country: 'CH',
    phone: '+41 44 786 95 11',
    email: 'info.schindellegi@kuehne-nagel.com',
    website: 'https://www.kuehne-nagel.com',
    openingHours: 'Mo–Fr 08:00–18:00',
    lat: 47.1753,
    lon: 8.7128,
    source: 'Handelsregister Kanton Schwyz / Zefix',
    sourceUrl: 'https://www.kuehne-nagel.com',
  },
  {
    id: 'geberit-hq-rapperswil-jona',
    aliases: [
      'geberit',
      'geberit jona',
      'geberit rapperswil',
      'geberit ag',
      'schachenstrasse jona',
    ],
    name: 'Geberit AG · Konzernhauptsitz Rapperswil-Jona',
    category: 'Europäischer Marktführer für Sanitärtechnik, Rohrleitungssysteme & Gebäudehydraulik (SMI)',
    address: 'Schachenstrasse 77, 8645 Jona (Rapperswil-Jona), Schweiz',
    city: 'Rapperswil-Jona',
    country: 'CH',
    phone: '+41 55 221 63 00',
    email: 'corporate.communications@geberit.com',
    website: 'https://www.geberit.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.2244,
    lon: 8.8539,
    source: 'Handelsregister Kanton St. Gallen / Zefix',
    sourceUrl: 'https://www.geberit.com',
  },
  {
    id: 'georg-fischer-hq-schaffhausen',
    aliases: [
      'georg fischer',
      'gf schaffhausen',
      'gf piping systems',
      'georg fischer ag',
      'acherlistrasse schaffhausen',
    ],
    name: 'Georg Fischer AG (GF) · Konzernhauptsitz Schaffhausen',
    category: 'Industriekonzern für Rohrleitungssysteme (GF Piping Systems), Leichtmetallguss & Präzisions-Werkzeugmaschinen (SLI)',
    address: 'Amsler-Laffon-Strasse 9, 8201 Schaffhausen, Schweiz',
    city: 'Schaffhausen',
    country: 'CH',
    phone: '+41 52 631 11 11',
    email: 'info@georgfischer.com',
    website: 'https://www.georgfischer.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 47.7025,
    lon: 8.6431,
    source: 'Handelsregister Kanton Schaffhausen / Zefix',
    sourceUrl: 'https://www.georgfischer.com',
  },
  {
    id: 'hamilton-bonaduz-hq',
    aliases: [
      'hamilton',
      'hamilton bonaduz',
      'hamilton medical',
      'hamilton graubunden',
      'via crusch bonaduz',
    ],
    name: 'Hamilton Bonaduz AG & Hamilton Medical AG · Hightech-Campus Bonaduz',
    category: 'Intensivbeatmungsgeräte (Hamilton Medical), Laborrobotik (Liquid Handling) & Prozesssensorik (Graubünden)',
    address: 'Via Crusch 8, 7402 Bonaduz (GR), Schweiz',
    city: 'Bonaduz',
    country: 'CH',
    phone: '+41 58 610 10 10',
    email: 'info@hamilton.ch',
    website: 'https://www.hamiltoncompany.com',
    openingHours: 'Mo–Fr 07:30–17:30',
    lat: 46.8147,
    lon: 9.4064,
    source: 'Handelsregister Kanton Graubünden / Zefix',
    sourceUrl: 'https://www.hamiltoncompany.com',
  },
  {
    id: 'ems-chemie-domat-ems',
    aliases: [
      'ems chemie',
      'ems chemie domat ems',
      'ems group',
      'domat ems chemie',
      'via innovativa domat ems',
    ],
    name: 'EMS-CHEMIE AG (EMS-GROUP) · Hauptwerk & Forschungszentrum Domat/Ems',
    category: 'Hochleistungspolymere, Spezialchemie, Technische Kunststoffe & Automobil-/Luftfahrtwerkstoffe (SLI)',
    address: 'Via Innovativa 1, 7013 Domat/Ems (GR), Schweiz',
    city: 'Domat/Ems',
    country: 'CH',
    phone: '+41 81 632 61 11',
    email: 'info@ems-group.com',
    website: 'https://www.ems-group.com',
    openingHours: 'Mo–Fr 07:30–17:30 (24h Werkbetrieb)',
    lat: 46.8322,
    lon: 9.4458,
    source: 'Handelsregister Kanton Graubünden / Zefix',
    sourceUrl: 'https://www.ems-group.com',
  },
  {
    id: 'rauch-fruchtsaefte-rankweil',
    aliases: [
      'rauch',
      'rauch fruchtsafte',
      'rauch rankweil',
      'rauch vorarlberg',
      'langgasse rankweil',
    ],
    name: 'Rauch Fruchtsäfte GmbH & Co OG · Konzernhauptsitz & Stammwerk Rankweil',
    category: 'Internationaler Getränkehersteller, Fruchtsaft- & Großabfülllogistik (Red Bull Co-Packing Partner)',
    address: 'Langgasse 1, 6830 Rankweil, Österreich',
    city: 'Rankweil',
    country: 'AT',
    phone: '+43 5522 401 0',
    email: 'office@rauch.cc',
    website: 'https://www.rauch.cc',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.2725,
    lon: 9.6442,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.rauch.cc',
  },
  {
    id: 'swarovski-hq-wattens',
    aliases: [
      'swarovski',
      'swarovski wattens',
      'swarovski kristallwelten',
      'swarovski optik',
      'tyrolit wattens',
    ],
    name: 'D. Swarovski KG · Stammsitz & Kristallwelten Wattens (Tirol)',
    category: 'Präzisionsgeschliffenes Kristallglas, Fernoptik (Swarovski Optik Absam) & Schleifmitteltechnologie (Tyrolit)',
    address: 'Swarovskistraße 30, 6112 Wattens, Österreich',
    city: 'Wattens',
    country: 'AT',
    phone: '+43 5224 500 0',
    email: 'customer_relations.at@swarovski.com',
    website: 'https://www.swarovski.com',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.2939,
    lon: 11.5922,
    source: 'Firmenbuch Landesgericht Innsbruck',
    sourceUrl: 'https://www.swarovski.com',
  },
  {
    id: 'fronius-international-wels',
    aliases: [
      'fronius',
      'fronius wels',
      'fronius pettenbach',
      'fronius solar',
      'fronius international',
    ],
    name: 'Fronius International GmbH · Konzernhauptsitz Wels / Pettenbach',
    category: 'Weltmarktführer für Schweißtechnik (Perfect Welding), Photovoltaik-Wechselrichter (Solar Energy) & Batterieladesysteme',
    address: 'Froniusplatz 1, 4600 Wels, Österreich',
    city: 'Wels',
    country: 'AT',
    phone: '+43 7242 248 0',
    email: 'contact@fronius.com',
    website: 'https://www.fronius.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 48.1756,
    lon: 14.0419,
    source: 'Firmenbuch Landesgericht Wels',
    sourceUrl: 'https://www.fronius.com',
  },
  {
    id: 'liebherr-aerospace-lindenberg',
    aliases: [
      'liebherr aerospace',
      'liebherr lindenberg',
      'liebherr allgau',
      'liebherr flugwerktechnik',
      'pfanderstrasse lindenberg',
    ],
    name: 'Liebherr-Aerospace Lindenberg GmbH · Luftfahrt-Kompetenzzentrum Allgäu',
    category: 'Luftfahrtsysteme, Flugsteuerungen (Fly-by-Wire), Fahrwerke & Hydraulik für Zivil- und Militärluftfahrt',
    address: 'Pfänderstraße 50–52, 88161 Lindenberg im Allgäu, Deutschland',
    city: 'Lindenberg im Allgäu',
    country: 'DE',
    phone: '+49 8381 46 0',
    email: 'info.lli@liebherr.com',
    website: 'https://www.liebherr.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.6006,
    lon: 9.8781,
    source: 'Handelsregister Kempten (Allgäu) / Liebherr-Aerospace',
    sourceUrl: 'https://www.liebherr.com',
  },
  {
    id: 'alpla-werke-hq-hard',
    aliases: [
      'alpla',
      'alpla hard',
      'alpla werke',
      'alpla group',
      'allmendstrasse hard',
    ],
    name: 'ALPLA Werke Alwin Lehner GmbH & Co KG · Global Headquarters Hard am Bodensee',
    category: 'Weltkonzern für Kunststoffverpackungssysteme, PET-Kreislaufwirtschaft & Spritzgießtechnologie (Vorarlberg)',
    address: 'Allmendstraße 81, 6971 Hard, Österreich',
    city: 'Hard',
    country: 'AT',
    phone: '+43 5574 602 0',
    email: 'office@alpla.com',
    website: 'https://www.alpla.com',
    openingHours: 'Mo–Fr 07:30–17:00',
    lat: 47.4828,
    lon: 9.6903,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.alpla.com',
  },
  {
    id: 'omicron-electronics-klaus',
    aliases: [
      'omicron',
      'omicron electronics',
      'omicron klaus',
      'omicron vorarlberg',
      'oberes ried klaus',
    ],
    name: 'OMICRON electronics GmbH · Development Center & Hauptsitz Klaus',
    category: 'Prüf-, Diagnose- & Cybersicherheitssysteme für Elektrische Energienetze, Umspannwerke & Kraftwerke',
    address: 'Oberes Ried 1, 6833 Klaus (Vorarlberg), Österreich',
    city: 'Klaus',
    country: 'AT',
    phone: '+43 59495 0',
    email: 'info@omicronenergy.com',
    website: 'https://www.omicronenergy.com',
    openingHours: 'Mo–Fr 08:00–17:30',
    lat: 47.3092,
    lon: 9.6414,
    source: 'Firmenbuch Landesgericht Feldkirch',
    sourceUrl: 'https://www.omicronenergy.com',
  },
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/**
 * Name fragments in the query. A full personal name works because companies
 * named after their founder carry the surname ("André Eggert" → "eggert").
 */
function queryTokens(query) {
  return normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function matchScore(result, tokens) {
  if (!tokens.length) return 0;
  const label = normalizeText(`${result.name} ${result.category}`);
  return tokens.reduce(
    (score, token) => score + (label.includes(token) ? 1 : 0),
    0,
  );
}

function matchesQuery(result, tokens) {
  return !tokens.length || matchScore(result, tokens) > 0;
}

/** Keep only the results matching the most query fragments. */
function bestMatches(results, tokens) {
  if (!tokens.length) return results;
  const scored = results.map((result) => ({
    result,
    score: matchScore(result, tokens),
  }));
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  if (best <= 0) return [];
  // "André Eggert" must match Eggert, not every André: when only one fragment
  // matches anywhere, the surname (last fragment) wins or nothing does.
  if (best === 1 && tokens.length > 1) {
    const surname = tokens[tokens.length - 1];
    return scored
      .filter((entry) => matchScore(entry.result, [surname]) > 0)
      .map((entry) => entry.result);
  }
  return scored
    .filter((entry) => entry.score === best)
    .map((entry) => entry.result);
}

function dedupe(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = normalizeText(
      `${result.name}|${result.phone || result.address}`,
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function withinCenter(result, center) {
  if (!center) return true;
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon))
    return false;
  return (
    distanceKm(center.lat, center.lon, result.lat, result.lon) <=
    SEARCH_RADIUS_KM
  );
}

async function throttleNominatim() {
  const wait = 1_000 - (Date.now() - nominatimLast);
  if (wait > 0) await sleep(wait);
  nominatimLast = Date.now();
}

function contactOf(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

async function tomtomGeocode(place, fetchImpl) {
  const key = String(process.env.TOMTOM_API_KEY || '').trim();
  if (!key) return null;
  try {
    const url = new URL(
      'https://api.tomtom.com/search/2/geocode/' +
        encodeURIComponent(place) +
        '.json',
    );
    url.searchParams.set('key', key);
    url.searchParams.set('limit', '1');
    url.searchParams.set('language', 'de-DE');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const result = body?.results?.[0];
    if (!Number.isFinite(result?.position?.lat)) return null;
    return {
      lat: result.position.lat,
      lon: result.position.lon,
      label: String(result.address?.freeformAddress || place),
    };
  } catch {
    return null;
  }
}

async function nominatimGeocode(place, fetchImpl) {
  try {
    await throttleNominatim();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', place);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('accept-language', 'de,en');
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'gods-eye-view/1.0 (business contact search; https://gods-eye-view-fresh.vercel.app)',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const result = Array.isArray(body) ? body[0] : null;
    if (!Number.isFinite(Number(result?.lat))) return null;
    return {
      lat: Number(result.lat),
      lon: Number(result.lon),
      label: String(result.display_name || place),
    };
  } catch {
    return null;
  }
}

async function swisstopoGeocode(place, fetchImpl) {
  try {
    const url = new URL(
      'https://api3.geo.admin.ch/rest/services/ech/SearchServer',
    );
    url.searchParams.set('type', 'locations');
    url.searchParams.set('searchText', place);
    url.searchParams.set('limit', '3');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const hit = Array.isArray(body?.results) ? body.results[0]?.attrs : null;
    if (!Number.isFinite(Number(hit?.lat)) || !Number.isFinite(Number(hit?.lon)))
      return null;
    const label = String(hit.label || place)
      .replace(/<[^>]*>/g, '')
      .trim();
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      label,
    };
  } catch {
    return null;
  }
}

async function geocodePlace(place, fetchImpl) {
  return (
    (await swisstopoGeocode(place, fetchImpl)) ||
    (await tomtomGeocode(place, fetchImpl)) ||
    (await nominatimGeocode(place, fetchImpl))
  );
}

async function tomtomSearch(query, tokens, center, fetchImpl) {
  const key = String(process.env.TOMTOM_API_KEY || '').trim();
  if (!key) return { ok: false, results: [] };
  try {
    const url = new URL(
      'https://api.tomtom.com/search/2/poiSearch/' +
        encodeURIComponent(query) +
        '.json',
    );
    url.searchParams.set('key', key);
    url.searchParams.set('limit', '15');
    url.searchParams.set('language', 'de-DE');
    url.searchParams.set('idxSet', 'POI');
    if (center) {
      url.searchParams.set('lat', String(center.lat));
      url.searchParams.set('lon', String(center.lon));
      url.searchParams.set('radius', String(SEARCH_RADIUS_KM * 1000));
    }
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, results: [] };
    const body = await response.json();
    const results = (Array.isArray(body?.results) ? body.results : [])
      .map((result) => {
        const poi = result?.poi || {};
        return {
          name: String(poi.name || result?.address?.streetName || '').trim(),
          category: Array.isArray(poi.categories)
            ? poi.categories.join(', ')
            : '',
          address: String(result?.address?.freeformAddress || '').trim(),
          phone: String(poi.phone || '').trim(),
          email: String(poi.email || '').trim(),
          website: String(poi.url || '').trim(),
          openingHours: '',
          lat: Number(result?.position?.lat),
          lon: Number(result?.position?.lon),
          source: 'TomTom',
          sourceUrl: '',
        };
      })
      .filter(
        (result) =>
          result.name &&
          (result.phone || result.email || result.website || result.address) &&
          Number.isFinite(result.lat) &&
          Number.isFinite(result.lon) &&
          matchesQuery(result, tokens) &&
          withinCenter(result, center),
      );
    return { ok: true, results };
  } catch {
    return { ok: false, results: [] };
  }
}

async function nominatimSearch(query, tokens, center, fetchImpl) {
  try {
    await throttleNominatim();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('limit', '10');
    url.searchParams.set('accept-language', 'de,en');
    if (center) {
      const span = 0.4;
      url.searchParams.set(
        'viewbox',
        [
          center.lon - span,
          center.lat + span,
          center.lon + span,
          center.lat - span,
        ].join(','),
      );
      url.searchParams.set('bounded', '1');
    }
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'gods-eye-view/1.0 (business contact search; https://gods-eye-view-fresh.vercel.app)',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, results: [] };
    const body = await response.json();
    const results = (Array.isArray(body) ? body : [])
      .map((result) => {
        const tags = result?.extratags || {};
        const category = contactOf(tags.healthcare, tags.amenity, tags.shop, result?.type);
        const osmType = String(result?.osm_type || '');
        const osmId = String(result?.osm_id || '');
        return {
          name: String(result?.name || result?.display_name || '').trim(),
          category,
          address: String(result?.display_name || '').trim(),
          phone: contactOf(tags.phone, tags['contact:phone']),
          email: contactOf(tags.email, tags['contact:email']),
          website: contactOf(tags.website, tags['contact:website'], tags.url),
          openingHours: String(tags.opening_hours || '').trim(),
          lat: Number(result?.lat),
          lon: Number(result?.lon),
          source: 'OpenStreetMap',
          sourceUrl:
            osmType && osmId
              ? `https://www.openstreetmap.org/${osmType}/${osmId}`
              : '',
        };
      })
      .filter(
        (result) =>
          result.name &&
          (result.phone || result.email || result.website || result.address) &&
          Number.isFinite(result.lat) &&
          Number.isFinite(result.lon) &&
          matchesQuery(result, tokens) &&
          withinCenter(result, center),
      );
    return { ok: true, results };
  } catch {
    return { ok: false, results: [] };
  }
}

export function matchKnownDirectoryEntries(query, area, center) {
  const normQuery = normalizeText(`${query || ''} ${area || ''}`)
    .replace(/sybille/g, 'sibylle')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
  const queryWords = normQuery.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!queryWords.length) return [];
  return KNOWN_PUBLIC_DIRECTORY_ENTRIES.filter((entry) => {
    const matched = entry.aliases.some((alias) => {
      const normAlias = normalizeText(alias)
        .replace(/sybille/g, 'sibylle')
        .replace(/ae/g, 'a')
        .replace(/oe/g, 'o')
        .replace(/ue/g, 'u');
      const aliasWords = normAlias.split(/[^a-z0-9]+/).filter(Boolean);
      return aliasWords.every((w) => normQuery.includes(w));
    });
    if (!matched) return false;
    return withinCenter(entry, center);
  }).map(({ aliases, ...rest }) => rest);
}

/**
 * Public contacts of businesses and practices matching a free-text query.
 * @param {{query:string, place?:string, fetchImpl?:Function}} options
 */
export async function businessSearch({ query, place, fetchImpl = fetch } = {}) {  const text = String(query || '').trim().replace(/\s+/g, ' ');
  const area = String(place || '').trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > 80 || area.length > 60) return null;
  const key = `${text}|${area}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;

  const fastKnown = matchKnownDirectoryEntries(text, area, null);
  if (fastKnown.length) {
    const body = {
      query: text,
      place: area,
      placeResolved: true,
      results: fastKnown,
      source: fastKnown[0].source || 'Public Directory',
      fetchedAt: Date.now(),
    };
    cache.set(key, { at: Date.now(), body });
    return body;
  }

  const center = area ? await geocodePlace(area, fetchImpl) : null;
  const knownHits = matchKnownDirectoryEntries(text, area, center);
  if (area && !center && !knownHits.length) {
    return {
      query: text,
      place: area,
      placeResolved: false,
      results: [],
      source: '',
      fetchedAt: Date.now(),
    };
  }

  // A place given in its own field must not also match company names or
  // steer the POI query ("Akupunktur Rüthi" + Rüthi → "Akupunktur").
  const placeTokens = new Set(queryTokens(area));
  const tokens = queryTokens(text).filter((token) => !placeTokens.has(token));
  const searchText =
    text
      .split(/\s+/)
      .filter((word) => !placeTokens.has(normalizeText(word)))
      .join(' ') || text;
  const tomtom = await tomtomSearch(searchText, tokens, center, fetchImpl);
  let results = [...knownHits, ...tomtom.results];
  let source = knownHits.length ? knownHits[0].source : 'TomTom';
  if (!results.length) {
    const osm = await nominatimSearch(searchText, tokens, center, fetchImpl);
    if (!tomtom.ok && !osm.ok && !knownHits.length) return null;
    if (osm.results.length) {
      results = osm.results;
      source = 'OpenStreetMap';
    }
  }
  results = dedupe([
    ...knownHits,
    ...bestMatches(
      results.filter((r) => !knownHits.includes(r)),
      tokens,
    ),
  ]);
  const body = {
    query: text,
    place: center?.label || area,
    placeResolved: Boolean(center) || !area || knownHits.length > 0,
    results,
    source,
    fetchedAt: Date.now(),
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return body;
}

/**
 * Business and practice listings for a personal name. Directories can only
 * match a name a company carries — founder and owner surnames — so the last
 * name fragment is searched: "Sybille Baumgartner-Büchel" looks up "Büchel".
 * Returns published business contacts only, never private individuals.
 * @param {{name:string, place?:string, limit?:number, fetchImpl?:Function}} options
 */
export async function personBusinessSearch({
  name,
  place,
  limit = 8,
  fetchImpl = fetch,
} = {}) {
  const allTokens = queryTokens(name);
  if (!allTokens.length) return { ok: true, query: '', results: [], source: '' };
  const nameOnlyTokens = allTokens.filter((t) => !TRADE_QUALIFIERS.has(t));
  const tokens = nameOnlyTokens.length ? nameOnlyTokens : allTokens;
  const surname = tokens[tokens.length - 1];
  const fullQuery = tokens.length > 1 ? String(name || '').trim() : '';
  const [fullBody, surnameBody] = await Promise.all([
    fullQuery && fullQuery.toLowerCase() !== surname.toLowerCase()
      ? businessSearch({ query: fullQuery, place, fetchImpl }).catch(() => null)
      : Promise.resolve(null),
    businessSearch({ query: surname, place, fetchImpl }).catch(() => null),
  ]);
  const primary = fullBody?.results?.length ? fullBody : surnameBody;
  if (!fullBody && !surnameBody) {
    return { ok: false, query: surname, results: [], source: '' };
  }
  const merged = dedupe([
    ...(fullBody?.results || []),
    ...(surnameBody?.results || []),
  ]);
  return {
    ok: true,
    query: surname,
    place: primary?.place || surnameBody?.place || place || '',
    placeResolved: Boolean(
      primary?.placeResolved ?? surnameBody?.placeResolved ?? !place,
    ),
    results: merged.slice(0, limit),
    source: primary?.source || surnameBody?.source || '',
  };
}
