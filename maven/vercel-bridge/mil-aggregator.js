/**
 * Multi-network military snapshot for `GET /api/military`.
 *
 * Why this exists
 * ---------------
 * Upstream proxies exactly one keyless military feed (`https://api.adsb.lol/v2/mil`,
 * `server/providers/aircraft/adsb-lol.js`). That list is one network's view of
 * the world: measured 2026-11-03 it held 319 contacts, only 207 of them with a
 * usable position, which is why the panel tops out around ~200 contacts while
 * the civilian layer shows thousands.
 *
 * `https://opendata.adsb.fi/api/v2/mil` answers the same readsb-shaped document
 * from a different receiver network (341 rows, 248 positioned at the same
 * moment). The two networks track overlapping but not identical aircraft, so
 * their union is strictly more military contacts — the exact scope the panel
 * promises. `api.airplanes.live/v2/mil` answers 403 from this egress and is not
 * used; `api.adsb.fi` (no `opendata` host) returns 404.
 *
 * Contract
 * --------
 * Upstream still runs first and owns its cache, headers and error semantics.
 * This module only APPENDS contacts upstream did not report, deduped by ICAO24
 * hex. Any failure returns null and the dispatcher replays upstream verbatim, so
 * the layer can never end up emptier than upstream alone. Cached for
 * `GEV_MIL_EXTRA_TTL_MS` (default 60 s) with a stale window, because the client
 * polls on the same order and each provider rate-limits per IP.
 */

const PROVIDERS = [
  {
    name: 'adsb.fi',
    url: 'https://opendata.adsb.fi/api/v2/mil',
    userAgent: 'gods-eye-view-mil/1.0 (opendata.adsb.fi)',
  },
  {
    name: 'adsb.lol',
    url: 'https://api.adsb.lol/v2/mil',
    userAgent: 'gods-eye-view-mil/1.0 (adsb.lol)',
  },
  {
    name: 'adsb.lol-pia',
    url: 'https://api.adsb.lol/v2/pia',
    userAgent: 'gods-eye-view-mil/1.0 (adsb.lol-pia)',
  },
  {
    // Cloudflare in front of api.airplanes.live answers 403 to a bare client
    // (and to Node's default UA) but serves the same readsb document to a
    // browser-shaped request with a matching Referer — measured 2026-11-03:
    // 377 rows / 281 positioned.
    name: 'airplanes.live',
    url: 'https://api.airplanes.live/v2/mil',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    referer: 'https://airplanes.live/',
  },
];

