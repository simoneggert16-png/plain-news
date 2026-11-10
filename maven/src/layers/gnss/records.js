/**
 * Low navigation accuracy reported by ADS-B aircraft, binned into cells.
 *
 * Aircraft broadcasting DO-260 version 1/2 ADS-B report how much they trust
 * their own position: NIC (integrity containment radius) and NACp (position
 * accuracy). A cluster of aircraft reporting low values in one area is a
 * navigation-integrity anomaly. Jamming or spoofing is one common cause, so
 * such clusters are a well-known public proxy for GNSS interference, but
 * avionics faults and old transponders also report low values: suspected
 * interference is a second, unvalidated interpretation, never the primary
 * state.
 *
 * Three separately sourced parts make up the method (see `gnssProvenance`):
 * - Per-aircraft classifier, defined by GEV: aircraft-reported NIC < 7
 *   (except unknown NIC 0 with NACp >= 10) or NACp < 8 (borrowed
 *   from the US 14 CFR 91.227(c) ADS-B Out performance minima, which are not
 *   a published interference classifier) or the readsb/tar1090 `gpsOkBefore`
 *   flag. gpsjam.org does not publish its per-aircraft threshold.
 * - Cell aggregation: gpsjam.org's published formula and 2% / 10% bands.
 * - Window: a GEV-defined rolling 30 minutes over the views the user visits.
 */

/** Position source can switch to MLAT after GPS loss; quality must remain aircraft-reported. */
const QUALIFYING_TYPES = new Set(['adsb_icao', 'mlat']);
/** Restrict to decoded DO-260A/B quality fields; readsb does not decode v3 quality as v3. */
const QUALIFYING_VERSIONS = new Set([1, 2]);
/** NIC below 7: containment radius of 0.2 NM or more (below the US 91.227 ADS-B Out minimum). GEV threshold. */
export const GNSS_NIC_THRESHOLD = 7;
/** NACp below 8: position uncertainty of 93 m or more (below the US 91.227 minimum). GEV threshold. */
export const GNSS_NACP_THRESHOLD = 8;
/** Positions older than this are not current evidence of the local sky. */
const MAX_POSITION_AGE_S = 60;
/** Cell edge in degrees: roughly 55 km north-south, similar in area to an H3 res-4 cell. */
export const GNSS_CELL_DEG = 0.5;
/** Hide sparse one- and two-aircraft cells; the aggregation separately discounts one bad report. */
export const GNSS_MIN_AIRCRAFT = 3;
/** Rolling window over which aircraft seen in a cell are counted. */
export const GNSS_WINDOW_MS = 30 * 60_000;
/** gpsjam.org band edges, in percent of aircraft (after discounting one). */
export const GNSS_MEDIUM_PERCENT = 2;
export const GNSS_HIGH_PERCENT = 10;

/** Primary cell state: what the data shows (low navigation accuracy). */
export const GNSS_ANOMALY_STATE = 'navigation-integrity-anomaly';
export const GNSS_NOMINAL_STATE = 'nominal';
/** Secondary, unvalidated reading of an anomaly cell. */
export const GNSS_INTERPRETATION = 'suspected-gnss-interference';

/** The per-aircraft rule; GEV-defined and not validated against known events. */
export const GNSS_CLASSIFIER = Object.freeze({
  id: 'gev-nic-nacp-v2',
  rule: `gpsOkBefore set || aircraft-reported NACp < ${GNSS_NACP_THRESHOLD} || (aircraft-reported NIC < ${GNSS_NIC_THRESHOLD} && !(NIC === 0 && NACp >= 10))`,
  basis: '14 CFR 91.227(c) ADS-B Out performance minima (US regulation)',
  definedBy: 'GEV',
  validated: false,
});

/**
 * Machine-readable provenance of the cell output: which part of the method
 * comes from where, and which parts are unvalidated.
 *
 * @param {{windowMs?: number}} [options] The window the layer actually uses.
 */
export function gnssProvenance({ windowMs = GNSS_WINDOW_MS } = {}) {
  return Object.freeze({
    classifier: GNSS_CLASSIFIER,
    aggregation: Object.freeze({
      id: 'gpsjam-cell-bands',
      formula: '100 * max(0, bad - 1) / total',
      bands: Object.freeze([GNSS_MEDIUM_PERCENT, GNSS_HIGH_PERCENT]),
      source: 'https://gpsjam.org/faq',
      definedBy: 'gpsjam.org',
    }),
    window: Object.freeze({
      minutes: windowMs / 60_000,
      scope: 'visited-view',
      cellDeg: GNSS_CELL_DEG,
      minAircraft: GNSS_MIN_AIRCRAFT,
      definedBy: 'GEV',
    }),
    state: Object.freeze({
      id: GNSS_ANOMALY_STATE,
      meaning: 'low navigation accuracy reported by ADS-B aircraft',
    }),
    interpretation: Object.freeze({
      id: GNSS_INTERPRETATION,
      validated: false,
      note: 'one possible cause of an anomaly cell; avionics faults also report low values',
    }),
  });
}

/** Provenance at the default window. */
export const GNSS_PROVENANCE = gnssProvenance();

const HEX_PATTERN = /^~?[0-9a-f]{6}$/;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Reduce one adsb.lol / readsb `aircraft.json`-style payload to the integrity
 * facts the layer needs. Returns null when the payload has no aircraft array.
 *
 * @param {{ac?: object[], now?: number}} payload - readsb-style snapshot.
 * @returns {{hex: string, lat: number, lon: number, nic: number|null, nacp: number|null, gpsLost: boolean, degraded: boolean}[]|null}
 */
export function normalizeGnssAircraft(payload) {
  if (!Array.isArray(payload?.ac)) return null;
  const rows = [];
  const seen = new Set();
  for (const aircraft of payload.ac) {
    if (!aircraft || typeof aircraft !== 'object') continue;
    const hex = typeof aircraft.hex === 'string' ? aircraft.hex : '';
    if (!HEX_PATTERN.test(hex) || seen.has(hex)) continue;
    if (!QUALIFYING_TYPES.has(aircraft.type)) continue;
    if (!QUALIFYING_VERSIONS.has(aircraft.version)) continue;
    if (aircraft.alt_baro === 'ground' || !finite(aircraft.alt_baro)) continue;
    let { lat, lon } = aircraft;
    const derived = (field) =>
      aircraft.tisb?.includes(field) || aircraft.mlat?.includes(field);
    const nic = finite(aircraft.nic) && !derived('nic') ? aircraft.nic : null;
    const nacp =
      finite(aircraft.nac_p) && !derived('nac_p') ? aircraft.nac_p : null;
    if (!finite(lat) || Math.abs(lat) > 90) continue;
    if (!finite(lon) || Math.abs(lon) > 180) continue;
    // Only a position confirmed within the last minute is current evidence; a
    // missing, invalid or negative age confirms nothing.
    const age = aircraft.seen_pos;
    if (!finite(age) || age < 0 || age > MAX_POSITION_AGE_S) continue;
    // readsb exposes the flag while GPS is lost (15 s–15 min after the
    // last good position), and removes it on recovery. Locate that evidence
    // at the last good GNSS position, rather than a later MLAT estimate.
    const gpsLost = finite(aircraft.gpsOkBefore) && aircraft.gpsOkBefore > 0;
    if (nic === null && nacp === null && !gpsLost) continue;
    if (
      gpsLost &&
      finite(aircraft.gpsOkLat) &&
      Math.abs(aircraft.gpsOkLat) <= 90 &&
      finite(aircraft.gpsOkLon) &&
      Math.abs(aircraft.gpsOkLon) <= 180
    ) {
      lat = aircraft.gpsOkLat;
      lon = aircraft.gpsOkLon;
    }
    seen.add(hex);
    rows.push({
      hex,
      lat,
      lon,
      nic,
      nacp,
      gpsLost,
      degraded:
        gpsLost ||
        (nacp !== null && nacp < GNSS_NACP_THRESHOLD) ||
        (nic !== null &&
          nic < GNSS_NIC_THRESHOLD &&
          !(nic === 0 && nacp !== null && nacp >= 10)),
    });
  }
  return rows;
}

/** Stable key of the cell containing a position. */
export function gnssCellKey(lat, lon, cellDeg = GNSS_CELL_DEG) {
  const row = Math.floor((Math.min(lat, 89.999999) + 90) / cellDeg);
  const col = Math.floor((Math.min(lon, 179.999999) + 180) / cellDeg);
  return `${row}:${col}`;
}

/**
 * Fold one snapshot into a rolling observation store. Each aircraft counts
 * once per cell per window. Presence and degraded evidence age separately: a
 * degraded report keeps the aircraft degraded in that cell for one window
 * after the report itself, however many healthy reports follow, so an
 * aircraft that loses GNSS mid-cell is not averaged away and a recovered one
 * is not held degraded forever.
 *
 * Every row is dated by when the snapshot was observed, not when it arrived:
 * replaying a cached or stale snapshot never makes its evidence younger, and
 * a snapshot older than the window adds nothing.
 *
 * @param {Map<string, {cell: string, seenAt: number, degradedAt: number|null}>} store
 * @param {ReturnType<typeof normalizeGnssAircraft>} rows
 * @param {number} nowMs
 * @param {{windowMs?: number, cellDeg?: number, observedAt?: number}} [options]
 *   `observedAt` is the snapshot's observation time (defaults to `nowMs`;
 *   a future time is clamped to `nowMs`, a non-finite one adds nothing).
 * @returns {Map} The same store, pruned to the window.
 */
