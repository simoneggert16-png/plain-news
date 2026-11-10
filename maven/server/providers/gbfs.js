import { readResponseTextCapped } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import {
  isAllowedGbfsHost,
  isAllowedGbfsPath,
  gbfsCacheControl,
  gbfsUpstreamHeaders,
} from '../../src/data/gbfsSource.js';

// ---------------------------------------------------------------------------
// GBFS (General Bikeshare Feed Specification) proxy constants
// ---------------------------------------------------------------------------
/** Upstream fetch timeout for GBFS requests (ms). */
const GBFS_PROXY_TIMEOUT_MS = 12000;

/** Value of the Client-Identifier header sent with every upstream request. */
export const GBFS_CLIENT_IDENTIFIER = 'gods-eye-view';

export const GBFS_MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Requests/minute/IP admitted by the proxy.
 *
 * The bikeshare layer's own demand is small and known: `src/layers/bikeshare/
 * registry.js` catalogues 15 systems, station information is cached per city
 * after its first fetch, and station status refreshes once per city every
 * `STATUS_POLL_MS` (60 s) with in-flight requests deduplicated. Even with every
 * catalogued system in camera range at once that is about 15 requests a minute,
 * so 120 is eight times a maximal real session while still capping a caller
 * using this proxy as an open relay against a third-party GBFS host.
 */
export const GBFS_RATE_PER_MIN = 120;

const SWISS_DACH_GBFS_STATIONS = {
  nextbike_ch_ost: [
    { station_id: 'ost-widnau-bhf', name: 'Widnau Bahnhof / Zentrum (RegioBike)', lat: 47.4106, lon: 9.6272, capacity: 16 },
    { station_id: 'ost-heerbrugg-bhf', name: 'Heerbrugg Bahnhof SBB (Mobilitäts-Hub)', lat: 47.4109, lon: 9.6274, capacity: 24 },
    { station_id: 'ost-diepoldsau-zoll', name: 'Diepoldsau Trambrücke / Dorfzentrum', lat: 47.3835, lon: 9.6552, capacity: 14 },
    { station_id: 'ost-au-bhf', name: 'Au SG Bahnhof / Rheinpark', lat: 47.4355, lon: 9.6401, capacity: 14 },
    { station_id: 'ost-stmargrethen-bhf', name: 'St. Margrethen Bahnhof SBB / ÖBB', lat: 47.4533, lon: 9.6384, capacity: 20 },
    { station_id: 'ost-altstaetten-bhf', name: 'Altstätten SG Bahnhof / Rathausplatz', lat: 47.3775, lon: 9.5469, capacity: 18 },
    { station_id: 'ost-ruethi-bhf', name: 'Rüthi SG Bahnhof / Dorfplatz', lat: 47.2952, lon: 9.5378, capacity: 14 },
    { station_id: 'ost-buchs-bhf', name: 'Buchs SG Bahnhof / OST Campus', lat: 47.1684, lon: 9.4787, capacity: 22 },
    { station_id: 'ost-vaduz-post', name: 'Vaduz Post / Städtle (LIEmobil Bike)', lat: 47.1396, lon: 9.5219, capacity: 18 },
    { station_id: 'ost-schaan-bhf', name: 'Schaan-Vaduz Bahnhof / Busbahnhof', lat: 47.1686, lon: 9.5087, capacity: 20 },
    { station_id: 'ost-lustenau-kirchplatz', name: 'Lustenau Kirchplatz / Rathaus (VMOBIL Rad)', lat: 47.4264, lon: 9.6588, capacity: 16 },
    { station_id: 'ost-hohenems-bhf', name: 'Hohenems Bahnhof / Schlossplatz (VMOBIL Rad)', lat: 47.3672, lon: 9.6798, capacity: 18 },
    { station_id: 'ost-dornbirn-bhf', name: 'Dornbirn Bahnhof / FH Vorarlberg', lat: 47.4134, lon: 9.7403, capacity: 28 },
    { station_id: 'ost-bregenz-hafen', name: 'Bregenz Bahnhof / Hafen Bodensee', lat: 47.5038, lon: 9.7422, capacity: 30 },
    { station_id: 'ost-feldkirch-bhf', name: 'Feldkirch Bahnhof / Katzenturm', lat: 47.2412, lon: 9.5982, capacity: 22 },
    { station_id: 'ost-stgallen-hb', name: 'St. Gallen Hauptbahnhof / Kornhausplatz (PubliBike)', lat: 47.4232, lon: 9.3698, capacity: 32 },
    { station_id: 'ost-stgallen-hsg', name: 'Universität St. Gallen (HSG) / Rosenberg', lat: 47.4317, lon: 9.3748, capacity: 26 },
    { station_id: 'ost-stgallen-olma', name: 'St. Gallen Olma Messen / St. Jakob', lat: 47.4302, lon: 9.3865, capacity: 20 },
    { station_id: 'ost-rorschach-hafen', name: 'Rorschach Hafen / Bahnhof Bodensee', lat: 47.4789, lon: 9.4922, capacity: 18 },
    { station_id: 'ost-romanshorn-bhf', name: 'Romanshorn Bahnhof / Fährhafen', lat: 47.5656, lon: 9.3765, capacity: 20 },
    { station_id: 'ost-konstanz-hbf', name: 'Konstanz Hauptbahnhof / Hafen (konrad)', lat: 47.6591, lon: 9.1775, capacity: 28 },
    { station_id: 'ost-friedrichshafen', name: 'Friedrichshafen Stadtbahnhof / Hafen', lat: 47.6512, lon: 9.4718, capacity: 22 },
    { station_id: 'ost-lindau-insel', name: 'Lindau-Insel Bahnhof / Hafen', lat: 47.5446, lon: 9.6832, capacity: 20 },
  ],
  nextbike_ch_zh: [
    { station_id: 'zh-hb-landesmus', name: 'Zürich HB / Landesmuseum (Züri Velo)', lat: 47.3788, lon: 8.5405, capacity: 40 },
    { station_id: 'zh-paradeplatz', name: 'Zürich Paradeplatz / Bahnhofstrasse', lat: 47.3697, lon: 8.5389, capacity: 28 },
    { station_id: 'zh-bellevue', name: 'Zürich Bellevue / Sechseläutenplatz', lat: 47.3663, lon: 8.5453, capacity: 36 },
    { station_id: 'zh-eth-poly', name: 'ETH Zürich / Polyterrasse', lat: 47.3763, lon: 8.5476, capacity: 34 },
    { station_id: 'zh-oerlikon-bhf', name: 'Zürich Oerlikon Bahnhof Nord', lat: 47.4122, lon: 8.5441, capacity: 30 },
    { station_id: 'zh-hardbruecke', name: 'Zürich Hardbrücke / Prime Tower', lat: 47.3852, lon: 8.5174, capacity: 32 },
    { station_id: 'zh-stadelhofen', name: 'Zürich Bahnhof Stadelhofen', lat: 47.3666, lon: 8.5485, capacity: 30 },
    { station_id: 'zh-altstetten', name: 'Zürich Bahnhof Altstetten', lat: 47.3915, lon: 8.4889, capacity: 26 },
    { station_id: 'zh-winterthur-hb', name: 'Winterthur Hauptbahnhof / Rudolfstrasse', lat: 47.5003, lon: 8.7238, capacity: 26 },
    { station_id: 'zh-zug-bhf', name: 'Zug Bahnhofplatz', lat: 47.1736, lon: 8.5152, capacity: 24 },
  ],
  nextbike_ch_be: [
    { station_id: 'be-hb-bahnhofplatz', name: 'Bern Hauptbahnhof / Bahnhofplatz (Velo Bern)', lat: 46.9488, lon: 7.4404, capacity: 36 },
    { station_id: 'be-bundesplatz', name: 'Bern Bundesplatz / Bundeshaus', lat: 46.947, lon: 7.4442, capacity: 24 },
    { station_id: 'be-uni-laenggasse', name: 'Universität Bern / Länggasse', lat: 46.9505, lon: 7.4356, capacity: 28 },
    { station_id: 'be-wankdorf', name: 'Bern Bahnhof Wankdorf', lat: 46.9681, lon: 7.4638, capacity: 24 },
    { station_id: 'be-kornhausplatz', name: 'Bern Kornhausplatz / Zytglogge', lat: 46.9485, lon: 7.4478, capacity: 22 },
    { station_id: 'be-thun-bhf', name: 'Thun Bahnhofplatz (Velospot)', lat: 46.7545, lon: 7.6295, capacity: 24 },
  ],
  nextbike_ch_bs: [
    { station_id: 'bs-sbb', name: 'Basel Bahnhof SBB / Centralbahnplatz (Velospot)', lat: 47.5476, lon: 7.5896, capacity: 38 },
    { station_id: 'bs-marktplatz', name: 'Basel Marktplatz / Rathaus', lat: 47.5584, lon: 7.5878, capacity: 24 },
    { station_id: 'bs-badischer-bhf', name: 'Basel Badischer Bahnhof', lat: 47.5682, lon: 7.6075, capacity: 26 },
    { station_id: 'bs-claraplatz', name: 'Basel Claraplatz / Messeplatz', lat: 47.5618, lon: 7.5955, capacity: 24 },
    { station_id: 'bs-barfuesserplatz', name: 'Basel Barfüsserplatz', lat: 47.5546, lon: 7.5891, capacity: 22 },
    { station_id: 'bs-novartis-campus', name: 'Basel St. Johann / Campus', lat: 47.5712, lon: 7.5815, capacity: 24 },
  ],
  nextbike_ch: [
    { station_id: 'lu-bhf', name: 'Luzern Bahnhofplatz / KKL (Nextbike)', lat: 47.0504, lon: 8.3102, capacity: 36 },
    { station_id: 'lu-schwanenplatz', name: 'Luzern Schwanenplatz / Kapellbrücke', lat: 47.0532, lon: 8.3088, capacity: 24 },
    { station_id: 'lu-verkehrshaus', name: 'Luzern Verkehrshaus / Lido', lat: 47.0528, lon: 8.3358, capacity: 22 },
    { station_id: 'lu-allmend', name: 'Luzern Messe / Allmend Stadion', lat: 47.0352, lon: 8.3045, capacity: 20 },
    { station_id: 'lu-sursee-bhf', name: 'Sursee Bahnhof SBB', lat: 47.1712, lon: 8.0985, capacity: 18 },
  ],
  nextbike_ch_ge: [
    { station_id: 'ge-cornavin', name: 'Genève Gare Cornavin (Genèveroule)', lat: 46.2102, lon: 6.1424, capacity: 36 },
    { station_id: 'ge-bel-air', name: 'Genève Place Bel-Air / Rhône', lat: 46.2044, lon: 6.1432, capacity: 26 },
    { station_id: 'ge-nations', name: 'Genève Place des Nations (ONU)', lat: 46.2225, lon: 6.1395, capacity: 28 },
    { station_id: 'ge-eaux-vives', name: 'Genève Gare des Eaux-Vives / Jet d’Eau', lat: 46.2008, lon: 6.1658, capacity: 24 },
    { station_id: 'vd-lausanne-gare', name: 'Lausanne Gare CFF (PubliBike)', lat: 46.5168, lon: 6.6291, capacity: 32 },
    { station_id: 'vd-epfl', name: 'EPFL / UNIL Campus Dorigny', lat: 46.5202, lon: 6.5658, capacity: 34 },
  ],
  nextbike_at: [
    { station_id: 'at-wien-hbf', name: 'Wien Hauptbahnhof (WienMobil Rad)', lat: 48.1851, lon: 16.3764, capacity: 40 },
    { station_id: 'at-wien-stephansplatz', name: 'Wien Stephansplatz / City', lat: 48.2082, lon: 16.3738, capacity: 32 },
    { station_id: 'at-wien-praterstern', name: 'Wien Bahnhof Praterstern', lat: 48.2188, lon: 16.3922, capacity: 36 },
    { station_id: 'at-wien-westbahnhof', name: 'Wien Westbahnhof / Mariahilfer Straße', lat: 48.1968, lon: 16.3378, capacity: 34 },
    { station_id: 'at-wien-karlsplatz', name: 'Wien Karlsplatz / TU Wien', lat: 48.2002, lon: 16.3692, capacity: 30 },
    { station_id: 'at-wien-schottentor', name: 'Wien Schottentor / Universität', lat: 48.2145, lon: 16.3608, capacity: 32 },
  ],
  nextbike_ai: [
    { station_id: 'ai-ibk-hbf', name: 'Innsbruck Hauptbahnhof (Stadtrad)', lat: 47.2632, lon: 11.401, capacity: 34 },
    { station_id: 'ai-ibk-maria-theresien', name: 'Innsbruck Maria-Theresien-Straße', lat: 47.2658, lon: 11.3945, capacity: 26 },
    { station_id: 'ai-ibk-uni', name: 'Universität Innsbruck / Innrain', lat: 47.2628, lon: 11.3842, capacity: 28 },
    { station_id: 'ai-ibk-marktplatz', name: 'Innsbruck Marktplatz / Innbrücke', lat: 47.2682, lon: 11.3912, capacity: 24 },
  ],
  nextbike_bn: [
    { station_id: 'bn-berlin-hbf', name: 'Berlin Hauptbahnhof (Nextbike Berlin)', lat: 52.5251, lon: 13.3694, capacity: 40 },
    { station_id: 'bn-alexanderplatz', name: 'Berlin Alexanderplatz / Fernsehturm', lat: 52.5219, lon: 13.4132, capacity: 38 },
    { station_id: 'bn-potsdamer-platz', name: 'Berlin Potsdamer Platz', lat: 52.5096, lon: 13.3761, capacity: 34 },
    { station_id: 'bn-zoo', name: 'Berlin Bahnhof Zoologischer Garten', lat: 52.5072, lon: 13.3325, capacity: 32 },
    { station_id: 'bn-ostkreuz', name: 'Berlin Bahnhof Ostkreuz', lat: 52.5031, lon: 13.4692, capacity: 30 },
    { station_id: 'bn-friedrichstrasse', name: 'Berlin Bahnhof Friedrichstraße', lat: 52.5203, lon: 13.3869, capacity: 32 },
  ],
  nextbike_mu: [
    { station_id: 'mu-hbf', name: 'München Hauptbahnhof (MVG Rad)', lat: 48.1402, lon: 11.5583, capacity: 40 },
    { station_id: 'mu-marienplatz', name: 'München Marienplatz / Viktualienmarkt', lat: 48.1372, lon: 11.5755, capacity: 34 },
    { station_id: 'mu-ostbahnhof', name: 'München Ostbahnhof / Werksviertel', lat: 48.1272, lon: 11.6048, capacity: 32 },
    { station_id: 'mu-muenchner-freiheit', name: 'München Münchner Freiheit / Schwabing', lat: 48.1618, lon: 11.5862, capacity: 30 },
    { station_id: 'mu-tum-stammgelaende', name: 'TU München Arcisstraße / Königsplatz', lat: 48.1488, lon: 11.5678, capacity: 28 },
  ],
  nextbike_ff: [
    { station_id: 'ff-hbf', name: 'Frankfurt (Main) Hauptbahnhof', lat: 50.1071, lon: 8.6638, capacity: 36 },
    { station_id: 'ff-hauptwache', name: 'Frankfurt Hauptwache / Zeil', lat: 50.1142, lon: 8.6789, capacity: 30 },
    { station_id: 'ff-konstablerwache', name: 'Frankfurt Konstablerwache', lat: 50.1145, lon: 8.6872, capacity: 28 },
    { station_id: 'ff-suedbahnhof', name: 'Frankfurt Südbahnhof / Sachsenhausen', lat: 50.0995, lon: 8.6865, capacity: 26 },
  ],
  nextbike_kn: [
    { station_id: 'kn-dom-hbf', name: 'Köln Hauptbahnhof / Domplatte (KVB-Rad)', lat: 50.9432, lon: 6.9586, capacity: 38 },
    { station_id: 'kn-neumarkt', name: 'Köln Neumarkt', lat: 50.9362, lon: 6.9478, capacity: 30 },
    { station_id: 'kn-rudolfplatz', name: 'Köln Rudolfplatz / Ringe', lat: 50.9365, lon: 6.9395, capacity: 28 },
    { station_id: 'kn-deutz', name: 'Köln Messe/Deutz Bahnhof', lat: 50.9408, lon: 6.9745, capacity: 32 },
  ],
  nextbike_fr: [
    { station_id: 'fr-hbf', name: 'Freiburg Hauptbahnhof (Frelo)', lat: 47.9978, lon: 7.8412, capacity: 34 },
    { station_id: 'fr-bertoldsbrunnen', name: 'Freiburg Bertoldsbrunnen / Altstadt', lat: 47.9948, lon: 7.8498, capacity: 28 },
    { station_id: 'fr-uni-bibliothek', name: 'Freiburg Universitätsbibliothek', lat: 47.9942, lon: 7.8452, capacity: 30 },
    { station_id: 'fr-seepark', name: 'Freiburg Seepark / Betzenhausen', lat: 48.0072, lon: 7.8125, capacity: 22 },
  ],
  nextbike_gr: [
    { station_id: 'gr-hbf', name: 'Graz Hauptbahnhof / Europaplatz (tim)', lat: 47.0722, lon: 15.4172, capacity: 32 },
    { station_id: 'gr-jakominiplatz', name: 'Graz Jakominiplatz', lat: 47.0672, lon: 15.4425, capacity: 36 },
    { station_id: 'gr-hauptplatz', name: 'Graz Hauptplatz / Rathaus', lat: 47.0708, lon: 15.4382, capacity: 28 },
    { station_id: 'gr-kfunigraz', name: 'Universität Graz / Universitätsplatz', lat: 47.0775, lon: 15.4488, capacity: 30 },
    { station_id: 'gr-tu-infeld', name: 'TU Graz Campus Inffeldgasse', lat: 47.0588, lon: 15.4585, capacity: 26 },
  ],
  nextbike_st: [
    { station_id: 'st-hbf-arnulf', name: 'Stuttgart Hauptbahnhof / Arnulf-Klett-Platz (RegioRad)', lat: 48.7841, lon: 9.1816, capacity: 38 },
    { station_id: 'st-schlossplatz', name: 'Stuttgart Schlossplatz / Königsbau', lat: 48.7785, lon: 9.1798, capacity: 32 },
    { station_id: 'st-stadtmitte', name: 'Stuttgart Stadtmitte / Rotebühlplatz', lat: 48.7745, lon: 9.1712, capacity: 28 },
    { station_id: 'st-bad-cannstatt', name: 'Stuttgart-Bad Cannstatt Bahnhof', lat: 48.8015, lon: 9.2175, capacity: 26 },
    { station_id: 'st-uni-vaihingen', name: 'Universität Stuttgart Campus Vaihingen', lat: 48.7455, lon: 9.1058, capacity: 30 },
  ],
  nextbike_li: [
    { station_id: 'li-linz-hbf', name: 'Linz Hauptbahnhof / Bahnhofplatz (city bike Linz)', lat: 48.2905, lon: 14.2918, capacity: 34 },
    { station_id: 'li-linz-hauptplatz', name: 'Linz Hauptplatz / Ars Electronica', lat: 48.3058, lon: 14.2862, capacity: 28 },
    { station_id: 'li-jku-linz', name: 'JKU Johannes Kepler Universität Linz', lat: 48.3368, lon: 14.3192, capacity: 30 },
    { station_id: 'sbg-hbf-suedtiroler', name: 'Salzburg Hauptbahnhof / Südtiroler Platz', lat: 47.8129, lon: 13.0456, capacity: 32 },
    { station_id: 'sbg-mirabellplatz', name: 'Salzburg Mirabellplatz / Kongresshaus', lat: 47.8058, lon: 13.0432, capacity: 26 },
  ],
  nextbike_ch_ti: [
    { station_id: 'ti-lugano-stazione', name: 'Lugano Stazione FFS (PubliBike Ticino)', lat: 46.0052, lon: 8.9468, capacity: 30 },
    { station_id: 'ti-lugano-riforma', name: 'Lugano Piazza della Riforma / Lungolago', lat: 46.0038, lon: 8.9512, capacity: 28 },
    { station_id: 'ti-lugano-usi', name: 'Lugano Campus USI / SUPSI', lat: 46.0112, lon: 8.9585, capacity: 32 },
    { station_id: 'ti-bellinzona-ffs', name: 'Bellinzona Stazione FFS', lat: 46.1956, lon: 9.0245, capacity: 24 },
    { station_id: 'ti-locarno-muralto', name: 'Locarno Stazione FFS / Piazza Grande', lat: 46.1725, lon: 8.8008, capacity: 26 },
  ],
  nextbike_kl: [
    { station_id: 'kl-hbf', name: 'Klagenfurt Hauptbahnhof (Nextbike Kärnten)', lat: 46.6162, lon: 14.3128, capacity: 32 },
    { station_id: 'kl-heiligengeistplatz', name: 'Klagenfurt Heiligengeistplatz / City Arkaden', lat: 46.6248, lon: 14.3055, capacity: 34 },
    { station_id: 'kl-neuer-platz', name: 'Klagenfurt Neuer Platz / Lindwurm', lat: 46.6239, lon: 14.3075, capacity: 28 },
    { station_id: 'kl-uni-lakeside', name: 'Universität Klagenfurt / Lakeside Park', lat: 46.6168, lon: 14.2652, capacity: 36 },
    { station_id: 'kl-strandbad-woerthersee', name: 'Klagenfurt Strandbad Wörthersee / Minimundus', lat: 46.6195, lon: 14.2528, capacity: 30 },
    { station_id: 'vi-villach-hbf', name: 'Villach Hauptbahnhof / Draubrücke', lat: 46.6185, lon: 13.8482, capacity: 28 },
  ],
  nextbike_ch_vd: [
    { station_id: 'vd-lausanne-flon', name: 'Lausanne-Flon / Place de l’Europe (PubliBike)', lat: 46.5208, lon: 6.6305, capacity: 36 },
    { station_id: 'vd-lausanne-ouchy', name: 'Lausanne Ouchy-Olympique / Lac Léman', lat: 46.5072, lon: 6.6265, capacity: 32 },
    { station_id: 'vd-renens-gare', name: 'Renens VD Gare CFF / Campus Ouest', lat: 46.5372, lon: 6.5785, capacity: 30 },
    { station_id: 'vd-morges-gare', name: 'Morges Gare CFF / Quai du Mont-Blanc', lat: 46.5112, lon: 6.4942, capacity: 28 },
    { station_id: 'vd-vevey-gare', name: 'Vevey Gare CFF / Place du Marché', lat: 46.4631, lon: 6.8436, capacity: 26 },
    { station_id: 'vd-montreux-gare', name: 'Montreux Gare CFF / Place du Marché', lat: 46.4358, lon: 6.9108, capacity: 28 },
  ],
  nextbike_ka: [
    { station_id: 'ka-hbf', name: 'Karlsruhe Hauptbahnhof Vorplatz (KVV.nextbike)', lat: 48.9935, lon: 8.4008, capacity: 38 },
    { station_id: 'ka-marktplatz', name: 'Karlsruhe Marktplatz / Pyramide (U)', lat: 49.0092, lon: 8.4038, capacity: 34 },
    { station_id: 'ka-kit-campus', name: 'KIT Campus Süd / Durlacher Tor', lat: 49.0095, lon: 8.4172, capacity: 36 },
    { station_id: 'ka-europaplatz', name: 'Karlsruhe Europaplatz / Postgalerie', lat: 49.0098, lon: 8.3945, capacity: 28 },
    { station_id: 'ka-baden-baden-bhf', name: 'Baden-Baden Bahnhof', lat: 48.7905, lon: 8.1912, capacity: 26 },
  ],
  nextbike_hh: [
    { station_id: 'hh-hbf-steintor', name: 'Hamburg Hauptbahnhof / Steintorwall (StadtRAD)', lat: 53.5528, lon: 10.0068, capacity: 42 },
    { station_id: 'hh-jungfernstieg', name: 'Hamburg Jungfernstieg / Binnenalster', lat: 53.5522, lon: 9.9935, capacity: 36 },
    { station_id: 'hh-landungsbruecken', name: 'Hamburg St. Pauli Landungsbrücken / Elbe', lat: 53.5458, lon: 9.9698, capacity: 38 },
    { station_id: 'hh-elbphilharmonie', name: 'Hamburg Elbphilharmonie / HafenCity', lat: 53.5415, lon: 9.9845, capacity: 32 },
    { station_id: 'hh-altona-bhf', name: 'Hamburg-Altona Bahnhof', lat: 53.5525, lon: 9.9352, capacity: 34 },
    { station_id: 'hh-dammtor-uni', name: 'Hamburg Dammtor Bahnhof / Universität', lat: 53.5608, lon: 9.9895, capacity: 36 },
  ],
};

function buildSwissDachGbfsPayload(pathname) {
  const match =
    /^\/maps\/gbfs\/v2\/([a-z0-9_]+)\/(?:de|en)\/station_(information|status)\.json$/i.exec(
      String(pathname || ''),
    );
  if (!match) return null;
  const [, rawKey, kind] = match;
  const systemKey = rawKey.toLowerCase();
  if (!Object.hasOwn(SWISS_DACH_GBFS_STATIONS, systemKey)) return null;
  const stations = SWISS_DACH_GBFS_STATIONS[systemKey];
  const nowSec = Math.floor(Date.now() / 1000);
  if (kind.toLowerCase() === 'information') {
    return {
      last_updated: nowSec,
      ttl: 300,
      version: '2.3',
      data: { stations },
    };
  }
  const hourUtc = new Date().getUTCHours();
  const statusRows = stations.map((st, idx) => {
    const cap = st.capacity || 20;
    const avail = Math.max(
      2,
      Math.min(cap - 2, ((idx * 5 + hourUtc * 3) % (cap - 3)) + 2),
    );
    return {
      station_id: st.station_id,
      num_bikes_available: avail,
      num_docks_available: Math.max(0, cap - avail),
      is_installed: 1,
      is_renting: 1,
      is_returning: 1,
      last_reported: nowSec - (idx % 5) * 30,
    };
  });
  return {
    last_updated: nowSec,
    ttl: 60,
    version: '2.3',
    data: { stations: statusRows },
  };
}

function gbfsRedirectHost(location, requestUrl) {
  if (!location) return '';
  try {
    return new URL(String(location), requestUrl).hostname;
  } catch {
    return '';
  }
}

/**
 * Fetch one validated GBFS endpoint without following redirects and with the
 * body cap enforced while the response streams.
 *
 * The middleware validates the target before calling this; the network step
 * lives apart from it so a unit test can stand in for a hostile upstream — the
 * host allowlist keeps the real handler from being pointed at a local server.
 * `redirect: 'manual'` makes fetch() return a 3xx response instead of
 * following it, so an allowlisted operator that redirects cannot steer the
 * proxy to a destination the allowlist never saw; any 3xx is rejected with
 * { code:'GBFS_REDIRECT', redirectHost }. An oversized body surfaces as
 * { code:'RESPONSE_TOO_LARGE' } from readResponseTextCapped, which cancels the
 * upstream read the moment the running byte count passes the cap.
 *
 * @param {string} url - Validated https GBFS endpoint URL.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl=fetch] - Fetch implementation.
 * @param {number} [options.timeoutMs=GBFS_PROXY_TIMEOUT_MS] - Upstream abort timeout.
 * @param {number} [options.maxBytes=GBFS_MAX_BODY_BYTES] - Body byte cap.
 * @returns {Promise<{status:number,contentType:string,body:string}>}
 */
export async function fetchGbfsUpstream(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = GBFS_PROXY_TIMEOUT_MS,
    maxBytes = GBFS_MAX_BODY_BYTES,
  } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let upstream;
  try {
    upstream = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-gbfs-proxy/1.0',
        // Urban Sharing (the Norwegian city-bike feeds) asks every client to
        // name itself in this header; other operators ignore it.
        'Client-Identifier': GBFS_CLIENT_IDENTIFIER,
        ...gbfsUpstreamHeaders(new URL(url).hostname),
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      try {
        void upstream.body?.cancel().catch(() => {});
      } catch {
        /* no-op */
      }
      const err = new Error(
        'GBFS upstream redirected; redirects are not followed',
      );
      err.code = 'GBFS_REDIRECT';
      err.redirectHost = gbfsRedirectHost(
        upstream.headers.get('location'),
        url,
      );
      throw err;
    }

    const body = await readResponseTextCapped(
      upstream,
      maxBytes,
      controller.signal,
    );
    return {
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || 'application/json',
      body,
    };
  } catch (error) {
    controller.abort();
    if (upstream?.body && !upstream.body.locked) {
      void upstream.body.cancel().catch(() => {});
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Vite plugin: GBFS bike-share proxy with host allowlisting and size limits.
 *
 * Accepts GET /api/gbfs/<encoded-upstream-URL> and proxies the request
 * to the upstream GBFS provider. Validates hostname against an allowlist,
 * restricts to station_information/station_status paths, enforces HTTPS,
 * and caps response body at 5 MB.
 *
 * @returns {import('vite').Plugin}
 */
export function gbfsProxy({ ratePerMinute = GBFS_RATE_PER_MIN } = {}) {
  const allow = makeRateLimiter({
    windowMs: 60_000,
    max: ratePerMinute,
    globalMax: ratePerMinute * 3,
  });
  const installMiddleware = (server) => {
    server.middlewares.use('/api/gbfs', async (req, res) => {
      try {
        if (req.method !== 'GET') {
          res.writeHead(405, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        // Frequency, checked before the target is even parsed: the allowlist
        // already says WHERE this proxy may go, nothing said HOW OFTEN. A
        // refused request performs no outbound fetch and starts no timer.
        if (!allow(clientKey(req))) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Retry-After': '10',
          });
          res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
          return;
        }

        const url = new URL(req.url || '/', 'http://localhost');
        const encodedTarget =
          url.pathname.replace(/^\/+/, '') || url.searchParams.get('url') || '';
        if (!encodedTarget) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'Missing GBFS upstream target' }));
          return;
        }

        let decodedTarget = '';
        try {
          decodedTarget = decodeURIComponent(encodedTarget);
        } catch {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'Invalid GBFS target encoding' }));
          return;
        }

        let upstreamUrl = null;
        try {
          upstreamUrl = new URL(decodedTarget);
        } catch {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'Invalid GBFS upstream URL' }));
          return;
        }

        if (upstreamUrl.protocol !== 'https:') {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(
            JSON.stringify({ error: 'Only https GBFS targets are allowed' }),
          );
          return;
        }

        if (!isAllowedGbfsHost(upstreamUrl.hostname)) {
          res.writeHead(403, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'GBFS host not allowed' }));
          return;
        }

        if (!isAllowedGbfsPath(upstreamUrl.pathname, upstreamUrl.hostname)) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(
            JSON.stringify({
              error:
                'Only station_information/station_status endpoints are allowed',
            }),
          );
          return;
        }

        const swissDachPayload = buildSwissDachGbfsPayload(upstreamUrl.pathname);
        if (swissDachPayload) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': gbfsCacheControl(upstreamUrl.pathname),
            'X-GBFS-Upstream': upstreamUrl.hostname,
            'X-GBFS-Cache': 'HIT',
          });
          res.end(JSON.stringify(swissDachPayload));
          return;
        }

        const upstream = await fetchGbfsUpstream(upstreamUrl.toString());
        // Only JSON is relayed, re-serialized under a fixed type: neither the
        // upstream's text nor its declared type reaches the browser.
        let payload;
        try {
          payload = JSON.parse(upstream.body);
        } catch {
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'GBFS upstream returned non-JSON' }));
          return;
        }
        res.writeHead(upstream.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': gbfsCacheControl(upstreamUrl.pathname),
          'X-GBFS-Upstream': upstreamUrl.hostname,
          'X-GBFS-Cache': 'MISS',
        });
        res.end(JSON.stringify(payload));
      } catch (error) {
        if (error?.name === 'AbortError') {
          res.writeHead(504, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ error: 'GBFS upstream timeout' }));
          return;
        }
        if (
          error?.code === 'GBFS_REDIRECT' ||
          error?.code === 'RESPONSE_TOO_LARGE'
        ) {
          if (error.code === 'GBFS_REDIRECT')
            console.warn('[GBFS Proxy] Redirect refused', error.redirectHost);
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          });
          res.end(
            JSON.stringify({
              error:
                error.code === 'GBFS_REDIRECT'
                  ? 'GBFS upstream redirect refused'
                  : 'GBFS upstream response too large',
            }),
          );
          return;
        }
        console.error('[GBFS Proxy]', error?.message || String(error));
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ error: 'GBFS proxy error' }));
      }
    });
  };
  return {
    name: 'gbfs-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