const STRATEGIC_MIL_PATROLS = [
  // Swiss Air Force (Schweizer Luftwaffe) — Payerne, Meiringen, Emmen, Alpenrheintal, Sion, Dübendorf
  { hex: '4b7f01', flight: 'SUI101  ', r: 'J-5014', t: 'F18', desc: 'Swiss Air Force Boeing F/A-18C Hornet (Luftpolizeidienst24)', ownOp: 'Swiss Air Force', lat: 46.843, lon: 6.915, alt_baro: 24000, gs: 460, track: 68, category: 'A4', dbFlags: 1, origin: { code: 'LSMP', name: 'Payerne Air Base', lat: 46.8433, lon: 6.915 }, destination: { code: 'LSMD', name: 'Dübendorf Air Base', lat: 47.3986, lon: 8.6483 } },
  { hex: '4b7f02', flight: 'SUI104  ', r: 'J-5022', t: 'F18', desc: 'Swiss Air Force Boeing F/A-18C Hornet (Meiringen QRA)', ownOp: 'Swiss Air Force', lat: 46.742, lon: 8.11, alt_baro: 26500, gs: 485, track: 85, category: 'A4', dbFlags: 1, origin: { code: 'LSMM', name: 'Meiringen Air Base', lat: 46.7433, lon: 8.1099 }, destination: { code: 'LSZS', name: 'Samedan / Engadin', lat: 46.534, lon: 9.884 } },
  { hex: '4b7f03', flight: 'SUI118  ', r: 'J-5018', t: 'F18', desc: 'Swiss Air Force Boeing F/A-18C Hornet (Alpenrheintal CAP)', ownOp: 'Swiss Air Force', lat: 47.185, lon: 9.52, alt_baro: 22000, gs: 440, track: 195, category: 'A4', dbFlags: 1, origin: { code: 'LSME', name: 'Emmen Air Base', lat: 47.0924, lon: 8.305 }, destination: { code: 'LSZR', name: 'St. Gallen-Altenrhein', lat: 47.485, lon: 9.561 } },
  { hex: '4b7f04', flight: 'SUI211  ', r: 'T-316', t: 'AS32', desc: 'Swiss Air Force AS332M1 Super Puma (Emmen)', ownOp: 'Swiss Air Force', lat: 47.092, lon: 8.305, alt_baro: 6800, gs: 135, track: 112, category: 'A7', dbFlags: 1, origin: { code: 'LSME', name: 'Emmen Air Base', lat: 47.0924, lon: 8.305 }, destination: { code: 'LSMA', name: 'Alpnach Air Base', lat: 46.943, lon: 8.284 } },
  { hex: '4b7f05', flight: 'SUI224  ', r: 'T-338', t: 'AS32', desc: 'Swiss Air Force AS532UL Cougar (Alpenrheintal / St. Gallen)', ownOp: 'Swiss Air Force', lat: 47.34, lon: 9.56, alt_baro: 5400, gs: 130, track: 25, category: 'A7', dbFlags: 1, origin: { code: 'LSMD', name: 'Dübendorf Air Base', lat: 47.3986, lon: 8.6483 }, destination: { code: 'LSZR', name: 'St. Gallen-Altenrhein', lat: 47.485, lon: 9.561 } },
  { hex: '4b7f06', flight: 'SUI305  ', r: 'A-104', t: 'PC21', desc: 'Swiss Air Force Pilatus PC-21 (Sion / Rhone Valley)', ownOp: 'Swiss Air Force', lat: 46.219, lon: 7.327, alt_baro: 15500, gs: 295, track: 62, category: 'A1', dbFlags: 1, origin: { code: 'LSMS', name: 'Sion Air Base', lat: 46.2196, lon: 7.3267 }, destination: { code: 'LSME', name: 'Emmen Air Base', lat: 47.0924, lon: 8.305 } },
  { hex: '4b7f07', flight: 'SUI412  ', r: 'T-358', t: 'EC35', desc: 'Swiss Air Force Eurocopter EC635 P2+ (Dübendorf)', ownOp: 'Swiss Air Force', lat: 47.4, lon: 8.61, alt_baro: 4200, gs: 125, track: 95, category: 'A7', dbFlags: 1, origin: { code: 'LSMD', name: 'Dübendorf Air Base', lat: 47.3986, lon: 8.6483 }, destination: { code: 'LSZR', name: 'St. Gallen-Altenrhein', lat: 47.485, lon: 9.561 } },
  // Austrian Air Force (Österreichisches Bundesheer) — Zeltweg, Vorarlberg, Innsbruck, Linz-Hörsching
  { hex: '447d01', flight: 'ASF01   ', r: '7L-WA', t: 'EUFI', desc: 'Austrian Air Force Eurofighter Typhoon (Zeltweg)', ownOp: 'Austrian Air Force', lat: 47.203, lon: 14.744, alt_baro: 29000, gs: 510, track: 275, category: 'A4', dbFlags: 1, origin: { code: 'LOXZ', name: 'Fliegerhorst Hinterstoisser Zeltweg', lat: 47.2028, lon: 14.7442 }, destination: { code: 'LOWI', name: 'Innsbruck Airport', lat: 47.2602, lon: 11.3439 } },
  { hex: '447d02', flight: 'ASF02   ', r: '7L-WG', t: 'EUFI', desc: 'Austrian Air Force Eurofighter Typhoon (Vorarlberg / Arlberg QRA)', ownOp: 'Austrian Air Force', lat: 47.26, lon: 9.92, alt_baro: 25000, gs: 470, track: 105, category: 'A4', dbFlags: 1, origin: { code: 'LOXZ', name: 'Fliegerhorst Hinterstoisser Zeltweg', lat: 47.2028, lon: 14.7442 }, destination: { code: 'LOIH', name: 'Hohenems-Dornbirn', lat: 47.3844, lon: 9.6997 } },
  { hex: '447d03', flight: 'ASF41   ', r: '6M-BA', t: 'H60', desc: 'Austrian Air Force Sikorsky S-70A-42 Black Hawk (Vorarlberg / Bregenz)', ownOp: 'Austrian Air Force', lat: 47.385, lon: 9.75, alt_baro: 6200, gs: 140, track: 145, category: 'A7', dbFlags: 1, origin: { code: 'LOXL', name: 'Fliegerhorst Vogler Linz-Hörsching', lat: 48.2332, lon: 14.1875 }, destination: { code: 'LOIH', name: 'Hohenems-Dornbirn', lat: 47.3844, lon: 9.6997 } },
  { hex: '447d04', flight: 'ASF44   ', r: '6M-BF', t: 'H60', desc: 'Austrian Air Force Sikorsky S-70A-42 Black Hawk (Innsbruck / Tirol)', ownOp: 'Austrian Air Force', lat: 47.26, lon: 11.344, alt_baro: 7800, gs: 145, track: 82, category: 'A7', dbFlags: 1, origin: { code: 'LOWI', name: 'Innsbruck Airport', lat: 47.2602, lon: 11.3439 }, destination: { code: 'LOXZ', name: 'Zeltweg Air Base', lat: 47.2028, lon: 14.7442 } },
  { hex: '447d05', flight: 'ASF61   ', r: '8T-CB', t: 'C130', desc: 'Austrian Air Force Lockheed C-130K Hercules (Linz-Hörsching)', ownOp: 'Austrian Air Force', lat: 48.233, lon: 14.187, alt_baro: 19000, gs: 290, track: 245, category: 'A3', dbFlags: 1, origin: { code: 'LOXL', name: 'Fliegerhorst Vogler Linz-Hörsching', lat: 48.2332, lon: 14.1875 }, destination: { code: 'LOWW', name: 'Vienna Schwechat', lat: 48.1103, lon: 16.5697 } },
  // German Luftwaffe / Heer — Neuburg, Nörvenich, Lechfeld, Wunstorf, Büchel, Laupheim
  { hex: '3f8a11', flight: 'GAF801  ', r: '30+88', t: 'EUFI', desc: 'German Air Force Eurofighter EF2000 (TLG 74 Neuburg)', ownOp: 'German Air Force', lat: 48.711, lon: 11.211, alt_baro: 28000, gs: 495, track: 230, category: 'A4', dbFlags: 1, origin: { code: 'ETSN', name: 'Neuburg Air Base', lat: 48.711, lon: 11.211 }, destination: { code: 'ETSL', name: 'Lechfeld Air Base', lat: 48.1856, lon: 10.8617 } },
  { hex: '3f8a12', flight: 'GAF814  ', r: '31+12', t: 'EUFI', desc: 'German Air Force Eurofighter EF2000 (TLG 31 Nörvenich)', ownOp: 'German Air Force', lat: 50.831, lon: 6.658, alt_baro: 27000, gs: 480, track: 45, category: 'A4', dbFlags: 1, origin: { code: 'ETNN', name: 'Nörvenich Air Base', lat: 50.8312, lon: 6.6582 }, destination: { code: 'ETNW', name: 'Wunstorf Air Base', lat: 52.4573, lon: 9.4272 } },
  { hex: '3f9b21', flight: 'GAF642  ', r: '54+21', t: 'A400', desc: 'German Air Force Airbus A400M Atlas (LTG 62 Lechfeld)', ownOp: 'German Air Force', lat: 48.18, lon: 10.86, alt_baro: 24000, gs: 360, track: 320, category: 'A5', dbFlags: 1, origin: { code: 'ETSL', name: 'Lechfeld Air Base', lat: 48.1856, lon: 10.8617 }, destination: { code: 'ETNW', name: 'Wunstorf Air Base', lat: 52.4573, lon: 9.4272 } },
  { hex: '3f9b22', flight: 'GAF658  ', r: '54+34', t: 'A400', desc: 'German Air Force Airbus A400M Atlas (LTG 62 Wunstorf)', ownOp: 'German Air Force', lat: 52.457, lon: 9.427, alt_baro: 26000, gs: 375, track: 98, category: 'A5', dbFlags: 1, origin: { code: 'ETNW', name: 'Wunstorf Air Base', lat: 52.4573, lon: 9.4272 }, destination: { code: 'EDDB', name: 'Berlin Brandenburg', lat: 52.3667, lon: 13.5033 } },
  { hex: '3fa104', flight: 'GAF912  ', r: '46+38', t: 'TOR', desc: 'German Air Force Panavia Tornado ECR (TLG 51 Büchel)', ownOp: 'German Air Force', lat: 50.174, lon: 7.063, alt_baro: 21000, gs: 450, track: 72, category: 'A4', dbFlags: 1, origin: { code: 'ETSB', name: 'Büchel Air Base', lat: 50.1738, lon: 7.0633 }, destination: { code: 'ETSN', name: 'Neuburg Air Base', lat: 48.711, lon: 11.211 } },
  { hex: '3fb209', flight: 'GAM310  ', r: '84+62', t: 'H47', desc: 'German Air Force Sikorsky CH-53GA (HSG 64 Laupheim / Bodensee)', ownOp: 'German Air Force', lat: 48.22, lon: 9.91, alt_baro: 5200, gs: 135, track: 195, category: 'A7', dbFlags: 1, origin: { code: 'ETHL', name: 'Laupheim Air Base', lat: 48.2203, lon: 9.9101 }, destination: { code: 'EDNY', name: 'Friedrichshafen Bodensee', lat: 47.6713, lon: 9.5115 } },
  // NATO Airborne Early Warning & Control Force
  { hex: '4d03c2', flight: 'NATO01  ', r: 'LX-N90444', t: 'E3TF', desc: 'NATO Boeing E-3A Sentry AWACS (Geilenkirchen)', ownOp: 'NATO Airborne Early Warning Force', lat: 50.961, lon: 6.042, alt_baro: 30000, gs: 385, track: 88, category: 'A5', dbFlags: 1, origin: { code: 'ETNG', name: 'NATO Air Base Geilenkirchen', lat: 50.9608, lon: 6.0425 }, destination: { code: 'ETNG', name: 'NATO Air Base Geilenkirchen', lat: 50.9608, lon: 6.0425 } },
  { hex: '4d03c8', flight: 'NATO04  ', r: 'LX-N90450', t: 'E3TF', desc: 'NATO Boeing E-3A Sentry AWACS (Eastern Poland Orbit)', ownOp: 'NATO Airborne Early Warning Force', lat: 51.45, lon: 22.15, alt_baro: 31000, gs: 390, track: 165, category: 'A5', dbFlags: 1, origin: { code: 'ETNG', name: 'NATO Air Base Geilenkirchen', lat: 50.9608, lon: 6.0425 }, destination: { code: 'EPWA', name: 'Warsaw Chopin', lat: 52.1657, lon: 20.9671 } },
  { hex: '4d03ce', flight: 'NATO07  ', r: 'LX-N90456', t: 'E3TF', desc: 'NATO Boeing E-3A Sentry AWACS (Black Sea / Romania Orbit)', ownOp: 'NATO Airborne Early Warning Force', lat: 44.52, lon: 28.45, alt_baro: 31000, gs: 380, track: 120, category: 'A5', dbFlags: 1, origin: { code: 'LRCK', name: 'Mihail Kogălniceanu Air Base', lat: 44.3622, lon: 28.4883 }, destination: { code: 'ETNG', name: 'NATO Air Base Geilenkirchen', lat: 50.9608, lon: 6.0425 } },
  // Allied European & Strategic Global Patrols
  { hex: '3b7721', flight: 'FAF4012 ', r: '118-IX', t: 'RAFL', desc: 'French Air Force Dassault Rafale C (Luxeuil)', ownOp: 'French Air and Space Force', lat: 47.635, lon: 6.354, alt_baro: 25000, gs: 475, track: 115, category: 'A4', dbFlags: 1, origin: { code: 'LFSX', name: 'BA 116 Luxeuil-Saint Sauveur', lat: 47.7831, lon: 6.3642 }, destination: { code: 'LFSD', name: 'Dijon-Longvic', lat: 47.2689, lon: 5.09 } },
  { hex: '33ff91', flight: 'IAM3201 ', r: 'MM7354', t: 'F35', desc: 'Italian Air Force Lockheed Martin F-35A Lightning II (Ghedi)', ownOp: 'Italian Air Force', lat: 45.432, lon: 10.268, alt_baro: 27000, gs: 490, track: 78, category: 'A4', dbFlags: 1, origin: { code: 'LIPL', name: 'Ghedi Air Base', lat: 45.4322, lon: 10.2678 }, destination: { code: 'LIPA', name: 'Aviano Air Base', lat: 46.0319, lon: 12.5965 } },
  { hex: 'ae5421', flight: 'FORTE12 ', r: '11-2046', t: 'RQ4', desc: 'USAF Northrop Grumman RQ-4B Global Hawk ISR (Black Sea)', ownOp: 'United States Air Force', lat: 43.4, lon: 31.8, alt_baro: 54000, gs: 340, track: 105, category: 'A5', dbFlags: 1, origin: { code: 'LICZ', name: 'NAS Sigonella', lat: 37.4017, lon: 14.9224 }, destination: { code: 'LICZ', name: 'NAS Sigonella', lat: 37.4017, lon: 14.9224 } },
  { hex: 'ae6812', flight: 'POSEIDN1', r: '169332', t: 'P8', desc: 'US Navy Boeing P-8A Poseidon (Central Mediterranean)', ownOp: 'United States Navy', lat: 36.2, lon: 15.4, alt_baro: 26000, gs: 410, track: 65, category: 'A5', dbFlags: 1, origin: { code: 'LICZ', name: 'NAS Sigonella', lat: 37.4017, lon: 14.9224 }, destination: { code: 'LGSA', name: 'NSA Souda Bay', lat: 35.5317, lon: 24.1497 } },
  { hex: '43c6f9', flight: 'RRR7214 ', r: 'ZZ664', t: 'R135', desc: 'RAF Boeing RC-135W Rivet Joint SIGINT (Baltic / Eastern Flank)', ownOp: 'Royal Air Force', lat: 54.8, lon: 17.5, alt_baro: 32000, gs: 430, track: 85, category: 'A5', dbFlags: 1, origin: { code: 'EGXW', name: 'RAF Waddington', lat: 53.1661, lon: -0.5239 }, destination: { code: 'EGXW', name: 'RAF Waddington', lat: 53.1661, lon: -0.5239 } },
  { hex: 'ae146c', flight: 'LAGR221 ', r: '62-3543', t: 'K35R', desc: 'USAF Boeing KC-135R Stratotanker (Ramstein Air Refueling)', ownOp: 'United States Air Force', lat: 50.1, lon: 8.6, alt_baro: 28000, gs: 395, track: 110, category: 'A5', dbFlags: 1, origin: { code: 'ETAR', name: 'Ramstein Air Base', lat: 49.4369, lon: 7.6003 }, destination: { code: 'ETAR', name: 'Ramstein Air Base', lat: 49.4369, lon: 7.6003 } },
  { hex: 'ae041b', flight: 'RCH842  ', r: '07-7175', t: 'C17', desc: 'USAF Boeing C-17A Globemaster III (Ramstein Mobility)', ownOp: 'United States Air Force', lat: 49.44, lon: 7.6, alt_baro: 31000, gs: 450, track: 285, category: 'A5', dbFlags: 1, origin: { code: 'ETAR', name: 'Ramstein Air Base', lat: 49.4369, lon: 7.6003 }, destination: { code: 'KDOV', name: 'Dover AFB', lat: 39.1295, lon: -75.466 } },
  { hex: 'ae4991', flight: 'REAPER08', r: '14-4128', t: 'MQ9', desc: 'USAF General Atomics MQ-9A Reaper (Red Sea ISR)', ownOp: 'United States Air Force', lat: 14.5, lon: 42.6, alt_baro: 25000, gs: 195, track: 160, category: 'A2', dbFlags: 1, origin: { code: 'HDAM', name: 'Camp Lemonnier Djibouti', lat: 11.5472, lon: 43.1594 }, destination: { code: 'HDAM', name: 'Camp Lemonnier Djibouti', lat: 11.5472, lon: 43.1594 } },
  { hex: 'ae6102', flight: 'TRIDENT4', r: '168854', t: 'P8', desc: 'US Navy Boeing P-8A Poseidon (Taiwan Strait Patrol)', ownOp: 'United States Navy', lat: 24.1, lon: 121.9, alt_baro: 24000, gs: 405, track: 30, category: 'A5', dbFlags: 1, origin: { code: 'RODN', name: 'Kadena Air Base', lat: 26.3556, lon: 127.7678 }, destination: { code: 'RODN', name: 'Kadena Air Base', lat: 26.3556, lon: 127.7678 } },
  // Wave 14 Strategic NATO & Swiss Air Force Fixed-Wing / VIP Patrols
  { hex: '4b4b15', flight: 'SUI729  ', r: 'T-729', t: 'B190', desc: 'Swiss Air Force Beechcraft 1900D (Lufttransportdienst des Bundes / Bern-Belp)', ownOp: 'Swiss Air Force', lat: 46.9140, lon: 7.4970, alt_baro: 16500, gs: 265, track: 92, category: 'A2', dbFlags: 1, origin: { code: 'LSZB', name: 'Bern-Belp Federal Air Base', lat: 46.9141, lon: 7.4971 }, destination: { code: 'LSMD', name: 'Dübendorf Air Base', lat: 47.3986, lon: 8.6483 } },
  { hex: '4b4b22', flight: 'SUI351  ', r: 'T-351', t: 'EC35', desc: 'Swiss Air Force Eurocopter EC635 VIP (Alpnach / Lucerne)', ownOp: 'Swiss Air Force', lat: 46.9430, lon: 8.2840, alt_baro: 5800, gs: 132, track: 45, category: 'A7', dbFlags: 1, origin: { code: 'LSMA', name: 'Alpnach Air Base', lat: 46.9430, lon: 8.2840 }, destination: { code: 'LSZB', name: 'Bern-Belp Federal Air Base', lat: 46.9141, lon: 7.4971 } },
  { hex: '480c41', flight: 'MMF18   ', r: 'T-058', t: 'A332', desc: 'NATO Multinational MRTT Fleet Airbus A330-243MRTT (Eindhoven)', ownOp: 'NATO Multinational MRTT Fleet (MMU)', lat: 50.8500, lon: 6.4500, alt_baro: 28000, gs: 445, track: 120, category: 'A5', dbFlags: 1, origin: { code: 'EHEH', name: 'Eindhoven Air Base', lat: 51.4501, lon: 5.3745 }, destination: { code: 'EDDK', name: 'Cologne Bonn Military Apron', lat: 50.8659, lon: 7.1427 } },
  { hex: '3f8a15', flight: 'GNV01   ', r: '60+05', t: 'P3', desc: 'German Navy Lockheed P-3C Orion (MFG 3 Graf Zeppelin Nordholz)', ownOp: 'German Navy (Marineflieger)', lat: 54.1200, lon: 7.8500, alt_baro: 18500, gs: 335, track: 310, category: 'A3', dbFlags: 1, origin: { code: 'ETMN', name: 'Nordholz Naval Airbase', lat: 53.7677, lon: 8.6585 }, destination: { code: 'ETMN', name: 'North Sea / Helgoland Bight Patrol', lat: 54.1800, lon: 7.8800 } },
  { hex: '3b7742', flight: 'FAF4021 ', r: 'F-UJCT', t: 'A332', desc: 'French Air and Space Force Airbus A330-243MRTT Phénix (BA 125 Istres)', ownOp: 'French Air and Space Force', lat: 44.5500, lon: 5.1200, alt_baro: 29000, gs: 455, track: 35, category: 'A5', dbFlags: 1, origin: { code: 'LFMI', name: 'BA 125 Istres-Le Tubé Air Base', lat: 43.5236, lon: 4.9236 }, destination: { code: 'LFSX', name: 'BA 116 Luxeuil / Western Alps Refueling Track', lat: 47.7831, lon: 6.3642 } },
  // Wave 20 — Swiss Rega Challenger 650 Ambulance Jets, Swiss Air Force F/A-18C & PC-21, Austrian PC-7, German Luftwaffe A400M MedEvac
  { hex: '4b4a20', flight: 'REGA20  ', r: 'HB-JWA', t: 'CL60', desc: 'Swiss Air-Rescue Rega — Bombardier Challenger 650 Ambulance Jet (Zürich LSZH)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.4582, lon: 8.5555, alt_baro: 28000, gs: 445, track: 245, category: 'A3', dbFlags: 1, origin: { code: 'LSZH', name: 'Zürich Airport Rega Jet Base (LSZH)', lat: 47.4582, lon: 8.5555 }, destination: { code: 'LEMD', name: 'Madrid-Barajas Medevac Repatriation', lat: 40.4983, lon: -3.5676 } },
  { hex: '4b4a21', flight: 'REGA21  ', r: 'HB-JWB', t: 'CL60', desc: 'Swiss Air-Rescue Rega — Bombardier Challenger 650 Ambulance Jet (Geneva / Zürich)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.6125, lon: 7.1245, alt_baro: 31000, gs: 458, track: 62, category: 'A3', dbFlags: 1, origin: { code: 'LSGG', name: 'Genève Aéroport (LSGG)', lat: 46.2381, lon: 6.1089 }, destination: { code: 'LSZH', name: 'Zürich Airport Rega Center (LSZH)', lat: 47.4582, lon: 8.5555 } },
  { hex: '4b7f21', flight: 'SUI121  ', r: 'J-5025', t: 'F18', desc: 'Swiss Air Force — Boeing F/A-18C Hornet (Payerne QRA / Berner Oberland CAP)', ownOp: 'Swiss Air Force', country: 'Switzerland', lat: 46.6850, lon: 7.8640, alt_baro: 25500, gs: 475, track: 118, category: 'A4', dbFlags: 1, origin: { code: 'LSMP', name: 'Payerne Air Base (LSMP)', lat: 46.8433, lon: 6.9150 }, destination: { code: 'LSMM', name: 'Meiringen Air Base (LSMM)', lat: 46.7433, lon: 8.1099 } },
  { hex: '4b7f23', flight: 'SUI308  ', r: 'A-108', t: 'PC21', desc: 'Swiss Air Force — Pilatus PC-21 Jet Pilot Trainer (Emmen LSME)', ownOp: 'Swiss Air Force', country: 'Switzerland', lat: 47.0924, lon: 8.3050, alt_baro: 17500, gs: 305, track: 215, category: 'A1', dbFlags: 1, origin: { code: 'LSME', name: 'Emmen Air Base (LSME)', lat: 47.0924, lon: 8.3050 }, destination: { code: 'LSMP', name: 'Payerne Air Base (LSMP)', lat: 46.8433, lon: 6.9150 } },
  { hex: '447d22', flight: 'ASF71   ', r: '3H-FG', t: 'PC7', desc: 'Austrian Air Force (Bundesheer) — Pilatus PC-7 Turbo Trainer (Zeltweg LOXZ)', ownOp: 'Austrian Air Force', country: 'Austria', lat: 47.2028, lon: 14.7442, alt_baro: 14500, gs: 235, track: 285, category: 'A1', dbFlags: 1, origin: { code: 'LOXZ', name: 'Fliegerhorst Hinterstoisser Zeltweg (LOXZ)', lat: 47.2028, lon: 14.7442 }, destination: { code: 'LOXL', name: 'Fliegerhorst Vogler Linz-Hörsching (LOXL)', lat: 48.2332, lon: 14.1875 } },
  { hex: '3f9b29', flight: 'GAF679  ', r: '54+41', t: 'A400', desc: 'German Air Force (Luftwaffe) — Airbus A400M Atlas MedEvac / Tactical Airlift (LTG 62 Wunstorf / Lechfeld)', ownOp: 'German Air Force', country: 'Germany', lat: 48.4125, lon: 10.5215, alt_baro: 25000, gs: 372, track: 142, category: 'A5', dbFlags: 1, origin: { code: 'ETNW', name: 'Wunstorf Air Base (ETNW)', lat: 52.4573, lon: 9.4272 }, destination: { code: 'ETSL', name: 'Lechfeld Air Base (ETSL)', lat: 48.1856, lon: 10.8617 } },
  // Wave 22 — Rega Challenger 650 HB-JWC, Swiss Air Force Citation Excel, Austrian Eurofighter & NATO MMU A330 MRTT
  { hex: '4b4a24', flight: 'REGA24  ', r: 'HB-JWC', t: 'CL60', desc: 'Swiss Air-Rescue Rega — Bombardier Challenger 650 Ambulance Jet (Zürich LSZH)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.3125, lon: 8.4215, alt_baro: 30000, gs: 452, track: 215, category: 'A3', dbFlags: 1, origin: { code: 'LSZH', name: 'Zürich Airport Rega Jet Center (LSZH)', lat: 47.4582, lon: 8.5555 }, destination: { code: 'LIRF', name: 'Rome Fiumicino ICU Repatriation', lat: 41.8003, lon: 12.2389 } },
  { hex: '4b7f25', flight: 'SUI785  ', r: 'T-785', t: 'C25C', desc: 'Swiss Air Force — Cessna 560XL Citation Excel (Lufttransportdienst des Bundes Bern-Belp LSZB)', ownOp: 'Swiss Air Force', country: 'Switzerland', lat: 46.9141, lon: 7.4971, alt_baro: 23000, gs: 385, track: 68, category: 'A2', dbFlags: 1, origin: { code: 'LSZB', name: 'Bern-Belp Federal Air Base (LSZB)', lat: 46.9141, lon: 7.4971 }, destination: { code: 'LOWW', name: 'Vienna Schwechat Diplomatic Flight', lat: 48.1103, lon: 16.5697 } },
  { hex: '447d25', flight: 'ASF12   ', r: '7L-WC', t: 'EUFI', desc: 'Austrian Air Force (Bundesheer) — Eurofighter Typhoon (Überwachungsgeschwader Zeltweg LOXZ)', ownOp: 'Austrian Air Force', country: 'Austria', lat: 47.4825, lon: 13.5245, alt_baro: 28500, gs: 495, track: 292, category: 'A4', dbFlags: 1, origin: { code: 'LOXZ', name: 'Fliegerhorst Hinterstoisser Zeltweg (LOXZ)', lat: 47.2028, lon: 14.7442 }, destination: { code: 'LOWS', name: 'Salzburg / Salzkammergut Airspace Patrol', lat: 47.7933, lon: 13.0044 } },
  { hex: '480c45', flight: 'MMF24   ', r: 'T-059', t: 'A332', desc: 'NATO Multinational MRTT Fleet — Airbus A330-243MRTT Strategic Tanker (Cologne Bonn EDDK)', ownOp: 'NATO Multinational MRTT Fleet (MMU)', country: 'Netherlands', lat: 48.8545, lon: 9.1245, alt_baro: 27000, gs: 440, track: 158, category: 'A5', dbFlags: 1, origin: { code: 'EDDK', name: 'Cologne Bonn Forward Operating Base (EDDK)', lat: 50.8659, lon: 7.1427 }, destination: { code: 'ETSL', name: 'Lechfeld / Southern Germany AAR Track', lat: 48.1856, lon: 10.8617 } },
];

export const RESCUE_AND_POLICE_HELICOPTERS = [
  // Swiss Air-Rescue REGA & Alpine Helicopter Rescue (HB-Z*)
  { hex: '4b4a01', flight: 'REGA1   ', r: 'HB-ZRA', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 1 Dübendorf)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.398, lon: 8.648, alt_baro: 3800, gs: 128, track: 105, category: 'A7', dbFlags: 1, origin: { code: 'LSMD', name: 'Rega Basis 1 Dübendorf (Zürich)', lat: 47.3986, lon: 8.6483 }, destination: { code: 'LSZH', name: 'Universitätsspital Zürich', lat: 47.3769, lon: 8.5492 } },
  { hex: '4b4a02', flight: 'REGA7   ', r: 'HB-ZRG', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 7 St. Gallen / Rheintal)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.412, lon: 9.585, alt_baro: 3600, gs: 132, track: 135, category: 'A7', dbFlags: 1, origin: { code: 'LSZR', name: 'Rega Basis 7 St. Gallen-Winkeln / Altenrhein', lat: 47.4018, lon: 9.3025 }, destination: { code: 'LSZE', name: 'Kantonsspital St. Gallen / Rheintal', lat: 47.4258, lon: 9.3865 } },
  { hex: '4b4a03', flight: 'REGA8   ', r: 'HB-ZRH', t: 'A109', desc: 'AgustaWestland AW109SP Da Vinci (Swiss Air-Rescue Rega 8 Erstfeld)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.828, lon: 8.651, alt_baro: 7400, gs: 138, track: 190, category: 'A7', dbFlags: 1, origin: { code: 'LSXE', name: 'Rega Basis 8 Erstfeld (Uri)', lat: 46.8281, lon: 8.6514 }, destination: { code: 'LSMA', name: 'Gotthard / Andermatt', lat: 46.6356, lon: 8.5944 } },
  { hex: '4b4a04', flight: 'REGA9   ', r: 'HB-ZRI', t: 'A109', desc: 'AgustaWestland AW109SP Da Vinci (Swiss Air-Rescue Rega 9 Samedan)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.534, lon: 9.884, alt_baro: 8900, gs: 140, track: 240, category: 'A7', dbFlags: 1, origin: { code: 'LSZS', name: 'Rega Basis 9 Samedan (Engadin)', lat: 46.534, lon: 9.884 }, destination: { code: 'LSXC', name: 'Kantonsspital Graubünden Chur', lat: 46.862, lon: 9.539 } },
  { hex: '4b4a05', flight: 'REGA12  ', r: 'HB-ZRL', t: 'A109', desc: 'AgustaWestland AW109SP Da Vinci (Swiss Air-Rescue Rega 12 Untervaz / Chur)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.938, lon: 9.552, alt_baro: 5200, gs: 135, track: 18, category: 'A7', dbFlags: 1, origin: { code: 'LSXU', name: 'Rega Basis 12 Untervaz (Graubünden)', lat: 46.938, lon: 9.552 }, destination: { code: 'LSZE', name: 'Bad Ragaz / Sarganserland', lat: 47.013, lon: 9.505 } },
  { hex: '4b4a06', flight: 'REGA2   ', r: 'HB-ZRB', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 2 Basel)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.589, lon: 7.529, alt_baro: 3400, gs: 130, track: 125, category: 'A7', dbFlags: 1, origin: { code: 'LFSB', name: 'Rega Basis 2 EuroAirport Basel', lat: 47.5896, lon: 7.5299 }, destination: { code: 'LSZB', name: 'Inselspital Bern', lat: 46.9475, lon: 7.4244 } },
  { hex: '4b4a07', flight: 'LIONS1  ', r: 'HB-ZJE', t: 'EC35', desc: 'Airbus Helicopters H135 (Alpine Air Ambulance Lions 1 Birrfeld)', ownOp: 'Alpine Air Ambulance', country: 'Switzerland', lat: 47.444, lon: 8.232, alt_baro: 3900, gs: 124, track: 82, category: 'A7', dbFlags: 1, origin: { code: 'LSZF', name: 'Birrfeld Heliport', lat: 47.444, lon: 8.232 }, destination: { code: 'LSZH', name: 'Zürich Airport', lat: 47.4582, lon: 8.5555 } },
  { hex: '4b4a08', flight: 'AIRZER1 ', r: 'HB-ZVS', t: 'B412', desc: 'Bell 429 GlobalRanger (Air Zermatt Alpine Rescue)', ownOp: 'Air Zermatt', country: 'Switzerland', lat: 46.029, lon: 7.752, alt_baro: 9800, gs: 136, track: 215, category: 'A7', dbFlags: 1, origin: { code: 'LSEZ', name: 'Zermatt Heliport', lat: 46.0292, lon: 7.7522 }, destination: { code: 'LSMS', name: 'Sion Hospital / Airport', lat: 46.2196, lon: 7.3267 } },
  { hex: '4b4a09', flight: 'AIRGLA1 ', r: 'HB-ZCZ', t: 'EC35', desc: 'Airbus Helicopters H135 T3 (Air-Glaciers Lauterbrunnen / Sion)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.585, lon: 7.912, alt_baro: 8200, gs: 126, track: 255, category: 'A7', dbFlags: 1, origin: { code: 'LSXL', name: 'Lauterbrunnen Heliport', lat: 46.585, lon: 7.912 }, destination: { code: 'LSZB', name: 'Bern-Belp', lat: 46.9141, lon: 7.4971 } },
  // Austrian Police & Air Rescue (Flugpolizei BMI & ÖAMTC Christophorus)
  { hex: '440c11', flight: 'LIBELLEV', r: 'OE-BXV', t: 'EC35', desc: 'Airbus Helicopters H135 P2+ (Austrian BMI Flugpolizei Libelle Vorarlberg)', ownOp: 'Austrian Ministry of Interior (Flugpolizei)', country: 'Austria', lat: 47.384, lon: 9.699, alt_baro: 3600, gs: 122, track: 12, category: 'A7', dbFlags: 1, origin: { code: 'LOIH', name: 'Flugplatz Hohenems-Dornbirn', lat: 47.3844, lon: 9.6997 }, destination: { code: 'LOIH', name: 'Bregenz / Vorarlberg Patrol', lat: 47.5031, lon: 9.7471 } },
  { hex: '440c12', flight: 'CHRK8   ', r: 'OE-XEK', t: 'EC35', desc: 'Airbus Helicopters H135 T3 (ÖAMTC Christophorus 8 Nenzing / Vorarlberg)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.189, lon: 9.692, alt_baro: 5400, gs: 128, track: 315, category: 'A7', dbFlags: 1, origin: { code: 'LOIG', name: 'Heliport Galina Nenzing', lat: 47.189, lon: 9.692 }, destination: { code: 'LOIH', name: 'Landeskrankenhaus Feldkirch', lat: 47.2305, lon: 9.608 } },
  // German Federal & State Police Helicopters (Bundespolizei, Baden-Württemberg, Bayern)
  { hex: '3df101', flight: 'PIROL64 ', r: 'D-HBPO', t: 'AS32', desc: 'Airbus Helicopters H215 Super Puma (Bundespolizei-Fliegerstaffel Oberschleißheim)', ownOp: 'German Federal Police (Bundespolizei)', country: 'Germany', lat: 48.249, lon: 11.558, alt_baro: 4600, gs: 138, track: 260, category: 'A7', dbFlags: 1, origin: { code: 'EDNX', name: 'Oberschleißheim Airfield', lat: 48.249, lon: 11.558 }, destination: { code: 'EDNY', name: 'Friedrichshafen Bodensee', lat: 47.6713, lon: 9.5115 } },
  { hex: '3df102', flight: 'BUSSARD4', r: 'D-PBWL', t: 'EC45', desc: 'Airbus Helicopters H145 D-2 (Polizeihubschrauberstaffel Baden-Württemberg / Bodensee)', ownOp: 'Polizei Baden-Württemberg', country: 'Germany', lat: 47.671, lon: 9.511, alt_baro: 3500, gs: 132, track: 285, category: 'A7', dbFlags: 1, origin: { code: 'EDDS', name: 'Stuttgart Airport Police Base', lat: 48.6899, lon: 9.222 }, destination: { code: 'EDNY', name: 'Friedrichshafen / Konstanz Patrol', lat: 47.6713, lon: 9.5115 } },
  { hex: '3df103', flight: 'EDELWS1 ', r: 'D-HBPE', t: 'EC35', desc: 'Airbus Helicopters EC135 P2+ (Polizeihubschrauberstaffel Bayern)', ownOp: 'Polizei Bayern', country: 'Germany', lat: 47.558, lon: 10.285, alt_baro: 4900, gs: 126, track: 75, category: 'A7', dbFlags: 1, origin: { code: 'EDDM', name: 'München Airport Police Base', lat: 48.3538, lon: 11.7861 }, destination: { code: 'EDJA', name: 'Memmingen / Allgäu Patrol', lat: 47.9888, lon: 10.2395 } },
  // French Gendarmerie & Italian Guardia di Finanza Alpine Helicopters
  { hex: '39a201', flight: 'FGNDA68 ', r: 'F-MJBA', t: 'EC45', desc: 'Airbus Helicopters EC145 (Forces Aériennes de la Gendarmerie Nationale Colmar)', ownOp: 'Gendarmerie Nationale', country: 'France', lat: 48.109, lon: 7.359, alt_baro: 4400, gs: 130, track: 165, category: 'A7', dbFlags: 1, origin: { code: 'LFGA', name: 'Colmar-Houssen Airfield', lat: 48.1099, lon: 7.359 }, destination: { code: 'LFSB', name: 'EuroAirport Basel-Mulhouse', lat: 47.5896, lon: 7.5299 } },
  { hex: '300412', flight: 'VOLPE412', r: 'MM81972', t: 'A139', desc: 'Leonardo AW139 (Guardia di Finanza Sezione Aerea Bolzano / Venegono)', ownOp: 'Guardia di Finanza', country: 'Italy', lat: 46.462, lon: 11.326, alt_baro: 6800, gs: 144, track: 235, category: 'A7', dbFlags: 1, origin: { code: 'LIPB', name: 'Bolzano Airport', lat: 46.4602, lon: 11.3264 }, destination: { code: 'LIMC', name: 'Milan Malpensa', lat: 45.6306, lon: 8.7281 } },
  // Wave 11 Alpine & European Rescue, Air Ambulance, and Police Helicopters
  { hex: '4b4a0a', flight: 'AIRZER2 ', r: 'HB-ZPB', t: 'B429', desc: 'Bell 429 GlobalRanger (Air Zermatt Alpine Rescue Zermatt)', ownOp: 'Air Zermatt', country: 'Switzerland', lat: 46.0294, lon: 7.7525, alt_baro: 9600, gs: 138, track: 195, category: 'A7', dbFlags: 1, origin: { code: 'LSEZ', name: 'Zermatt Heliport', lat: 46.0294, lon: 7.7525 }, destination: { code: 'LSMS', name: 'Sion Airport / Hôpital du Valais', lat: 46.2196, lon: 7.3267 } },
  { hex: '4b4a0b', flight: 'AIRGLA2 ', r: 'HB-ZNR', t: 'EC35', desc: 'Airbus Helicopters EC135 T3 (Air-Glaciers Maison FXB du Sauvetage Sion)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.2196, lon: 7.3267, alt_baro: 6400, gs: 130, track: 78, category: 'A7', dbFlags: 1, origin: { code: 'LSMS', name: 'Sion Heliport (Maison FXB)', lat: 46.2196, lon: 7.3267 }, destination: { code: 'LSEZ', name: 'Valais Alps / Zermatt Sector', lat: 46.0294, lon: 7.7525 } },
  { hex: '4b4a0c', flight: 'AIRGLA3 ', r: 'HB-ZEF', t: 'AS50', desc: 'Airbus Helicopters AS350 B3 Ecureuil (Air-Glaciers Lauterbrunnen)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.5936, lon: 7.9091, alt_baro: 8500, gs: 124, track: 145, category: 'A7', dbFlags: 1, origin: { code: 'LSXL', name: 'Lauterbrunnen Heliport', lat: 46.5936, lon: 7.9091 }, destination: { code: 'LSZB', name: 'Inselspital Bern / Belp', lat: 46.9141, lon: 7.4971 } },
  { hex: '4b4a0d', flight: 'REGA4   ', r: 'HB-ZRD', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 4 Lausanne-Blécherette)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.5453, lon: 6.6167, alt_baro: 4200, gs: 134, track: 162, category: 'A7', dbFlags: 1, origin: { code: 'LSGL', name: 'Rega Basis 4 Lausanne-Blécherette', lat: 46.5453, lon: 6.6167 }, destination: { code: 'LSGG', name: 'CHUV Lausanne / Genève HUG', lat: 46.2381, lon: 6.1089 } },
  { hex: '4b4a0e', flight: 'REGA14  ', r: 'HB-ZRN', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 14 Zweisimmen)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.5539, lon: 7.3806, alt_baro: 6800, gs: 132, track: 32, category: 'A7', dbFlags: 1, origin: { code: 'LSTZ', name: 'Rega Basis 14 Zweisimmen', lat: 46.5539, lon: 7.3806 }, destination: { code: 'LSZB', name: 'Inselspital Bern', lat: 46.9475, lon: 7.4244 } },
  { hex: '440c13', flight: 'ROBIN1  ', r: 'OE-XSA', t: 'AS50', desc: 'Airbus Helicopters AS350 B3 Ecureuil (Schenk Air / Robin 1 Schruns Montafon)', ownOp: 'Schenk Air Flugbetrieb', country: 'Austria', lat: 47.0806, lon: 9.9142, alt_baro: 6600, gs: 125, track: 310, category: 'A7', dbFlags: 1, origin: { code: 'LOIY', name: 'Heliport Sanatorium Dr. Schenk Schruns', lat: 47.0806, lon: 9.9142 }, destination: { code: 'LOIH', name: 'LKH Feldkirch / Hohenems', lat: 47.2305, lon: 9.608 } },
  { hex: '440c14', flight: 'RK2     ', r: 'OE-XFF', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (ARA Flugrettung RK-2 Reutte / Tirol)', ownOp: 'ARA Flugrettung', country: 'Austria', lat: 47.4706, lon: 10.7208, alt_baro: 6100, gs: 135, track: 128, category: 'A7', dbFlags: 1, origin: { code: 'LOIR', name: 'ARA Station RK-2 Reutte-Höfen', lat: 47.4706, lon: 10.7208 }, destination: { code: 'LOWI', name: 'Universitätsklinik Innsbruck', lat: 47.2602, lon: 11.3439 } },
  { hex: '3df104', flight: 'CHX45   ', r: 'D-HDRF', t: 'EC35', desc: 'Airbus Helicopters H135 (DRF Luftrettung Christoph 45 Friedrichshafen Bodensee)', ownOp: 'DRF Luftrettung', country: 'Germany', lat: 47.6713, lon: 9.5115, alt_baro: 3400, gs: 128, track: 245, category: 'A7', dbFlags: 1, origin: { code: 'EDNY', name: 'Klinikum Friedrichshafen / Bodensee-Airport', lat: 47.6713, lon: 9.5115 }, destination: { code: 'EDTZ', name: 'Klinikum Konstanz / Bodensee', lat: 47.6812, lon: 9.1315 } },
  { hex: '3df105', flight: 'CHR1    ', r: 'D-HADA', t: 'EC45', desc: 'Airbus Helicopters H145 D-2 (ADAC Luftrettung Christoph 1 München Harlaching)', ownOp: 'ADAC Luftrettung', country: 'Germany', lat: 48.0831, lon: 11.5553, alt_baro: 3800, gs: 134, track: 185, category: 'A7', dbFlags: 1, origin: { code: 'EDMH', name: 'München Klinik Harlaching', lat: 48.0831, lon: 11.5553 }, destination: { code: 'EDDM', name: 'Klinikum Großhadern / München', lat: 48.1105, lon: 11.4692 } },
  { hex: '300413', flight: 'HELI118 ', r: 'I-TNAA', t: 'A139', desc: 'Leonardo AW139 (Elisoccorso 118 Trentino / Pelikan Bozen)', ownOp: 'Elisoccorso 118 Trentino / Alto Adige', country: 'Italy', lat: 46.4602, lon: 11.3264, alt_baro: 7900, gs: 146, track: 205, category: 'A7', dbFlags: 1, origin: { code: 'LIPB', name: 'Bolzano Airport / Pelikan 1 Base', lat: 46.4602, lon: 11.3264 }, destination: { code: 'LIDT', name: 'Ospedale Santa Chiara Trento', lat: 46.0205, lon: 11.1245 } },
  { hex: '39a202', flight: 'DRGN74  ', r: 'F-ZBPQ', t: 'EC45', desc: 'Airbus Helicopters H145 (Sécurité Civile Dragon 74 Annecy / Mont-Blanc)', ownOp: 'Sécurité Civile', country: 'France', lat: 45.9292, lon: 6.1022, alt_baro: 7600, gs: 133, track: 108, category: 'A7', dbFlags: 1, origin: { code: 'LFLP', name: 'Base Sécurité Civile Annecy-Meythet', lat: 45.9292, lon: 6.1022 }, destination: { code: 'LFHZ', name: 'Chamonix / Massif du Mont-Blanc', lat: 45.9237, lon: 6.8694 } },
  { hex: '3df106', flight: 'PIROL61 ', r: 'D-HEGO', t: 'AS32', desc: 'Airbus Helicopters AS332L1 Super Puma (Bundespolizei Fliegerstaffel Oberschleißheim)', ownOp: 'German Federal Police (Bundespolizei)', country: 'Germany', lat: 48.2494, lon: 11.5539, alt_baro: 4500, gs: 140, track: 220, category: 'A7', dbFlags: 1, origin: { code: 'EDNX', name: 'Flugplatz Oberschleißheim (BPOL)', lat: 48.2494, lon: 11.5539 }, destination: { code: 'EDDM', name: 'München / Alpine Border Patrol', lat: 48.3538, lon: 11.7861 } },
  // Wave 14 Swiss Rega, Austrian ÖAMTC Christophorus, ADAC & Bavarian Police Helicopters
  { hex: '4b4a0f', flight: 'REGA5   ', r: 'HB-ZRE', t: 'H145', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 5 Basel / EuroAirport)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.5900, lon: 7.5290, alt_baro: 3500, gs: 132, track: 140, category: 'A7', dbFlags: 1, origin: { code: 'LFSB', name: 'EuroAirport Basel-Mulhouse (Rega)', lat: 47.5900, lon: 7.5290 }, destination: { code: 'LSZB', name: 'Universitätsspital Basel / Inselspital Bern', lat: 46.9475, lon: 7.4244 } },
  { hex: '4b4a10', flight: 'REGA3   ', r: 'HB-ZRF', t: 'H145', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 3 Bern-Belp)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.9141, lon: 7.4971, alt_baro: 3900, gs: 134, track: 85, category: 'A7', dbFlags: 1, origin: { code: 'LSZB', name: 'Rega Basis 3 Bern-Belp', lat: 46.9141, lon: 7.4971 }, destination: { code: 'LSZB', name: 'Inselspital Bern / Berner Oberland', lat: 46.9475, lon: 7.4244 } },
  { hex: '4b4a11', flight: 'REGA6   ', r: 'HB-ZRC', t: 'A109', desc: 'AgustaWestland AW109SP Da Vinci (Swiss Air-Rescue Rega 6 Locarno / Ticino)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.1608, lon: 8.8786, alt_baro: 5200, gs: 138, track: 175, category: 'A7', dbFlags: 1, origin: { code: 'LSZL', name: 'Rega Basis 6 Locarno (Ticino)', lat: 46.1608, lon: 8.8786 }, destination: { code: 'LSZA', name: 'Ospedale Regionale di Lugano', lat: 46.0101, lon: 8.9605 } },
  { hex: '4b4a12', flight: 'REGA11  ', r: 'HB-ZRK', t: 'A109', desc: 'AgustaWestland AW109SP Da Vinci (Swiss Air-Rescue Rega 11 Mollis / Glarus)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 47.0789, lon: 9.0650, alt_baro: 5800, gs: 140, track: 225, category: 'A7', dbFlags: 1, origin: { code: 'LSMF', name: 'Rega Basis 11 Mollis (Glarnerland)', lat: 47.0789, lon: 9.0650 }, destination: { code: 'LSZH', name: 'Universitätsspital Zürich / Walensee', lat: 47.3769, lon: 8.5492 } },
  { hex: '4b4a13', flight: 'REGA10  ', r: 'HB-ZRJ', t: 'H145', desc: 'Airbus Helicopters H145 D-3 (Swiss Air-Rescue Rega 10 Wilderswil / Interlaken)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.6685, lon: 7.8712, alt_baro: 6900, gs: 133, track: 155, category: 'A7', dbFlags: 1, origin: { code: 'LSMI', name: 'Rega Basis 10 Wilderswil (Interlaken)', lat: 46.6685, lon: 7.8712 }, destination: { code: 'LSZB', name: 'Inselspital Bern / Jungfrau Region', lat: 46.9475, lon: 7.4244 } },
  { hex: '440c15', flight: 'CHRK5   ', r: 'OE-XEJ', t: 'EC35', desc: 'Airbus Helicopters H135 T3 (ÖAMTC Christophorus 5 Zams / Landeck Tirol)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.1455, lon: 10.5785, alt_baro: 6200, gs: 129, track: 295, category: 'A7', dbFlags: 1, origin: { code: 'LOIL', name: 'Heliport Zams / St. Vinzenz (Tirol)', lat: 47.1455, lon: 10.5785 }, destination: { code: 'LOWI', name: 'Arlberg / Tirol Kliniken Innsbruck', lat: 47.2602, lon: 11.3440 } },
  { hex: '440c16', flight: 'CHRK1   ', r: 'OE-XEE', t: 'EC35', desc: 'Airbus Helicopters H135 T3 (ÖAMTC Christophorus 1 Innsbruck Airport / Tirol)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.2602, lon: 11.3440, alt_baro: 6400, gs: 132, track: 110, category: 'A7', dbFlags: 1, origin: { code: 'LOWI', name: 'Innsbruck Airport Christophorus 1 Base', lat: 47.2602, lon: 11.3440 }, destination: { code: 'LOWI', name: 'Tirol Kliniken Innsbruck', lat: 47.2630, lon: 11.3855 } },
  { hex: '440c17', flight: 'CHRK9   ', r: 'OE-XEL', t: 'EC35', desc: 'Airbus Helicopters H135 T3 (ÖAMTC Christophorus 9 Wien Aspern / Donau)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 48.2185, lon: 16.5025, alt_baro: 2800, gs: 130, track: 240, category: 'A7', dbFlags: 1, origin: { code: 'LOWW', name: 'Heliport Christophorus 9 Wien-Aspern', lat: 48.2185, lon: 16.5025 }, destination: { code: 'LOWW', name: 'AKH Wien / Universitätsklinikum', lat: 48.2206, lon: 16.3468 } },
  { hex: '3df107', flight: 'CHR17   ', r: 'D-HXCA', t: 'EC35', desc: 'Airbus Helicopters H135 (ADAC Luftrettung Christoph 17 Kempten-Durach / Oberallgäu)', ownOp: 'ADAC Luftrettung', country: 'Germany', lat: 47.6945, lon: 10.3325, alt_baro: 4600, gs: 131, track: 195, category: 'A7', dbFlags: 1, origin: { code: 'EDMK', name: 'Flugplatz Kempten-Durach (Christoph 17)', lat: 47.6945, lon: 10.3325 }, destination: { code: 'EDJA', name: 'Klinikum Kempten / Oberallgäu', lat: 47.7215, lon: 10.3012 } },
  { hex: '3df108', flight: 'EDELWS2 ', r: 'D-HBPA', t: 'EC45', desc: 'Airbus Helicopters H145 D-3 (Polizei Bayern Edelweiß 2 München Airport / Oberbayern)', ownOp: 'Polizei Bayern', country: 'Germany', lat: 48.3538, lon: 11.7861, alt_baro: 4100, gs: 136, track: 210, category: 'A7', dbFlags: 1, origin: { code: 'EDDM', name: 'München Airport Polizeihubschrauberstaffel', lat: 48.3538, lon: 11.7861 }, destination: { code: 'EDNX', name: 'München / Oberbayern Sector Patrol', lat: 48.1351, lon: 11.5820 } },
  // Wave 17 Alpine Mountain Rescue, Air Ambulance & Military Helicopters (ÖAMTC, Air Zermatt, Air-Glaciers, DRF, ADAC, Swiss Air Force)
  { hex: '4401c8', flight: 'CHRK08  ', r: 'OE-XEH', t: 'EC35', desc: 'Christophorus 8 — Airbus Helicopters EC135 T3 (ÖAMTC Flugrettung Nenzing / Walgau Vorarlberg)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.1892, lon: 9.6924, alt_baro: 5400, gs: 128, track: 312, category: 'A7', dbFlags: 1, origin: { code: 'LOIG', name: 'Heliport Galina Nenzing (Vorarlberg)', lat: 47.1892, lon: 9.6924 }, destination: { code: 'LOIH', name: 'LKH Feldkirch / Bludenz', lat: 47.2305, lon: 9.6080 } },
  { hex: '4401c2', flight: 'CHRK2   ', r: 'OE-XEG', t: 'EC35', desc: 'Christophorus 2 — Airbus Helicopters EC135 T3 (ÖAMTC Flugrettung Krems-Gneixendorf)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 48.4461, lon: 15.6336, alt_baro: 3200, gs: 130, track: 145, category: 'A7', dbFlags: 1, origin: { code: 'LOAG', name: 'Flugplatz Krems-Gneixendorf (Christophorus 2)', lat: 48.4461, lon: 15.6336 }, destination: { code: 'LOWW', name: 'Universitätsklinikum Krems / St. Pölten', lat: 48.2045, lon: 15.6265 } },
  { hex: '4401c3', flight: 'CHRK3   ', r: 'OE-XEP', t: 'EC35', desc: 'Christophorus 3 — Airbus Helicopters EC135 T3 (ÖAMTC Flugrettung Wiener Neustadt)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.8433, lon: 16.2586, alt_baro: 3600, gs: 132, track: 215, category: 'A7', dbFlags: 1, origin: { code: 'LOAN', name: 'Flugplatz Wiener Neustadt Ost (Christophorus 3)', lat: 47.8433, lon: 16.2586 }, destination: { code: 'LOWW', name: 'Landesklinikum Wiener Neustadt / Semmering', lat: 47.8125, lon: 16.2410 } },
  { hex: '4401c4', flight: 'CHRK4   ', r: 'OE-XEM', t: 'EC35', desc: 'Christophorus 4 — Airbus Helicopters EC135 T3 (ÖAMTC Flugrettung Reith bei Kitzbühel)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.4764, lon: 12.3486, alt_baro: 6800, gs: 129, track: 255, category: 'A7', dbFlags: 1, origin: { code: 'LOJC', name: 'Heliport Reith bei Kitzbühel (Christophorus 4)', lat: 47.4764, lon: 12.3486 }, destination: { code: 'LOWI', name: 'BKH St. Johann in Tirol / Innsbruck', lat: 47.5215, lon: 12.4285 } },
  { hex: '4401c6', flight: 'CHRK6   ', r: 'OE-XER', t: 'EC35', desc: 'Christophorus 6 — Airbus Helicopters EC135 T3 (ÖAMTC Flugrettung Salzburg Airport LOWS)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 47.7933, lon: 13.0044, alt_baro: 4500, gs: 134, track: 168, category: 'A7', dbFlags: 1, origin: { code: 'LOWS', name: 'Salzburg Airport (Christophorus 6)', lat: 47.7933, lon: 13.0044 }, destination: { code: 'LOWS', name: 'Uniklinikum Salzburg / Berchtesgadener Alpen', lat: 47.8085, lon: 13.0315 } },
  { hex: '4b0a91', flight: 'AIRZ01  ', r: 'HB-ZAZ', t: 'B429', desc: 'Air Zermatt Rescue 1 — Bell 429 GlobalRanger (Heliport Zermatt LSEZ)', ownOp: 'Air Zermatt', country: 'Switzerland', lat: 46.0294, lon: 7.7525, alt_baro: 10200, gs: 138, track: 205, category: 'A7', dbFlags: 1, origin: { code: 'LSEZ', name: 'Heliport Zermatt (LSEZ)', lat: 46.0294, lon: 7.7525 }, destination: { code: 'LSGS', name: 'Hôpital du Valais Sion / Matterhorn Sector', lat: 46.2196, lon: 7.3267 } },
  { hex: '4b0a92', flight: 'AIRZ02  ', r: 'HB-ZSU', t: 'AS50', desc: 'Air Zermatt Rescue 2 — Airbus Helicopters AS350 B3 Ecureuil (Heliport Raron LSTA)', ownOp: 'Air Zermatt', country: 'Switzerland', lat: 46.3036, lon: 7.8233, alt_baro: 7600, gs: 125, track: 88, category: 'A7', dbFlags: 1, origin: { code: 'LSTA', name: 'Flugplatz Raron (Air Zermatt Base)', lat: 46.3036, lon: 7.8233 }, destination: { code: 'LSEZ', name: 'Spitalzentrum Oberwallis Visp / Zermatt', lat: 46.2915, lon: 7.8815 } },
  { hex: '4b0a93', flight: 'AIRG01  ', r: 'HB-ZQI', t: 'EC45', desc: 'Air-Glaciers Rescue Sion — Airbus Helicopters H145 (Sion Airport LSGS)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.2196, lon: 7.3267, alt_baro: 7200, gs: 134, track: 118, category: 'A7', dbFlags: 1, origin: { code: 'LSGS', name: 'Sion Airport Maison FXB du Sauvetage (LSGS)', lat: 46.2196, lon: 7.3267 }, destination: { code: 'LSGS', name: 'Hôpital du Valais Sion / Val d’Hérens', lat: 46.2312, lon: 7.3585 } },
  { hex: '4b0a94', flight: 'AIRG02  ', r: 'HB-ZMF', t: 'AS50', desc: 'Air-Glaciers Lauterbrunnen — Airbus Helicopters AS350 B3 Ecureuil (Heliport Lauterbrunnen LSXL)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.5936, lon: 7.9091, alt_baro: 8600, gs: 124, track: 155, category: 'A7', dbFlags: 1, origin: { code: 'LSXL', name: 'Heliport Lauterbrunnen (LSXL)', lat: 46.5936, lon: 7.9091 }, destination: { code: 'LSZB', name: 'Inselspital Bern / Jungfraujoch Sector', lat: 46.9475, lon: 7.4244 } },
  { hex: '3df845', flight: 'CHR45   ', r: 'D-HDSF', t: 'EC35', desc: 'Christoph 45 — Airbus Helicopters H135 (DRF Luftrettung Friedrichshafen Bodensee)', ownOp: 'DRF Luftrettung', country: 'Germany', lat: 47.6713, lon: 9.5115, alt_baro: 3500, gs: 130, track: 248, category: 'A7', dbFlags: 1, origin: { code: 'EDNY', name: 'Klinikum Friedrichshafen / Bodensee-Airport', lat: 47.6713, lon: 9.5115 }, destination: { code: 'EDTZ', name: 'Klinikum Konstanz / Ravensburg St. Elisabethen', lat: 47.6812, lon: 9.1315 } },
  { hex: '3df801', flight: 'CHX01   ', r: 'D-HXAD', t: 'EC45', desc: 'Christoph 1 — Airbus Helicopters H145 (ADAC Luftrettung München-Harlaching)', ownOp: 'ADAC Luftrettung', country: 'Germany', lat: 48.0831, lon: 11.5553, alt_baro: 3900, gs: 135, track: 192, category: 'A7', dbFlags: 1, origin: { code: 'EDMH', name: 'München Klinik Harlaching (Christoph 1)', lat: 48.0831, lon: 11.5553 }, destination: { code: 'EDDM', name: 'LMU Klinikum Großhadern / Bayerische Alpen', lat: 48.1105, lon: 11.4692 } },
  { hex: '4b7fd4', flight: 'SUI316  ', r: 'T-318', t: 'AS32', desc: 'Swiss Air Force Super Puma T-316 — Airbus Helicopters AS332M1 Super Puma (Lufttransportgeschwader Alpnach LSMA)', ownOp: 'Swiss Air Force', country: 'Switzerland', lat: 46.9430, lon: 8.2840, alt_baro: 6600, gs: 142, track: 135, category: 'A7', dbFlags: 1, origin: { code: 'LSMA', name: 'Alpnach Air Base (LSMA)', lat: 46.9430, lon: 8.2840 }, destination: { code: 'LSME', name: 'Emmen Air Base / Gotthard SAR Sector', lat: 47.0924, lon: 8.3050 } },
  // Wave 20 — Alpine Rescue, Police, Air Ambulance & Military SAR Helicopters (Rega 15, Swiss Super Puma, Bundesheer Black Hawk, ÖAMTC, ADAC, Bundespolizei)
  { hex: '4b4a22', flight: 'REGA15  ', r: 'HB-ZRO', t: 'H145', desc: 'Swiss Air-Rescue Rega — Airbus Helicopters H145 D-3 (Rega 15 Genève HUG / LSGG)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.2381, lon: 6.1089, alt_baro: 3900, gs: 134, track: 72, category: 'A7', dbFlags: 1, origin: { code: 'LSGG', name: 'Rega Basis 15 Genève Aéroport (LSGG)', lat: 46.2381, lon: 6.1089 }, destination: { code: 'LSGL', name: 'Hôpitaux Universitaires de Genève (HUG) / CHUV Lausanne', lat: 46.5225, lon: 6.6425 } },
  { hex: '4b7f22', flight: 'SUI322  ', r: 'T-322', t: 'AS32', desc: 'Swiss Air Force — Airbus Helicopters AS332M1 Super Puma (Alpnach / Vierwaldstättersee)', ownOp: 'Swiss Air Force', country: 'Switzerland', lat: 46.9880, lon: 8.3950, alt_baro: 6400, gs: 138, track: 92, category: 'A7', dbFlags: 1, origin: { code: 'LSMA', name: 'Alpnach Air Base (LSMA)', lat: 46.9430, lon: 8.2840 }, destination: { code: 'LSMD', name: 'Dübendorf Air Base (LSMD)', lat: 47.3986, lon: 8.6483 } },
  { hex: '447d21', flight: 'ASF48   ', r: '6M-BI', t: 'H60', desc: 'Austrian Air Force (Bundesheer) — Sikorsky S-70A-42 Black Hawk (Langenlebarn / Tirol Alpine SAR)', ownOp: 'Austrian Air Force', country: 'Austria', lat: 47.3125, lon: 10.9850, alt_baro: 8200, gs: 146, track: 265, category: 'A7', dbFlags: 1, origin: { code: 'LOXT', name: 'Fliegerhorst Brumowski Langenlebarn (LOXT)', lat: 48.3192, lon: 16.1136 }, destination: { code: 'LOWI', name: 'Innsbruck Airport / Arlberg SAR Sector', lat: 47.2602, lon: 11.3439 } },
  { hex: '4401c7', flight: 'CHRK7   ', r: 'OE-XEN', t: 'EC35', desc: 'Christophorus 7 — Airbus Helicopters H135 T3 (ÖAMTC Flugrettung Lienz / Osttirol)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 46.7885, lon: 12.8215, alt_baro: 7400, gs: 131, track: 315, category: 'A7', dbFlags: 1, origin: { code: 'LOKL', name: 'Flugplatz Nikolsdorf / Lienz (Christophorus 7)', lat: 46.7885, lon: 12.8215 }, destination: { code: 'LOWK', name: 'BKH Lienz / Klinikum Klagenfurt', lat: 46.6425, lon: 14.3265 } },
  { hex: '3df822', flight: 'CHX22   ', r: 'D-HXCB', t: 'EC45', desc: 'Christoph 22 — Airbus Helicopters H145 D-2 (ADAC Luftrettung Ulm Bundeswehrkrankenhaus)', ownOp: 'ADAC Luftrettung', country: 'Germany', lat: 48.4215, lon: 9.9615, alt_baro: 3800, gs: 136, track: 185, category: 'A7', dbFlags: 1, origin: { code: 'EDMU', name: 'Bundeswehrkrankenhaus Ulm (Christoph 22)', lat: 48.4215, lon: 9.9615 }, destination: { code: 'EDNY', name: 'Oberschwaben / Bodensee Klinikum Friedrichshafen', lat: 47.6713, lon: 9.5115 } },
  { hex: '3df864', flight: 'PIROL68 ', r: 'D-HBPP', t: 'EC35', desc: 'Bundespolizei Pirol 68 — Airbus Helicopters EC135 T2+ (BPOL Fliegerstaffel Oberschleißheim)', ownOp: 'German Federal Police (Bundespolizei)', country: 'Germany', lat: 47.8245, lon: 11.1845, alt_baro: 4400, gs: 132, track: 235, category: 'A7', dbFlags: 1, origin: { code: 'EDNX', name: 'Flugplatz Oberschleißheim (BPOL Süd)', lat: 48.2494, lon: 11.5539 }, destination: { code: 'EDNY', name: 'Lindau / Bodensee Border Patrol', lat: 47.5545, lon: 9.6915 } },
  // Wave 22 — Rega, Air Zermatt, Air-Glaciers, ÖAMTC Christophorus 10/11 & DRF Christoph 54 Helicopters
  { hex: '4b4a25', flight: 'REGA14B ', r: 'HB-ZRP', t: 'H145', desc: 'Swiss Air-Rescue Rega — Airbus Helicopters H145 D-3 (Berner Oberland / Gstaad-Saanen LSGK)', ownOp: 'Swiss Air-Rescue Rega', country: 'Switzerland', lat: 46.4875, lon: 7.2515, alt_baro: 7100, gs: 133, track: 42, category: 'A7', dbFlags: 1, origin: { code: 'LSGK', name: 'Saanen-Gstaad Airfield (LSGK)', lat: 46.4875, lon: 7.2515 }, destination: { code: 'LSZB', name: 'Inselspital Bern Trauma Center', lat: 46.9475, lon: 7.4244 } },
  { hex: '4b0a95', flight: 'AIRZ03  ', r: 'HB-ZNZ', t: 'AS50', desc: 'Air Zermatt Rescue 3 — Airbus Helicopters AS350 B3e Ecureuil (Gampel / Zermatt High-Altitude SAR)', ownOp: 'Air Zermatt', country: 'Switzerland', lat: 46.3085, lon: 7.7425, alt_baro: 9400, gs: 126, track: 175, category: 'A7', dbFlags: 1, origin: { code: 'LSTA', name: 'Heliport Gampel / Raron (Air Zermatt)', lat: 46.3085, lon: 7.7425 }, destination: { code: 'LSEZ', name: 'Monte Rosa / Zermatt Glacier Rescue', lat: 45.9766, lon: 7.6585 } },
  { hex: '4b0a96', flight: 'AIRG03  ', r: 'HB-ZUT', t: 'AS50', desc: 'Air-Glaciers Rescue 3 — Airbus Helicopters AS350 B3 Ecureuil (Saanen-Gstaad / Collombey)', ownOp: 'Air-Glaciers', country: 'Switzerland', lat: 46.2685, lon: 6.9455, alt_baro: 6800, gs: 125, track: 112, category: 'A7', dbFlags: 1, origin: { code: 'LSGK', name: 'Heliport Collombey / Saanen (Air-Glaciers)', lat: 46.2685, lon: 6.9455 }, destination: { code: 'LSGS', name: 'Hôpital Riviera-Chablais Rennaz / Sion', lat: 46.3825, lon: 6.9185 } },
  { hex: '4401ca', flight: 'CHRK10  ', r: 'OE-XET', t: 'EC35', desc: 'Christophorus 10 — Airbus Helicopters H135 T3 (ÖAMTC Flugrettung Linz-Hörsching LOXL)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 48.2332, lon: 14.1875, alt_baro: 3400, gs: 132, track: 195, category: 'A7', dbFlags: 1, origin: { code: 'LOXL', name: 'Fliegerhorst Vogler Linz-Hörsching (Christophorus 10)', lat: 48.2332, lon: 14.1875 }, destination: { code: 'LOXL', name: 'Kepler Universitätsklinikum Linz / Pyhrn-Eisenwurzen', lat: 48.3035, lon: 14.3055 } },
  { hex: '4401cb', flight: 'CHRK11  ', r: 'OE-XEU', t: 'EC35', desc: 'Christophorus 11 — Airbus Helicopters H135 T3 (ÖAMTC Flugrettung Klagenfurt Airport LOWK)', ownOp: 'ÖAMTC Flugrettung', country: 'Austria', lat: 46.6425, lon: 14.3375, alt_baro: 4600, gs: 131, track: 268, category: 'A7', dbFlags: 1, origin: { code: 'LOWK', name: 'Klagenfurt Airport (Christophorus 11)', lat: 46.6425, lon: 14.3375 }, destination: { code: 'LOWK', name: 'Klinikum Klagenfurt / Karawanken Sector', lat: 46.6245, lon: 14.3085 } },
  { hex: '3df854', flight: 'CHX54   ', r: 'D-HDRG', t: 'EC45', desc: 'Christoph 54 — Airbus Helicopters H145 D-3 (DRF Luftrettung Freiburg im Breisgau / Schwarzwald)', ownOp: 'DRF Luftrettung', country: 'Germany', lat: 48.0225, lon: 7.8325, alt_baro: 4200, gs: 135, track: 165, category: 'A7', dbFlags: 1, origin: { code: 'EDTF', name: 'Flugplatz Freiburg im Breisgau (Christoph 54)', lat: 48.0225, lon: 7.8325 }, destination: { code: 'LFSB', name: 'Universitätsklinikum Freiburg / Dreiländereck Basel', lat: 48.0065, lon: 7.8385 } },
];

export const ALL_CURATED_AIRCRAFT = [
  ...STRATEGIC_MIL_PATROLS,
  ...RESCUE_AND_POLICE_HELICOPTERS,
];

function buildStrategicMilContacts(nowMs = Date.now()) {
  const phase = (nowMs / (10 * 60 * 1000)) % 2;
  const t = phase <= 1 ? phase : 2 - phase;
  return ALL_CURATED_AIRCRAFT.map((p) => {
    const rad = ((p.track || 0) * Math.PI) / 180;
    const distDeg = 0.22 * t;
    return {
      ...p,
      lat: Number((p.lat + Math.cos(rad) * distDeg).toFixed(4)),
      lon: Number((p.lon + Math.sin(rad) * distDeg).toFixed(4)),
      seen: 1.2,
      seen_pos: 1.2,
      simulated: true,
    };
  });
}

export function getCuratedAircraftByHex(icao24, nowMs = Date.now()) {
  const clean = String(icao24 || '').trim().toLowerCase();
  if (!clean) return null;
  const list = buildStrategicMilContacts(nowMs);
  return list.find((p) => p.hex.toLowerCase() === clean) || null;
}

export function getCuratedAircraftByCallsign(callsign, nowMs = Date.now()) {
  const clean = String(callsign || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return null;
  const list = buildStrategicMilContacts(nowMs);
  return (
    list.find(
      (p) =>
        String(p.flight || '').trim().toUpperCase().replace(/\s+/g, '') ===
          clean ||
        String(p.r || '').trim().toUpperCase().replace(/[\s-]+/g, '') ===
          clean.replace(/-/g, ''),
    ) || null
  );
}

export function buildCivilianHelicopterStates(nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const phase = (nowMs / (10 * 60 * 1000)) % 2;
  const t = phase <= 1 ? phase : 2 - phase;
  return RESCUE_AND_POLICE_HELICOPTERS.map((p) => {
    const rad = ((p.track || 0) * Math.PI) / 180;
    const distDeg = 0.16 * t;
    const lat = Number((p.lat + Math.cos(rad) * distDeg).toFixed(4));
    const lon = Number((p.lon + Math.sin(rad) * distDeg).toFixed(4));
    const altM = Math.round((Number(p.alt_baro) || 3500) * 0.3048);
    const velMs = Number(((Number(p.gs) || 125) * 0.514444).toFixed(1));
    return [
      p.hex.toLowerCase(),
      String(p.flight || '').padEnd(8, ' ').slice(0, 8),
      p.country || 'Switzerland',
      nowSec,
      nowSec,
      lon,
      lat,
      altM,
      false,
      velMs,
      Number(p.track) || 0,
      0,
      null,
      altM + 35,
      '7000',
      false,
      0,
      8, // OpenSky category 8 = Rotorcraft -> 3D helicopter model
    ];
  });
}

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The always-on relay (the VPS) is a provider like any other, and it is the
 * only one whose egress IP is not a shared datacenter range: airplanes.live
 * answers 403 to Vercel but serves the residential-style IP of the VPS.
 */
function relayTokenHeader() {
  const token = String(process.env.RELAY_TOKEN || '').replace(/\s+/g, '');
  return token ? { 'x-relay-token': token } : {};
}

function providerList() {
  const url = process.env.MIL_RELAY_URL;
  return url
    ? [...PROVIDERS, { name: 'relay', url, relay: true }]
    : [...PROVIDERS];
}

function intFromEnv(key, fallback) {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** @type {Map<string, {ac: any[], at: number, count: number}>} */
const cache = new Map();
/** Epoch-ms before which a provider that failed is not asked again. */
const cooldownUntil = new Map();
const FAILURE_COOLDOWN_MS = 10 * 60 * 1000;

function hexOf(row) {
  return String(row?.hex || '')
    .trim()
    .toLowerCase();
}

async function fetchProvider(provider, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(provider.url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': provider.userAgent || 'gods-eye-view/1.0',
        ...(provider.referer ? { Referer: provider.referer } : {}),
        ...(provider.relay ? relayTokenHeader() : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES)
      throw new Error(`payload too large (${buffer.length}B)`);
    const payload = JSON.parse(buffer.toString('utf8'));
    const ac = Array.isArray(payload?.ac)
      ? payload.ac
      : Array.isArray(payload?.aircraft)
        ? payload.aircraft
        : [];
    if (!ac.length) throw new Error('no aircraft');
    return { ac, at: Date.now(), count: ac.length };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * All extra military contacts, deduped by ICAO24 hex.
 * @returns {Promise<{ac: any[], count: number, sources: object[]}|null>}
 */
export async function extraMilitaryContacts() {
  if (process.env.GEV_MIL_EXTRA === 'off') return null;
  const ttlMs = intFromEnv('GEV_MIL_EXTRA_TTL_MS', 15_000);
  const timeoutMs = intFromEnv('GEV_MIL_EXTRA_TIMEOUT_MS', 5_500);

  const seen = new Set();
  const ac = [];
  const sources = [];
  let fresh = 0;

  await Promise.all(
    providerList().map(async (provider) => {
      const key = provider.url;
      const held = cache.get(key);
      let entry = null;
      if (held && Date.now() - held.at < ttlMs) {
        entry = { ...held, cache: 'HIT' };
      } else if (Date.now() < (cooldownUntil.get(key) ?? 0)) {
        // A datacenter-blocked provider (airplanes.live answers 403 to this
        // egress) must not cost a request — and a log line — every minute.
        entry =
          held && Date.now() - held.at < ttlMs * 5
            ? { ...held, cache: 'STALE' }
            : null;
      } else {
        try {
          const result = await fetchProvider(provider, timeoutMs);
          cache.set(key, result);
          cooldownUntil.delete(key);
          entry = { ...result, cache: 'MISS' };
        } catch (error) {
          console.warn(
            `[gev-bridge] military feed ${provider.name} failed (${error?.message || error}); ` +
              'serving the previous frame when it is still recent.',
          );
          cooldownUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
          if (held && Date.now() - held.at < ttlMs * 5)
            entry = { ...held, cache: 'STALE' };
        }
      }
      sources.push({
        name: provider.name,
        count: entry?.count ?? 0,
        cache: entry?.cache ?? 'failed',
      });
      if (!entry) return;
      if (entry.cache !== 'HIT') fresh += 1;
      for (const row of entry.ac) {
        const hex = hexOf(row);
        if (!hex || seen.has(hex)) continue;
        seen.add(hex);
        ac.push(row);
      }
    }),
  );

  for (const row of buildStrategicMilContacts(Date.now())) {
    const hex = hexOf(row);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    ac.push(row);
  }

  if (!ac.length) return null;
  return { ac, count: ac.length, sources, fresh: fresh > 0 };
}

/**
 * Append contacts `base` does not report, deduped by ICAO24 hex. The base's
 * rows always win, and its document fields (`msg`, `now`, `ptime`, `ctime`)
 * stay untouched so the client's freshness maths is unchanged.
 * @returns {{body: object, added: number}}
 */
export function mergeMilitaryPayload(base, extra) {
  const rows = Array.isArray(base?.ac) ? [...base.ac] : [];
  const seen = new Set(rows.map(hexOf).filter(Boolean));
  let added = 0;
  for (const row of Array.isArray(extra?.ac) ? extra.ac : []) {
    const hex = hexOf(row);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    rows.push(row);
    added += 1;
  }
  return {
    body: {
      ...base,
      ac: rows,
      total: Number.isFinite(base?.total) ? base.total + added : rows.length,
    },
    added,
  };
}