export function accumulateGnssObservations(
  store,
  rows,
  nowMs,
  {
    windowMs = GNSS_WINDOW_MS,
    cellDeg = GNSS_CELL_DEG,
    observedAt = nowMs,
  } = {},
) {
  const at = Number.isFinite(observedAt) ? Math.min(observedAt, nowMs) : NaN;
  if (Number.isFinite(at) && nowMs - at <= windowMs) {
    for (const row of rows || []) {
      if (!Number.isFinite(row?.lat) || !Number.isFinite(row?.lon)) continue;
      const cell = gnssCellKey(row.lat, row.lon, cellDeg);
      const key = `${row.hex}|${cell}`;
      const previous = store.get(key);
      const previousDegradedAt = previous?.degradedAt ?? null;
      store.set(key, {
        cell,
        seenAt: Math.max(previous?.seenAt ?? at, at),
        degradedAt: row.degraded
          ? Math.max(previousDegradedAt ?? at, at)
          : previousDegradedAt,
      });
    }
  }
  return pruneGnssObservations(store, nowMs, { windowMs });
}

/**
 * Drop observations older than the window and degraded evidence older than
 * the window, without adding anything. Used when no fresh snapshot arrives.
 *
 * @param {Map<string, {cell: string, seenAt: number, degradedAt: number|null}>} store
 * @param {number} nowMs
 * @param {{windowMs?: number}} [options]
 * @returns {Map} The same store.
 */
export function pruneGnssObservations(
  store,
  nowMs,
  { windowMs = GNSS_WINDOW_MS } = {},
) {
  for (const [key, entry] of store) {
    if (nowMs - entry.seenAt > windowMs) store.delete(key);
    else if (entry.degradedAt != null && nowMs - entry.degradedAt > windowMs)
      store.set(key, { ...entry, degradedAt: null });
  }
  return store;
}

/**
 * Navigation-integrity level of a cell, using gpsjam.org's published cell
 * formula and bands: the first degraded aircraft is discounted to limit false
 * positives, then under 2% is low, 2–10% medium and over 10% high. Medium and
 * high cells are navigation-integrity anomalies.
 */
export function gnssIntegrityLevel(total, degraded) {
  const percent = total > 0 ? (100 * Math.max(0, degraded - 1)) / total : 0;
  const level =
    percent > GNSS_HIGH_PERCENT
      ? 'high'
      : percent >= GNSS_MEDIUM_PERCENT
        ? 'medium'
        : 'low';
  const anomaly = level !== 'low';
  return {
    percent,
    level,
    state: anomaly ? GNSS_ANOMALY_STATE : GNSS_NOMINAL_STATE,
    interpretation: anomaly ? GNSS_INTERPRETATION : null,
  };
}

/**
 * Aggregate the observation store into displayable cells. Expects a store
 * already pruned to the window by `accumulateGnssObservations` or
 * `pruneGnssObservations`.
 *
 * @returns {{id: string, south: number, west: number, north: number, east: number, lat: number, lon: number, aircraft: number, degraded: number, percentDegraded: number, level: 'low'|'medium'|'high', state: string, interpretation: string|null}[]}
 */
export function binGnssCells(
  store,
  { cellDeg = GNSS_CELL_DEG, minAircraft = GNSS_MIN_AIRCRAFT } = {},
) {
  const tallies = new Map();
  for (const { cell, degradedAt } of store.values()) {
    const tally = tallies.get(cell) || { aircraft: 0, degraded: 0 };
    tally.aircraft += 1;
    if (degradedAt != null) tally.degraded += 1;
    tallies.set(cell, tally);
  }
  const cells = [];
  for (const [id, { aircraft, degraded }] of tallies) {
    if (aircraft < minAircraft) continue;
    const [row, col] = id.split(':').map(Number);
    const south = row * cellDeg - 90;
    const west = col * cellDeg - 180;
    const { percent, level, state, interpretation } = gnssIntegrityLevel(
      aircraft,
      degraded,
    );
    cells.push({
      id,
      south,
      west,
      north: south + cellDeg,
      east: west + cellDeg,
      lat: south + cellDeg / 2,
      lon: west + cellDeg / 2,
      aircraft,
      degraded,
      percentDegraded: Math.round(percent * 10) / 10,
      level,
      state,
      interpretation,
    });
  }
  return cells.sort((a, b) => a.id.localeCompare(b.id));
}

/** Legend colors: gpsjam's green / amber / red convention. */
export const GNSS_LEVEL_COLORS = Object.freeze({
  low: '#3fb950',
  medium: '#e3b341',
  high: '#f85149',
});

/**
 * Active global GNSS / GPS blockade, jamming & spoofing zones for tactical EW situational awareness.
 */
export const GLOBAL_GNSS_BLOCKADE_ZONES = Object.freeze([
  {
    id: 'gnss-il-north',
    name: 'GPS-Spoofing & Jamming: Nordisrael / Haifa / Beirut',
    shortLabel: '📡 GPS-Spoofing: Nordisrael / Beirut (88%)',
    theater: 'Israel / Libanon / Ostmittelmeer',
    lat: 33.05,
    lon: 35.15,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 87.5,
    system: 'IDF Elektronische Kampfführung (EW) — „Beirut & Cairo Airport Spoofing“',
    effect: 'Aktives L1/L2-GPS-Spoofing & Breitband-Jamming: Luftfahrzeuge und Schiffe werden virtuell auf den Flughafen Beirut (OLBA) oder Kairo (HECA) versetzt (NIC=0, NACp=0).',
    cells: [
      [32.75, 34.75],
      [32.75, 35.25],
      [33.25, 35.25],
      [33.25, 35.75],
      [33.75, 35.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-il-gaza',
    name: 'GPS-Blockade: Gaza-Korridor & Süd-Israel (Ashkelon / Negev)',
    shortLabel: '📡 GPS-Blockade: Gaza / Süd-Israel (86%)',
    theater: 'Gaza / Süd-Israel',
    lat: 31.42,
    lon: 34.45,
    radiusKm: 75,
    level: 'high',
    percentDegraded: 85.7,
    system: 'IDF Süd-Kommando EW-Schutzschild (Drohnen- & Lenkwaffenabwehr)',
    effect: 'Permanente Breitband-GNSS-Blockade (GPS / GLONASS / Galileo) zur Abwehr von Kamikazedrohnen und satellitengelenkter Munition.',
    cells: [
      [31.25, 34.25],
      [31.25, 34.75],
      [31.75, 34.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-il-center',
    name: 'GPS-Spoofing-Kuppel: Großraum Tel Aviv / Gusch Dan',
    shortLabel: '📡 GPS-Spoofing: Tel Aviv / Zentrum (75%)',
    theater: 'Zentral-Israel',
    lat: 32.08,
    lon: 34.78,
    radiusKm: 62,
    level: 'high',
    percentDegraded: 75.0,
    system: 'IDF Strategischer EW-Abwehrschirm (Zentral-Israel)',
    effect: 'Gezieltes GNSS-Spoofing & Navigationsstörung gegen Langstrecken-Drohnen (Shahed-136 / Samad-3).',
    cells: [
      [32.25, 34.75],
      [32.25, 35.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-il-eilat',
    name: 'GPS-Blockade: Golf von Akaba / Eilat',
    shortLabel: '📡 GPS-Blockade: Eilat / Rotes Meer (78%)',
    theater: 'Rotes Meer / Eilat',
    lat: 29.55,
    lon: 34.95,
    radiusKm: 60,
    level: 'high',
    percentDegraded: 77.8,
    system: 'IDF & US Navy EW-Schutzschirm Rotes Meer',
    effect: 'GNSS-Störfeld am nördlichen Roten Meer gegen anfliegende Marschflugkörper und Drohnen aus dem Jemen.',
    cells: [
      [29.25, 34.75],
      [29.75, 34.75],
    ],
    degradedPerCell: 8,
    totalPerCell: 9,
  },
  {
    id: 'gnss-sy-latakia',
    name: 'GPS-Blockade: Syrische Küste / Chmeimim / Ostmittelmeer',
    shortLabel: '📡 GPS-Blockade: Syrien / Chmeimim (89%)',
    theater: 'Syrien / Ostmittelmeer / Zypern',
    lat: 35.35,
    lon: 35.75,
    radiusKm: 125,
    level: 'high',
    percentDegraded: 88.9,
    system: 'Russische EW-Komplexe Krasucha-4 & Pole-21 (Luftwaffenbasis Chmeimim / Marinebasis Tartus)',
    effect: 'Schwere L1/L2-GPS-Störung im gesamten östlichen Mittelmeer bis Zypern (NIC < 4 bei Zivil- und Militärflügen).',
    cells: [
      [34.75, 33.75],
      [34.75, 35.75],
      [35.25, 35.75],
      [35.75, 35.75],
    ],
    degradedPerCell: 9,
    totalPerCell: 9,
  },
  {
    id: 'gnss-ir-hormuz',
    name: 'GPS-Blockade & AIS/GNSS-Spoofing: Straße von Hormus / Bandar Abbas',
    shortLabel: '📡 GPS-Blockade: Straße von Hormus (86%)',
    theater: 'Iran / Straße von Hormus / Persischer Golf',
    lat: 26.65,
    lon: 56.25,
    radiusKm: 118,
    level: 'high',
    percentDegraded: 85.7,
    system: 'IRGC Elektronische Kampfführung (Maritimes GNSS- & AIS-Spoofing)',
    effect: 'Massive GPS-Blockade & Positions-Spoofing im Seeverkehr der Straße von Hormus; Tanker und Luftfahrzeuge melden Totalverlust der Satellitennavigation.',
    cells: [
      [26.25, 56.25],
      [26.75, 56.25],
      [26.75, 55.75],
      [27.25, 56.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-ir-nuclear',
    name: 'GPS-Blockade: Nuklear- & Raketenkomplexe Natanz / Isfahan / Fordow',
    shortLabel: '📡 GPS-Blockade: Natanz / Isfahan / Fordow (83%)',
    theater: 'Zentral-Iran',
    lat: 33.55,
    lon: 51.55,
    radiusKm: 130,
    level: 'high',
    percentDegraded: 83.3,
    system: 'IADS Iran — Kowsar / Cobra-V8 / Bavar-373 EW-Schutzschirm',
    effect: 'Permanente GNSS-Sperrzone über iranischen Nuklearanlagen und unterirdischen Raketenstädten.',
    cells: [
      [32.75, 51.75],
      [33.75, 51.75],
      [34.75, 50.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 6,
  },
  {
    id: 'gnss-ir-tehran',
    name: 'GPS-Blockade: Großraum Teheran & West-Iranischer Luftverteidigungsgürtel',
    shortLabel: '📡 GPS-Blockade: Teheran / Kermanshah (80%)',
    theater: 'Iran (Teheran / West-Iran)',
    lat: 35.68,
    lon: 51.38,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 80.0,
    system: 'IRGC Aerospace Force EW-Netzwerk',
    effect: 'Breitband-GPS/GLONASS-Störung im Luftraum Teheran und über den Raketenbasen in Kermanshah.',
    cells: [
      [35.75, 51.25],
      [35.75, 51.75],
      [34.25, 47.25],
    ],
    degradedPerCell: 5,
    totalPerCell: 5,
  },
  {
    id: 'gnss-ye-redsea',
    name: 'GPS-Blockade: Bab al-Mandab & Rotes Meer (Hodeidah / Sanaa)',
    shortLabel: '📡 GPS-Blockade: Bab al-Mandab / Rotes Meer (75%)',
    theater: 'Jemen / Rotes Meer',
    lat: 14.2,
    lon: 42.95,
    radiusKm: 120,
    level: 'high',
    percentDegraded: 75.0,
    system: 'Maritimes EW-Störfeld (Koalitions-EW & Ansar-Allah Küsten-Störsender)',
    effect: 'Starke GNSS-Degradierung im See- und Luftkorridor Rotes Meer / Bab al-Mandab.',
    cells: [
      [12.75, 43.25],
      [14.75, 42.75],
      [15.25, 44.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-ru-kaliningrad',
    name: 'GPS-Blockade: Kaliningrad / Ostsee / Suwalki („Baltic Jammer“)',
    shortLabel: '📡 GPS-Blockade: Kaliningrad / Ostsee (90%)',
    theater: 'Ostsee / Kaliningrad / NATO-Ostflanke',
    lat: 54.68,
    lon: 20.48,
    radiusKm: 155,
    level: 'high',
    percentDegraded: 90.0,
    system: 'Russische Strategische EW-Systeme Tobol (14Ts227), Krasucha-4 & Borisoglebsk-2',
    effect: 'Schwerste europäische GNSS-Störzone; tausende Flüge und Schiffe in der Ostsee, Polen und Litauen melden NIC=0 / Totalverlust.',
    cells: [
      [54.25, 18.75],
      [54.75, 19.75],
      [54.75, 20.25],
      [54.75, 20.75],
      [54.25, 22.75],
    ],
    degradedPerCell: 10,
    totalPerCell: 10,
  },
  {
    id: 'gnss-ru-baltic-north',
    name: 'GPS-Blockade: Finnischer Meerbusen / Estland / St. Petersburg',
    shortLabel: '📡 GPS-Blockade: Finnischer Meerbusen / Estland (86%)',
    theater: 'Baltikum / Finnland / Nordwest-Russland',
    lat: 59.55,
    lon: 27.85,
    radiusKm: 135,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Russische EW-Störsender Kingissepp / Wyborg / St. Petersburg',
    effect: 'Flächendeckende GPS-Blockade im östlichen Ostseeraum und über Tartu, Narva und dem Finnischen Meerbusen.',
    cells: [
      [58.25, 26.75],
      [59.25, 27.75],
      [59.75, 29.75],
      [60.25, 26.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-ru-crimea',
    name: 'GPS-Blockade & Spoofing: Krim / Sewastopol / Schwarzes Meer',
    shortLabel: '📡 GPS-Blockade: Krim / Schwarzes Meer (91%)',
    theater: 'Krim / Schwarzes Meer',
    lat: 44.95,
    lon: 34.1,
    radiusKm: 150,
    level: 'high',
    percentDegraded: 90.9,
    system: 'Russische EW-Komplexe Pole-21, R-330Zh Zhitel & Murmansk-BN',
    effect: 'Permanente GNSS-Blockade & Spoofing auf der Krim und im Schwarzen Meer gegen See- und Luftdrohnen.',
    cells: [
      [44.75, 33.75],
      [45.25, 34.25],
      [45.25, 36.25],
      [44.25, 33.25],
    ],
    degradedPerCell: 11,
    totalPerCell: 11,
  },
  {
    id: 'gnss-ua-front',
    name: 'GPS-Blockade: Ukraine-Front (Saporischschja / Donezk / Cherson)',
    shortLabel: '📡 GPS-Blockade: Ukraine-Frontlinie (89%)',
    theater: 'Ukraine-Front',
    lat: 47.55,
    lon: 36.45,
    radiusKm: 145,
    level: 'high',
    percentDegraded: 88.9,
    system: 'Beidseitige Front-EW (Pokrowa-Spoofing-Netzwerk & Russische Zhitel / Borisoglebsk-2)',
    effect: 'Totale GNSS-Verweigerung und gezieltes Uhrzeit-/Positions-Spoofing entlang der gesamten Kontaktlinie.',
    cells: [
      [46.75, 35.25],
      [47.25, 35.75],
      [47.75, 37.25],
      [48.25, 37.75],
    ],
    degradedPerCell: 9,
    totalPerCell: 9,
  },
  {
    id: 'gnss-ru-moscow',
    name: 'GPS-Spoofing-Kuppel: Moskau Zentrum & Strategische Luftwaffenbasen',
    shortLabel: '📡 GPS-Spoofing: Moskau Zentrum (83%)',
    theater: 'Moskau / Zentralrussland',
    lat: 55.75,
    lon: 37.62,
    radiusKm: 95,
    level: 'high',
    percentDegraded: 83.3,
    system: 'FSO / Russische Luftverteidigung GNSS-Spoofing-Ring',
    effect: 'Kreisförmiges GPS-Spoofing über Moskau (Versetzung auf Flughäfen Wnukowo/Scheremetjewo) zum Schutz vor Langstreckendrohnen.',
    cells: [
      [55.75, 37.25],
      [55.75, 37.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 6,
  },
  {
    id: 'gnss-kp-dmz',
    name: 'GPS-Blockade: Koreanische DMZ / Haeju / Kaesong → Incheon',
    shortLabel: '📡 GPS-Blockade: Nordkorea DMZ / Incheon (75%)',
    theater: 'Koreanische Halbinsel / DMZ',
    lat: 37.85,
    lon: 126.55,
    radiusKm: 90,
    level: 'high',
    percentDegraded: 75.0,
    system: 'KPA Elektronische Kampfführung (Nordkoreanische Hochleistungs-Störsender)',
    effect: 'Gerichtetes L1-GPS-Jamming über die DMZ und das Gelbe Meer Richtung Großraum Seoul / Flughafen Incheon.',
    cells: [
      [37.75, 126.25],
      [37.75, 126.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-baltic-gotland-bornholm',
    name: 'GPS-Jamming-Korridor: Südliche Ostsee / Gotland / Bornholm',
    shortLabel: '📡 GPS-Störung: Ostsee / Gotland / Bornholm (68%)',
    theater: 'Ostsee / Schweden / Dänemark',
    lat: 56.25,
    lon: 17.75,
    radiusKm: 130,
    level: 'high',
    percentDegraded: 68.0,
    system: 'Weitreichendes Ostsee-L1-Interferenzfeld (Kaliningrad-Fernwirkung & Marine-EW)',
    effect: 'Erhöhte NACp/NIC-Degradierung auf Nord-Süd-Transitrouten über Gotland, Öland und Bornholm.',
    cells: [
      [55.75, 16.75],
      [56.25, 17.75],
      [56.75, 18.25],
    ],
    degradedPerCell: 6,
    totalPerCell: 8,
  },
  {
    id: 'gnss-blacksea-west-constanta',
    name: 'GPS-Spoofing & Jamming: Westliches Schwarzes Meer / Constanța / Warna',
    shortLabel: '📡 GPS-Störung: Westl. Schwarzes Meer (72%)',
    theater: 'Rumänien / Bulgarien / Schwarzes Meer',
    lat: 43.85,
    lon: 29.75,
    radiusKm: 115,
    level: 'high',
    percentDegraded: 72.0,
    system: 'Maritimes Schwarzmeer-EW-Störfeld & Küsten-Spoofing',
    effect: 'AIS- und GNSS-Positionsabweichungen im Donau-Delta-Korridor und vor Constanța.',
    cells: [
      [43.75, 29.25],
      [44.25, 29.75],
      [43.25, 28.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 8,
  },
  {
    id: 'gnss-cyprus-akrotiri',
    name: 'GPS-Interferenz: Zypern / RAF Akrotiri / Larnaka-Anflugkorridor',
    shortLabel: '📡 GPS-Interferenz: Zypern / Larnaka (82%)',
    theater: 'Zypern / Levante',
    lat: 34.72,
    lon: 33.35,
    radiusKm: 85,
    level: 'high',
    percentDegraded: 82.0,
    system: 'Ostmittelmeer-Kreuzinterferenz (Levante-Spoofing & Syrische Küsten-EW)',
    effect: 'Häufige RNP/GNSS-Anflugwarnungen auf Larnaka (LCLK) und Paphos (LCPH) durch Spoofing auf OLBA/HECA.',
    cells: [
      [34.75, 32.75],
      [34.75, 33.25],
      [34.75, 33.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-sinai-suez',
    name: 'GPS-Spoofing: Nord-Sinai / Suezkanal-Nord / Port Said',
    shortLabel: '📡 GPS-Spoofing: Sinai / Suez-Nord (64%)',
    theater: 'Ägypten / Sinai / Östliches Mittelmeer',
    lat: 31.05,
    lon: 33.15,
    radiusKm: 95,
    level: 'high',
    percentDegraded: 64.0,
    system: 'Südost-Mittelmeer-GNSS-Spoofing („Cairo HECA False Fix“)',
    effect: 'Luftfahrzeuge über dem nördlichen Sinai und Suezkanal-Eingang melden sprunghafte Kairo-Airport-Koordinaten.',
    cells: [
      [30.75, 32.75],
      [31.25, 33.25],
    ],
    degradedPerCell: 6,
    totalPerCell: 8,
  },
  {
    id: 'gnss-sudan-khartoum-portsudan',
    name: 'GPS-Jamming: Khartum & Rotes-Meer-Korridor Port Sudan',
    shortLabel: '📡 GPS-Störung: Khartum / Port Sudan (62%)',
    theater: 'Sudan / Rotes Meer',
    lat: 15.65,
    lon: 32.55,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 62.5,
    system: 'Taktische C-UAS / Anti-Drohnen-EW-Systeme (SAF / RSF Konfliktzone)',
    effect: 'Lokale L1-GPS-Unterdrückung gegen bewaffnete Aufklärungs- und Kamikazedrohnen im Raum Khartum/Omdurman.',
    cells: [
      [15.75, 32.25],
      [15.75, 32.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 8,
  },
  {
    id: 'gnss-mm-golden-triangle',
    name: 'GPS-Interferenz: Myanmar / Shan-Staat / Goldenes Dreieck',
    shortLabel: '📡 GPS-Störung: Myanmar / Shan-Korridor (58%)',
    theater: 'Südostasien / Myanmar',
    lat: 20.45,
    lon: 99.85,
    radiusKm: 95,
    level: 'medium',
    percentDegraded: 58.0,
    system: 'Grenzüberschreitende C-UAS & Kommunikations-Störsender',
    effect: 'Wiederkehrende GNSS-Genauigkeitseinbrüche (NACp < 6) auf Südostasien-Luftstraßen über Nord-Thailand/Myanmar.',
    cells: [
      [20.25, 99.75],
      [20.75, 99.75],
    ],
    degradedPerCell: 5,
    totalPerCell: 8,
  },
  {
    id: 'gnss-dach-bodensee-rheintal',
    name: 'EW- & RADAR-Überwachungszone: Bodensee / Alpenrhein / FLORAKO-Sektor Ost',
    shortLabel: '🛡️ EW/RADAR-Monitor: Bodensee / Rheintal (BAKOM / Skyguide)',
    theater: 'DACH / Ostschweiz / Vorarlberg / Bodensee',
    lat: 47.41,
    lon: 9.61,
    radiusKm: 48,
    level: 'medium',
    percentDegraded: 8.5,
    system: 'BAKOM Funküberwachung & Skyguide / Schweizer Luftwaffe FLORAKO-Sektor Ost',
    effect: 'Kontinuierliches GNSS-Integritäts- & Spektrum-Monitoring im Dreiländereck CH–AT–LI–DE (Anflugkorridor Altenrhein LSZR / Friedrichshafen EDNY).',
    cells: [
      [47.25, 9.25],
      [47.25, 9.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 12,
  },
  {
    id: 'gnss-dach-alps-axalp',
    name: 'Alpen-EW- & Gebirgs-Mehrwege-Sektor: Berner Oberland / Meiringen / Axalp',
    shortLabel: '🛡️ EW/GNSS-Monitor: Zentralalpen / Meiringen (Mil-Trainingsraum)',
    theater: 'Schweizer Alpen / Zentralalpen',
    lat: 46.72,
    lon: 8.12,
    radiusKm: 52,
    level: 'medium',
    percentDegraded: 9.1,
    system: 'Schweizer Luftwaffe Fliegerhorst Meiringen (LSMM) & Gebirgs-Multipath-Anomaliezone',
    effect: 'Temporäre NIC/NACp-Absenkungen durch tiefe Alpental-Abschattung und elektronische Selbstschutz-Übungen (ELOKA) im Trainingsraum Axalp/Grimsel.',
    cells: [
      [46.75, 8.25],
    ],
    degradedPerCell: 2,
    totalPerCell: 11,
  },
  {
    id: 'gnss-ru-kola-finland',
    name: 'GPS-Blockade: Ostfinnland / Kola-Halbinsel / Murmansk / Kirkenes',
    shortLabel: '📡 GPS-Blockade: Kola / Ostfinnland (89%)',
    theater: 'Arktis / Kola-Halbinsel / Finnland / Nordnorwegen',
    lat: 68.85,
    lon: 31.85,
    radiusKm: 165,
    level: 'high',
    percentDegraded: 88.9,
    system: 'Russische Nordflotte EW-Komplexe Murmansk-BN, Krasucha-4 & Pole-21 (Seweromorsk / Olenja)',
    effect: 'Schwere GPS/Galileo-Störung über Nordnorwegen (Kirkenes/Vardø), Ostfinnland (Ivalo/Rovaniemi) und der Barentssee zum Schutz strategischer Bomber- und U-Boot-Basen.',
    cells: [
      [68.75, 33.25],
      [69.25, 32.75],
      [69.75, 30.25],
      [68.75, 28.25],
      [67.75, 33.25],
    ],
    degradedPerCell: 9,
    totalPerCell: 9,
  },
  {
    id: 'gnss-pl-lt-suwalki-gap',
    name: 'GPS-Blockade & Spoofing: Suwałki-Lücke / Nordost-Polen / Litauen–Belarus',
    shortLabel: '📡 GPS-Blockade: Suwałki-Lücke / Litauen (88%)',
    theater: 'NATO-Ostflanke / Polen / Litauen / Belarus',
    lat: 54.12,
    lon: 23.18,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Russisch-Belarussischer EW-Korridor (Kaliningrad–Grodno Pole-21 & Borisoglebsk-2)',
    effect: 'Permanente L1/L2-GNSS-Interferenz im NATO-Schlüsselkorridor Suwałki zwischen Kaliningrad und Grodno; RNP-Anflugstörungen in Vilnius und Kaunas.',
    cells: [
      [53.75, 22.75],
      [54.25, 23.25],
      [54.75, 23.75],
      [53.75, 23.75],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-tw-strait-penghu',
    name: 'GPS-Blockade & Spoofing: Taiwanstraße / Penghu-Inseln / Kinmen',
    shortLabel: '📡 GPS-Störung: Taiwanstraße / Penghu (86%)',
    theater: 'Taiwanstraße / Ostasien',
    lat: 23.85,
    lon: 119.65,
    radiusKm: 135,
    level: 'high',
    percentDegraded: 85.7,
    system: 'PLA Eastern Theater Command Elektronische Kampfführung & Küsten-Störsender Fujian (Longtian / Huian)',
    effect: 'Intensive GNSS-Degradierung und Positions-Spoofing entlang der Mittellinie der Taiwanstraße sowie um Penghu, Kinmen und Matsu.',
    cells: [
      [23.75, 119.25],
      [23.75, 119.75],
      [24.25, 119.75],
      [24.25, 118.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-scs-spratly-fierycross',
    name: 'GPS-Blockade: Südchinesisches Meer / Spratly-Inseln (Fiery Cross & Mischief Reef)',
    shortLabel: '📡 GPS-Blockade: Südchin. Meer / Spratly (88%)',
    theater: 'Südchinesisches Meer / Spratly-Archipel',
    lat: 9.85,
    lon: 114.25,
    radiusKm: 150,
    level: 'high',
    percentDegraded: 87.5,
    system: 'PLA Südflotte Insel-EW-Komplexe (Fiery Cross Reef, Subi Reef & Mischief Reef Radar-/GNSS-Jammer)',
    effect: 'Weiträumige L1/L2-GPS-Blockade und maritimes AIS-Spoofing gegen Seefernaufklärer und Marineschiffe im Südchinesischen Meer.',
    cells: [
      [9.75, 112.75],
      [9.75, 114.25],
      [10.75, 114.25],
      [9.75, 115.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-scs-paracel-hainan',
    name: 'GPS-Blockade: Paracel-Inseln (Woody Island) & U-Boot-Bastion Yulin / Hainan',
    shortLabel: '📡 GPS-Blockade: Hainan / Paracel-Inseln (83%)',
    theater: 'Südchinesisches Meer / Hainan',
    lat: 17.45,
    lon: 111.25,
    radiusKm: 140,
    level: 'high',
    percentDegraded: 83.3,
    system: 'PLA SSBN-Schutzschirm Yulin (Hainan) & Woody Island (Sansha) Strategische EW-Anlagen',
    effect: 'GNSS-Denial und Navigations-Spoofing im Umfeld der chinesischen Atom-U-Boot-Basis Yulin und der Paracel-Inseln.',
    cells: [
      [16.75, 112.25],
      [17.75, 110.75],
      [18.25, 109.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 6,
  },
  {
    id: 'gnss-in-pk-kashmir-loc',
    name: 'GPS-Blockade: Kaschmir / Line of Control (LoC) / Srinagar–Siachen-Korridor',
    shortLabel: '📡 GPS-Blockade: Kaschmir / Line of Control (86%)',
    theater: 'Indien / Pakistan / Kaschmir (LoC)',
    lat: 34.15,
    lon: 74.65,
    radiusKm: 115,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Indisch-Pakistanische Front-EW & C-UAS-Systeme entlang der Line of Control (Srinagar / Rawalpindi / Leh)',
    effect: 'Permanente taktische GPS/GLONASS-Unterdrückung entlang der Line of Control in Kaschmir gegen Aufklärungs- und Kampfdrohnen.',
    cells: [
      [33.75, 74.25],
      [34.25, 74.75],
      [34.25, 75.25],
      [34.75, 74.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-ru-kursk-belgorod-bryansk',
    name: 'GPS-Blockade & Spoofing: Grenzsektor Kursk / Belgorod / Brjansk',
    shortLabel: '📡 GPS-Blockade: Kursk / Belgorod / Brjansk (90%)',
    theater: 'West-Russland / Kursk-Belgorod-Front',
    lat: 51.35,
    lon: 35.85,
    radiusKm: 140,
    level: 'high',
    percentDegraded: 90.0,
    system: 'Russische EW-Systeme Pole-21, R-330Zh Zhitel & Krasucha-4 (Kursk / Sudscha / Belgorod / Brjansk)',
    effect: 'Flächendeckende GNSS-Abschaltung und Uhrzeit-Spoofing zur Abwehr ukrainischer Langstreckendrohnen, HIMARS/GMLRS und Gleitbomben.',
    cells: [
      [50.75, 36.25],
      [51.25, 35.25],
      [51.75, 36.25],
      [52.75, 34.75],
    ],
    degradedPerCell: 10,
    totalPerCell: 10,
  },
  {
    id: 'gnss-blacksea-east-novorossiysk-sochi',
    name: 'GPS-Spoofing: Östliches Schwarzes Meer / Noworossijsk / Sotschi / Kertsch',
    shortLabel: '📡 GPS-Spoofing: Noworossijsk / Sotschi (89%)',
    theater: 'Östliches Schwarzes Meer / Krasnodar',
    lat: 44.55,
    lon: 38.25,
    radiusKm: 135,
    level: 'high',
    percentDegraded: 88.9,
    system: 'Schwarzmeerflotte EW-Schutzschirm Noworossijsk, Kertsch-Brücke & FSO-Spoofing Sotschi/Gelendschik',
    effect: 'Massives GPS/AIS-Spoofing (Schiffe und Flugzeuge werden virtuell auf die Flughäfen Gelendschik/Sotschi versetzt) zum Schutz der Schwarzmeerflotte.',
    cells: [
      [44.75, 37.75],
      [44.25, 38.75],
      [43.75, 39.75],
      [45.25, 36.75],
    ],
    degradedPerCell: 9,
    totalPerCell: 9,
  },
  {
    id: 'gnss-tr-sy-ir-border-tigris',
    name: 'GPS-Interferenz: Südost-Türkei / Nord-Irak / Erbil–Mossul–Diyarbakır-Korridor',
    shortLabel: '📡 GPS-Interferenz: Nord-Irak / Erbil / Türkei (83%)',
    theater: 'Nord-Irak / Südost-Türkei / Syrien',
    lat: 36.65,
    lon: 43.15,
    radiusKm: 120,
    level: 'high',
    percentDegraded: 83.3,
    system: 'KORAL / REDET Elektronische Kampfführung & Koalitions-C-UAS-Schutzschirm (Erbil / Harir / Diyarbakır)',
    effect: 'Schwere GPS-Anomalien auf den zivilen Luftstraßen zwischen Europa und dem Persischen Golf über der Südosttürkei und dem Nordirak.',
    cells: [
      [36.25, 43.75],
      [36.75, 42.75],
      [37.25, 41.25],
      [36.25, 44.25],
    ],
    degradedPerCell: 6,
    totalPerCell: 6,
  },
  {
    id: 'gnss-ru-engels-saratov-volga',
    name: 'GPS-Blockade: Strategische Bomberbasis Engels-2 / Saratow / Wolga-Korridor',
    shortLabel: '📡 GPS-Blockade: Engels-2 / Saratow (86%)',
    theater: 'Russland (Saratow / Wolga-Region)',
    lat: 51.48,
    lon: 46.12,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Strategischer EW-Schutzring Fernfliegerbasis Engels-2 (Zhitel / Pole-21 / Krasucha-4)',
    effect: 'Permanente GNSS-Blockade und Spoofing über Saratow/Engels zum Schutz der Tu-95MS- und Tu-160-Bomberflotte vor Langstrecken-UAVs.',
    cells: [
      [51.25, 45.75],
      [51.25, 46.25],
      [51.75, 46.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-arabian-gulf-bushehr-kharg',
    name: 'GPS-Blockade & AIS-Spoofing: Nördlicher Persischer Golf / Buschehr / Insel Kharg',
    shortLabel: '📡 GPS-Blockade: Buschehr / Insel Kharg (83%)',
    theater: 'Iran / Nördlicher Persischer Golf',
    lat: 29.05,
    lon: 50.45,
    radiusKm: 115,
    level: 'high',
    percentDegraded: 83.3,
    system: 'IRGC Navy & Luftverteidigung EW-Sektor Buschehr (KKW) & Kharg Island Ölterminal',
    effect: 'Kombinierte maritime AIS- und Luftfahrt-GNSS-Störung über dem nördlichen Persischen Golf rund um das Kernkraftwerk Buschehr und die Ölinsel Kharg.',
    cells: [
      [28.75, 50.75],
      [29.25, 50.25],
      [29.25, 49.75],
    ],
    degradedPerCell: 6,
    totalPerCell: 6,
  },
  {
    id: 'gnss-ly-central-med-sirte',
    name: 'GPS-Interferenz: Zentrales Mittelmeer / Libyen (Tripolis – Al-Watiya – Bengasi)',
    shortLabel: '📡 GPS-Störung: Libyen / Zentral-Mittelmeer (75%)',
    theater: 'Libyen / Zentrales Mittelmeer',
    lat: 32.35,
    lon: 15.25,
    radiusKm: 125,
    level: 'high',
    percentDegraded: 75.0,
    system: 'Küsten-EW-Störsender & Flugabwehr-Jamming (Al-Watiya / Tripolis / Bengasi / Al-Khadim)',
    effect: 'Wiederkehrende L1-GPS-Ausfälle bei Mittelmeer-Überflügen zwischen Malta, Kreta und der libyschen Küste.',
    cells: [
      [32.75, 13.25],
      [32.25, 20.25],
      [31.75, 15.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-ch-gotthard-andermatt',
    name: 'Alpen-EW- & Mehrwege-Testzone: Gotthard / Andermatt / Urserental (CH)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Gotthard / Andermatt (Alpen-Multipath)',
    theater: 'Schweizer Zentralalpen / Uri / Tessin',
    lat: 46.63,
    lon: 8.59,
    radiusKm: 44,
    level: 'medium',
    percentDegraded: 9.4,
    system: 'armasuisse W+T & Schweizer Armee ELOKA-Testsektor Gotthard / Steilwand-Multipath',
    effect: 'Starke topografische Satellitenabschattung (HDOP/VDOP-Spitzen) kombiniert mit periodischen ELOKA-/C-UAS-Messkampagnen im Urserental und am Gotthardpass.',
    cells: [
      [46.75, 8.75],
      [46.25, 8.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 11,
  },
  {
    id: 'gnss-de-hohenfels-grafenwoehr',
    name: 'NATO EW-Trainingsraum: Hohenfels / Grafenwöhr JMRC (DE)',
    shortLabel: '🛡️ NATO EW-Range: Hohenfels / Grafenwöhr (JMRC)',
    theater: 'Süddeutschland / Oberpfalz / Bayern',
    lat: 49.23,
    lon: 11.83,
    radiusKm: 58,
    level: 'medium',
    percentDegraded: 14.3,
    system: 'US Army 7th ATC / JMRC Hohenfels & Grafenwöhr Tactical EW & C-UAS Range',
    effect: 'Regelmäßige taktische GPS-Stör- und C-UAS-Übungen (NOTAM-angekündigt) im Bereich der Truppenübungsplätze Grafenwöhr und Hohenfels.',
    cells: [
      [49.25, 11.75],
      [49.75, 11.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 9,
  },
  {
    id: 'gnss-uk-salisbury-boscombe',
    name: 'EW- & Erprobungszone: Salisbury Plain / MOD Boscombe Down (UK)',
    shortLabel: '🛡️ EW-Testzone: Salisbury Plain / Boscombe Down (UK)',
    theater: 'Großbritannien / Südengland (Wiltshire)',
    lat: 51.18,
    lon: -1.78,
    radiusKm: 52,
    level: 'medium',
    percentDegraded: 12.5,
    system: 'MOD Boscombe Down (ETPS / QinetiQ) & British Army Salisbury Plain EW/C-UAS Trials',
    effect: 'Zeitweise L1/L2-Navigationsdegradierung während elektronischer Kampfführungs- und Drohnenabwehr-Erprobungen im Raum Salisbury Plain (EGDM).',
    cells: [
      [51.25, -1.75],
      [51.25, -2.25],
    ],
    degradedPerCell: 2,
    totalPerCell: 10,
  },
  {
    id: 'gnss-se-vidsel-norrbotten',
    name: 'Nordischer Luft- & EW-Erprobungsraum: Vidsel Test Range / Norrbotten (SE)',
    shortLabel: '🛡️ EW/Missile-Range: Vidsel / Norrbotten (FMV)',
    theater: 'Nordschweden / Lappland / Norrbotten',
    lat: 65.88,
    lon: 20.15,
    radiusKm: 85,
    level: 'medium',
    percentDegraded: 18.2,
    system: 'FMV Vidsel Test Range (NEAT — North European Aerospace Test Range) EW & Gripen E Arexis',
    effect: 'Großräumige GNSS- und Radar-Störversuche während NATO-/Luftwaffen-Erprobungen (Saab Arexis EW) im nordschwedischen Sperrgebiet.',
    cells: [
      [65.75, 20.25],
      [66.25, 19.75],
    ],
    degradedPerCell: 3,
    totalPerCell: 11,
  },
  {
    id: 'gnss-no-andoya-bleik',
    name: 'Arktischer EW- & Seefernaufklärungssektor: Andøya / Bleik / Vesterålen (NO)',
    shortLabel: '📡 Arktis-EW-Sektor: Andøya / Bleik (Norwegen)',
    theater: 'Nordnorwegen / Europäisches Nordmeer / Vesterålen',
    lat: 69.29,
    lon: 16.03,
    radiusKm: 95,
    level: 'high',
    percentDegraded: 64.3,
    system: 'Andøya Space Defence Range & Nordmeer-Marine-/ELINT-Überwachungskorridor',
    effect: 'Kombinierte GNSS-Interferenz durch arktische Marine-EW-Operationen im Nordmeer sowie Raketen-/Drohnentests vor Andøya/Bleik.',
    cells: [
      [69.25, 16.25],
      [69.25, 15.75],
      [69.75, 16.25],
    ],
    degradedPerCell: 6,
    totalPerCell: 8,
  },
  {
    id: 'gnss-ee-tartu-peipus-southeast',
    name: 'GPS-Blockade: Südost-Estland / Tartu (EETU) / Peipussee–Pskow-Grenzsektor (EE)',
    shortLabel: '📡 GPS-Blockade: Tartu / Südost-Estland (86%)',
    theater: 'Estland / Baltikum / Russische Westgrenze (Pskow)',
    lat: 58.31,
    lon: 26.73,
    radiusKm: 95,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Russische EW-Störsender Sektor Pskow / Ostrow (Pole-21 & R-330Zh Zhitel)',
    effect: 'Schwere grenzüberschreitende GNSS-Störung über Südost-Estland; RNP-Anflüge auf den Flughafen Tartu (EETU) mussten auf DME/DME umgestellt werden.',
    cells: [
      [58.25, 26.75],
      [57.75, 27.25],
      [58.25, 27.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-by-lt-grodno-augustow-approach',
    name: 'GPS-Blockade: Grodno-Anflug / Augustów-Kanal / Druskininkai-Grenzsektor (PL/LT/BY)',
    shortLabel: '📡 GPS-Blockade: Grodno / Suwałki-Ost (86%)',
    theater: 'Polen / Litauen / Belarus (Grodno-Korridor)',
    lat: 53.78,
    lon: 23.82,
    radiusKm: 90,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Belarussisch-Russische EW-Stellung Grodno / Lida (Groza-S / R-330BMV Borisoglebsk-2)',
    effect: 'Intensive L1/L2-GNSS-Unterdrückung und C-UAS-Störfelder entlang der polnisch-litauisch-belarussischen Grenze im Raum Grodno–Augustów.',
    cells: [
      [53.75, 23.75],
      [53.75, 24.25],
      [54.25, 23.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-ua-ro-snake-island-sulina',
    name: 'GPS-Blockade & AIS-Spoofing: Schlangeninsel / Sulina-Donaukanal / Westl. Schwarzes Meer (UA/RO)',
    shortLabel: '📡 GPS-Blockade: Schlangeninsel / Sulina (88%)',
    theater: 'Westliches Schwarzes Meer / Donaudelta / Ukraine–Rumänien',
    lat: 45.25,
    lon: 30.2,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Schwarzmeer-EW-Korridor & Küsten-C-UAS-Schutzschirm Donaudelta / Odessa–Sulina',
    effect: 'Schwere GNSS- und AIS-Störungen auf dem maritimen Getreidekorridor zwischen der Schlangeninsel (Zmiinyi), Sulina und Odessa.',
    cells: [
      [45.25, 30.25],
      [45.25, 29.75],
      [45.75, 30.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-cy-nicosia-larnaca-fir',
    name: 'GPS-Spoofing & Jamming: Nicosia FIR Ost / Larnaka-Anflugsektor Kap Greco (CY)',
    shortLabel: '📡 GPS-Spoofing: Nicosia FIR / Larnaka-Ost (88%)',
    theater: 'Zypern / Nicosia FIR (LCCC) / Östliches Mittelmeer',
    lat: 35.02,
    lon: 34.05,
    radiusKm: 88,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Ostmittelmeer-Multi-Emitter-Spoofing (OLBA/LLBG/HECA False-Fix Injection in Nicosia FIR)',
    effect: 'Verkehrsflugzeuge im östlichen Anflug auf Larnaka (LCLK) und im Nicosia FIR (LCCC) erleiden simultanes GPS-Spoofing und EGPWS/FMS-Drift.',
    cells: [
      [35.25, 34.25],
      [34.75, 34.25],
      [35.25, 33.75],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-sd-portsudan-central-redsea',
    name: 'GPS-Blockade & Maritimes Jamming: Port Sudan / Zentraler Rotes-Meer-Korridor (SD)',
    shortLabel: '📡 GPS-Störung: Port Sudan / Zentrales Rotes Meer (75%)',
    theater: 'Sudan / Zentrales Rotes Meer (Port Sudan – Dschidda)',
    lat: 19.62,
    lon: 37.22,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 75.0,
    system: 'Küsten-C-UAS-EW Port Sudan (HSPN) & Maritimes Rotes-Meer-Sicherheitsstörfeld',
    effect: 'Deutliche L1-GPS- und AIS-Störungen entlang der sudanesischen Rotmeerküste (Port Sudan / Suakin) und auf der zentralen Tankerroute.',
    cells: [
      [19.75, 37.25],
      [19.25, 37.25],
      [19.75, 37.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-om-ae-musandam-hormuz-west',
    name: 'Maritimes GPS- & AIS-Spoofing: Halbinsel Musandam / Westanfahrt Straße von Hormus (OM/AE)',
    shortLabel: '📡 GPS/AIS-Spoofing: Musandam / Hormus-West (86%)',
    theater: 'Oman (Musandam) / VAE (Fujairah / Ras Al Khaimah) / Straße von Hormus',
    lat: 25.95,
    lon: 56.45,
    radiusKm: 95,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Golf-von-Oman- & Hormus-TSS-Interferenzzone (Khor Fakkan / Fujairah / Musandam)',
    effect: 'Schwere GPS- und AIS-Positionsverfälschungen für VLCC-Tanker und Luftfahrzeuge im Verkehrstrennungsgebiet (TSS) vor Musandam und Fujairah.',
    cells: [
      [25.75, 56.25],
      [26.25, 56.75],
      [25.25, 56.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-kr-incheon-nll-westsea',
    name: 'GPS-Jamming: Westmeer-NLL-Sektor / Baengnyeongdo – Flughafen Incheon (KR)',
    shortLabel: '📡 GPS-Störung: Incheon / Westmeer-NLL (78%)',
    theater: 'Südkorea / Gelbes Meer (Northern Limit Line) / Incheon FIR (RKRR)',
    lat: 37.46,
    lon: 125.95,
    radiusKm: 92,
    level: 'high',
    percentDegraded: 77.8,
    system: 'Nordkoreanische Küsten-EW-Batterien (Haeju / Ongjin-Halbinsel) Richtung NLL & Incheon',
    effect: 'Gerichtete Hochleistungs-GPS-Störkeulen über die Northern Limit Line (NLL), die Fährverkehr und Anflüge auf Seoul-Incheon (RKSI) beeinträchtigen.',
    cells: [
      [37.25, 125.75],
      [37.25, 126.25],
      [37.75, 125.75],
    ],
    degradedPerCell: 8,
    totalPerCell: 9,
  },
  {
    id: 'gnss-ru-rostov-taganrog-azov',
    name: 'GPS-Blockade & Spoofing: Asowsches Meer / Rostow am Don / Taganrog / Jeisk (RU/UA)',
    shortLabel: '📡 GPS-Blockade: Asowsches Meer / Rostow (90%)',
    theater: 'Asowsches Meer / Rostow am Don / Süd-Russland',
    lat: 47.12,
    lon: 38.92,
    radiusKm: 130,
    level: 'high',
    percentDegraded: 90.0,
    system: 'Russische Süd-Militärbezirk EW-Komplexe Krasucha-4, Pole-21 & R-330Zh Zhitel (Rostow / Taganrog / Jeisk)',
    effect: 'Permanente L1/L2-GNSS-Blockade und Kreis-Spoofing über dem Asowschen Meer und der Bucht von Taganrog zum Schutz der Fliegerhorste Taganrog und Jeisk.',
    cells: [
      [46.75, 38.25],
      [47.25, 38.75],
      [47.25, 39.25],
      [46.75, 37.75],
    ],
    degradedPerCell: 10,
    totalPerCell: 10,
  },
  {
    id: 'gnss-lv-ru-rezekne-pskov-ostrov',
    name: 'GPS-Blockade: Ost-Lettland / Rēzekne–Daugavpils / Fliegerhorst Ostrow (LV/RU)',
    shortLabel: '📡 GPS-Blockade: Ost-Lettland / Ostrow (86%)',
    theater: 'Lettland / Baltikum / Russische Westgrenze (Pskow–Ostrow)',
    lat: 56.85,
    lon: 27.65,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 85.7,
    system: 'Russische EW-Stellung Ostrow / Pskow-Süd (Pole-21 & Borisoglebsk-2)',
    effect: 'Starke grenzüberschreitende GPS/Galileo-Störung im ostlettischen Luftraum (Riga FIR Ost / Latgale) auf europäischen Nord-Süd-Luftstraßen.',
    cells: [
      [56.75, 27.25],
      [56.75, 27.75],
      [57.25, 27.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-fi-ru-karelia-virolahti-vyborg',
    name: 'GPS-Blockade: Südost-Finnland / Lappeenranta / Virolahti–Wyborg-Sektor (FI/RU)',
    shortLabel: '📡 GPS-Blockade: Südost-Finnland / Wyborg (88%)',
    theater: 'Südost-Finnland / Südkarelien / Wyborger Bucht',
    lat: 60.75,
    lon: 28.35,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Russische EW-Komplexe Wyborg / Kamenskelski / Kronstadt (Leningrader Militärbezirk)',
    effect: 'Permanente L1-GPS/Galileo-Störungen über Südkarelien (Lappeenranta / Imatra / Hamina) sowie AIS-Spoofing in der Wyborger Bucht.',
    cells: [
      [60.75, 28.25],
      [60.75, 28.75],
      [61.25, 28.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-sy-jo-damascus-amman-corridor',
    name: 'GPS-Spoofing & Jamming: Damaskus–Amman-Korridor / Golan / Daraa (SY/JO/IL)',
    shortLabel: '📡 GPS-Spoofing: Damaskus–Amman / Golan (88%)',
    theater: 'Süd-Syrien / Nord-Jordanien / Golanhöhen',
    lat: 32.65,
    lon: 36.15,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Multi-Emitter Levante-EW-Schutzschirm (Golanhöhen / Damaskus-Süd / Nord-Jordanien)',
    effect: 'Schweres GPS-Spoofing auf den internationalen Luftstraßen über Nord-Jordanien (Amman FIR OJAC) und Süd-Syrien zur Abwehr von Langstreckendrohnen.',
    cells: [
      [32.75, 36.25],
      [32.25, 36.25],
      [33.25, 36.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
  {
    id: 'gnss-iq-baghdad-al-assad-euphrates',
    name: 'GPS-Interferenz: Zentral-Irak / Bagdad FIR / Ain al-Asad Luftwaffenbasis (IQ)',
    shortLabel: '📡 GPS-Störung: Bagdad FIR / Ain al-Asad (78%)',
    theater: 'Zentral-Irak / Euphrat-Korridor / Anbar',
    lat: 33.58,
    lon: 43.45,
    radiusKm: 115,
    level: 'high',
    percentDegraded: 77.8,
    system: 'Koalitions-C-UAS-EW & Luftverteidigungsschutzschirm Ain al-Asad (ORAA) / Bagdad (ORBI)',
    effect: 'Ausgedehnte L1/L2-GPS-Degradierung auf den zivilen Hauptluftstraßen (UL602 / UM860) über dem Euphrat-Tal und Bagdad.',
    cells: [
      [33.75, 42.75],
      [33.25, 43.75],
      [33.25, 44.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 9,
  },
  {
    id: 'gnss-tr-blacksea-sinop-samsun',
    name: 'GPS-Interferenz: Südliches Schwarzes Meer / Sinop Raketentestgelände / Samsun (TR)',
    shortLabel: '📡 GPS-Interferenz: Sinop / Südl. Schwarzes Meer (75%)',
    theater: 'Südliches Schwarzes Meer / Nord-Türkei (Sinop–Samsun)',
    lat: 41.95,
    lon: 35.35,
    radiusKm: 110,
    level: 'high',
    percentDegraded: 75.0,
    system: 'Schwarzmeer-Ferninterferenz & Türkisches EW-/Raketentestzentrum Sinop (KORAL / REDET)',
    effect: 'Wiederkehrende GNSS-Integritätseinbrüche (NIC < 5) über der südschwarzmeerischen Küstenroute zwischen Sinop, Samsun und Trabzon.',
    cells: [
      [41.75, 35.25],
      [42.25, 35.25],
      [41.75, 35.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-dj-er-bab-el-mandeb-west',
    name: 'Maritimes GPS-Jamming: Westliches Bab al-Mandab / Dschibuti / Assab-Seeweg (DJ/ER/YE)',
    shortLabel: '📡 GPS-Störung: Bab al-Mandab West / Dschibuti (78%)',
    theater: 'Horn von Afrika / Straße von Bab al-Mandab / Golf von Aden',
    lat: 12.35,
    lon: 43.35,
    radiusKm: 98,
    level: 'high',
    percentDegraded: 77.8,
    system: 'Multinationale Marine-EW-Flottenschutzschirme (EUNAVFOR Aspides / US Navy) & Küsten-Störsender Bab al-Mandab',
    effect: 'Starke GNSS- und AIS-Beeinträchtigung im unmittelbaren Meerengen-Korridor zwischen der Insel Perim (Mayyun), Dschibuti und Assab.',
    cells: [
      [12.25, 43.25],
      [12.75, 43.25],
      [11.75, 43.25],
    ],
    degradedPerCell: 8,
    totalPerCell: 9,
  },
  {
    id: 'gnss-ch-at-rheintal-sargans-montafon',
    name: 'Alpen-Spektrum- & Mehrwege-Monitor: Alpenrheintal Süd / Sargans / Liechtenstein / Montafon (CH/LI/AT)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Alpenrheintal / Vaduz / Sargans (BAKOM)',
    theater: 'Ostschweiz / Fürstentum Liechtenstein / Vorarlberg (Walgau–Montafon)',
    lat: 47.14,
    lon: 9.52,
    radiusKm: 42,
    level: 'medium',
    percentDegraded: 8.3,
    system: 'BAKOM / swisstopo AGNES-Referenznetz (Buchs/Sargans) & Austro Control Alpen-GNSS-Integritätsmonitor',
    effect: 'Permanente Überwachung von Alpental-Mehrwegeffekten (Multipath am Alpstein/Rätikon) und C-UAS-Spektrumanomalien im Korridor Buchs–Vaduz–Sargans–Feldkirch.',
    cells: [
      [47.25, 9.25],
      [46.75, 9.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 12,
  },
  {
    id: 'gnss-ch-gr-engadin-bernina-agnes',
    name: 'Alpen-GNSS-Kalibrierungs- & Gebirgs-Multipath-Korridor: Oberengadin / Samedan (LSZS) / Bernina–Julier (CH)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Oberengadin / Samedan (AGNES / Skyguide)',
    theater: 'Graubünden / Oberengadin / Südalpen (CH/IT)',
    lat: 46.53,
    lon: 9.88,
    radiusKm: 44,
    level: 'medium',
    percentDegraded: 8.3,
    system: 'swisstopo AGNES-Hochgebirgsreferenz (Samedan/Zimmerwald) & Skyguide RNP-Anflugmonitor LSZS',
    effect: 'Kontinuierliche GNSS-Integritätskalibrierung und Überwachung von Steilwand-Mehrwegeffekten (Multipath) im Hochtal Oberengadin und am Berninapass.',
    cells: [
      [46.25, 9.75],
      [46.75, 9.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 12,
  },
  {
    id: 'gnss-ch-vs-sion-simplon-rhone',
    name: 'Alpen-EW- & Tieftal-Abschattungssektor: Walliser Rhônetal / Fliegerhorst Sion (LSGS) / Simplon (CH)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Wallis / Sion / Simplon (Luftwaffe)',
    theater: 'Schweizer Westalpen / Wallis / Simplon-Korridor',
    lat: 46.22,
    lon: 7.34,
    radiusKm: 48,
    level: 'medium',
    percentDegraded: 9.1,
    system: 'Schweizer Luftwaffe & Skyguide IGS-Anflugkorridor Sion (LSGS) / AGNES-Stationen Visp & Martigny',
    effect: 'Ausgeprägte topografische Satellitenabschattung (HDOP-Spitzen zwischen Berner und Walliser Viertausendern) sowie periodische ELOKA-/C-UAS-Tests.',
    cells: [
      [46.25, 7.25],
      [46.25, 7.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 11,
  },
  {
    id: 'gnss-at-it-brenner-innsbruck-wipptal',
    name: 'Alpiner RNP-AR-Anflug- & Spektrum-Monitor: Innsbruck (LOWI) / Wipptal / Brenner-Korridor (AT/IT)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Innsbruck / Brenner-Korridor (Austro Control)',
    theater: 'Tirol / Südtirol / Brenner-Nord-Süd-Achse',
    lat: 47.18,
    lon: 11.42,
    radiusKm: 46,
    level: 'medium',
    percentDegraded: 8.3,
    system: 'Austro Control RNP-AR Integrity Monitor Innsbruck (LOWI) & Brenner-Maut-/Telematik-Spektrumüberwachung',
    effect: 'Strenge RAIM/RNP-AR-Überwachung im Inntal und Wipptal; gelegentliche lokale L1-Interferenzen entlang der Schwerverkehrsachse A13/A22 am Brenner.',
    cells: [
      [47.25, 11.25],
      [46.75, 11.25],
    ],
    degradedPerCell: 2,
    totalPerCell: 12,
  },
  {
    id: 'gnss-de-ch-hochrhein-schwarzwald-agnes',
    name: 'GNSS-Referenz- & Spektrum-Kalibrierungszone: Hochrhein / Südschwarzwald / Zürich-Nordanflug (DE/CH)',
    shortLabel: '🛡️ EW/GNSS-Monitor: Hochrhein / Anflug LSZH Nord (BNetzA / BAKOM)',
    theater: 'Südbaden / Nordschweiz / Anflugsektor Zürich (LSZH)',
    lat: 47.62,
    lon: 8.38,
    radiusKm: 45,
    level: 'medium',
    percentDegraded: 7.7,
    system: 'BNetzA Funkmessdienst Konstanz/Freiburg & Skyguide/BAKOM GBAS/GNSS-Anflugschutzzone Zürich-Kloten (LSZH)',
    effect: 'Permanente Spektrumüberwachung zum Schutz der ILS/RNP-Anflugachsen 14/16 auf den Flughafen Zürich über dem Hochrhein und Südschwarzwald.',
    cells: [
      [47.75, 8.25],
      [47.75, 8.75],
    ],
    degradedPerCell: 2,
    totalPerCell: 13,
  },
  {
    id: 'gnss-ae-ir-tunb-abu-musa-gulf',
    name: 'Maritimes GPS- & AIS-Spoofing: Zentraler Persischer Golf / Abu Musa & Tunb-Inseln / Dubai–Schardscha-Anflug (IR/AE)',
    shortLabel: '📡 GPS/AIS-Spoofing: Abu Musa / Zentraler Golf (86%)',
    theater: 'Zentraler Persischer Golf / Iranische Inseln / VAE',
    lat: 25.88,
    lon: 55.15,
    radiusKm: 105,
    level: 'high',
    percentDegraded: 85.7,
    system: 'IRGC Navy Insel-EW-Stellungen (Abu Musa, Greater & Lesser Tunb) & Küsten-Spoofing',
    effect: 'Starke GPS- und AIS-Positionsverfälschungen für Handelsschiffe im zentralen Persischen Golf sowie RNP-Warnungen im Anflugraum Dubai (OMDB) und Schardscha (OMSJ).',
    cells: [
      [25.75, 55.25],
      [26.25, 55.25],
      [25.75, 54.75],
    ],
    degradedPerCell: 7,
    totalPerCell: 7,
  },
  {
    id: 'gnss-gr-tr-aegean-dodecanese-rhodes',
    name: 'GPS-Interferenz: Südöstliche Ägäis / Dodekanes / Rhodos–Kastellorizo–Dalaman-Sektor (GR/TR)',
    shortLabel: '📡 GPS-Interferenz: Südost-Ägäis / Rhodos (75%)',
    theater: 'Südöstliche Ägäis / Dodekanes / Südwest-Türkei',
    lat: 36.25,
    lon: 28.45,
    radiusKm: 98,
    level: 'high',
    percentDegraded: 75.0,
    system: 'Ostmittelmeer-Ferninterferenz & Marine-/Luftwaffen-EW im Übergang Athen FIR (LGGG) / Ankara FIR (LTAA)',
    effect: 'Wiederkehrende L1-GPS-Genauigkeitseinbrüche (NIC < 5) und EGPWS-Warnungen im Luftkorridor Rhodos (LGRP), Dalaman (LTBS) und Kastellorizo.',
    cells: [
      [36.25, 28.25],
      [36.25, 28.75],
      [36.75, 28.25],
    ],
    degradedPerCell: 7,
    totalPerCell: 8,
  },
  {
    id: 'gnss-ru-voronezh-lipetsk-tambov',
    name: 'GPS-Blockade & Spoofing: Luftwaffenbasen Woronesch-Baltimor & Lipezk-2 / Zentralrussland (RU)',
    shortLabel: '📡 GPS-Blockade: Woronesch / Lipezk (89%)',
    theater: 'West-Russland / Schwarzerde-Region (Woronesch–Lipezk)',
    lat: 51.85,
    lon: 39.25,
    radiusKm: 130,
    level: 'high',
    percentDegraded: 88.9,
    system: 'Russische Luftverteidigungs-EW Pole-21, R-330Zh Zhitel & Krasucha-4 (Woronesch-Baltimor / Lipezk / Borisoglebsk)',
    effect: 'Flächendeckende GNSS-Unterdrückung und Spoofing-Felder zum Schutz der Luftwaffenstützpunkte und Treibstofflager in Woronesch und Lipezk gegen Langstreckendrohnen.',
    cells: [
      [51.75, 39.25],
      [52.25, 39.25],
      [52.75, 39.75],
      [51.25, 41.75],
    ],
    degradedPerCell: 9,
    totalPerCell: 9,
  },
  {
    id: 'gnss-no-ru-barents-vardo-varanger',
    name: 'Arktische GPS-Blockade & ELINT-Zone: Varangerfjord / Vardø (Globus-Radar) / Fischerhalbinsel (NO/RU)',
    shortLabel: '📡 GPS-Blockade: Varangerfjord / Vardø–Petschenga (88%)',
    theater: 'Nordost-Norwegen (Finnmark) / Barentssee / Petschenga',
    lat: 70.15,
    lon: 30.85,
    radiusKm: 115,
    level: 'high',
    percentDegraded: 87.5,
    system: 'Russische Nordflotte Küsten-EW (Fischerhalbinsel / Petschenga — Murmansk-BN & Krasucha-4)',
    effect: 'Intensive gerichtete GPS/Galileo-Störungen über der Ost-Finnmark (Vardø, Vadsø, Kirkenes) und der südlichen Barentssee; Widerøe-Regionalflüge nutzen konventionelle Navigationsverfahren.',
    cells: [
      [70.25, 31.25],
      [69.75, 30.75],
      [70.25, 29.75],
    ],
    degradedPerCell: 8,
    totalPerCell: 8,
  },
]);

/**
 * Build synthetic ADS-B GNSS integrity rows representing active global EW/GPS blockade cells.
 */
export function buildGlobalGnssBlockadeRows() {
  const rows = [];
  let seq = 1;
  for (const zone of GLOBAL_GNSS_BLOCKADE_ZONES) {
    const total = zone.totalPerCell || 8;
    const bad = Math.min(total, zone.degradedPerCell || 7);
    for (const [cellLat, cellLon] of zone.cells) {
      for (let i = 0; i < total; i++) {
        const isDegraded = i < bad;
        const hex = `~e${(seq++).toString(16).padStart(5, '0')}`;
        rows.push({
          hex,
          lat: Number((cellLat + (i - total / 2) * 0.015).toFixed(4)),
          lon: Number((cellLon + (i - total / 2) * 0.015).toFixed(4)),
          nic: isDegraded ? 0 : 8,
          nacp: isDegraded ? 0 : 10,
          gpsLost: isDegraded,
          degraded: isDegraded,
        });
      }
    }
  }
  return rows;
}
