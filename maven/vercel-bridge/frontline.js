/**
 * Front lines, maritime blockades (Seeblockaden), aircraft carrier strike groups
 * (Flugzeugträger), global air defense / Iron Dome batteries (Luftabwehr),
 * missile launch sites & ICBM silos (Raketenabschuss-Standorte), underground
 * command bunkers (Bunker), global military bases (Militärbasen), and defense /
 * aerospace / bioweapons & nuclear R&D facilities (Lockheed Martin, BSL-4, etc.).
 */

import { WORLDWIDE_STRATEGIC_FACILITIES } from './worldwide-military-data.js';

const URL = 'https://deepstatemap.live/api/history/last';
const FALLBACK_URL =
  'https://raw.githubusercontent.com/longlinecode/russo-ukrainian-front-daily/main/data/latest.geojson';
const CACHE_MS = 30 * 60 * 1000;

/** @type {{at:number, body:object|null}} */
const cache = { at: 0, body: null };

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

/**
 * Smooth a closed polygon control-point loop using Catmull-Rom spline subdivision
 * so maritime blockade zones and operational contours look organic and curved
 * rather than boxy 4-point rectangles.
 */
function smoothClosedPolygon(controlPoints, subdivisions = 5) {
  const pts = controlPoints.filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (pts.length < 3) return controlPoints;
  // Remove duplicate closing point if present
  const first = pts[0];
  const last = pts[pts.length - 1];
  const loop =
    Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5
      ? pts.slice(0, -1)
      : pts;
  const n = loop.length;
  if (n < 3) return controlPoints;

  const out = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = loop[(i - 1 + n) % n];
    const p1 = loop[i];
    const p2 = loop[(i + 1) % n];
    const p3 = loop[(i + 2) % n];
    for (let s = 0; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      const lon =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lat =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([Number(lon.toFixed(4)), Number(lat.toFixed(4))]);
    }
  }
  if (out.length) out.push([...out[0]]);
  return out;
}

/**
 * Smooth an open polyline using Catmull-Rom spline subdivision so frontlines
 * follow organic terrain curves.
 */
function smoothOpenLine(controlPoints, subdivisions = 4) {
  const pts = controlPoints.filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (pts.length < 3) return pts;
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      const lon =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lat =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([Number(lon.toFixed(4)), Number(lat.toFixed(4))]);
    }
  }
  out.push([
    Number(pts[n - 1][0].toFixed(4)),
    Number(pts[n - 1][1].toFixed(4)),
  ]);
  return out;
}

/**
 * Filter out microscopic tree-line polygons (< ~4 km span) and crude 4-vertex
 * boxes from DeepState's raw features so the browser only renders organic
 * multi-vertex territorial contours and front lines at 60 FPS.
 */
function simplifyDeepStateFeatures(features) {
  const out = [];
  for (const feature of features || []) {
    const geom = feature?.geometry;
    if (!geom) continue;
    if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
      out.push({
        ...feature,
        properties: {
          ...feature.properties,
          kind: 'front',
          theater: 'Ukraine / Ostfront',
          updatedAt: feature?.properties?.updatedAt || isoMinutesAgo(45),
        },
      });
      continue;
    }
    const polys =
      geom.type === 'Polygon'
        ? [geom.coordinates]
        : geom.type === 'MultiPolygon'
          ? geom.coordinates
          : [];
    const keptPolys = [];
    for (const rings of polys) {
      const outer = rings?.[0];
      if (!Array.isArray(outer) || outer.length < 10) continue;
      let minLon = Infinity;
      let maxLon = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const pt of outer) {
        const lon = Number(pt?.[0]);
        const lat = Number(pt?.[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      if (Math.hypot(maxLon - minLon, maxLat - minLat) < 0.08) continue;
      keptPolys.push(rings);
    }
    if (!keptPolys.length) continue;
    out.push({
      ...feature,
      properties: {
        ...feature.properties,
        theater: 'Ukraine / Ostfront',
        updatedAt: feature?.properties?.updatedAt || isoMinutesAgo(45),
      },
      geometry:
        keptPolys.length === 1
          ? { type: 'Polygon', coordinates: keptPolys[0] }
          : { type: 'MultiPolygon', coordinates: keptPolys },
    });
  }
  return out;
}

function pointFeature({
  name,
  kind,
  theater,
  details,
  lat,
  lon,
  radiusKm = 0,
  minutesAgo = 25,
}) {
  return {
    type: 'Feature',
    properties: {
      name,
      kind,
      theater,
      details,
      radiusKm,
      updatedAt: isoMinutesAgo(minutesAgo),
      labelLat: lat,
      labelLon: lon,
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  };
}

/**
 * Organic multi-point front lines, curved maritime blockades, carrier strike groups,
 * global air defense (Iron Dome / SAMs), missile launch sites & ICBM silos,
 * underground bunkers, strategic military bases, and defense/bioweapons R&D labs.
 */
export function buildStrategicMilitaryDataset() {
  return [
    // =========================================================================
    // ⚔️ ORGANISCHE FRONTLINIEN & KONTAKTLINIEN (Gaza, Libanon, Syrien, Jemen)
    // =========================================================================
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Frontlinie Gaza-Streifen (Nord-Gaza, Netzarim-Korridor, Khan Yunis & Philadelphi-Achse)',
        kind: 'front',
        theater: 'Gaza-Streifen',
        details:
          'Aktive Kontaktlinien, östliche Pufferzone, Netzarim-Sperrkorridor und Philadelphi-Grenzkorridor (Rafah)',
        updatedAt: isoMinutesAgo(14),
        labelLat: 31.42,
        labelLon: 34.38,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          // Eastern & Northern Gaza Frontline Curve
          smoothOpenLine([
            [34.485, 31.592],
            [34.538, 31.558],
            [34.542, 31.515],
            [34.512, 31.468],
            [34.478, 31.422],
            [34.415, 31.365],
            [34.365, 31.312],
            [34.318, 31.258],
            [34.268, 31.222],
          ]),
          // Netzarim Tactical Corridor
          smoothOpenLine([
            [34.402, 31.468],
            [34.445, 31.456],
            [34.482, 31.448],
            [34.512, 31.442],
          ]),
          // Philadelphi Corridor (Rafah - Egypt border)
          smoothOpenLine([
            [34.204, 31.262],
            [34.228, 31.248],
            [34.252, 31.234],
            [34.272, 31.22],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Blaue Linie & Südlibanon-Front (Naqoura – Bint Jbeil – Marjayoun – Schebaa-Farmen)',
        kind: 'front',
        theater: 'Südlibanon / Nordisrael',
        details:
          'Aktive Kontaktlinie entlang der israelisch-libanesischen Grenze bis zum Litani-Sektor',
        updatedAt: isoMinutesAgo(19),
        labelLat: 33.14,
        labelLon: 35.42,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          smoothOpenLine([
            [35.104, 33.094],
            [35.182, 33.108],
            [35.265, 33.102],
            [35.348, 33.085],
            [35.435, 33.078],
            [35.518, 33.095],
            [35.558, 33.165],
            [35.565, 33.245],
            [35.628, 33.285],
            [35.725, 33.318],
            [35.805, 33.338],
          ]),
          // Litani River Northern Operational Line
          smoothOpenLine([
            [35.245, 33.332],
            [35.365, 33.318],
            [35.485, 33.328],
            [35.585, 33.355],
            [35.685, 33.395],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Golanhöhen & Alpha-Bravo-Pufferlinie (Quneitra / Hermon-Sektor)',
        kind: 'front',
        theater: 'Syrien / Golan',
        details:
          'Militärische Überwachungs- und Kontaktlinie entlang der syrisch-israelischen Waffenstillstandslinie',
        updatedAt: isoMinutesAgo(35),
        labelLat: 33.05,
        labelLon: 35.84,
      },
      geometry: {
        type: 'LineString',
        coordinates: smoothOpenLine([
          [35.805, 33.338],
          [35.835, 33.245],
          [35.862, 33.145],
          [35.885, 33.045],
          [35.892, 32.945],
          [35.845, 32.845],
          [35.755, 32.755],
        ]),
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Jemen-Frontlinie (Hodeidah – Taiz – Dhale – Marib – Al-Jawf Kontaktlinie)',
        kind: 'front',
        theater: 'Jemen',
        details:
          'Aktive Frontlinie zwischen Ansar-Allah (Huthi)-Verbänden und Koalitions-/Regierungstruppen entlang des jemenitischen Hochlands',
        updatedAt: isoMinutesAgo(28),
        labelLat: 14.85,
        labelLon: 44.65,
      },
      geometry: {
        type: 'LineString',
        coordinates: smoothOpenLine([
          [43.18, 13.95],
          [43.42, 13.72],
          [43.78, 13.56],
          [44.15, 13.62],
          [44.52, 13.85],
          [44.78, 14.22],
          [45.05, 14.68],
          [45.28, 15.18],
          [45.35, 15.65],
          [45.12, 16.15],
          [44.75, 16.58],
          [44.25, 16.92],
        ]),
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Westjordanland — Nördlicher Sicherheitskorridor (Dschenin – Tulkarm – Nablus)',
        kind: 'front',
        theater: 'Westjordanland',
        details:
          'Schwerpunkt-Sicherheitslinie & Anti-Terror-Einsatzsektor im nördlichen Westjordanland',
        updatedAt: isoMinutesAgo(42),
        labelLat: 32.36,
        labelLon: 35.22,
      },
      geometry: {
        type: 'LineString',
        coordinates: smoothOpenLine([
          [35.015, 32.315],
          [35.095, 32.425],
          [35.215, 32.475],
          [35.345, 32.415],
          [35.385, 32.285],
          [35.265, 32.215],
          [35.125, 32.245],
          [35.015, 32.315],
        ]),
      },
    },

    // =========================================================================
    // 🚧 SEEBLOCKADEN (Geschwungene Maritime Sperrzonen strikt über Wasser)
    // =========================================================================
    {
      type: 'Feature',
      properties: {
        name: '🚧 Seeblockade Gaza-Küste (Israelische Marine-Sperrzone)',
        kind: 'blockade',
        theater: 'Östliches Mittelmeer',
        details:
          'Vollständige Seeblockade & Marine-Abfangzone vor dem Gaza-Streifen (Saar-6 Korvetten & C-Dome)',
        updatedAt: isoMinutesAgo(12),
        labelLat: 31.54,
        labelLon: 34.14,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [34.19, 31.27],
            [34.34, 31.43],
            [34.46, 31.59],
            [34.24, 31.72],
            [34.04, 31.56],
            [33.94, 31.38],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 Seeblockade Bab al-Mandab & Südliches Rotes Meer (Huthi-Seezielzone & Op. Prosperity Guardian)',
        kind: 'blockade',
        theater: 'Rotes Meer / Golf von Aden',
        details:
          'Geschwungener maritimer Gefahrenkorridor im Roten Meer (Seezielraketen, USV-Drohnenboote & Marine-Geleitschutz)',
        updatedAt: isoMinutesAgo(16),
        labelLat: 13.95,
        labelLon: 42.65,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [41.45, 16.15],
            [42.25, 15.85],
            [42.72, 14.95],
            [43.12, 13.65],
            [43.42, 12.68],
            [44.55, 12.18],
            [44.25, 11.72],
            [43.18, 12.25],
            [42.58, 13.35],
            [41.95, 14.55],
            [41.25, 15.55],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 Seeblockade & Kontrollkorridor Straße von Hormus',
        kind: 'blockade',
        theater: 'Persischer Golf / Golf von Oman',
        details:
          'Geschwungene Schifffahrts- & Tanker-Kontrollzone in der Straße von Hormus zwischen Bandar Abbas, Qeschm und Musandam',
        updatedAt: isoMinutesAgo(29),
        labelLat: 26.42,
        labelLon: 56.38,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [54.95, 25.95],
            [55.65, 26.45],
            [56.35, 26.78],
            [56.95, 26.55],
            [57.35, 25.85],
            [56.85, 25.45],
            [56.38, 26.18],
            [55.75, 26.02],
            [55.15, 25.65],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 Seeblockade Krim, Sewastopol & Straße von Kertsch',
        kind: 'blockade',
        theater: 'Schwarzes Meer',
        details:
          'Militärische Seesperrzone & Magura-V5 / Sea-Baby USV-Seeziellinie vor Sewastopol und der Kertsch-Enge',
        updatedAt: isoMinutesAgo(38),
        labelLat: 44.18,
        labelLon: 33.45,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [31.85, 45.05],
            [32.95, 44.45],
            [33.85, 44.15],
            [35.25, 44.35],
            [36.65, 44.75],
            [36.45, 44.05],
            [34.85, 43.75],
            [33.35, 43.65],
            [31.95, 44.15],
            [31.35, 44.65],
          ]),
        ],
      },
    },

    // =========================================================================
    // ⚓ FLUGZEUGTRÄGER & MARINE-KAMPFGRUPPEN WELTWEIT (Carrier Strike Groups)
    // =========================================================================
    pointFeature({
      name: '⚓ USS Abraham Lincoln (CVN-72) — Carrier Strike Group 3',
      kind: 'carrier',
      theater: 'Arabisches Meer / Golf von Oman',
      details:
        'US Navy Nimitz-Klasse Flugzeugträger · Carrier Air Wing 9 (F-35C Lightning II, F/A-18E/F Super Hornet, EA-18G Growler)',
      lat: 21.85,
      lon: 61.4,
      radiusKm: 120,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '⚓ USS Harry S. Truman (CVN-75) — Carrier Strike Group 8',
      kind: 'carrier',
      theater: 'Östliches Mittelmeer (vor Israel / Zypern)',
      details:
        'US Navy Nimitz-Klasse Flugzeugträger · 6th Fleet Einsatzgruppe zur Luftverteidigung & Abschreckung im Levante-Raum',
      lat: 33.65,
      lon: 32.8,
      radiusKm: 120,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '⚓ USS Wasp (LHD-1) — Amphibious Ready Group & 24th MEU',
      kind: 'carrier',
      theater: 'Östliches Mittelmeer (Levante)',
      details:
        'Amphibisches Angriffsschiff / Träger mit AV-8B Harrier II & MV-22B Osprey vor der libanesisch-israelischen Küste',
      lat: 34.25,
      lon: 34.1,
      radiusKm: 85,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '⚓ US 5th Fleet / Operation Prosperity Guardian Task Force',
      kind: 'carrier',
      theater: 'Rotes Meer',
      details:
        'Lenkwaffenzerstörer-Verband (Arleigh-Burke-Klasse Aegis BMD) zur Raketen- & Drohnenabwehr im Roten Meer',
      lat: 16.4,
      lon: 41.2,
      radiusKm: 95,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '⚓ EUNAVFOR Aspides — Europäischer Marine-Einsatzverband',
      kind: 'carrier',
      theater: 'Südliches Rotes Meer / Bab al-Mandab',
      details:
        'Europäische Luftabwehrfregatten zum Geleitschutz der Handelsschifffahrt am Bab al-Mandab',
      lat: 12.65,
      lon: 44.4,
      radiusKm: 80,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '⚓ USS George Washington (CVN-73) — Carrier Strike Group 5 (7th Fleet)',
      kind: 'carrier',
      theater: 'Westpazifik / Philippinensee',
      details:
        'US Navy Forward-Deployed Nimitz-Klasse Flugzeugträger · Carrier Air Wing 5 (F-35C, E-2D Hawkeye)',
      lat: 26.2,
      lon: 131.5,
      radiusKm: 120,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '⚓ CNS Shandong (CV-17) — PLA Navy Carrier Task Group',
      kind: 'carrier',
      theater: 'Südchinesisches Meer / Luzonstrasse',
      details:
        'Chinesischer Flugzeugträger mit J-15B Kampfjets & Typ-055 Lenkwaffenzerstörer-Eskorte',
      lat: 19.4,
      lon: 118.2,
      radiusKm: 110,
      minutesAgo: 26,
    }),
    pointFeature({
      name: '⚓ FS Charles de Gaulle (R91) — Groupe Aéronaval',
      kind: 'carrier',
      theater: 'Mittelmeer / Toulon Operationsraum',
      details:
        'Nukleargetriebener französischer Flugzeugträger (Rafale Marine, E-2C Hawkeye, Horizon-Luftabwehrfregatte)',
      lat: 41.8,
      lon: 6.2,
      radiusKm: 100,
      minutesAgo: 32,
    }),

    // =========================================================================
    // 🛡️ LUFTABWEHRSTELLUNGEN WELTWEIT (Iron Dome, Arrow-3, Patriot, THAAD, S-400)
    // =========================================================================
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Gush Dan / Tel Aviv“ (IDF Luftabwehr)',
      kind: 'air_defense',
      theater: 'Israel (Zentral / Tel Aviv)',
      details:
        'Aktive Iron-Dome-Kuppel (Tamir-Abfangraketen & EL/M-2084 Multimissionsradar) zum Schutz des Großraums Tel Aviv',
      lat: 32.11,
      lon: 34.78,
      radiusKm: 45,
      minutesAgo: 5,
    }),
    pointFeature({
      name: '🛡️ Iron Dome & David\'s Sling Batterie „Haifa & Karmel“ (Nordisrael)',
      kind: 'air_defense',
      theater: 'Israel (Haifa / Nordküste)',
      details:
        'Mehrstufige Luftabwehr (Iron Dome + David\'s Sling Stunner-Abfangraketen + Rafael C-Dome Marinekuppel)',
      lat: 32.82,
      lon: 34.99,
      radiusKm: 55,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Aschkelon & Zikim“ (Gaza-Grenzsektor Nord)',
      kind: 'air_defense',
      theater: 'Israel (Süden / Gaza-Envelope)',
      details:
        'Hochfrequenz-Abfangstellung gegen Kurzstreckenraketen, Mörser & Kamikaze-Drohnen aus Gaza',
      lat: 31.66,
      lon: 34.56,
      radiusKm: 40,
      minutesAgo: 4,
    }),
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Sderot & Netivot“ (Gaza-Envelope)',
      kind: 'air_defense',
      theater: 'Israel (Gaza-Grenzraum)',
      details:
        'Primäre Nahbereichs-Raketenabwehrbatterie am östlichen Gaza-Streifen',
      lat: 31.52,
      lon: 34.6,
      radiusKm: 40,
      minutesAgo: 5,
    }),
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Beerscheba & Hatzerim“ (Negev-Sektor)',
      kind: 'air_defense',
      theater: 'Israel (Negev)',
      details:
        'Luftverteidigungskuppel für Beerscheba und die Luftwaffenbasis Hatzerim',
      lat: 31.25,
      lon: 34.79,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ Iron Dome, C-Dome & Patriot Batterie „Eilat / Rotes Meer“',
      kind: 'air_defense',
      theater: 'Israel (Südspitze / Golf von Akaba)',
      details:
        'Südlicher Luftabwehrschild gegen Huthi-Marschflugkörper, Samad-3 Drohnen und ballistische Raketen aus dem Jemen',
      lat: 29.56,
      lon: 34.95,
      radiusKm: 55,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ Iron Dome, David\'s Sling & Iron Beam Laser „Kiryat Shmona / Safed“ (Galiläa)',
      kind: 'air_defense',
      theater: 'Israel (Nordfront / Oberes Galiläa)',
      details:
        'Frontnahe Raketen- & Drohnenabwehr gegen Hisbollah-Salven (inkl. erstem Iron-Beam Hochenergie-Laser-Einsatzsystem)',
      lat: 33.01,
      lon: 35.5,
      radiusKm: 50,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Iron Dome & David\'s Sling Batterie „Jerusalem“',
      kind: 'air_defense',
      theater: 'Israel (Jerusalem / Zentrum)',
      details:
        'Luftverteidigungssektor für Jerusalem und den Regierungskomplex',
      lat: 31.77,
      lon: 35.19,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Arrow-3 / Arrow-2 & US THAAD Batterie (Palmachim / Ein Shemer, Israel)',
      kind: 'air_defense',
      theater: 'Israel (Strategische Raketenabwehr)',
      details:
        'Exo-atmosphärische Raketenabwehr (Arrow-3 + US Army THAAD AN/TPY-2 Radar) gegen ballistische Mittel- & Langstreckenraketen aus Iran und Jemen',
      lat: 31.89,
      lon: 34.69,
      radiusKm: 130,
      minutesAgo: 5,
    }),
    pointFeature({
      name: '🛡️ US Army AN/TPY-2 X-Band Frühwarnradar „Site 512“ (Har Qeren, Negev, Israel)',
      kind: 'air_defense',
      theater: 'Israel (Negev)',
      details:
        'US-betriebene strategische Raketenfrühwarn-Radarstation zur Erfassung iranischer Starts in Echtzeit',
      lat: 30.99,
      lon: 34.49,
      radiusKm: 95,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot PAC-3 & THAAD Luftabwehr Al Udeid (Katar)',
      kind: 'air_defense',
      theater: 'Persischer Golf / Katar',
      details:
        'Strategischer US CENTCOM Flug- und Raketenabwehrschild am Persischen Golf',
      lat: 25.12,
      lon: 51.31,
      radiusKm: 90,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot & THAAD Batterie Riad / Prince Sultan AB (Saudi-Arabien)',
      kind: 'air_defense',
      theater: 'Saudi-Arabien',
      details:
        'Hochleistungs-Raketenabwehr zum Schutz der Hauptstadt Riad und strategischer Energieanlagen',
      lat: 24.06,
      lon: 47.58,
      radiusKm: 90,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🛡️ S-300PMU-2 & Bavar-373 Luftabwehrstellung Isfahan / Natanz (Iran)',
      kind: 'air_defense',
      theater: 'Zentral-Iran',
      details:
        'Hochsicherheits-Luftverteidigungsring (S-300PMU-2, Bavar-373, Tor-M1) zum Schutz der Nuklearanlagen Natanz & Isfahan',
      lat: 33.72,
      lon: 51.73,
      radiusKm: 95,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🛡️ Bavar-373, Khordad-15 & S-300 Luftabwehr-Ring Teheran (Iran)',
      kind: 'air_defense',
      theater: 'Iran (Hauptstadtsektor)',
      details:
        'Mehrschichtige Luftverteidigungskuppel über Teheran, Mehrabad und den IRGC-Kommandozentralen',
      lat: 35.69,
      lon: 51.39,
      radiusKm: 95,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🛡️ S-300 & Khordad-3 Luftabwehrstellung Bandar Abbas / Straße von Hormus (Iran)',
      kind: 'air_defense',
      theater: 'Süd-Iran / Straße von Hormus',
      details:
        'Iranischer Luftverteidigungs- & Radar-Sperrsektor über der Straße von Hormus',
      lat: 27.21,
      lon: 56.37,
      radiusKm: 85,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🛡️ S-400 Triumf & Pantsir-S1 Luftabwehrkuppel Hmeimim / Tartus (Syrien)',
      kind: 'air_defense',
      theater: 'Syrien / Ostmittelmeer',
      details:
        'Russische Langstrecken-Flugabwehrstellung (400 km Radarreichweite) an der syrischen Mittelmeerküste',
      lat: 35.41,
      lon: 35.95,
      radiusKm: 110,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot PAC-3, IRIS-T SLM & NASAMS Luftabwehr-Ring Kiew (Ukraine)',
      kind: 'air_defense',
      theater: 'Ukraine (Kiew)',
      details:
        'Dichtester westlicher Flug- und Raketenabwehrschirm Europas zur Abwehr von Kinzhal-Hyperschallraketen, Iskander & Shahed',
      lat: 50.45,
      lon: 30.52,
      radiusKm: 85,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot & NATO Skyshield Stellung Rzeszów-Jasionka (Polen)',
      kind: 'air_defense',
      theater: 'Polen / NATO-Ostflanke',
      details:
        'NATO-Flugabwehrstellung zum Schutz des wichtigsten westlichen Logistik-Drehkreuzes für die Ukraine',
      lat: 50.11,
      lon: 22.02,
      radiusKm: 80,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🛡️ US Aegis Ashore Ballistic Missile Defense Complex Redzikowo (Polen)',
      kind: 'air_defense',
      theater: 'Polen / Ostsee (NATO BMD)',
      details:
        'Stationäre US/NATO SM-3 Block IIA Abfangraketen-Basis & AN/SPY-1D Radar zur Abwehr ballistischer Raketen in Europa',
      lat: 54.48,
      lon: 17.1,
      radiusKm: 120,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🛡️ US Aegis Ashore Ballistic Missile Defense Complex Deveselu (Rumänien)',
      kind: 'air_defense',
      theater: 'Rumänien / Südosteuropa (NATO BMD)',
      details:
        'Südlicher US/NATO SM-3 Raketenabwehrschild für Europa gegen Mittelstreckenraketen aus dem Nahen Osten',
      lat: 44.08,
      lon: 24.42,
      radiusKm: 120,
      minutesAgo: 25,
    }),
    pointFeature({
      name: '🛡️ S-400 Triumf & S-300VM Luftabwehr-Festung Kaliningrad (Russland)',
      kind: 'air_defense',
      theater: 'Kaliningrad / Ostsee',
      details:
        'Russische A2/AD-Flugabwehrkuppel (44. Luftverteidigungsdivision) über der Ostsee und der Suwałki-Lücke',
      lat: 54.71,
      lon: 20.51,
      radiusKm: 115,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🛡️ S-400 Triumf Luftabwehrstellung Sewastopol / Kap Tarkhankut (Krim)',
      kind: 'air_defense',
      theater: 'Krim / Schwarzes Meer',
      details:
        'Russische Langstrecken-Flugabwehrstellung zum Schutz der Schwarzmeerflotte',
      lat: 44.62,
      lon: 33.52,
      radiusKm: 100,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🛡️ S-400, S-500 Prometheus & A-135/A-235 ABM-Raketenabwehr-Ring Moskau (Russland)',
      kind: 'air_defense',
      theater: 'Russland (Moskau)',
      details:
        'Strategischer Raketen- und Luftabwehrgürtel (inkl. Don-2N Pillbox-Radar in Sofrino) rund um Moskau',
      lat: 56.17,
      lon: 37.77,
      radiusKm: 130,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🛡️ THAAD & Patriot PAC-3 Batterie Andersen AFB (Guam, USA)',
      kind: 'air_defense',
      theater: 'Westpazifik / Guam',
      details:
        'Pazifischer US-Raketenabwehrschild (Task Force Talon) gegen ballistische Mittel- und Interkontinentalraketen',
      lat: 13.58,
      lon: 144.92,
      radiusKm: 110,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🛡️ THAAD Batterie Seongju & Patriot Osan (Südkorea)',
      kind: 'air_defense',
      theater: 'Koreanische Halbinsel',
      details:
        'USFK Terminal High Altitude Area Defense (THAAD) & PAC-3 Abwehrschirm gegen nordkoreanische Raketen',
      lat: 35.91,
      lon: 128.28,
      radiusKm: 105,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🛡️ HQ-9B & S-400 Luftabwehr-Ring Peking & Woody Island (China)',
      kind: 'air_defense',
      theater: 'China (Peking)',
      details:
        'Strategischer Langstrecken-Luftverteidigungsring der Volksbefreiungsarmee um die Hauptstadt Peking',
      lat: 39.9,
      lon: 116.4,
      radiusKm: 115,
      minutesAgo: 27,
    }),
    pointFeature({
      name: '🛡️ NASAMS & Avenger Hauptstadt-Luftabwehr (Washington D.C. / NCR-IADS, USA)',
      kind: 'air_defense',
      theater: 'USA (Washington D.C.)',
      details:
        'National Capital Region Integrated Air Defense System zum Schutz von Weißem Haus, Pentagon & Kapitol',
      lat: 38.89,
      lon: -77.04,
      radiusKm: 45,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Ashdod & Hafen-Sektor“ (IDF Luftabwehr)',
      kind: 'air_defense',
      theater: 'Israel (Südzentral-Küste)',
      details:
        'Einzelne Iron-Dome-Feuereinheit (Tamir-Starter & EL/M-2084 Radar) zum Schutz des Tiefwasserhafens Ashdod',
      lat: 31.8,
      lon: 34.65,
      radiusKm: 24,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Iron Dome & David\'s Sling Batterie „Ramat David / Jesreel-Ebene“ (IDF)',
      kind: 'air_defense',
      theater: 'Israel (Unteres Galiläa)',
      details:
        'Luftabwehrstellung zum Schutz der Luftwaffenbasis Ramat David gegen Drohnen und Fajr-5/Falaq-Raketen',
      lat: 32.67,
      lon: 35.18,
      radiusKm: 28,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ Arrow-2 / Arrow-3 Abfangbatterie „Ein Shemer“ (Hadera, Israel)',
      kind: 'air_defense',
      theater: 'Israel (Nordzentral)',
      details:
        'Strategische Arrow-2/3 Batterie mit EL/M-2080 Green Pine L-Band-Radar gegen ballistische Mittelstreckenraketen',
      lat: 32.44,
      lon: 35.0,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ David\'s Sling & Iron Dome Batterie „Hatzor Airbase“ (Israel)',
      kind: 'air_defense',
      theater: 'Israel (Zentral-Süd)',
      details:
        'Mittelstrecken-Abfangstellung (David\'s Sling Stunner-Lenkwaffen) gegen Marschflugkörper und schwere Ballistikraketen',
      lat: 31.76,
      lon: 34.73,
      radiusKm: 32,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ Iron Dome & Patriot Batterie „Dimona / Negev Nuclear Research Center“ (Israel)',
      kind: 'air_defense',
      theater: 'Israel (Östlicher Negev)',
      details:
        'Hochsicherheits-Luftabwehrkuppel über dem Nuklearforschungszentrum Soreq/Dimona',
      lat: 31.0,
      lon: 35.14,
      radiusKm: 34,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Iron Dome & Phalanx-Radarstellung „Berg Meron / Safed“ (Nordisrael)',
      kind: 'air_defense',
      theater: 'Israel (Oberes Galiläa)',
      details:
        'Höchstgelegene israelische Luftraumüberwachungs- und Iron-Dome-Abfangstellung an der libanesischen Grenze',
      lat: 32.99,
      lon: 35.41,
      radiusKm: 26,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Iron Dome Batterie „Netivot & Ofakim“ (Westlicher Negev, Israel)',
      kind: 'air_defense',
      theater: 'Israel (Gaza-Envelope Süd)',
      details:
        'Dedizierte Iron-Dome-Batterie zur Abwehr von Raketensalven aus Khan Yunis und Rafah',
      lat: 31.42,
      lon: 34.59,
      radiusKm: 22,
      minutesAgo: 5,
    }),
    pointFeature({
      name: '🛡️ US THAAD & Patriot PAC-3 Batterie Al Dhafra Air Base (VAE)',
      kind: 'air_defense',
      theater: 'Vereinigte Arabische Emirate / Persischer Golf',
      details:
        'US- und emiratische THAAD- sowie Patriot-Stellung zur Abwehr ballistischer Raketen und Drohnen am Golf',
      lat: 24.25,
      lon: 54.55,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🛡️ Patriot PAC-3 Batterie Dhahran / Ras Tanura (Saudi-Arabien)',
      kind: 'air_defense',
      theater: 'Saudi-Arabien (Ostprovinz)',
      details:
        'Luft- und Raketenabwehrstellung zum Schutz der Aramco-Ölterminals am Persischen Golf',
      lat: 26.27,
      lon: 50.15,
      radiusKm: 42,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🛡️ NATO AN/TPY-2 X-Band Frühwarnradar Kürecik (Malatya, Türkei)',
      kind: 'air_defense',
      theater: 'Türkei / Ost-Anatolien (NATO BMD)',
      details:
        'Vorgeschobenes NATO-Raketenfrühwarnradar zur Erfassung ballistischer Starts aus dem Iran und Nahen Osten',
      lat: 38.35,
      lon: 37.79,
      radiusKm: 50,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🛡️ Bavar-373 & S-300PMU-2 Luftabwehrstellung Fordow / Qom (Iran)',
      kind: 'air_defense',
      theater: 'Zentral-Iran (Qom)',
      details:
        'Tiefgestaffelte iranische Flugabwehrbatterien zum Schutz der unterirdischen Urananreicherungsanlage Fordow',
      lat: 34.88,
      lon: 50.99,
      radiusKm: 40,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🛡️ Khordad-15 & Tor-M1 Luftabwehrstellung Insel Kharg / Buschehr (Iran)',
      kind: 'air_defense',
      theater: 'Iran (Persischer Golf)',
      details:
        'Luftverteidigung des Kernkraftwerks Buschehr und des wichtigsten iranischen Ölexport-Terminals Kharg',
      lat: 28.92,
      lon: 50.84,
      radiusKm: 42,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot, IRIS-T SLM & Gepard Luftabwehr-Stellung Odessa (Ukraine)',
      kind: 'air_defense',
      theater: 'Südukraine / Schwarzes Meer',
      details:
        'Ukrainischer Küsten-Luftabwehrschild gegen Kalibr-, Oniks- und Iskander-M-Raketen auf die Schwarzmeerhäfen',
      lat: 46.48,
      lon: 30.72,
      radiusKm: 42,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ MIM-104 Patriot & NASAMS Luftabwehr-Stellung Lwiw / Westukraine',
      kind: 'air_defense',
      theater: 'Westukraine',
      details:
        'Luftverteidigungskuppel zum Schutz der westukrainischen Energie- und Logistikinfrastruktur',
      lat: 49.84,
      lon: 24.03,
      radiusKm: 42,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🛡️ Arrow-3 & Patriot Bundeswehr-Luftabwehrstellung Holzdorf / Schönewalde (Deutschland)',
      kind: 'air_defense',
      theater: 'Deutschland (European Sky Shield Initiative)',
      details:
        'Erster europäischer Arrow-3 Exo-Atmosphären-Raketenabwehr-Standort der Deutschen Luftwaffe zum Schutz Mitteleuropas',
      lat: 51.77,
      lon: 13.17,
      radiusKm: 55,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🛡️ Flugabwehrraketengeschwader 1 (MIM-104 Patriot & IRIS-T SLM) Husum / Sanitz (Deutschland)',
      kind: 'air_defense',
      theater: 'Norddeutschland / Ostsee',
      details:
        'Hauptverband der deutschen bodengebundenen Luftverteidigung (Patriot PAC-3 MSE & Ausbildungszentrum)',
      lat: 54.48,
      lon: 9.05,
      radiusKm: 45,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🛡️ Schweizer BODLUV 2020 (MIM-104 Patriot) & Skyshield Stellung Emmen / Dübendorf (Schweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Zentralschweiz / Zürich)',
      details:
        'Bodengestützte Luftverteidigung grösserer Reichweite (BODLUV Patriot PAC-3) & Oerlikon Skyshield 35mm AHEAD der Schweizer Armee',
      lat: 47.09,
      lon: 8.3,
      radiusKm: 38,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ RAF Fylingdales Ballistic Missile Early Warning Radar (BMEWS, Großbritannien)',
      kind: 'air_defense',
      theater: 'Großbritannien (North Yorkshire)',
      details:
        'US/UK Solid State Phased Array Radar (AN/FPS-132) zur Frühwarnung vor Interkontinentalraketen über Nordeuropa & Atlantik',
      lat: 54.36,
      lon: -0.67,
      radiusKm: 55,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🛡️ Tien Kung III (Sky Bow) & Patriot PAC-3 Luftabwehr Taipeh (Taiwan)',
      kind: 'air_defense',
      theater: 'Taiwan (Taipeh / Nordküste)',
      details:
        'Dichter Raketenabwehrgürtel (Sky Bow III + PAC-3 MSE) entlang der Taiwanstraße',
      lat: 25.04,
      lon: 121.56,
      radiusKm: 45,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🛡️ Aegis Ashore / PAC-3 MSE & JFPS-3 Radarstellung Misawa / Kyogamisaki (Japan)',
      kind: 'air_defense',
      theater: 'Japan (Nord-Honshu)',
      details:
        'Japanisch-amerikanischer Raketenabwehrschild gegen nordkoreanische Mittel- und Interkontinentalraketen',
      lat: 40.7,
      lon: 141.37,
      radiusKm: 48,
      minutesAgo: 19,
    }),

    // =========================================================================
    // 🚀 RAKETENABSCHUSS-STANDORTE & ICBM-SILOS WELTWEIT (Missile Launch Sites)
    // =========================================================================
    pointFeature({
      name: '🚀 IRGC Untergrund-Raketenbasis („Missile City“) Kermanschah / Kenesht (West-Iran)',
      kind: 'missile_site',
      theater: 'West-Iran (Zagros-Gebirge)',
      details:
        'Tief verbunkerte Startbasis der IRGC Aerospace Force für Emad, Ghadr-110 & Fattah-1 Hyperschallraketen (Hauptstartort Richtung Israel)',
      lat: 34.43,
      lon: 47.15,
      radiusKm: 60,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🚀 IRGC Untergrund-Raketenbasis Khorramabad / Imam Ali Base (Lorestan, Iran)',
      kind: 'missile_site',
      theater: 'West-Iran',
      details:
        'Unterirdische Silos & TEL-Startrampen für Shahab-3, Kheibar Shekan & Paveh-Marschflugkörper',
      lat: 33.48,
      lon: 48.22,
      radiusKm: 55,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🚀 IRGC Raketenabschuss-Komplex Täbris & Sahand-Silos (Nordwest-Iran)',
      kind: 'missile_site',
      theater: 'Nordwest-Iran',
      details:
        'Strategische Mittelstreckenraketen-Basis mit verbunkerten Startschächten im Nordwesten Irans',
      lat: 38.08,
      lon: 46.2,
      radiusKm: 55,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 IRGC Untergrund-Raketenbasis Haji Abad (Hormozgan, Süd-Iran)',
      kind: 'missile_site',
      theater: 'Süd-Iran / Persischer Golf',
      details:
        'Startkomplex für ballistische Raketen & Khalij-Fars Anti-Schiff-Ballistikraketen',
      lat: 28.31,
      lon: 55.9,
      radiusKm: 55,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Imam Khomeini Weltraum- & Raketentestzentrum Semnan / Schahrud (Iran)',
      kind: 'missile_site',
      theater: 'Nord-Iran (Semnan)',
      details:
        'Startplatz für iranische Feststoff-Trägerraketen (Qaem-100, Zuljanah) und Langstreckenraketen-Erprobung',
      lat: 35.23,
      lon: 53.92,
      radiusKm: 65,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 IRGC Untergrund-Raketenbasis Schiras-Süd / Khojir-Sektor (Fars, Iran)',
      kind: 'missile_site',
      theater: 'Süd-Iran (Provinz Fars)',
      details:
        'Unterirdische Felsen-Tunnelsysteme für ballistische Mittelstreckenraketen (Emad, Rezvan, Kheibar Shekan)',
      lat: 29.54,
      lon: 52.58,
      radiusKm: 50,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 IRGC Raketenbasis Bidganeh / Modarres (Alborz, Iran)',
      kind: 'missile_site',
      theater: 'Iran (Westlich von Teheran)',
      details:
        'Zentrale Feststoffraketen-Basis der IRGC Aerospace Force für Sejjil-2 und Fattah-Hyperschallraketen',
      lat: 35.62,
      lon: 50.87,
      radiusKm: 45,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 IRGC Untergrund-Raketenbasis Dezful / Andimeschk (Chuzestan, Iran)',
      kind: 'missile_site',
      theater: 'Südwest-Iran',
      details:
        'Verbunkerte Startstellungen für ballistische Raketen und Shahed-136/Arash-Langstreckendrohnen',
      lat: 32.43,
      lon: 48.38,
      radiusKm: 45,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🚀 IRGC Raketenbasis Maragheh & Urmia-Sektor (Nordwest-Iran)',
      kind: 'missile_site',
      theater: 'Nordwest-Iran',
      details:
        'Gebirgsgestützte Silos und mobile TEL-Startrampen für Mittelstreckenraketen',
      lat: 37.39,
      lon: 46.24,
      radiusKm: 45,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 IRGC Raketen- & Drohnenbasis Isfahan / Najafabad (Zentral-Iran)',
      kind: 'missile_site',
      theater: 'Zentral-Iran',
      details:
        'Fertigungs- und Startkomplex für ballistische Raketen (Kheibar Shekan) und Shahed-Drohnengeschwader',
      lat: 32.63,
      lon: 51.36,
      radiusKm: 45,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 IRGC Küsten-Raketenbasis Tschabahar & Jask (Golf von Oman, Iran)',
      kind: 'missile_site',
      theater: 'Südost-Iran / Arabisches Meer',
      details:
        'Unterirdische Seeziel- und Marschflugkörperbasis (Abu Mahdi, Noor, Qader) am Ausgang des Golfs von Oman',
      lat: 25.35,
      lon: 60.62,
      radiusKm: 45,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 IRGC Raketenbasis Birjand / Chorasan (Ost-Iran)',
      kind: 'missile_site',
      theater: 'Ost-Iran',
      details:
        'Strategische Rückraum-Raketenbasis für weitreichende ballistische Systeme (Khorramshahr-4 / Sejjil)',
      lat: 32.89,
      lon: 59.22,
      radiusKm: 45,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 Huthi Raketen- & Drohnen-Startkomplex Sanaa / Al-Hafa & Jabal Nuqum (Jemen)',
      kind: 'missile_site',
      theater: 'Jemen (Hochland Sanaa)',
      details:
        'Startstellungen für Toofan/Palestine-2 ballistische Mittelstreckenraketen (Richtung Tel Aviv/Eilat) & Quds-Marschflugkörper',
      lat: 15.32,
      lon: 44.24,
      radiusKm: 45,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🚀 Huthi Untergrund-Raketenbasis Saada / Nordjemen-Gebirge',
      kind: 'missile_site',
      theater: 'Nord-Jemen (Saada)',
      details:
        'Felsenkavernen für Burkan-3 / Zulfiqar ballistische Raketen und Samad-3 Langstreckendrohnen',
      lat: 16.94,
      lon: 43.76,
      radiusKm: 40,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🚀 Huthi Seeziel-Raketenstellung Hodeidah / Al-Salif (Rotes Meer, Jemen)',
      kind: 'missile_site',
      theater: 'Jemen (Westküste / Rotes Meer)',
      details:
        'Mobile Küstenstartrampen für Asef- und Tankil-Seezielballistikraketen sowie Said-Marschflugkörper gegen Schiffe im Roten Meer',
      lat: 14.85,
      lon: 42.95,
      radiusKm: 40,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🚀 Huthi Raketenbrigade Dhamar & Amran (Zentral-Jemen)',
      kind: 'missile_site',
      theater: 'Jemen (Zentrales Hochland)',
      details:
        'Hochland-Abschusssektor für ballistische Langstreckenraketen Richtung Rotes Meer und Israel',
      lat: 14.55,
      lon: 44.4,
      radiusKm: 40,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🚀 Hisbollah Untergrund-Raketenkomplex Bekaa-Ebene / Baalbek („Imad-4“, Libanon)',
      kind: 'missile_site',
      theater: 'Ost-Libanon (Bekaa-Tal)',
      details:
        'Tief verbunkerte Tunnelsysteme für präzisionsgelenkte Fateh-110 / M-600 Raketen, Zelzal-2 & Burkan',
      lat: 34.01,
      lon: 36.21,
      radiusKm: 35,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🚀 Syrische Raketenbasis Masyaf & Al-Safirah (West-Syrien)',
      kind: 'missile_site',
      theater: 'Syrien (Hama / Aleppo)',
      details:
        'Produktions- und Startkomplex für Scud-D, Fateh-110 und Tishreen ballistische Kurzstreckenraketen',
      lat: 35.06,
      lon: 36.34,
      radiusKm: 40,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 Syrische Gebirgs-Raketenbasis Qalamoun / Al-Qutayfah (Damaskus, Syrien)',
      kind: 'missile_site',
      theater: 'Syrien (Damaskus-Nord)',
      details:
        'In den Qalamoun-Bergen verbunkerte Starttunnels der 155. Raketenbrigade (Scud-B/C/D & Fateh-110)',
      lat: 33.74,
      lon: 36.6,
      radiusKm: 38,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Sdot Micha („Zacharia“) Strategische Jericho-II/III Raketenbasis (Israel)',
      kind: 'missile_site',
      theater: 'Israel (Judäisches Hügelland)',
      details:
        'Streng geheime verbunkerte Basis der israelischen Luftwaffe für nuklearfähige Jericho-II (IRBM) & Jericho-III (ICBM) Raketen',
      lat: 31.73,
      lon: 34.93,
      radiusKm: 45,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 Palmachim Airbase & Raketenstartplatz (Israel)',
      kind: 'missile_site',
      theater: 'Israel (Mittelmeerküste)',
      details:
        'Startplatz für Shavit-Weltraumraketen (Ofek-Spionagesatelliten), Jericho-Teststarts & Arrow-3 Abfangraketen',
      lat: 31.89,
      lon: 34.68,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🚀 Royal Saudi Strategic Missile Force — Untergrundbasis Al-Watah (Saudi-Arabien)',
      kind: 'missile_site',
      theater: 'Saudi-Arabien (Südwestlich von Riad)',
      details:
        'Geheime unterirdische Basis der Königlich Saudischen Strategischen Raketenstreitkräfte (DF-3A & DF-21 Mittelstreckenraketen)',
      lat: 24.21,
      lon: 44.69,
      radiusKm: 45,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Royal Saudi Strategic Missile Force — Raketenbasis Al-Sulayyil (Saudi-Arabien)',
      kind: 'missile_site',
      theater: 'Saudi-Arabien (Süd-Zentral)',
      details:
        'Strategische Ballistikraketen-Basis mit verbunkerten Startrampen (DF-3 / DF-21)',
      lat: 20.46,
      lon: 45.57,
      radiusKm: 45,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 Royal Saudi Strategic Missile Force — Raketenbasis Al-Dawadmi / Ranhah (Saudi-Arabien)',
      kind: 'missile_site',
      theater: 'Saudi-Arabien (Zentral)',
      details:
        'Moderne Feststoff-Ballistikraketenbasis & Produktionsanlage im zentralen Hochland',
      lat: 24.5,
      lon: 44.39,
      radiusKm: 45,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 US Minuteman III ICBM-Silofeld — Malmstrom AFB (341st Missile Wing, Montana, USA)',
      kind: 'missile_site',
      theater: 'USA (Montana)',
      details:
        '150 gehärtete unterirdische Nuklear-Raketensilos für LGM-30G Minuteman III Interkontinentalraketen (13.000 km Reichweite)',
      lat: 47.5,
      lon: -111.18,
      radiusKm: 90,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 US Minuteman III ICBM-Silofeld — Minot AFB (91st Missile Wing, North Dakota, USA)',
      kind: 'missile_site',
      theater: 'USA (North Dakota)',
      details:
        '150 gehärtete unterirdische ICBM-Nuklearsilos + B-52H Stratofortress Nuklearbomber-Geschwader',
      lat: 48.41,
      lon: -101.35,
      radiusKm: 90,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 US Minuteman III ICBM-Silofeld — F.E. Warren AFB (90th Missile Wing, Wyoming, USA)',
      kind: 'missile_site',
      theater: 'USA (Wyoming / Colorado / Nebraska)',
      details:
        '150 gehärtete Interkontinentalraketen-Silos (Minuteman III / künftige LGM-35A Sentinel)',
      lat: 41.15,
      lon: -104.86,
      radiusKm: 90,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 Vandenberg Space Force Base & GMD-Abfangraketen-Silos (Kalifornien, USA)',
      kind: 'missile_site',
      theater: 'USA (Kalifornien / Pazifik)',
      details:
        'Startplatz für US Minuteman III ICBM-Testflüge, NRO-Spionagesatelliten & Ground-Based Midcourse Defense (GBI) Abfangraketen-Silos',
      lat: 34.74,
      lon: -120.57,
      radiusKm: 75,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 Fort Greely GMD Interkontinental-Abfangraketen-Silofeld (Alaska, USA)',
      kind: 'missile_site',
      theater: 'USA (Alaska)',
      details:
        'Hauptstellung der US Ground-Based Interceptors (40+ unterirdische Silos) zur Abwehr von Interkontinentalraketen über dem Nordpazifik/Arktis',
      lat: 63.97,
      lon: -145.73,
      radiusKm: 85,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🚀 US Navy Trident II D5 SLBM Atom-U-Boot-Basis Bangor / Kitsap (Washington, USA)',
      kind: 'missile_site',
      theater: 'USA (Pazifikküste / Puget Sound)',
      details:
        'Strategische Pazifik-Basis für 8 Ohio-Klasse Atom-U-Boote (je 20 UGM-133A Trident II D5 Interkontinentalraketen) & Strategic Weapons Facility Pacific',
      lat: 47.73,
      lon: -122.71,
      radiusKm: 60,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 US Navy Trident II D5 SLBM Atom-U-Boot-Basis Kings Bay (Georgia, USA)',
      kind: 'missile_site',
      theater: 'USA (Atlantikküste / Georgia)',
      details:
        'Strategische Atlantik-Basis für 6 Ohio-Klasse SSBNs (Trident II D5 Nuklearraketen) & Strategic Weapons Facility Atlantic',
      lat: 30.8,
      lon: -81.52,
      radiusKm: 60,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 White Sands Missile Range — US Hyperschall- & Raketentestgelände (New Mexico, USA)',
      kind: 'missile_site',
      theater: 'USA (New Mexico)',
      details:
        'Größtes militärisches Raketentestgelände der USA (Dark Eagle LRHW Hyperschallrakete, PrSM, Patriot PAC-3 MSE, Standard Missile)',
      lat: 32.38,
      lon: -106.48,
      radiusKm: 55,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 Cape Canaveral Space Force Station — Hypersonic & Strategic Launch Pads (Florida, USA)',
      kind: 'missile_site',
      theater: 'USA (Florida / Atlantik)',
      details:
        'Teststartkomplex (Launch Complex 46) für US Navy Trident II D5 SLBMs, Conventional Prompt Strike & Dark Eagle Hyperschallraketen',
      lat: 28.49,
      lon: -80.58,
      radiusKm: 55,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Pacific Missile Range Facility Barking Sands (Kauai, Hawaii, USA)',
      kind: 'missile_site',
      theater: 'USA (Hawaii / Zentralpazifik)',
      details:
        'Aegis Ashore Missile Defense Test Complex, THAAD- und SM-3 Block IIA Abfangraketen-Startplatz im Pazifik',
      lat: 22.02,
      lon: -159.78,
      radiusKm: 50,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🚀 Russisches ICBM-Silofeld Dombarowski / Jasny (13. Raketendivision, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Südural / Orenburg)',
      details:
        'Unterirdische Schwerst-Silos für R-36M2 „Satan“, RS-28 „Sarmat“ & „Avangard“ Hyperschall-Gleiter (Mach 27)',
      lat: 51.09,
      lon: 59.84,
      radiusKm: 90,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 Russisches ICBM-Silofeld Koselsk (28. Garde-Raketendivision, Kaluga, Russland)',
      kind: 'missile_site',
      theater: 'Westrussland (Kaluga)',
      details:
        'Gehärtete unterirdische Silos für RS-24 „Jars“ Interkontinentalraketen mit MIRV-Mehrfachsprengköpfen',
      lat: 54.04,
      lon: 35.78,
      radiusKm: 80,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Russisches ICBM-Silofeld Tatischtschewo (60. Raketendivision, Saratow, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Wolgaregion / Saratow)',
      details:
        'Über 100 unterirdische Hochsicherheits-Silos für RT-2PM2 Topol-M und RS-24 Jars Interkontinentalraketen',
      lat: 51.68,
      lon: 45.58,
      radiusKm: 80,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Russisches ICBM-Silofeld Uschur (62. Raketendivision, Krasnojarsk, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Sibirien / Krasnojarsk)',
      details:
        'Strategisches Silofeld für schwere Flüssigtreibstoff-Interkontinentalraketen R-36M2 „Wojewoda“ und RS-28 „Sarmat“',
      lat: 55.3,
      lon: 89.83,
      radiusKm: 85,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Teikowo (54. Garde-Raketendivision, Iwanowo, Russland)',
      kind: 'missile_site',
      theater: 'Zentralrussland (Iwanowo)',
      details:
        'Hauptstützpunkt mobiler 8-achsiger TEL-Startfahrzeuge für RS-24 „Jars“ und Topol-M Interkontinentalraketen',
      lat: 56.86,
      lon: 40.54,
      radiusKm: 70,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Joschkar-Ola (14. Raketendivision, Mari El, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Wolga-Ural)',
      details:
        'Strategische Wald-Garnison für mobile RS-24 „Jars“ Interkontinentalraketen-Startrampen',
      lat: 56.63,
      lon: 47.89,
      radiusKm: 70,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Nischni Tagil (42. Raketendivision, Ural, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Mittlerer Ural)',
      details:
        'Verbunkerte Garnison und Einsatzgebiet für mobile RS-24 „Jars“ Nuklearraketen',
      lat: 58.05,
      lon: 60.05,
      radiusKm: 70,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Nowosibirsk (39. Garde-Raketendivision, Sibirien)',
      kind: 'missile_site',
      theater: 'Russland (Westsibirien)',
      details:
        'Sibirischer Hauptstützpunkt für mobile RS-24 „Jars“ Interkontinentalraketen-Regimenter',
      lat: 55.2,
      lon: 83.1,
      radiusKm: 70,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Barnaul (35. Raketendivision, Altai, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Südsibirien / Altai)',
      details:
        'Strategische Raketendivision mit mobilen RS-24 „Jars“-S Startsystemen',
      lat: 53.35,
      lon: 83.76,
      radiusKm: 70,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Irkutsk (29. Garde-Raketendivision, Ostsibirien)',
      kind: 'missile_site',
      theater: 'Russland (Baikalsee / Ostsibirien)',
      details:
        'Ostsibirische Garnison für mobile Interkontinentalraketen RS-24 „Jars“',
      lat: 52.29,
      lon: 104.3,
      radiusKm: 70,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 Russische Mobile ICBM-Basis Bologoje / Wypolsowo (7. Garde-Raketendivision, Twer)',
      kind: 'missile_site',
      theater: 'Nordwest-Russland (zwischen Moskau & St. Petersburg)',
      details:
        'Westlichste mobile Interkontinentalraketen-Division Russlands (Topol / Jars)',
      lat: 57.87,
      lon: 33.9,
      radiusKm: 65,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Kosmodrom & ICBM-Startplatz Plessezk (Archangelsk, Russland)',
      kind: 'missile_site',
      theater: 'Nordrussland',
      details:
        'Hauptstart- und Testplatz der russischen Strategischen Raketentruppen (Topol-M, Jars, Sarmat & Anti-Satelliten-Raketen)',
      lat: 62.92,
      lon: 40.57,
      radiusKm: 85,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 Raketentestgelände Kapustin Jar (Astrachan, Russland)',
      kind: 'missile_site',
      theater: 'Südrussland (Wolgaregion)',
      details:
        'Startplatz für „Oreschnik“ Mittelstrecken-Hyperschallraketen, Iskander-M & 9M729 Marschflugkörper',
      lat: 48.58,
      lon: 45.75,
      radiusKm: 75,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 Iskander-M Raketenstellung Tschernjachowsk (Kaliningrad, Russland)',
      kind: 'missile_site',
      theater: 'Kaliningrad / Ostsee',
      details:
        '152. Garde-Raketenbrigade mit nuklearfähigen 9K720 Iskander-M Kurzstreckenraketen & Kinzhal-Vorwärtsstationierung',
      lat: 54.63,
      lon: 21.81,
      radiusKm: 65,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🚀 Iskander-M Raketenbasis Luga (26. Raketenbrigade, Region St. Petersburg, Russland)',
      kind: 'missile_site',
      theater: 'Nordwest-Russland (Ostsee / Baltikum-Sektor)',
      details:
        'Iskander-M Ballistik- & Marschflugkörperbrigade nahe der estnisch-finnischen Grenze',
      lat: 58.73,
      lon: 29.85,
      radiusKm: 55,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Iskander-M & Taktische Nuklearraketen-Basis Ossipowitschi (Belarus)',
      kind: 'missile_site',
      theater: 'Belarus (Minsk-Südost)',
      details:
        '465. Raketenbrigade mit vorgeschobenen 9K720 Iskander-M Systemen und modernisiertem Sonderwaffenlager',
      lat: 53.3,
      lon: 28.64,
      radiusKm: 55,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🚀 Iskander-M & KN-23 Ballistik-Startsektor Kursk / Chalino (Russland)',
      kind: 'missile_site',
      theater: 'Westrussland (Ukraine-Nordostfront)',
      details:
        '448. Raketenbrigade — aktiver Startraum für ballistische Raketen und Shahed-Drohnenwellen',
      lat: 51.75,
      lon: 36.29,
      radiusKm: 50,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🚀 Iskander-M & Kinzhal Startsektor Millerowo / Rostow (Südrussland)',
      kind: 'missile_site',
      theater: 'Südrussland (Donbass-Sektor)',
      details:
        'Vorgeschobener Startraum für ballistische Kurzstreckenraketen Richtung Ost- und Zentralukraine',
      lat: 48.95,
      lon: 40.3,
      radiusKm: 50,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🚀 Iskander-M & Bastion-P (Oniks) Raketenstellung Dschankoj / Kap Tarkhankut (Krim)',
      kind: 'missile_site',
      theater: 'Krim / Schwarzes Meer',
      details:
        'Startstellungen für P-800 Oniks Überschall-Raketen, Iskander-M und Zirkon-Hyperschallraketen auf der Krim',
      lat: 45.7,
      lon: 34.39,
      radiusKm: 50,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🚀 Iskander-M Raketenbasis Molkino / Krasnodar (1. Garde-Raketenbrigade, Russland)',
      kind: 'missile_site',
      theater: 'Südrussland / Kaukasus-Schwarzes Meer',
      details:
        'Südlicher Hauptstützpunkt für ballistische Iskander-M Raketen und 9M728/9M729 Marschflugkörper',
      lat: 44.8,
      lon: 39.22,
      radiusKm: 50,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 Russische Borei-Klasse SLBM Atom-U-Boot-Basis Gadschijewo (Nordflotte, Kola)',
      kind: 'missile_site',
      theater: 'Russland (Kola-Halbinsel / Barentssee)',
      details:
        'Hauptbasis der strategischen Raketen-U-Boote der Nordflotte (Borei-A & Delta-IV Klasse mit RSM-56 Bulawa & Sinewa Interkontinentalraketen)',
      lat: 69.25,
      lon: 33.32,
      radiusKm: 60,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 Russische Borei-Klasse SLBM Atom-U-Boot-Basis Wiljutschinsk (Kamtschatka, Pazifikflotte)',
      kind: 'missile_site',
      theater: 'Russland (Kamtschatka / Nordpazifik)',
      details:
        'Pazifische Hauptbasis für Borei-A Atom-U-Boote mit je 16 RSM-56 „Bulawa“ Interkontinentalraketen',
      lat: 52.93,
      lon: 158.4,
      radiusKm: 60,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🚀 Britische Trident II D5 SLBM Atom-U-Boot-Basis HMNB Clyde / Faslane & Coulport (Schottland, UK)',
      kind: 'missile_site',
      theater: 'Großbritannien (Schottland / Nordatlantik)',
      details:
        'Heimatbasis der 4 britischen Vanguard-Klasse Atom-U-Boote (Continuous At-Sea Deterrent mit Trident II D5 Nuklearraketen)',
      lat: 56.06,
      lon: -4.82,
      radiusKm: 55,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Île Longue Strategische Atom-U-Boot- & M51-Nuklearraketen-Basis (Frankreich)',
      kind: 'missile_site',
      theater: 'Frankreich (Bretagne / Atlantik)',
      details:
        'Verbunkerte Basis der französischen Force Océanique Stratégique (4× Triomphant-Klasse SSBNs mit M51 Interkontinentalraketen)',
      lat: 48.3,
      lon: -4.5,
      radiusKm: 60,
      minutesAgo: 28,
    }),
    pointFeature({
      name: '🚀 US Multi-Domain Task Force (MDTF) — Langstrecken-Raketenkommando Wiesbaden / Grafenwöhr (Deutschland)',
      kind: 'missile_site',
      theater: 'Deutschland (NATO Europa)',
      details:
        '56th Artillery Command & 2nd Multi-Domain Task Force (Typhon Mid-Range Capability, SM-6, Tomahawk & Dark Eagle Hyperschall-Standort)',
      lat: 50.05,
      lon: 8.33,
      radiusKm: 50,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Ukrainische Neptun- & Hrim-2 (Sapsan) Raketenanlage Dnipro / Juschnoje (Ukraine)',
      kind: 'missile_site',
      theater: 'Zentralukraine (Dnipro)',
      details:
        'Entwicklungs- und Einsatzbasis für R-360 Neptun Marschflugkörper, Palianytsia Raketendrohnen & ballistische Hrim-2 Systeme',
      lat: 48.43,
      lon: 34.98,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🚀 Chinesisches DF-41 ICBM-Silofeld Yumen (Gansu, China)',
      kind: 'missile_site',
      theater: 'China (Provinz Gansu)',
      details:
        'Rund 120 neu errichtete unterirdische Interkontinentalraketen-Silos der PLA Rocket Force (DF-41 / DF-31AG)',
      lat: 40.22,
      lon: 96.85,
      radiusKm: 95,
      minutesAgo: 25,
    }),
    pointFeature({
      name: '🚀 Chinesisches DF-41 ICBM-Silofeld Hami (Xinjiang, China)',
      kind: 'missile_site',
      theater: 'China (Ost-Xinjiang)',
      details:
        'Rund 110 strategische Interkontinentalraketen-Silos der PLA Rocket Force in der Wüste Gobi',
      lat: 42.35,
      lon: 92.95,
      radiusKm: 95,
      minutesAgo: 26,
    }),
    pointFeature({
      name: '🚀 Chinesisches DF-41 ICBM-Silofeld Ordos / Hanggin Banner (Innere Mongolei, China)',
      kind: 'missile_site',
      theater: 'China (Innere Mongolei)',
      details:
        'Drittes großes Silofeld der PLA Rocket Force mit rund 90 unterirdischen Interkontinentalraketen-Silos (DF-41)',
      lat: 40.15,
      lon: 108.35,
      radiusKm: 90,
      minutesAgo: 25,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force Silo- & ICBM-Testzentrum Jilantai (Innere Mongolei, China)',
      kind: 'missile_site',
      theater: 'China (Alxa / Innere Mongolei)',
      details:
        'Trainings- und Einsatz-Silokomplex der chinesischen Strategischen Raketenstreitkräfte (DF-41, DF-31AG, DF-5B)',
      lat: 39.75,
      lon: 105.75,
      radiusKm: 75,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force DF-5B/C Schwer-ICBM-Silofeld Luoyang / Sundian (Henan, China)',
      kind: 'missile_site',
      theater: 'Zentral-China (Provinz Henan)',
      details:
        'Verbunkerte Gebirgs-Silos der Basis 66 für flüssiggetriebene DF-5B und DF-5C Interkontinentalraketen mit Mehrfach-Nuklearsprengköpfen',
      lat: 34.55,
      lon: 112.15,
      radiusKm: 70,
      minutesAgo: 26,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force DF-26 („Guam Killer“) & DF-31AG Raketenbasis Delingha / Xining (Qinghai, China)',
      kind: 'missile_site',
      theater: 'West-China (Qinghai-Tibet-Plateau)',
      details:
        'Hochgebirgs-Raketenbrigaden mit nuklear- und konventionell bestückbaren DF-26 Mittelstreckenraketen & DF-31AG ICBMs',
      lat: 37.37,
      lon: 97.37,
      radiusKm: 65,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force DF-17 Hyperschall- & DF-21D Anti-Schiff-Raketenbasis Qimen / Huangshan (Anhui, China)',
      kind: 'missile_site',
      theater: 'Ost-China (Basis 61 — Taiwan-Sektor)',
      details:
        'Hauptkommando der PLARF-Basis 61 mit DF-17 Hyperschall-Gleitflugkörpern und DF-21D „Carrier Killer“ Seeziel-Ballistikraketen',
      lat: 29.85,
      lon: 117.71,
      radiusKm: 60,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force DF-16 & DF-17 Küsten-Raketenbasis Meizhou /興寧 (Guangdong, China)',
      kind: 'missile_site',
      theater: 'Südost-China (Taiwanstraße / Südchinesisches Meer)',
      details:
        'Vorgeschobene Hyperschall- und Kurzstreckenraketen-Brigade gegenüber der südlichen Taiwanstraße',
      lat: 24.15,
      lon: 115.73,
      radiusKm: 55,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 PLA Navy JL-3 SLBM Atom-U-Boot-Kavernenbasis Yulin (Sanya / Hainan, China)',
      kind: 'missile_site',
      theater: 'Südchinesisches Meer (Insel Hainan)',
      details:
        'Unterirdische Felsen-U-Boot-Bunker für 6+ Typ-094 (Jin-Klasse) Atom-U-Boote mit JL-2 / JL-3 Interkontinentalraketen',
      lat: 18.21,
      lon: 109.68,
      radiusKm: 65,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🚀 Kosmodrom & Hyperschall-Testzentrum Taiyuan (Shanxi, China)',
      kind: 'missile_site',
      theater: 'Nord-China (Provinz Shanxi)',
      details:
        'Startzentrum für chinesische Fractional Orbital Bombardment System (FOBS) Hyperschalltests und DF-31/DF-41 Erprobungen',
      lat: 38.85,
      lon: 111.61,
      radiusKm: 65,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 Nordkoreanisches ICBM-Startzentrum Sohae / Tongchang-ri (Nordkorea)',
      kind: 'missile_site',
      theater: 'Nordkorea (Westküste)',
      details:
        'Hauptstartrampe und Triebwerksteststand für Hwasong-15, Hwasong-17 & Hwasong-18 Interkontinentalraketen',
      lat: 39.66,
      lon: 124.7,
      radiusKm: 70,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🚀 Nordkoreanische Untergrund-ICBM-Basis Sinpung-dong & Hoejung-ni (Chagang, Nordkorea)',
      kind: 'missile_site',
      theater: 'Nordkorea (Nördliches Gebirge / Chinesische Grenze)',
      details:
        'Tief im Gebirge verbunkerte Einsatzbasis für Hwasong-17 und Hwasong-18 Feststoff-Interkontinentalraketen',
      lat: 40.92,
      lon: 126.58,
      radiusKm: 55,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Nordkoreanische Raketenbasis Sino-ri & Sunan-Startplatz (Pjöngjang-Nord, Nordkorea)',
      kind: 'missile_site',
      theater: 'Nordkorea (Zentral)',
      details:
        'Operative Hauptbasis der Strategischen Raketentruppen (Pukguksong-2, Hwasong-12 IRBM & Hwasong-16B Hyperschallrakete)',
      lat: 39.61,
      lon: 125.43,
      radiusKm: 50,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🚀 Nordkoreanische Raketen- & SLBM-Testbasis Wonsan / Kalma & Sinpo (Ostküste, Nordkorea)',
      kind: 'missile_site',
      theater: 'Nordkorea (Japanisches Meer)',
      details:
        'Ostküsten-Startplatz für ballistische Raketentests sowie Werft für Raketen-U-Boote (Pukguksong SLBM)',
      lat: 39.17,
      lon: 127.48,
      radiusKm: 50,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🚀 Indisches Agni-V ICBM-Test- & Startzentrum Abdul Kalam Island (Odisha, Indien)',
      kind: 'missile_site',
      theater: 'Indien (Golf von Bengalen)',
      details:
        'Integrated Test Range für Indiens nuklearfähige Agni-V Interkontinentalraketen (MIRV), K-4 SLBM und Prithvi/Pralay',
      lat: 20.76,
      lon: 87.09,
      radiusKm: 60,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🚀 Indische Atom-U-Boot- & SLBM-Kavernenbasis INS Varsha / Rambilli (Visakhapatnam, Indien)',
      kind: 'missile_site',
      theater: 'Indien (Ostküste)',
      details:
        'Unterirdische Marinebasis für Indiens Arihant-Klasse Atom-U-Boote (K-15 Sagarika & K-4 nukleare Ballistikraketen)',
      lat: 17.45,
      lon: 83.12,
      radiusKm: 55,
      minutesAgo: 25,
    }),
    pointFeature({
      name: '🚀 Pakistanische Nuklearraketen-Basis Sargodha / Kirana Hills (Punjab, Pakistan)',
      kind: 'missile_site',
      theater: 'Pakistan (Punjab)',
      details:
        'Unterirdische Felsenstollen und TEL-Garagen für Shaheen-II, Shaheen-III (2.750 km), Ababeel (MIRV) und Ghauri Mittelstreckenraketen',
      lat: 31.96,
      lon: 72.69,
      radiusKm: 55,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🚀 Pakistanische Strategische Raketenbasis Khuzdar (Belutschistan, Pakistan)',
      kind: 'missile_site',
      theater: 'Pakistan (Belutschistan)',
      details:
        'Unterirdisches Silo- und Depot-Netzwerk für strategische Shaheen-II/III Feststoff-Ballistikraketen',
      lat: 27.74,
      lon: 66.62,
      radiusKm: 50,
      minutesAgo: 23,
    }),
    pointFeature({
      name: '🚀 Pakistanische Raketen-Garnison Pano Aqil / Akro (Sindh, Pakistan)',
      kind: 'missile_site',
      theater: 'Pakistan (Provinz Sindh)',
      details:
        'Basis für Babur-Marschflugkörper und Shaheen-1A / Ghaznavi ballistische Kurzstreckenraketen',
      lat: 27.85,
      lon: 69.11,
      radiusKm: 50,
      minutesAgo: 24,
    }),

    // =========================================================================
    // 🏰 BUNKER & UNTERIRDISCHE KOMMANDOZENTRALEN WELTWEIT (Underground Bunkers)
    // =========================================================================
    pointFeature({
      name: '🏰 Cheyenne Mountain Complex — NORAD / USNORTHCOM Atombunker (Colorado, USA)',
      kind: 'bunker',
      theater: 'USA (Colorado Springs)',
      details:
        'Unter 610 m massivem Granitfels gebauter, EMP- und atombombensicherer Führungsbunker für Raketenfrühwarnung & Luftverteidigung',
      lat: 38.74,
      lon: -104.84,
      radiusKm: 45,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🏰 Raven Rock Mountain Complex — „Site R“ / Underground Pentagon (Pennsylvania, USA)',
      kind: 'bunker',
      theater: 'USA (Pennsylvania / Maryland)',
      details:
        'Streng geheime unterirdische Ausweich-Kommandozentrale des US-Verteidigungsministeriums (Continuity of Government)',
      lat: 39.73,
      lon: -77.42,
      radiusKm: 40,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🏰 Mount Weather Emergency Operations Center — US-Regierungsbunker (Virginia, USA)',
      kind: 'bunker',
      theater: 'USA (Virginia / Blue Ridge Mountains)',
      details:
        'Unterirdischer Hochsicherheits-Führungsbunker für US-Präsident, Kabinett und FEMA im Nuklear- oder Krisenfall',
      lat: 39.06,
      lon: -77.89,
      radiusKm: 40,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🏰 USSTRATCOM Underground Command Complex — Offutt AFB (Nebraska, USA)',
      kind: 'bunker',
      theater: 'USA (Nebraska)',
      details:
        'Tiefbunker des US Strategic Command zur Führung der gesamten US-Nuklearstreitkräfte (ICBM, SSBN, Bomber)',
      lat: 41.12,
      lon: -95.91,
      radiusKm: 45,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🏰 Mount Yamantau / Mezhgorye Strategischer Tiefbunker (Ural, Russland)',
      kind: 'bunker',
      theater: 'Russland (Südural / Baschkortostan)',
      details:
        'Gigantische, unter 1.000 m Quarzitfels gelegene geheime russische Führungs- und Nuklearanlage in der geschlossenen Stadt Meschgorje',
      lat: 54.25,
      lon: 58.1,
      radiusKm: 55,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🏰 Koswinski Kamen Untergrund-Kommandozentrale „Perimeter / Tote Hand“ (Russland)',
      kind: 'bunker',
      theater: 'Russland (Nordural)',
      details:
        'Unter 300 m Granit verbunkerter Kommandoknoten des russischen Generalstabs und des automatischen nuklearen Zweitschlagsystems „Perimeter“',
      lat: 59.52,
      lon: 59.06,
      radiusKm: 55,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🏰 Ramenki-43 & Metro-2 Staatsführungsbunker (Moskau, Russland)',
      kind: 'bunker',
      theater: 'Russland (Moskau)',
      details:
        'In 180–200 m Tiefe gelegene unterirdische Bunkerstadt im Südwesten Moskaus, über Geheim-U-Bahn („Metro-2“) mit dem Kreml verbunden',
      lat: 55.69,
      lon: 37.5,
      radiusKm: 35,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🏰 „Site 81“ / „The Pit“ (HaKirya Untergrund-Kommandozentrale, Tel Aviv, Israel)',
      kind: 'bunker',
      theater: 'Israel (Tel Aviv)',
      details:
        'Tief verbunkerte Operationszentrale des israelischen Generalstabs (IDF), der Luftwaffenführung und des Sicherheitskabinetts',
      lat: 32.075,
      lon: 34.788,
      radiusKm: 30,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏰 National Management Center — Regierungsbunker Jerusalem (Judäische Berge, Israel)',
      kind: 'bunker',
      theater: 'Israel (Jerusalem)',
      details:
        'Tief in die Judäischen Berge westlich von Jerusalem getriebener, ABC- und atombombensicherer Führungsbunker der israelischen Staatsführung',
      lat: 31.78,
      lon: 35.15,
      radiusKm: 30,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏰 Fordow Unterirdischer Urananreicherungs-Bunker (Qom, Iran)',
      kind: 'bunker',
      theater: 'Iran (Provinz Qom)',
      details:
        '80–90 Meter tief unter einem massiven Gebirgsmassiv verbunkerte iranische Hochleistungs-Zentrifugenanlage (geschützt gegen konventionelle Bunkerbrecher)',
      lat: 34.88,
      lon: 50.99,
      radiusKm: 40,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏰 Natanz Tiefbunker & Kuh-e Kolang Gaz La Untergrundkomplex (Iran)',
      kind: 'bunker',
      theater: 'Zentral-Iran (Isfahan)',
      details:
        'Unterirdische Urananreicherungshallen sowie der neue, über 100 m tief im Berg Zagros gegrabene Nuklear-Bunkerkomplex südlich von Natanz',
      lat: 33.72,
      lon: 51.72,
      radiusKm: 40,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Western Hills (Xishan) Underground Joint Battle Command Center (Peking, China)',
      kind: 'bunker',
      theater: 'China (Peking Westberge)',
      details:
        'Über 2.000 m unter Karstgestein liegender, härtester unterirdischer Gefechtsstand der Zentralen Militärkommission Chinas (CMC)',
      lat: 40.01,
      lon: 116.18,
      radiusKm: 45,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🏰 Yulin Unterirdischer Atom-U-Boot-Felsbunker (Hainan / Sanya, China)',
      kind: 'bunker',
      theater: 'Südchinesisches Meer (Insel Hainan)',
      details:
        'Direkt vom Meer aus befahrbare, in den Küstenfels gesprengte U-Boot-Bunkerkavernen für Chinas strategische Jin-Klasse (Typ 094) Atom-U-Boote',
      lat: 18.21,
      lon: 109.68,
      radiusKm: 45,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🏰 Führungsanlage K20 (Kandersteg) & Gotthard-Reduit-Bunker (Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Berner Oberland / Alpen-Reduit)',
      details:
        'Atombombensicherer Tiefbunker des Schweizer Bundesrats („Bundesratsbunker K20“) und militärische Führungsanlagen im Alpenmassiv',
      lat: 46.49,
      lon: 7.67,
      radiusKm: 35,
      minutesAgo: 25,
    }),
    pointFeature({
      name: '🏰 Northwood Headquarters & Pindar Underground Command Bunker (UK)',
      kind: 'bunker',
      theater: 'Großbritannien (London / Whitehall / Northwood)',
      details:
        'Unterirdische Kommandozentrale der britischen Streitkräfte, der Royal Navy Atom-U-Boot-Flotte und des NATO MARCOM',
      lat: 51.62,
      lon: -0.41,
      radiusKm: 35,
      minutesAgo: 26,
    }),

    // =========================================================================
    // 🏛️ STRATEGISCHE MILITÄRBASEN WELTWEIT (Global Military Bases)
    // =========================================================================
    pointFeature({
      name: '🏛️ Ramstein Air Base & NATO AIRCOM (Rheinland-Pfalz, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland / Europa',
      details:
        'Hauptquartier der US Air Forces in Europe (USAFE), NATO Allied Air Command & globales Drohnen-/Satelliten-Relais',
      lat: 49.44,
      lon: 7.6,
      radiusKm: 50,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🏛️ Naval Support Facility Diego Garcia (Chagos-Archipel, Indischer Ozean)',
      kind: 'military_base',
      theater: 'Indischer Ozean',
      details:
        'Strategischer US/UK-Inselstützpunkt für B-2 Spirit Tarnkappenbomber, B-52H, Atom-U-Boote & Weltraumüberwachung (GEODSS)',
      lat: -7.31,
      lon: 72.41,
      radiusKm: 65,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🏛️ Al Udeid Air Base (Katar — US CENTCOM Forward HQ)',
      kind: 'military_base',
      theater: 'Persischer Golf / Katar',
      details:
        'Größter US-Luftwaffenstützpunkt im Nahen Osten (Combined Air Operations Center für den gesamten CENTCOM-Raum)',
      lat: 25.12,
      lon: 51.31,
      radiusKm: 50,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏛️ Naval Support Activity Bahrain — US Navy 5th Fleet HQ (Manama, Bahrain)',
      kind: 'military_base',
      theater: 'Persischer Golf / Bahrain',
      details:
        'Hauptquartier der 5. US-Flotte & Combined Maritime Forces zur Überwachung des Persischen Golfs und des Roten Meeres',
      lat: 26.21,
      lon: 50.61,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏛️ Incirlik Air Base (Adana, Türkei — NATO Südostflanke)',
      kind: 'military_base',
      theater: 'Türkei / Levante',
      details:
        'Strategischer US/NATO-Luftwaffenstützpunkt (inkl. Sondermunitionslager für taktische B61-Nuklearwaffen)',
      lat: 37.0,
      lon: 35.43,
      radiusKm: 50,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🏛️ RAF Akrotiri (Zypern — UK Sovereign Base Area)',
      kind: 'military_base',
      theater: 'Östliches Mittelmeer / Zypern',
      details:
        'Wichtigster britischer Luftwaffenstützpunkt für Eurofighter Typhoon, SIGINT-Aufklärungsflüge & Einsätze im Nahen Osten',
      lat: 34.59,
      lon: 32.99,
      radiusKm: 45,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏛️ Camp Lemonnier (USA) & PLA-Marinebasis Dschibuti (Bab al-Mandab)',
      kind: 'military_base',
      theater: 'Horn von Afrika / Bab al-Mandab',
      details:
        'Strategischer Knotenpunkt am Eingang zum Roten Meer: US-Basis, chinesische Auslands-Marinebasis, französische & japanische Stützpunkte in unmittelbarer Nachbarschaft',
      lat: 11.55,
      lon: 43.15,
      radiusKm: 50,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🏛️ Nevatim Airbase (Negev, Israel — F-35I „Adir“ Hauptbasis)',
      kind: 'military_base',
      theater: 'Israel (Negev)',
      details:
        'Strategischer Hauptstützpunkt der israelischen F-35I „Adir“ Tarnkappen-Kampfjets, Tankflugzeuge & Nahshon-Aufklärer',
      lat: 31.21,
      lon: 35.01,
      radiusKm: 40,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Ramon Airbase & Tel Nof Airbase (Israel)',
      kind: 'military_base',
      theater: 'Israel (Negev / Zentrum)',
      details:
        'Einsatzbasen der israelischen F-15I „Ra\'am“ und F-16I „Sufa“ Langstrecken-Jagdbomber sowie AH-64 Apache Kampfhubschrauber',
      lat: 30.78,
      lon: 34.67,
      radiusKm: 40,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Engels-2 Strategische Bomberbasis (Saratow, Russland)',
      kind: 'military_base',
      theater: 'Russland (Saratow)',
      details:
        'Heimatbasis der russischen strategischen Fernfliegerkräfte (Tu-160M „Blackjack“ & Tu-95MS „Bear“ Langstreckenbomber mit Kh-101 Marschflugkörpern)',
      lat: 51.48,
      lon: 46.2,
      radiusKm: 55,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🏛️ Seweromorsk & Gadschijewo Atom-U-Boot-Basis (Murmansk / Kola-Halbinsel, Russland)',
      kind: 'military_base',
      theater: 'Arktis / Barentssee (Russland)',
      details:
        'Hauptquartier der russischen Nordflotte und wichtigster Stützpunkt für Borei-A (Bulawa-SLBM) & Yasen-M Atom-U-Boote',
      lat: 69.07,
      lon: 33.42,
      radiusKm: 60,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🏛️ Naval Station Norfolk (Virginia, USA — Größte Marinebasis der Welt)',
      kind: 'military_base',
      theater: 'USA (Atlantikküste)',
      details:
        'Heimathafen der US Fleet Forces Command (Flugzeugträger der Ford- & Nimitz-Klasse, Atom-U-Boote & Zerstörer)',
      lat: 36.95,
      lon: -76.33,
      radiusKm: 55,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🏛️ Joint Base Pearl Harbor-Hickam (Hawaii, USA — US INDOPACOM HQ)',
      kind: 'military_base',
      theater: 'Zentralpazifik / Hawaii',
      details:
        'Hauptquartier der US-Pazifikflotte, Virginia-Klasse Jagd-U-Boote & F-22 Raptor Luftüberlegenheitsgeschwader',
      lat: 21.35,
      lon: -157.95,
      radiusKm: 55,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🏛️ Kadena Air Base (Okinawa) & Yokosuka Naval Base (Japan)',
      kind: 'military_base',
      theater: 'Japan / Ostchinesisches Meer',
      details:
        'Größter US-Luftwaffenstützpunkt in Ostasien („Keystone of the Pacific“) zur Überwachung der Taiwanstraße und des Ostchinesischen Meeres',
      lat: 26.35,
      lon: 127.77,
      radiusKm: 55,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🏛️ Camp Humphreys & Osan Air Base (Südkorea)',
      kind: 'military_base',
      theater: 'Südkorea',
      details:
        'Größter US-Auslandsstützpunkt weltweit (Hauptquartier der 8th US Army & United States Forces Korea)',
      lat: 36.96,
      lon: 127.03,
      radiusKm: 50,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🏛️ Pine Gap Joint Defence Facility (Alice Springs, Australien)',
      kind: 'military_base',
      theater: 'Zentralaustralien',
      details:
        'Streng geheime US/Australische Satelliten-Bodenstation (CIA / NSA / NRO) für globale SIGINT-Überwachung und Raketenfrühwarnung (SBIRS)',
      lat: -23.8,
      lon: 133.74,
      radiusKm: 50,
      minutesAgo: 24,
    }),
    pointFeature({
      name: '🏛️ Pituffik Space Base (ehem. Thule Air Base, Grönland)',
      kind: 'military_base',
      theater: 'Arktis / Grönland',
      details:
        'Nördlichster Stützpunkt der US Space Force mit AN/FPS-132 Upgraded Early Warning Radar zur Überwachung polarer ICBM-Flugbahnen',
      lat: 76.53,
      lon: -68.7,
      radiusKm: 60,
      minutesAgo: 25,
    }),

    // =========================================================================
    // 🧬 MILITÄRISCHE FORSCHUNGSANLAGEN, RÜSTUNG (LOCKHEED MARTIN) & BIOWAFFEN-/NUKLEARLABORE
    // =========================================================================
    pointFeature({
      name: '🧬 Lockheed Martin „Skunk Works“ & Northrop Grumman — AF Plant 42 (Palmdale, Kalifornien)',
      kind: 'research',
      theater: 'USA (Kalifornien / Mojave-Wüste)',
      details:
        'Legendäres Geheimforschungs- & Produktionszentrum für Stealth-Flugzeuge (U-2, SR-71, F-117, F-22, F-35, RQ-180, B-21 Raider & SR-72 Darkstar Hyperschall-Projekt)',
      lat: 34.63,
      lon: -118.08,
      radiusKm: 45,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 Lockheed Martin Global Headquarters (Bethesda, Maryland, USA)',
      kind: 'research',
      theater: 'USA (Maryland / Washington D.C.)',
      details:
        'Konzernzentrale des weltgrößten Rüstungsunternehmens (Stealth-Kampfjets, Hyperschallwaffen LRHW/ARRW, THAAD, Aegis, Weltraum- & Raketensysteme)',
      lat: 39.03,
      lon: -77.14,
      radiusKm: 35,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Lockheed Martin Space & Trident-II Nuklearraketen-Entwicklung (Sunnyvale, Kalifornien)',
      kind: 'research',
      theater: 'USA (Silicon Valley / Kalifornien)',
      details:
        'Entwicklungszentrum für UGM-133 Trident II D5 U-Boot-Interkontinentalraketen, SBIRS-Frühwarnsatelliten & militärische Raumfahrt',
      lat: 37.41,
      lon: -122.02,
      radiusKm: 35,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🧬 Area 51 / Groom Lake (Homey Airport, Nevada Test and Training Range, USA)',
      kind: 'research',
      theater: 'USA (Nevada)',
      details:
        'Streng geheime US Air Force / CIA Erprobungsbasis für unbemannte Stealth-Flugzeuge, Black-Project-Prototypen, Radar-Signatur-Tests & Fremdtechnologie-Auswertung',
      lat: 37.24,
      lon: -115.81,
      radiusKm: 50,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🧬 Fort Detrick — USAMRIID (BSL-4 Biodefense & Historische Biowaffenforschung, Maryland, USA)',
      kind: 'research',
      theater: 'USA (Frederick, Maryland)',
      details:
        'US Army Medical Research Institute of Infectious Diseases: Militärisches BSL-4 Hochsicherheitslabor für tödliche Krankheitserreger (Ebola, Anthrax, Pocken, Marburg; 1943–1969 Zentrum des offensiven US-Biowaffenprogramms)',
      lat: 39.44,
      lon: -77.44,
      radiusKm: 40,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🧬 Dugway Proving Ground — Biologische & Chemische Kampfstoff-Erprobung (Utah, USA)',
      kind: 'research',
      theater: 'USA (Great Salt Lake Desert, Utah)',
      details:
        'Über 3.200 km² großes militärisches Sperrgebiet der US Army zur Erprobung von biologischen (Anthrax/Botulinum-Simulanzien), chemischen (Nervenkampfstoffe) und radiologischen Abwehrsystemen',
      lat: 40.18,
      lon: -113.14,
      radiusKm: 50,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🧬 Porton Down — Dstl (Britische Geheimforschung für Biowaffen- & Chemiewaffenabwehr, UK)',
      kind: 'research',
      theater: 'Großbritannien (Wiltshire)',
      details:
        'Defence Science and Technology Laboratory: Streng geheimes britisches Militärforschungszentrum (seit 1916) für Nervenkampfstoffe (VX, Nowitschok), Anthrax & BSL-4 Pathogene',
      lat: 51.13,
      lon: -1.7,
      radiusKm: 40,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🧬 Staatliches Virologie-Zentrum „Vektor“ (Koltsovo / Nowosibirsk, Russland)',
      kind: 'research',
      theater: 'Russland (Sibirien / Nowosibirsk)',
      details:
        'Hochsicherheits-BSL-4-Forschungskomplex (ehem. Sowjetisches „Biopreparat“-Biowaffenprogramm; weltweites Referenzdepot für Variola/Pockenviren, Ebola & Marburg-Viren)',
      lat: 54.94,
      lon: 83.18,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 48. Zentrales Forschungsinstitut des Russischen Verteidigungsministeriums (Sergijew Possad-6)',
      kind: 'research',
      theater: 'Russland (Region Moskau)',
      details:
        'Militärisches Hochsicherheits-Sperrgebiet des russischen Verteidigungsministeriums für militärische Mikrobiologie, virale Hämorrhagische Fieber & spekulative Biowaffenforschung (jüngst massiv ausgebaut)',
      lat: 56.33,
      lon: 38.15,
      radiusKm: 40,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🧬 Wuhan Institute of Virology (WIV — BSL-4 Hochsicherheitslabor, Wuhan, China)',
      kind: 'research',
      theater: 'China (Hubei / Wuhan)',
      details:
        'Chinas erstes BSL-4 Hochsicherheits-Virologielabor (Forschung an Fledermaus-Coronaviren, chimären Viren, synthetischer Biologie & hochpathogenen Erregern)',
      lat: 30.38,
      lon: 114.26,
      radiusKm: 45,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 Academy of Military Medical Sciences (AMMS — PLA Militärbiologie, Peking, China)',
      kind: 'research',
      theater: 'China (Peking)',
      details:
        'Militärbiologisches und biotechnologisches Spitzenforschungsinstitut der Chinesischen Volksbefreiungsarmee (Biodefense, Gentechnik & Toxikologie)',
      lat: 39.9,
      lon: 116.27,
      radiusKm: 40,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🧬 Israel Institute for Biological Research (IIBR — Ness Ziona, Israel)',
      kind: 'research',
      theater: 'Israel (Ness Ziona / südlich von Tel Aviv)',
      details:
        'Direkt dem Büro des israelischen Premierministers unterstelltes, streng geheimes staatliches Forschungsinstitut für biologische, chemische und toxikologische Verteidigung',
      lat: 31.92,
      lon: 34.79,
      radiusKm: 35,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🧬 Rafael Advanced Defense Systems & Elbit R&D (Haifa / Kiryat Yam, Israel)',
      kind: 'research',
      theater: 'Israel (Haifa)',
      details:
        'Israelisches Rüstungs-Forschungszentrum für Iron Dome, David\'s Sling, Trophy APS, Iron Beam Hochenergie-Laserwaffen & autonome KI-Drohnenschwärme',
      lat: 32.86,
      lon: 35.09,
      radiusKm: 35,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🧬 Raytheon (RTX) Missiles & Defense Forschungszentrum (Tucson, Arizona, USA)',
      kind: 'research',
      theater: 'USA (Arizona)',
      details:
        'Forschungs- und Produktionskomplex für Tomahawk-Marschflugkörper, Patriot, SM-3/SM-6 Abfangraketen, AMRAAM & Hyperschall-Abwehrsysteme',
      lat: 32.11,
      lon: -110.94,
      radiusKm: 40,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🧬 DARPA Headquarters (Defense Advanced Research Projects Agency, Arlington, USA)',
      kind: 'research',
      theater: 'USA (Virginia / Pentagon-Sektor)',
      details:
        'Zentrale Forschungsbehörde des Pentagon für strategische Zukunftstechnologien, autonome KI-Kampfsysteme, Hyperschall, Quantenradar & synthetische Biologie',
      lat: 38.88,
      lon: -77.11,
      radiusKm: 35,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🧬 Los Alamos National Laboratory (LANL — Nuklearwaffen-Forschung, New Mexico, USA)',
      kind: 'research',
      theater: 'USA (New Mexico)',
      details:
        'Historisches Zentrum des Manhattan-Projekts und heutiges Hauptlabor für Design, Plutonium-Kernfertigung („Pits“) und Zertifizierung des US-Atomwaffenarsenals',
      lat: 35.88,
      lon: -106.31,
      radiusKm: 45,
      minutesAgo: 19,
    }),
    pointFeature({
      name: '🧬 Lawrence Livermore National Laboratory (LLNL — Kernfusions- & Waffenforschung, Kalifornien)',
      kind: 'research',
      theater: 'USA (Kalifornien)',
      details:
        'Standort der National Ignition Facility (Laser-Trägheitsfusion) und der Exascale-Supercomputer („El Capitan“) zur Simulation thermonuklearer Sprengköpfe',
      lat: 37.69,
      lon: -121.71,
      radiusKm: 40,
      minutesAgo: 20,
    }),
    pointFeature({
      name: '🧬 Dimona — Shimon Peres Negev Nuclear Research Center (Israel)',
      kind: 'research',
      theater: 'Israel (Negev-Wüste)',
      details:
        'Streng bewachtes israelisches Nuklearforschungszentrum (Schwerwasserreaktor & unterirdische Plutonium-Abtrennung „Machon 2“)',
      lat: 31.0,
      lon: 35.14,
      radiusKm: 45,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🧬 Parchin Militär-, Raketen- & Hochsprengstoff-Forschungskomplex (Iran)',
      kind: 'research',
      theater: 'Iran (südöstlich von Teheran)',
      details:
        'Weitläufiges iranisches Militärforschungs-Sperrgebiet für Feststoffraketentriebwerke, Drohnen und Hochgeschwindigkeits-Detonationskammern (Taleghan-2)',
      lat: 35.52,
      lon: 51.77,
      radiusKm: 40,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Sarow (Arsamas-16 / RFNC-VNIIEF — Russisches Bundesnuklearzentrum)',
      kind: 'research',
      theater: 'Russland (Nischni Nowgorod)',
      details:
        'Streng abgeriegelte geschlossene Stadt: Geburtsort der sowjetischen Atom- und Wasserstoffbombe & Hauptentwicklungszentrum russischer Nuklearsprengköpfe',
      lat: 54.93,
      lon: 43.32,
      radiusKm: 45,
      minutesAgo: 21,
    }),
    pointFeature({
      name: '🧬 Yongbyon Nuclear Research Center & Pyongyang Bio-Technical Institute (Nordkorea)',
      kind: 'research',
      theater: 'Nordkorea',
      details:
        'Nordkoreanischer Hauptkomplex für waffenfähiges Plutonium und hochangereichertes Uran (HEU) sowie Dual-Use-Biotechnologieforschung',
      lat: 39.8,
      lon: 125.75,
      radiusKm: 45,
      minutesAgo: 18,
    }),
    pointFeature({
      name: '🧬 Rheinmetall Waffen-, Munitions- & Hochenergie-Laser-Forschungszentrum Unterlüß (Deutschland)',
      kind: 'research',
      theater: 'Deutschland (Niedersachsen)',
      details:
        'Größtes privates militärisches Erprobungs- und Forschungszentrum Europas (Panzerkanonen, Artillerie, Skyranger-Flugabwehr & Hochenergie-Laser)',
      lat: 52.84,
      lon: 10.29,
      radiusKm: 0,
      minutesAgo: 22,
    }),
    pointFeature({
      name: '🧬 Labor Spiez (BABS — Schweizerisches ABC-Schutz- & Hochsicherheitslabor, Spiez)',
      kind: 'research',
      theater: 'Schweiz (Berner Oberland / Spiez)',
      details:
        'Weltweit renommiertes Schweizer Fachinstitut für den Schutz vor atomaren, biologischen und chemischen Bedrohungen (BSL-4 Sicherheitslabor, OPCW-Referenzlabor für chemische Kampfstoffe wie Nowitschok/Sarin & Nuklearforensik)',
      lat: 46.688,
      lon: 7.674,
      radiusKm: 0,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🧬 armasuisse Wissenschaft + Technologie (W+T) Forschungszentrum (Thun, Schweiz)',
      kind: 'research',
      theater: 'Schweiz (Thun / Kanton Bern)',
      details:
        'Technologie- und Erprobungszentrum des VBS für Cyber-Defense, Drohnenabwehr, elektronische Kriegsführung (EKF), Sensorik, Ballistik & Explosivstoffe',
      lat: 46.759,
      lon: 7.614,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 RUAG MRO & Rheinmetall Air Defence (Oerlikon Skyguard / Skynex) R&D (Zürich / Emmen, Schweiz)',
      kind: 'research',
      theater: 'Schweiz (Zürich-Oerlikon / Emmen)',
      details:
        'Entwicklungs- und Systemzentrum für moderne 35-mm-Flugabwehrsysteme (Oerlikon Skynex / Skyranger, AHEAD-Airburst-Munition zur Drohnenschwarm-Abwehr) & Kampfjet-Systemintegration',
      lat: 47.414,
      lon: 8.548,
      radiusKm: 0,
      minutesAgo: 14,
    }),

    // =========================================================================
    // 🏰 SCHWEIZER FESTUNGEN, REDUIT-BUNKER & UNTERIRDISCHE KOMMANDOZENTRALEN
    // =========================================================================
    pointFeature({
      name: '🏰 Artilleriewerk & Festung Heldsberg (St. Margrethen / Rheintal, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (St. Galler Rheintal / Bodensee)',
      details:
        'Strategische Grenzfestung direkt oberhalb von St. Margrethen/Au/Heerbrugg zur Sperrung des Rheinübergangs und Bodenseeraums: 1.000 m unterirdische Stollenanlage, 7,5-cm-Festungsgeschütze, MG-Kasematten, Beobachtungskuppeln & autarke Kraftwerks-/Filterkaverne',
      lat: 47.4418,
      lon: 9.6425,
      radiusKm: 0,
      minutesAgo: 5,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Magletsch (AFOM — Wartau / Oberschan, St. Galler Rheintal)',
      kind: 'bunker',
      theater: 'Schweiz (Rheintal / Sarganserland)',
      details:
        'Größtes Artilleriewerk der Festung Sargans an der Flanke zum Rheintal & Fürstentum Liechtenstein: 4 km Stollensystem, drei 10,5-cm-Panzertürme (Reichweite bis Feldkirch/Diepoldsau), vier 12-cm-Festungsminenwerfer & unterirdische Kaserne für 400 Mann',
      lat: 47.0942,
      lon: 9.4581,
      radiusKm: 0,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Furggels (St. Margrethenberg / Pfäfers, Kanton St. Gallen)',
      kind: 'bunker',
      theater: 'Schweiz (Sarganserland / Ostschweiz)',
      details:
        'Eine der größten und modernsten Festungsanlagen der Schweiz (bis 1998 streng geheim): über 10 km Stollen auf zwei Etagen im Berg, vier 15-cm-Bunkergeschütze, vier 10,5-cm-Panzertürme, Spital, Kraftwerk & Munitionskavernen für 550 Soldaten',
      lat: 46.9685,
      lon: 9.5062,
      radiusKm: 0,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏰 Festung Schollberg & Artilleriewerk Castels (Sargans / Mels, Kanton St. Gallen)',
      kind: 'bunker',
      theater: 'Schweiz (Festungsgebiet Sargans)',
      details:
        'Zentrales Sperrwerk des Nord-Süd- und Ost-West-Alpenkreuzes (Rheintal–Walensee–Graubünden) mit unterirdischen Geschützständen, Flankierwerken und Kommandostollen',
      lat: 47.0532,
      lon: 9.4528,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏰 Festung Crestawald (A 7860 — Sufers / Rheinwald, Graubünden)',
      kind: 'bunker',
      theater: 'Schweiz (Graubünden / San-Bernardino-Achse)',
      details:
        'Unterirdisches Artilleriewerk zur Sperrung der San-Bernardino-Alpenroute mit zwei schweren 10,5-cm-Ständerkanonen im Fels',
      lat: 46.5714,
      lon: 9.3508,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏰 Bundesratsbunker „K7“ / „Alpenrösli“ (Amsteg / Bristen, Kanton Uri)',
      kind: 'bunker',
      theater: 'Schweiz (Kanton Uri / Gotthard-Nordrampe)',
      details:
        'Historischer und geschützter Führungsbunker des Schweizerischen Bundesrates im Felsmassiv bei Amsteg am Eingang zum Gotthard-Reduit',
      lat: 46.7712,
      lon: 8.6695,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Sasso da Pigna & Festung Bäzberg (St. Gotthard / Andermatt, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Gotthardpass / Zentralalpen-Reduit)',
      details:
        'Herzstück des Schweizer National-Reduits auf 2.100 m ü. M. mit vier 15-cm-Festungskanonen, 2,5 km Felsstollen und strategischem Überblick über die Alpenpässe',
      lat: 46.5572,
      lon: 8.5668,
      radiusKm: 0,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏰 Festung Vitznau & Artilleriewerk Mueterschwanderberg (Vierwaldstättersee, Zentralschweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Luzern / Nidwalden)',
      details:
        'In die Rigi- und Mueterschwanderberg-Felswände gesprengte Artillerie- und Führungsanlagen zum Schutz des Zentralschweizer Reduit-Zugangs inkl. unterirdischem Festungshotel & Spital',
      lat: 47.0155,
      lon: 8.4872,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏰 Zivilschutz-Großbunker Sonnenberg (Luzern, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Luzern)',
      details:
        'Ehemals größter ziviler Atombunker der Welt (ausgelegt für 20.000 Personen im Autobahntunnel Sonnenberg mit 1,5 m dicken, 350 Tonnen schweren drucksicheren Panzertoren und 7-stöckiger Kommandokaverne)',
      lat: 47.0432,
      lon: 8.2885,
      radiusKm: 0,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏰 FLORAKO Luftverteidigungs-Kavernenbunker (Pilatus / Dübendorf / Scopi / Monte Ceneri)',
      kind: 'bunker',
      theater: 'Schweiz (Zentralschweiz / Alpenkamm)',
      details:
        'Tief im Alpenfels verbunkerte Einsatzzentralen und versenkbare Hochleistungs-Radarkuppeln des Schweizer Luftraumüberwachungs- und Führungssystems FLORAKO',
      lat: 46.9792,
      lon: 8.2548,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏰 Festung Reuenthal & Rheinsperre Koblenz (Aargau, Schweizer Nordgrenze)',
      kind: 'bunker',
      theater: 'Schweiz (Hochrhein / Kanton Aargau)',
      details:
        'Unterirdisches Artilleriewerk direkt am Hochrhein gegenüber Waldshut zur Sicherung der Schweizer Nordgrenze und des Aaremündungsraums',
      lat: 47.6052,
      lon: 8.2035,
      radiusKm: 0,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Festung Dailly-Savatan (Saint-Maurice, Wallis/Waadt — Westliches Reduit-Tor)',
      kind: 'bunker',
      theater: 'Schweiz (Rhonetal / Unterwallis)',
      details:
        'Gigantischer unterirdischer Festungskomplex mit über 20 km Stollennetz, unterirdischer Standseilbahn und zwei 15-cm-Zwillings-Panzertürmen hoch über dem Rhonetal',
      lat: 46.2085,
      lon: 7.0245,
      radiusKm: 0,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🏰 Festung Naters & Simplon-Sperrwerk (Brig-Glis, Oberwallis)',
      kind: 'bunker',
      theater: 'Schweiz (Oberwallis / Simplon-Achse)',
      details:
        'Unterirdisches Artilleriewerk im Fels über Brig/Naters zur Sicherung des Simplon-Portals und des oberen Rhonetals',
      lat: 46.3268,
      lon: 7.9912,
      radiusKm: 0,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🏰 Festung Vallorbe / Pré-Giroud (Waadtländer Jura, Westschweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Jura / Grenze zu Frankreich)',
      details:
        'In den Jurafels getriebenes Artilleriewerk zur Sperrung des strategischen Grenzübergangs am Col de Jougne',
      lat: 46.7095,
      lon: 6.3622,
      radiusKm: 0,
      minutesAgo: 17,
    }),
    pointFeature({
      name: '🏰 Regierungsbunker St. Johann im Pongau / „EZ/B“ Einsatzzentrale Basisraum (Österreich)',
      kind: 'bunker',
      theater: 'Österreich (Salzburger Alpen)',
      details:
        'Streng geschützte unterirdische Regierungs- und Luftraumüberwachungs-Führungsanlage („Goldhaube“-Zentrale) des Österreichischen Bundesheeres tief im Heukareck-Alpenmassiv',
      lat: 47.332,
      lon: 13.214,
      radiusKm: 0,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Ausweichsitz der Verfassungsorgane & Kommando Strategische Aufklärung (Gelsdorf / Ahrtal, Deutschland)',
      kind: 'bunker',
      theater: 'Deutschland (Rheinland-Pfalz / Nordrhein-Westfalen)',
      details:
        'Unterirdische Führungs- und Fernmeldeinfrastruktur im Raum Marienthal/Gelsdorf inkl. Bundeswehr Kommando Strategische Aufklärung (KSA)',
      lat: 50.568,
      lon: 7.042,
      radiusKm: 0,
      minutesAgo: 18,
    }),

    // =========================================================================
    // 🏛️ SCHWEIZER KASERNEN, WAFFENPLÄTZE, KAVERNENFLUGPLÄTZE & MILITÄRINFRASTRUKTUR
    // =========================================================================
    pointFeature({
      name: '🏛️ Waffenplatz St. Gallen — Kaserne Neuchlen-Anschwilen (Gossau / St. Gallen) & Kaserne Herisau',
      kind: 'military_base',
      theater: 'Schweiz (Ostschweiz / St. Gallen – Appenzell)',
      details:
        'Hauptwaffenplatz der Infanterie in der Ostschweiz (Infanterie-Kaserne Neuchlen-Anschwilen, Kaserne Herisau-Gossau, Häuserkampfanlage & Gefechtsausbildungszentrum Ost)',
      lat: 47.4342,
      lon: 9.2618,
      radiusKm: 0,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Walenstadt & Kaserne St. Luzisteig (Sarganserland / Rheintal, Schweiz)',
      kind: 'military_base',
      theater: 'Schweiz (Sarganserland / Graubünden-Nord)',
      details:
        'Traditionsreicher Gebirgs- und Infanteriewaffenplatz mit dem Gefechtsausbildungszentrum Ost (GAZ Ost), Kaserne Walenstadt und historischer Passkaserne St. Luzisteig bei Maienfeld/Balzers',
      lat: 47.1215,
      lon: 9.3145,
      radiusKm: 0,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Kaserne Wil SG & Armeelogistikcenter Hinwil/Ostschweiz (Kanton St. Gallen)',
      kind: 'military_base',
      theater: 'Schweiz (Ostschweiz / Wil SG)',
      details:
        'Militärkaserne, Truppenunterkunft und Logistik-/Bereitstellungsstützpunkt der Territorialdivision 4 (Ostschweiz)',
      lat: 47.4665,
      lon: 9.0455,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Chur — Kaserne Chur & Gebirgsinfanterie-Ausbildungszentrum (Graubünden)',
      kind: 'military_base',
      theater: 'Schweiz (Graubünden / Alpenrhein)',
      details:
        'Großer Waffenplatz der Schweizer Armee am Alpenrhein mit Kaserne Chur, Schießplatz Rossboden und Kommando der Gebirgsspezialisten /Inf RS 12',
      lat: 46.8548,
      lon: 9.5082,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Frauenfeld — Kaserne Auenfeld, Artillerie & Cyber-Lehrgang (Thurgau, Schweiz)',
      kind: 'military_base',
      theater: 'Schweiz (Ostschweiz / Thurgau)',
      details:
        'Waffenplatz für Artillerie, Führungsunterstützung, Elektronische Kriegsführung (EKF) und das Cyber-Bataillon der Schweizer Armee',
      lat: 47.5682,
      lon: 8.8924,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Kloten-Bülach — Kaserne Bülach (Führungsunterstützung & Richtstrahl, Zürich)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Zürich)',
      details:
        'Hauptstandort für militärische Telekommunikation, Richtstrahltruppen, Cyber-Führungsnetze und Mobilmachungslogistik im Raum Zürich',
      lat: 47.5142,
      lon: 8.5385,
      radiusKm: 0,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Kaserne Reppischtal (Birmensdorf / Zürich) & Waffenplatz Aarau',
      kind: 'military_base',
      theater: 'Schweiz (Zürich / Aargau)',
      details:
        'Militärkaserne Reppischtal bei Zürich sowie Kaserne Aarau (Kommando Militärpolizei, Infanterie & Kompetenzzentrum Militärmusik)',
      lat: 47.3485,
      lon: 8.4362,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Brugg — Geniekaserne & Katastrophenhilfe-Bereitschaftsverband (Aargau)',
      kind: 'military_base',
      theater: 'Schweiz (Aargau / Wasserschloss)',
      details:
        'Zentrum der Genietruppen (Pioniere, Brückenbau, Sprengdienst & Katastrophenhilfe) an Aare, Reuss und Limmat',
      lat: 47.4865,
      lon: 8.2128,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Thun — Größter Panzer-, Artillerie- & Logistik-Waffenplatz der Schweiz',
      kind: 'military_base',
      theater: 'Schweiz (Berner Oberland / Thun)',
      details:
        'Größter Waffenplatz der Schweizer Armee: Panzertruppen (Leopard 2 WE), Panzerhaubitzen M109 KAWEST, Armeelogistikcenter Thun & armasuisse Erprobung',
      lat: 46.7585,
      lon: 7.6085,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Kaserne Bern & Eidgenössisches Departement für Verteidigung VBS / Armeestab (Bern)',
      kind: 'military_base',
      theater: 'Schweiz (Bundesstadt Bern)',
      details:
        'Hauptsitz des VBS, des Chefs der Armee, des Kommando Operationen (Kdo Op) und des Militärischen Nachrichtendienstes (MND)',
      lat: 46.9582,
      lon: 7.4565,
      radiusKm: 0,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Grenadier-Kaserne Isone — Kommando Spezialkräfte (KSK / AAD 10 / Grenadiere, Tessin)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Tessin / Monte Ceneri)',
      details:
        'Streng abgeschirmtes Ausbildungs- und Einsatzzentrum der Schweizer Elitetruppen: Armee-Aufklärungsdetachement 10 (AAD 10), Grenadiere & Fallschirmaufklärer',
      lat: 46.1305,
      lon: 8.9892,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Payerne (HauptEinsatzbasis F/A-18 Hornet & künftig F-35A Lightning II)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Waadt / Westschweiz)',
      details:
        'Wichtigster Einsatzflugplatz der Schweizer Luftwaffe (Luftpolizeidienst QRA24, Fliegergeschwader 11, unterirdische Flugzeug- Wartungsanlagen & gehärtete Shelter)',
      lat: 46.8433,
      lon: 6.9152,
      radiusKm: 0,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Meiringen — Unterirdische Flugzeugkaverne im Alpenfels (Berner Oberland)',
      kind: 'military_base',
      theater: 'Schweiz (Berner Oberland / Haslital)',
      details:
        'Einzigartiger Alpen-Militärflugplatz mit riesiger Flugzeugkaverne direkt im Bergmassiv (F/A-18 Kampfjets rollen direkt aus dem Felsstollen auf die Startbahn)',
      lat: 46.7422,
      lon: 8.1095,
      radiusKm: 0,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Emmen — Luftwaffe, Drohnengeschwader (Hermes 900 HFE) &Fliegerabwehr',
      kind: 'military_base',
      theater: 'Schweiz (Luzern / Emmen)',
      details:
        'Stützpunkt für Aufklärungsdrohnen ADS 15 (Elbit Hermes 900), Pilatus PC-21 Jet-Trainer, Bodengestützte Luftverteidigung (BODLUV) & RUAG Endmontage',
      lat: 47.0924,
      lon: 8.3048,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Dübendorf — Lufttransport, Bundes-Luftdienst & Air Operations Center (Zürich)',
      kind: 'military_base',
      theater: 'Schweiz (Zürich / Dübendorf)',
      details:
        'Standort des Air Operations Center (AOC) der Schweizer Luftwaffe, Super Puma / Cougar Helikopter-Lufttransport sowie Skyguide Luftraumüberwachung',
      lat: 47.3985,
      lon: 8.6482,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Alpnach (Helikopter-Hauptbasis) & Militärflugplatz Locarno / Sion',
      kind: 'military_base',
      theater: 'Schweiz (Obwalden / Zentralschweiz)',
      details:
        'Zentrale Gebirgs-Helikopterbasis der Schweizer Luftwaffe (AS332 Super Puma, AS532 Cougar & EC635) am Fuß des Pilatus',
      lat: 46.9435,
      lon: 8.2842,
      radiusKm: 0,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Bière — Artillerie-, Aufklärungs- & Gefechtsausbildungszentrum West (Waadt)',
      kind: 'military_base',
      theater: 'Schweiz (Waadtländer Jura)',
      details:
        'Größter Waffenplatz der Westschweiz für Panzerartillerie, Minenwerfer, Aufklärungsbataillone und verbundene Gefechtsübungen',
      lat: 46.5352,
      lon: 6.3385,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ Onyx SATCOM-Abhöranlage (Nachrichtendienst des Bundes NDB — Leuk, Kanton Wallis)',
      kind: 'military_base',
      theater: 'Schweiz (Wallis / Leuk)',
      details:
        'Strategische Satelliten-Aufklärungsanlage („Onyx“) des Schweizer Nachrichtendienstes NDB und des MND zur weltweiten elektronischen Fernmelde- und Satellitenüberwachung (SIGINT/COMINT)',
      lat: 46.3185,
      lon: 7.6482,
      radiusKm: 0,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Walgau-Kaserne (Bludesch) & Bilgeri-Kaserne (Bregenz — Österreichisches Bundesheer Vorarlberg)',
      kind: 'military_base',
      theater: 'Österreich (Vorarlberg / Nachbarschaft Rheintal)',
      details:
        'Garnisonen des Hochgebirgs-Jägerbataillons 23 (Bludesch) und des Militärkommandos Vorarlberg (Bregenz) unmittelbar östlich des St. Galler Rheintals',
      lat: 47.1965,
      lon: 9.7385,
      radiusKm: 0,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Hinterstoisser (Zeltweg — Österreichische Eurofighter Typhoon Einsatzbasis)',
      kind: 'military_base',
      theater: 'Österreich (Steiermark)',
      details:
        'Haupteinsatzbasis des Überwachungsgeschwaders der österreichischen Luftstreitkräfte (Eurofighter Typhoon Luftraumüberwachung)',
      lat: 47.2028,
      lon: 14.7442,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏛️ Graf-Zeppelin-Kaserne Calw — Kommando Spezialkräfte (KSK der Bundeswehr, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Baden-Württemberg / Schwarzwald)',
      details:
        'Stützpunkt des Kommandos Spezialkräfte (KSK) der Deutschen Bundeswehr für Geiselbefreiung, Terrorbekämpfung und verdeckte Spezialoperationen',
      lat: 48.7185,
      lon: 8.7652,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Büchel — Taktisches Luftwaffengeschwader 33 & US B61-12 Nuklear-Standort (Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Rheinland-Pfalz / Eifel)',
      details:
        'Deutscher Luftwaffenstützpunkt im Rahmen der nuklearen Teilhabe der NATO (unterirdische WS3-Vaults für US B61-12 Thermonuklearbomben, Umrüstung auf F-35A Lightning II)',
      lat: 50.1738,
      lon: 7.0633,
      radiusKm: 0,
      minutesAgo: 10,
    }),

    // =========================================================================
    // 🛡️ ZUSÄTZLICHE LUFTABWEHR-STELLUNGEN (Schweiz BODLUV, DACH & Weltweit)
    // =========================================================================
    pointFeature({
      name: '🛡️ Schweizer BODLUV GR (Patriot PAC-3 MSE / Oerlikon 35mm Skyguard / Stinger — Emmen & Ostschweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Mittelland / Alpennordseite)',
      details:
        'Bodengestützte Luftverteidigung größerer Reichweite (BODLUV GR / Patriot-Beschaffung) & mittlere/leichte Fliegerabwehr zum Schutz des Schweizer Luftraums',
      lat: 47.392,
      lon: 8.642,
      radiusKm: 65,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ WEF-Luftraumschutz & Alpin-Radarstellung Weißfluhjoch / Davos (FLORAKO / Skyguard, Graubünden)',
      kind: 'air_defense',
      theater: 'Schweiz (Graubünden / Davos – Rheintal)',
      details:
        'Hochalpine Radar- und Flugabwehrstellung zum Schutz des Ostschweizer und Bündner Luftraums (u.a. während des World Economic Forum WEF in Davos)',
      lat: 46.8325,
      lon: 9.8065,
      radiusKm: 50,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ Goldhaube Weitbereichsradar Kolomannsberg & Speikkogel (Österreichische Luftraumüberwachung)',
      kind: 'air_defense',
      theater: 'Österreich (Salzburg / Oberösterreich)',
      details:
        'Ortsfeste 3D-Phased-Array-Weitbereichsradarstation (RAT-31DL) des österreichischen Systems „Goldhaube“ mit über 450 km Erfassungsreichweite',
      lat: 47.8805,
      lon: 13.2745,
      radiusKm: 75,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Arrow-3 Exo-Atmosphärische Raketenabwehr & IRIS-T SLM Stellung Holzdorf/Schönewalde (Deutschland)',
      kind: 'air_defense',
      theater: 'Deutschland (Brandenburg / Sachsen-Anhalt — European Sky Shield)',
      details:
        'Erster europäischer Standort des israelisch-amerikanischen Arrow-3-Raketenabwehrsystems (Abfang von ballistischen Raketen im Weltraum in bis zu 100 km Höhe) im Rahmen der European Sky Shield Initiative',
      lat: 51.768,
      lon: 13.167,
      radiusKm: 95,
      minutesAgo: 9,
    }),

    // =========================================================================
    // ⚔️ WEITERE GLOBALE FRONTLINIEN & MILITÄRISCHE DEMARKATIONSLINIEN
    // =========================================================================
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Sudan-Frontlinie (Khartum – Omdurman – Wad Madani – El-Fascher Kontaktlinie)',
        kind: 'front',
        theater: 'Sudan (Khartum / Darfur)',
        details:
          'Aktive Gefechts- und Belagerungslinien zwischen den Sudanesischen Streitkräften (SAF) und den Rapid Support Forces (RSF)',
        updatedAt: isoMinutesAgo(22),
        labelLat: 15.55,
        labelLon: 32.52,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          smoothOpenLine([
            [32.42, 15.72],
            [32.48, 15.63],
            [32.53, 15.55],
            [32.61, 15.48],
            [32.85, 15.12],
            [33.32, 14.65],
            [33.52, 14.4],
          ]),
          smoothOpenLine([
            [25.21, 13.72],
            [25.35, 13.63],
            [25.48, 13.58],
            [25.38, 13.48],
            [25.22, 13.54],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Koreanische Demilitarisierte Zone (DMZ — 38. Breitengrad Militärische Demarkationslinie)',
        kind: 'front',
        theater: 'Koreanische Halbinsel (Nord- / Südkorea)',
        details:
          '248 km lange, schwerstbefestigte Militärische Demarkationslinie (MDL) mit Artilleriestellungen, Minengürteln & JSA Panmunjom',
        updatedAt: isoMinutesAgo(18),
        labelLat: 38.12,
        labelLon: 127.15,
      },
      geometry: {
        type: 'LineString',
        coordinates: smoothOpenLine([
          [126.15, 37.78],
          [126.67, 37.95],
          [127.12, 38.18],
          [127.65, 38.31],
          [128.08, 38.42],
          [128.36, 38.61],
        ]),
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Line of Control (LoC Kaschmir) & Line of Actual Control (LAC Ladakh / Aksai Chin)',
        kind: 'front',
        theater: 'Kaschmir / Himalaya (Indien – Pakistan – China)',
        details:
          'Hochgebirgs-Militärkontaktlinien am Siachen-Gletscher, in Kaschmir (LoC) und im Galwan-/Pangong-Sektor (LAC)',
        updatedAt: isoMinutesAgo(31),
        labelLat: 34.25,
        labelLon: 75.15,
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          smoothOpenLine([
            [74.05, 32.85],
            [73.88, 33.45],
            [73.95, 34.12],
            [74.55, 34.58],
            [75.65, 34.62],
            [76.85, 35.15],
            [77.05, 35.52],
          ]),
          smoothOpenLine([
            [77.85, 35.45],
            [78.18, 34.68],
            [78.65, 33.95],
            [78.92, 33.42],
            [79.15, 32.78],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '⚔️ Ost-Kongo / Nord-Kivu Frontlinie (Goma – Sake – Masisi – Rutshuru)',
        kind: 'front',
        theater: 'DR Kongo (Nord-Kivu / Große Seen)',
        details:
          'Aktive Gefechtslinie zwischen M23-Verbänden, FARDC und Regionaltruppen nördlich und westlich von Goma',
        updatedAt: isoMinutesAgo(27),
        labelLat: -1.58,
        labelLon: 29.12,
      },
      geometry: {
        type: 'LineString',
        coordinates: smoothOpenLine([
          [28.88, -1.62],
          [29.04, -1.56],
          [29.18, -1.52],
          [29.32, -1.42],
          [29.44, -1.25],
        ]),
      },
    },

    // =========================================================================
    // 🚧 WEITERE MARITIME SPERR- & BLOCKADEZONEN (Indo-Pazifik, Ostsee, Arktis)
    // =========================================================================
    {
      type: 'Feature',
      properties: {
        name: '🚧 See- & Luftblockade-Übungszone Taiwanstraße (PLA „Joint Sword“ & Median-Linie)',
        kind: 'blockade',
        theater: 'Taiwanstraße / Westpazifik',
        details:
          'Maritime Kontroll-, ADIZ- und Seeziel-Übungssektoren der chinesischen Marine (PLAN) & Küstenwache rund um Taiwan',
        updatedAt: isoMinutesAgo(15),
        labelLat: 24.45,
        labelLon: 119.85,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [118.85, 23.15],
            [119.55, 24.35],
            [120.45, 25.45],
            [121.65, 25.85],
            [122.45, 25.25],
            [121.85, 24.55],
            [120.65, 23.85],
            [119.65, 22.85],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 Maritime Sperr- & Konfliktzone Südchinesisches Meer (Scarborough Shoal & Spratly-Inseln)',
        kind: 'blockade',
        theater: 'Südchinesisches Meer (West Philippine Sea)',
        details:
          'Umkämpfte See-Sperrzone um Second Thomas Shoal (Ayungin), Sabina Shoal und Scarborough-Riff',
        updatedAt: isoMinutesAgo(21),
        labelLat: 11.85,
        labelLon: 115.25,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [112.45, 9.25],
            [114.25, 11.45],
            [116.55, 14.85],
            [118.15, 15.35],
            [118.45, 13.85],
            [116.95, 10.65],
            [114.85, 8.85],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 NATO „Baltic Sentry“ & Kaliningrad A2/AD-Seeraumkontrolle (Ostsee / Finnischer Meerbusen)',
        kind: 'blockade',
        theater: 'Ostsee',
        details:
          'NATO-Marineüberwachungskorridor zum Schutz kritischer Unterseekabel/Pipelines & russische Baltische Flotten-Sperrzone vor Baltijsk',
        updatedAt: isoMinutesAgo(24),
        labelLat: 55.65,
        labelLon: 19.45,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [18.25, 54.65],
            [19.85, 54.55],
            [20.65, 55.45],
            [21.45, 56.85],
            [20.15, 57.35],
            [18.95, 56.25],
          ]),
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '🚧 GIUK-Lücke (Grönland–Island–UK) — NATO U-Boot-Abwehr- & SOSUS-Sperrgürtel',
        kind: 'blockade',
        theater: 'Nordatlantik / Arktis-Zugang',
        details:
          'Strategischer NATO-Unterwasser-Überwachungsriegel (SOSUS/IUSS & P-8A Poseidon) gegen russische Atom-U-Boote der Nordflotte',
        updatedAt: isoMinutesAgo(30),
        labelLat: 63.25,
        labelLon: -14.5,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          smoothClosedPolygon([
            [-24.5, 65.8],
            [-18.2, 64.2],
            [-11.5, 62.1],
            [-5.8, 59.8],
            [-7.2, 58.6],
            [-14.5, 60.8],
            [-21.5, 63.1],
            [-26.5, 64.9],
          ]),
        ],
      },
    },

    // =========================================================================
    // ⚓ WEITERE FLUGZEUGTRÄGER-KAMPFGRUPPEN (CSG / Carrier Task Groups)
    // =========================================================================
    pointFeature({
      name: '⚓ USS Gerald R. Ford (CVN-78) — Carrier Strike Group 12',
      kind: 'carrier',
      theater: 'Westatlantik / US 2nd Fleet',
      details:
        'Größter atomgetriebener Flugzeugträger der Welt (Ford-Klasse) mit Carrier Air Wing 8 & Aegis-Lenkwaffenzerstörern',
      lat: 36.85,
      lon: -66.4,
      radiusKm: 125,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '⚓ USS Carl Vinson (CVN-70) — Carrier Strike Group 1',
      kind: 'carrier',
      theater: 'Philippinensee / Westpazifik',
      details:
        'US Navy Nimitz-Klasse Flugzeugträger-Kampfgruppe mit F-35C Lightning II Stealth-Staffeln im Indo-Pazifik',
      lat: 18.25,
      lon: 128.4,
      radiusKm: 120,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '⚓ CNS Liaoning (CV-16) — PLA Navy Carrier Task Group',
      kind: 'carrier',
      theater: 'Ostchinesisches Meer / Ryukyu-Bogen',
      details:
        'Chinesische Flugzeugträger-Kampfgruppe mit J-15B Bordkampfflugzeugen und Typ-055 Renhai-Klasse Lenkwaffenkreuzern',
      lat: 26.85,
      lon: 123.45,
      radiusKm: 110,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '⚓ CNS Fujian (CV-18) — PLA Navy CATOBAR Supercarrier Group',
      kind: 'carrier',
      theater: 'Ostchinesisches Meer / Zhoushan',
      details:
        'Chinas neuester 80.000-Tonnen-Flugzeugträger mit elektromagnetischen Katapulten (EMALS) für J-35 Stealth-Jets & KJ-600 AWACS',
      lat: 30.65,
      lon: 122.95,
      radiusKm: 115,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '⚓ HMS Prince of Wales (R09) — UK Carrier Strike Group',
      kind: 'carrier',
      theater: 'Nordatlantik / Nordsee (NATO)',
      details:
        'Flaggschiff der Royal Navy (Queen-Elizabeth-Klasse) mit F-35B Lightning II & Type-45 Daring-Klasse Luftabwehrzerstörern',
      lat: 59.85,
      lon: -4.25,
      radiusKm: 105,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '⚓ INS Vikrant (IAC-1) — Indian Navy Western Fleet Carrier Group',
      kind: 'carrier',
      theater: 'Arabisches Meer / Indischer Ozean',
      details:
        'Indischer Flugzeugträger mit MiG-29K Staffeln und Kolkata-/Visakhapatnam-Klasse Lenkwaffenzerstörern (Barak-8 & BrahMos)',
      lat: 16.45,
      lon: 71.25,
      radiusKm: 100,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '⚓ JS Kaga (DDH-184) & JS Izumo — JMSDF F-35B Escort Flotilla',
      kind: 'carrier',
      theater: 'Pazifik / Süd-Japan',
      details:
        'Japanische F-35B-Trägergruppe der Maritimen Selbstverteidigungsstreitkräfte (JMSDF) mit Maya-Klasse Aegis-Zerstörern',
      lat: 31.45,
      lon: 132.85,
      radiusKm: 95,
      minutesAgo: 13,
    }),

    // =========================================================================
    // 🛡️ WEITERE LUFTABWEHR- & FRÜHWARNRADAR-STELLUNGEN (DACH & Global)
    // =========================================================================
    pointFeature({
      name: '🛡️ FLORAKO Höhenradarstation Scopi (3.190 m ü. M., Lukmanierpass, Graubünden/Tessin, Schweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Graubünden / Tessin — Alpenhauptkamm)',
      details:
        'Höchstgelegene geschützte 3D-Phased-Array-Gebirgsradarstation (FLORAKO / Thales Master-M) der Schweizer Luftwaffe mit Seilbahn-Kavernenzugang',
      lat: 46.5714,
      lon: 8.8295,
      radiusKm: 65,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ FLORAKO Höhenradarstation Weisshorn / Mittelplatten (2.940 m ü. M., Wallis, Schweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Wallis / Westalpen)',
      details:
        'Hochalpine FLORAKO-Luftraumüberwachungs- und Führungsradarstation der Schweizer Luftwaffe über dem Rhonetal',
      lat: 46.1065,
      lon: 7.7162,
      radiusKm: 65,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ FLORAKO Höhenradarstation Monte Ceneri / Tamaro (Tessin, Schweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Tessin / Südschweiz)',
      details:
        'Südlicher Sensor-Knotenpunkt des Schweizer FLORAKO-Luftverteidigungsnetzes zur Überwachung des Alpen-Südraums und Norditaliens',
      lat: 46.1038,
      lon: 8.8658,
      radiusKm: 55,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Schweizer BODLUV GR (Patriot PAC-3 MSE) & Skyguard Stellung Payerne (Westschweiz)',
      kind: 'air_defense',
      theater: 'Schweiz (Waadt / Freiburg)',
      details:
        'Bodengestützte Luftverteidigung (BODLUV) zum Schutz der Haupt-Kampfjetbasis Payerne (F/A-18 & künftige F-35A)',
      lat: 46.8433,
      lon: 6.9152,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ Goldhaube 3D-Weitbereichsradar Steinmandl (Leiser Berge, Niederösterreich)',
      kind: 'air_defense',
      theater: 'Österreich (Niederösterreich / Raum Wien)',
      details:
        'Ortsfeste RAT-31DL Phased-Array-Großraumradarstation des österreichischen Luftraumüberwachungssystems „Goldhaube“ nördlich von Wien',
      lat: 48.5622,
      lon: 16.4125,
      radiusKm: 75,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ Goldhaube 3D-Weitbereichsradar Speikkogel (2.140 m, Koralpe, Kärnten/Steiermark, Österreich)',
      kind: 'air_defense',
      theater: 'Österreich (Kärnten / Steiermark)',
      details:
        'Hochalpine 3D-Weitbereichsradarstation (RAT-31DL) des Bundesheeres zur Überwachung des Südostalpen- und Balkanraums',
      lat: 46.7865,
      lon: 14.9722,
      radiusKm: 75,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ US Army 10th AAMDC (Air & Missile Defense Command) Kaiserslautern / Ramstein (Deutschland)',
      kind: 'air_defense',
      theater: 'Deutschland (Rheinland-Pfalz)',
      details:
        'Oberkommando der US-Heeresflugabwehr in Europa (Patriot PAC-3 MSE, Avenger & M-SHORAD zum Schutz der NATO-Ostflanke und Ramstein)',
      lat: 49.445,
      lon: 7.768,
      radiusKm: 60,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Bundeswehr Patriot PAC-3 & IRIS-T SLM Ausbildungs- & Einsatzstellung Todendorf (Ostsee, Deutschland)',
      kind: 'air_defense',
      theater: 'Deutschland (Schleswig-Holstein / Ostseeküste)',
      details:
        'Deutsches Kompetenz- und Schießzentrum für bodengebundene Luftverteidigung (IRIS-T SLM & Patriot Flugabwehrraketengeschwader 1)',
      lat: 54.331,
      lon: 10.708,
      radiusKm: 55,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ SAMP/T Mamba (Aster 30 B1NT) Luftabwehrstellung Istres / Marseille (Frankreich)',
      kind: 'air_defense',
      theater: 'Frankreich (Provence / Mittelmeer)',
      details:
        'Französische Langstrecken-Flug- und Raketenabwehrbatterie (SAMP/T NG mit Aster-30-Abfangraketen) zum Schutz der Nuklearbasis Istres',
      lat: 43.524,
      lon: 4.925,
      radiusKm: 65,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ David’s Sling (Stunner) & ITO05M Luftabwehr-Ring Helsinki (Finnland)',
      kind: 'air_defense',
      theater: 'Finnland (Hauptstadtregion Helsinki)',
      details:
        'Finnischer Hochleistungs-Luft- und Raketenabwehrschirm (israelisch-finnisches David’s-Sling-System & NASAMS II)',
      lat: 60.317,
      lon: 24.963,
      radiusKm: 60,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Patriot PAC-3 MSE & Narew/Wisła Luftabwehr-Ring Warschau (Polen)',
      kind: 'air_defense',
      theater: 'Polen (Warschau / Masowien)',
      details:
        'Polnische Integrierte Luft- und Raketenabwehr (IBCS Patriot PAC-3 MSE & CAMM-ER Narew) zum Schutz des Großraums Warschau',
      lat: 52.229,
      lon: 20.238,
      radiusKm: 65,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Patriot PAC-3 & IRIS-T SLM Luftabwehr Charkiw & Dnipro (Ostukraine)',
      kind: 'air_defense',
      theater: 'Ukraine (Dnipro / Charkiw)',
      details:
        'Kombinierter ukrainischer Flugabwehrschirm gegen ballistische Iskander-M-Raketen, Kinschal und Shahed-Drohnenschwärme',
      lat: 48.464,
      lon: 35.046,
      radiusKm: 55,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Clear Space Force Station — LRDR (Long Range Discrimination Radar) & BMEWS (Alaska, USA)',
      kind: 'air_defense',
      theater: 'USA (Alaska — NORAD / US Space Force)',
      details:
        'Strategisches US-Hochleistungs-GaN-Festkörperradar (AN/SPY-7 LRDR & AN/FPS-132) zur Erfassung von Interkontinentalraketen und Hyperschallgleitern über der Arktis',
      lat: 64.29,
      lon: -149.19,
      radiusKm: 120,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ Cape Cod Space Force Station — AN/FPS-132 PAVE PAWS Radar (Massachusetts, USA)',
      kind: 'air_defense',
      theater: 'USA (Ostküste / Atlantik)',
      details:
        'US Space Force Phased-Array-Frühwarnradar (UEWR) mit 5.500 km Reichweite zur Überwachung des Nordatlantiks gegen SLBM-/ICBM-Starts',
      lat: 41.75,
      lon: -70.54,
      radiusKm: 110,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Beale AFB — AN/FPS-132 PAVE PAWS ICBM-Frühwarnradar (Kalifornien, USA)',
      kind: 'air_defense',
      theater: 'USA (Kalifornien / Pazifikküste)',
      details:
        'Strategisches US-Frühwarnradar zur Überwachung des gesamten Ostpazifiks gegen ballistische Raketen und Weltraumobjekte',
      lat: 39.13,
      lon: -121.35,
      radiusKm: 110,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Woronesch-DM Strategisches Frühwarnradar Armawir (Krasnodar, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Krasnodar / Nordkaukasus)',
      details:
        'Russisches UHF-Überhorizont-Frühwarnradar (bis 6.000 km Reichweite) mit Abdeckung über das Schwarze Meer, Mittelmeer und den Nahen Osten',
      lat: 44.92,
      lon: 40.98,
      radiusKm: 115,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ Woronesch-M Frühwarnradar Lachtusi / St. Petersburg (Nordwest-Russland)',
      kind: 'air_defense',
      theater: 'Russland (Leningrad / St. Petersburg)',
      details:
        'Strategischer russischer Raketenfrühwarn-Radarkomplex zur Überwachung des nordeuropäischen und nordatlantischen Luftraums',
      lat: 60.27,
      lon: 30.55,
      radiusKm: 115,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ S-400 Triumf & Bastion-P Arktis-Kuppel „Arktitscheski Trilistnik“ Nagurskoje (Franz-Josef-Land, Arktis)',
      kind: 'air_defense',
      theater: 'Russland (Arktis / 80° Nord)',
      details:
        'Nördlichster geschlossener Militär- und Luftabwehrkomplex der Welt (S-400, Pantsir-SA & Monolit-B Radar am Nordpolarmeer)',
      lat: 80.8,
      lon: 47.66,
      radiusKm: 95,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🛡️ HQ-9B & Anti-Stealth-Radar Fiery Cross Reef (Yongshu Jiao, Spratly-Inseln)',
      kind: 'air_defense',
      theater: 'Südchinesisches Meer (Spratly-Archipel)',
      details:
        'Befestigte künstliche Militärinsel der PLA mit HQ-9B Langstrecken-Flugabwehr, YJ-12B Seezielraketen und 3.000-Meter-Startbahn',
      lat: 9.55,
      lon: 112.89,
      radiusKm: 75,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ HQ-9B & S-400 Luftabwehr-Gürtel Xiamen / Fuzhou (Taiwanstraße, China)',
      kind: 'air_defense',
      theater: 'China (Fujian / Taiwanstraße)',
      details:
        'Hochdichter chinesischer Langstrecken-Flugabwehrschirm (S-400 Triumf & HQ-9B) mit direkter Reichweite über die gesamte Taiwanstraße',
      lat: 24.48,
      lon: 118.08,
      radiusKm: 75,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Indische S-400 Triumf („Sudarshan Chakra“) Stellung Adampur (Punjab, Indien)',
      kind: 'air_defense',
      theater: 'Indien (Punjab / Westgrenze)',
      details:
        'Erste Einsatzstellung des indischen S-400-Langstrecken-Luftverteidigungssystems (400 km Abfangradius) zum Schutz des nordwestlichen Sektors',
      lat: 31.43,
      lon: 75.76,
      radiusKm: 85,
      minutesAgo: 14,
    }),

    // =========================================================================
    // 🚀 WEITERE RAKETENABSCHUSS-STANDORTE & ICBM-SILOFELDER
    // =========================================================================
    pointFeature({
      name: '🚀 Russisches ICBM-Silofeld Kartaly / Lokomotivny (59. Raketendivision, Südural, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Tscheljabinsk / Südural)',
      details:
        'Strategisches Silofeld für überschwere Interkontinentalraketen vom Typ R-36M2 „Wojewoda“ (SS-18 Satan) und RS-28 „Sarmat“',
      lat: 53.05,
      lon: 60.65,
      radiusKm: 85,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🚀 Kosmodrom Wostotschny (Amur, Fernost-Russland)',
      kind: 'missile_site',
      theater: 'Russland (Amur / Fernost)',
      details:
        'Modernstes russisches Weltraum- und Trägerstartzentrum für Angara-A5-Schwerlastraketen und Sojus-2-Militärsatelliten',
      lat: 51.88,
      lon: 128.33,
      radiusKm: 75,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 Kosmodrom Baikonur (Strategische Raumfahrt- & ICBM-Testbasis, Kasachstan)',
      kind: 'missile_site',
      theater: 'Kasachstan / Zentralasien',
      details:
        'Historischer und aktiver Großstartkomplex für strategische Raumfahrt-, Aufklärungs- und Interkontinentalraketen-Erprobungen',
      lat: 45.96,
      lon: 63.3,
      radiusKm: 80,
      minutesAgo: 16,
    }),
    pointFeature({
      name: '🚀 Französische ASMPA-R Nuklear-Marschflugkörper-Basis BA 113 Saint-Dizier (Frankreich)',
      kind: 'missile_site',
      theater: 'Frankreich (Grand Est)',
      details:
        'Heimatbasis der französischen Forces Aériennes Stratégiques (Rafale B mit überschallschnellen nuklearen ASMPA-R Lenkwaffen)',
      lat: 48.63,
      lon: 4.9,
      radiusKm: 50,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force Basis 62 (Kunming / Yunnan — DF-21 & DF-26 Brigaden, China)',
      kind: 'missile_site',
      theater: 'China (Yunnan / Südwest-Kommando)',
      details:
        'Operatives Hauptquartier der 62. Raketenbasis der chinesischen Raketenstreitkräfte (PLARF) mit mobilen DF-26 und DF-21D Mittelstreckenraketen',
      lat: 25.04,
      lon: 102.71,
      radiusKm: 60,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force Basis 63 (Huaihua / Hunan — DF-5B & DF-31AG ICBMs, China)',
      kind: 'missile_site',
      theater: 'China (Hunan)',
      details:
        'Strategische chinesische ICBM-Kommandobasis mit unterirdischen Silos für DF-5B (MIRV) und mobilen DF-31AG Interkontinentalraketen',
      lat: 27.55,
      lon: 109.96,
      radiusKm: 65,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force Basis 64 (Lanzhou / Gansu — DF-31AG & DF-26 Brigaden, China)',
      kind: 'missile_site',
      theater: 'China (Gansu / Nordwest-Korridor)',
      details:
        'Kommandocentrum für die westlichen ICBM-Silofelder (Yumen/Hami) und mobile nukleare Langstreckenbrigaden',
      lat: 36.06,
      lon: 103.83,
      radiusKm: 65,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 PLA Rocket Force Basis 65 (Shenyang / Liaoning — DF-31AG & DF-21 Brigaden, China)',
      kind: 'missile_site',
      theater: 'China (Liaoning / Nordost-China)',
      details:
        'Strategische PLARF-Raketenbasis für den nordostasiatischen und pazifischen Sektor (DF-31AG, DF-26 & DF-17 Hyperschallraketen)',
      lat: 41.8,
      lon: 123.43,
      radiusKm: 60,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🚀 Kosmodrom Jiuquan & Hyperschall-Testzentrum (Wüste Gobi, China)',
      kind: 'missile_site',
      theater: 'China (Innere Mongolei / Gansu)',
      details:
        'Chinas wichtigstes Weltraum-, Orbitalbomber- (FOBS) und Hyperschallgleiter-Startzentrum in der Wüste Gobi',
      lat: 40.96,
      lon: 100.29,
      radiusKm: 75,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🚀 Nordkoreanische ICBM-Basis Sangnam-ri (Hochland Chagang/Hambuk, Nordkorea)',
      kind: 'missile_site',
      theater: 'Nordkorea (Hochland nahe chinesischer Grenze)',
      details:
        'Geschützte Gebirgs-Raketenbasis für nordkoreanische Langstrecken- und Interkontinentalraketen (Hwasong-15, Hwasong-17 & Feststoff-Hwasong-18)',
      lat: 40.82,
      lon: 128.18,
      radiusKm: 55,
      minutesAgo: 11,
    }),

    // =========================================================================
    // 🏰 WEITERE UNTERIRDISCHE KOMMANDOBUNKER & SCHWEIZER ALPENFESTUNGEN
    // =========================================================================
    pointFeature({
      name: '🏰 Artilleriewerk Festung Ebersberg („Rüdlingen“ — Hochrhein / Schaffhausen, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Schaffhausen / Zürcher Weinland)',
      details:
        'Unterirdische Schweizer Grenzbefestigung (A 5438) mit verbunkerten 12-cm-Festungsminenwerfern und Beobachtungskuppeln hoch über dem Rhein',
      lat: 47.5755,
      lon: 8.5678,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Waldbrand & Beatenberg (Thunersee / Berner Oberland, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Berner Oberland / Reduit-Nordwand)',
      details:
        'Großes unterirdisches Schweizer Reduit-Artilleriewerk (A 1880) im Felsmassiv über dem Thunersee zur Sperrung der Berner Alpenzugänge',
      lat: 46.6945,
      lon: 7.7522,
      radiusKm: 0,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Grimsel (A 8900 — Grimselpass, Berner Oberland/Wallis, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Grimselpass / Zentralalpen)',
      details:
        'Hochalpines Schweizer Fels-Artilleriewerk (2.100 m ü. M.) direkt gegenüber der Staumauer Grimselsee mit sechs 10,5-cm-Festungskanonen im Granit',
      lat: 46.5685,
      lon: 8.3342,
      radiusKm: 0,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Follatères (Dorénaz / Martigny, Rhonetal-Knie, Wallis, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Wallis / Festungsgebiet Saint-Maurice)',
      details:
        'Mehrstöckige Felsenfestung im Bergmassiv am Rhoneknie bei Martigny zur Abriegelung des Zugangs zum Großen St. Bernhard und Simplon',
      lat: 46.1292,
      lon: 7.0545,
      radiusKm: 0,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Forte Airolo & Foppa Grande (Gotthard-Südportal, Tessin, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Tessin / Gotthard-Südflanke)',
      details:
        'Schwer gepanzertes Schweizer Festungswerk mit Panzerdrehtürmen und unterirdischen Stollensystemen am Südportal des Gotthardtunnels',
      lat: 46.5268,
      lon: 8.5912,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏰 Artilleriewerk Festung Tschingel & Festung Ansstein (Sarganserland / Walensee, Schweiz)',
      kind: 'bunker',
      theater: 'Schweiz (Sarganserland / Zugang St. Galler Rheintal)',
      details:
        'Felsenfestungen der Festung Sargans zur artilleristischen Sperrung des Seeztals, des Walensees und des südlichen St. Galler Rheintals',
      lat: 47.1255,
      lon: 9.3542,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏰 Greenbrier Bunker („Project Greek Island“ — US-Kongress-Atombunker, West Virginia, USA)',
      kind: 'bunker',
      theater: 'USA (West Virginia)',
      details:
        'Tiefbunker-Anlage (10.450 m², 25-Tonnen-Druckschutztore) zur Notaufnahme des gesamten US-Senats und Repräsentantenhauses im Nuklearkriegsfall',
      lat: 37.785,
      lon: -80.308,
      radiusKm: 35,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🏰 Taverny Underground Nuclear Air Command Bunker (Montmorency / Paris, Frankreich)',
      kind: 'bunker',
      theater: 'Frankreich (Île-de-France / Paris Nord)',
      details:
        'Unterirdisches Hauptquartier der französischen strategischen Nuklearluftstreitkräfte (FAS) und der nationalen Luftverteidigung in 70 m Tiefe',
      lat: 49.032,
      lon: 2.228,
      radiusKm: 35,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏰 Mount Taibai („Basis 67“) Zentraler Nuklearsprengkopf-Tiefbunker (Qinling-Gebirge / Baoji, China)',
      kind: 'bunker',
      theater: 'China (Shaanxi / Qinling-Alpen)',
      details:
        'Zentrales unterirdisches Hochsicherheits-Depot und technisches Kommandozentrum („Base 67“) für Chinas strategisches Nuklearsprengkopf-Arsenal',
      lat: 33.95,
      lon: 107.76,
      radiusKm: 45,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🏰 Taipeh „Hengshan“ Underground Joint Operations Command Center (Dazhi, Taiwan)',
      kind: 'bunker',
      theater: 'Taiwan (Taipeh Nord)',
      details:
        'Tief im Bergmassiv von Dazhi ausgehöhlter nationaler Kriegsführungsbunker des taiwanesischen Verteidigungsministeriums und Generalstabs',
      lat: 25.085,
      lon: 121.548,
      radiusKm: 35,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏰 Chiashan Unterirdische Kampfjet-Felsenkaverne (Hualien, Ost-Taiwan)',
      kind: 'bunker',
      theater: 'Taiwan (Hualien / Pazifikküste)',
      details:
        'Riesiger unterirdischer Kavernen-Fliegerhorst im Zentralgebirge von Hualien zum bombensicheren Schutz von bis zu 200 Kampfflugzeugen (F-16V)',
      lat: 24.028,
      lon: 121.615,
      radiusKm: 35,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏰 Command Post „Tango“ (CP TANGO — US/ROK Kriegsführungsbunker, Seongnam, Südkorea)',
      kind: 'bunker',
      theater: 'Südkorea (Südlich von Seoul)',
      details:
        'Atombombensicherer Granit-Tiefbunker des Combined Forces Command (CFC) von USA und Südkorea für den Verteidigungsfall auf der Halbinsel',
      lat: 37.432,
      lon: 127.105,
      radiusKm: 35,
      minutesAgo: 12,
    }),

    // =========================================================================
    // 🏛️ WEITERE MILITÄRBASEN & 🧬 NUKLEAR-/BIOWAFFEN-FORSCHUNGSZENTREN
    // =========================================================================
    pointFeature({
      name: '🏛️ Spangdahlem Air Base (USAF 52nd Fighter Wing, Eifel, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Rheinland-Pfalz / Eifel)',
      details:
        'US Air Force Einsatzbasis des 52nd Fighter Wing (F-16CM Fighting Falcon SEAD/DEAD-Staffeln zur Unterdrückung feindlicher Flugabwehr)',
      lat: 49.972,
      lon: 6.692,
      radiusKm: 0,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ NATO Air Base Geilenkirchen (E-3A AWACS Hauptbasis, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Nordrhein-Westfalen)',
      details:
        'Haupteinsatzbasis der multinationalen NATO Airborne Early Warning & Control Force (E-3A Sentry AWACS Luftraumüberwachungsflotte)',
      lat: 50.961,
      lon: 6.042,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Neuburg & WTD 61 Manching (Eurofighter QRA Süd, Bayern, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Bayern)',
      details:
        'Standort des Taktischen Luftwaffengeschwaders 74 (Alarmrotte Süd / Eurofighter Typhoon) und der Wehrtechnischen Dienststelle 61 (Flugerprobung)',
      lat: 48.711,
      lon: 11.211,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Jagel (TaktLwG 51 „Immelmann“, Schleswig-Holstein, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Schleswig-Holstein)',
      details:
        'Stützpunkt für taktische Luftaufklärung, elektronischen Kampf (Tornado ECR) und künftige Heron-TP- sowie Eurofighter-EK-Verbände',
      lat: 54.459,
      lon: 9.516,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Vogler (Hörsching / Linz, Österreichisches Bundesheer)',
      kind: 'military_base',
      theater: 'Österreich (Oberösterreich)',
      details:
        'Größter Luftwaffenstützpunkt Österreichs (Luftunterstützungsgeschwader, C-130 Hercules / Embraer C-390M Transportflieger & AB-212 Hubschrauber)',
      lat: 48.233,
      lon: 14.187,
      radiusKm: 0,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏛️ Schwarzenbergkaserne (Wals-Siezenheim / Salzburg — Größte Kaserne Österreichs)',
      kind: 'military_base',
      theater: 'Österreich (Salzburg)',
      details:
        'Flächengrößte Garnison des Österreichischen Bundesheeres mit Pionier-, Jäger- und Luftraumüberwachungsverbänden',
      lat: 47.782,
      lon: 12.978,
      radiusKm: 0,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🏛️ Militärflugplatz Sion / Sitten & Militärflugplatz Locarno (Schweizer Luftwaffe)',
      kind: 'military_base',
      theater: 'Schweiz (Wallis / Alpen)',
      details:
        'Alpen-Ausweichflugplatz der Schweizer Luftwaffe im Rhonetal für Kampfjet-, Drohnen- und Gebirgstransport-Operationen',
      lat: 46.219,
      lon: 7.327,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ RAF Lakenheath & RAF Mildenhall (USAF F-35A & KC-135 Hauptstützpunkt, UK)',
      kind: 'military_base',
      theater: 'Großbritannien (Suffolk / East Anglia)',
      details:
        'Größter US Air Force Kampfflugzeug- und Luftbetankungsstützpunkt in Großbritannien (48th Fighter Wing F-35A Lightning II & F-15E Strike Eagle)',
      lat: 52.409,
      lon: 0.561,
      radiusKm: 45,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Aviano Air Base (USAF 31st Fighter Wing & B61-12 Nuklear-Standort, Italien)',
      kind: 'military_base',
      theater: 'Italien (Friaul / Südalpen)',
      details:
        'Strategische US-Luftwaffenbasis südlich der Alpen mit F-16CM Staffeln und WS3-Nuklearwaffenlagern (B61-12)',
      lat: 46.032,
      lon: 12.596,
      radiusKm: 45,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ NAS Sigonella & Souda Bay Naval Base (NATO Mittelmeer-Drehkreuz, Sizilien)',
      kind: 'military_base',
      theater: 'Italien (Sizilien / Zentrales Mittelmeer)',
      details:
        'Zentrales NATO-Aufklärungs- und Marinedrehkreuz („Hub of the Med“) für RQ-4B Global Hawk Langstreckendrohnen und P-8A Poseidon Seefernaufklärer',
      lat: 37.402,
      lon: 14.922,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Whiteman Air Force Base (Missouri, USA — B-2 Spirit Stealth-Bomber Heimatbasis)',
      kind: 'military_base',
      theater: 'USA (Missouri — Global Strike Command)',
      details:
        'Weltweit einziger Heimatstützpunkt der strategischen Tarnkappenbomberflotte Northrop Grumman B-2 Spirit (509th Bomb Wing, GBU-57 MOP Bunkerbrecher)',
      lat: 38.73,
      lon: -93.548,
      radiusKm: 50,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Russische Strategische Bomberbasis Olenja (Murmansk / Kola-Halbinsel, Russland)',
      kind: 'military_base',
      theater: 'Russland (Murmansk / Arktis)',
      details:
        'Arktischer Hauptstützpunkt der russischen Fernfliegerkräfte (Tu-95MS Bear, Tu-160 Blackjack & Tu-22M3 Backfire Strategische Bomber)',
      lat: 68.152,
      lon: 33.465,
      radiusKm: 55,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Changi Naval Base (Singapur — US Navy & Indo-Pazifik-Stützpunkt an der Straße von Malakka)',
      kind: 'military_base',
      theater: 'Singapur / Straße von Malakka',
      details:
        'Strategischer Tiefwasser-Marinestützpunkt am östlichen Ausgang der Straße von Malakka mit Liegeplätzen für US-Flugzeugträger und LCS-Kampfschiffe',
      lat: 1.318,
      lon: 104.018,
      radiusKm: 45,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 Sandia National Laboratories & Kirtland Underground Munitions Complex (New Mexico, USA)',
      kind: 'research',
      theater: 'USA (New Mexico)',
      details:
        'US-Nuklearwaffen-Systemtechnikzentrum (Z-Machine Pulsed Power Facility) neben dem größten unterirdischen Atomsprengkopf-Lagerkomplex der USA (KUMMSC)',
      lat: 35.048,
      lon: -106.542,
      radiusKm: 40,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🧬 Oak Ridge National Laboratory & Y-12 National Security Complex (Tennessee, USA)',
      kind: 'research',
      theater: 'USA (Tennessee)',
      details:
        'Zentrale US-Anlage für hochangereichertes Uran (HEU), Sekundärstufen-Produktion thermonuklearer Sprengköpfe und Exascale-Supercomputing (Frontier)',
      lat: 35.985,
      lon: -84.253,
      radiusKm: 40,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Pantex Plant (US Nuclear Weapons Assembly & Disassembly Facility, Amarillo, Texas, USA)',
      kind: 'research',
      theater: 'USA (Texas)',
      details:
        'Einzige Endmontage-, Wartungs- und Demontageanlage für sämtliche Nuklearsprengköpfe und Atombomben des US-Arsenals',
      lat: 35.318,
      lon: -101.559,
      radiusKm: 40,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Tonopah Test Range („Area 52“ — Stealth- & B61-12 Nuklear-Testgelände, Nevada, USA)',
      kind: 'research',
      theater: 'USA (Nevada)',
      details:
        'Hochgeheimes Testgelände im Nevada Test and Training Range (ehemalige F-117 Nighthawk Basis, Erprobung von B61-12 Nuklearbomben und Hyperschallsystemen)',
      lat: 37.795,
      lon: -116.778,
      radiusKm: 45,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 Sneschinsk (Tscheljabinsk-70 / VNIITF — Russisches Bundes-Nuklearwaffenzentrum, Ural)',
      kind: 'research',
      theater: 'Russland (Tscheljabinsk / Ural)',
      details:
        'Geschlossene Atomstadt (ZATO) und Allrussisches Wissenschaftliches Forschungsinstitut für Technische Physik (Design von U-Boot- und ICBM-Nuklearsprengköpfen)',
      lat: 56.085,
      lon: 60.732,
      radiusKm: 45,
      minutesAgo: 15,
    }),
    pointFeature({
      name: '🧬 Nyonoksa / Sewerodwinsk („Sopka-2“ — Russisches Burewestnik- & Poseidon-Testzentrum)',
      kind: 'research',
      theater: 'Russland (Archangelsk / Weißes Meer)',
      details:
        'Maritimes Raketen- und Nuklearantriebs-Testgelände der russischen Nordflotte (Zirkon-Hyperschallraketen, Burewestnik & Poseidon-Nukleartorpedos)',
      lat: 64.648,
      lon: 39.185,
      radiusKm: 45,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🧬 Lop Nur Nuklearwaffen-Testgelände & China Academy of Engineering Physics (Xinjiang, China)',
      kind: 'research',
      theater: 'China (Xinjiang / Taklamakan)',
      details:
        'Chinas strategisches unterirdisches Nuklearwaffen-Testgelände mit ausgebauten Vertikalschächten, Horizontaltunneln und einem 5-km-Raumgleiter-Landestreifen',
      lat: 41.55,
      lon: 88.7,
      radiusKm: 55,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Punggye-ri Nuklearwaffen-Testgelände (Mantapsan, Nordkorea)',
      kind: 'research',
      theater: 'Nordkorea (Kilju / Nord-Hamgyong)',
      details:
        'Unterirdisches nordkoreanisches Atomtestgelände im Bergmassiv Mantapsan (Standort aller sechs nordkoreanischen Kernwaffentests inkl. Thermonukleartest)',
      lat: 41.278,
      lon: 129.085,
      radiusKm: 45,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🧬 CEA Valduc (Französisches Nuklearsprengkopf-Forschungszentrum, Côte-d’Or, Frankreich)',
      kind: 'research',
      theater: 'Frankreich (Burgund)',
      details:
        'Hochsicherheits-Forschungs- und Produktionszentrum der Direction des Applications Militaires (CEA/DAM) für französische TNA/TNO-Kernsprengköpfe (Epure-Röntgenblitzanlage)',
      lat: 47.575,
      lon: 4.888,
      radiusKm: 35,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Atomic Weapons Establishment (AWE Aldermaston — Britische Nuklearsprengkopf-Forschung, UK)',
      kind: 'research',
      theater: 'Großbritannien (Berkshire)',
      details:
        'Britisches Entwicklungs-, Fertigungs- und Wartungszentrum für die nuklearen Gefechtsköpfe der Royal-Navy-Trident-U-Boote',
      lat: 51.368,
      lon: -1.148,
      radiusKm: 35,
      minutesAgo: 14,
    }),
    pointFeature({
      name: '🧬 Paul Scherrer Institut (PSI) & Nuklearforschung Würenlingen / Villigen (Aargau, Schweiz)',
      kind: 'research',
      theater: 'Schweiz (Aargau / Untere Aare)',
      details:
        'Größtes Forschungsinstitut für Natur- und Ingenieurwissenschaften der Schweiz (Teilchenbeschleuniger, Spallations-Neutronenquelle SINQ, Schweizer Freiluft-Röntgenblitzanlage & Hotlabor)',
      lat: 47.5365,
      lon: 8.2228,
      radiusKm: 0,
      minutesAgo: 11,
    }),
    // =========================================================================
    // 🛡️ STRATEGISCHE FRÜHWARNRADARE, ABM-KOMPLEXE & KOMMANDOKNOTEN (+15 NEU)
    // =========================================================================
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-DM“ Armawir (Krasnodar, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Krasnodar / Nordkaukasus)',
      details:
        'Strategisches UHF-Phased-Array-Frühwarnradar (bis 6.000 km Reichweite) zur Überwachung des Schwarzen Meeres, des Nahen Ostens und Südeuropas',
      lat: 44.925,
      lon: 40.984,
      radiusKm: 110,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-M“ Lechtussi (St. Petersburg, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Leningrad / Nordwest-Sektor)',
      details:
        'VHF-Phased-Array-Raketenfrühwarnradar der russischen Weltraumtruppen zur Überwachung des Nordatlantiks, Skandinaviens und der NATO-Nordflanke',
      lat: 60.275,
      lon: 30.546,
      radiusKm: 110,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-DM“ Pionerski (Kaliningrad, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Kaliningrad / Ostsee)',
      details:
        'Strategisches UHF-Frühwarnradar auf dem Fliegerhorst Dunajewka/Pionerski zur lückenlosen Erfassung von Raketenstarts und Weltraumobjekten über ganz West- und Mitteleuropa',
      lat: 54.857,
      lon: 20.182,
      radiusKm: 110,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-M“ Orsk (Süd-Ural / Orenburg, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Orenburg / Süd-Ural)',
      details:
        'Strategisches Raketenfrühwarnradar (6.000 km Erfassungsbereich) für den Sektor Zentralasien, Indischer Ozean und Persischer Golf',
      lat: 51.274,
      lon: 58.959,
      radiusKm: 110,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-DM“ Jenisseisk (Krasnojarsk / Sibirien, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Krasnojarsk / Zentralsibirien)',
      details:
        'Hochleistungs-Phased-Array-Frühwarnradar zur Überwachung polarer ICBM-Flugbahnen über der Arktis und Nordostasien',
      lat: 58.506,
      lon: 92.046,
      radiusKm: 110,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ Russisches Überhorizont-Radar 29B6 „Konteyner“ Kowylkino (Mordwinien, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Mordwinien / Wolga-Föderationskreis)',
      details:
        'Bistatisches Kurzwellen-Überhorizontradar (OTH-B, >3.000 km Reichweite) zur Früherkennung von Marschflugkörpern, Tarnkappenflugzeugen und Hyperschallzielen über Europa',
      lat: 53.984,
      lon: 43.843,
      radiusKm: 120,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ Russisches Arktis-Frühwarnradar „Darjal / Woronesch-VP“ Olenegorsk (Murmansk / Kola-Halbinsel)',
      kind: 'air_defense',
      theater: 'Russland (Murmansk / Kola-Halbinsel)',
      details:
        'Strategischer Raketenfrühwarn-Radarkomplex auf der Kola-Halbinsel zur Überwachung der GIUK-Lücke, des Nordpolarmeeres und von SLBM-Starts im Nordatlantik',
      lat: 68.114,
      lon: 33.91,
      radiusKm: 115,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Darjal“ Petschora (Republik Komi / Nord-Ural, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Republik Komi / Arktis-Korridor)',
      details:
        'Schweres bistatisches Phased-Array-Frühwarnradar für den transpolaren ICBM-Anflugkorridor',
      lat: 65.21,
      lon: 57.295,
      radiusKm: 115,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ Cavalier Space Force Station — AN/FPQ-16 PARCS Perimeter Acquisition Radar (North Dakota, USA)',
      kind: 'air_defense',
      theater: 'USA (North Dakota / NORAD Nordsektor)',
      details:
        'Leistungsfähigstes einseitiges Phased-Array-Radar der US Space Force zur Verfolgung polarer ICBM-Gefechtsköpfe und tausender Weltraumobjekte im Erdorbit',
      lat: 48.724,
      lon: -97.899,
      radiusKm: 115,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ Chinesisches Groß-Phased-Array-Frühwarnradar (LPAR) Yiyuan / Mount Xueshan (Shandong, China)',
      kind: 'air_defense',
      theater: 'China (Shandong / Ostchina)',
      details:
        'Doppelseitiges strategisches Groß-Phased-Array-Frühwarnradar (LPAR) der PLA zur Raketenfrühwarnung über der Koreanischen Halbinsel, Japan und dem Westpazifik',
      lat: 36.125,
      lon: 118.085,
      radiusKm: 110,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🛡️ Chinesisches Strategisches LPAR-Frühwarnradar Lintong / Mount Lishan (Shaanxi, China)',
      kind: 'air_defense',
      theater: 'China (Shaanxi / Zentralchina)',
      details:
        'Strategische PLA-Raketenfrühwarn- und Weltraumüberwachungs-Radarstation im Lishan-Gebirge östlich von Xi’an',
      lat: 34.335,
      lon: 109.265,
      radiusKm: 110,
      minutesAgo: 13,
    }),
    pointFeature({
      name: '🛡️ IAF Regionales Luftraumüberwachungs- & Frühwarnradar „Baal Hatzor“ (Einheit 503, Zentral-Israel)',
      kind: 'air_defense',
      theater: 'Israel (Zentrales Bergland / Östlicher Sektor)',
      details:
        'Höchstgelegene Radar- und Luftführungsstation in Zentral-Israel (1.016 m ü. M.) zur Tiefflug-, Drohnen- und Marschflugkörper-Früherkennung aus östlicher Richtung',
      lat: 31.977,
      lon: 35.278,
      radiusKm: 75,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🚀 Strategisches Raketen- & Mittelstrecken-Testgelände Kapustin Jar („Oreschnik“ / Iskander / S-500, Astrachan, Russland)',
      kind: 'missile_site',
      theater: 'Russland (Astrachan / Unteres Wolgagebiet)',
      details:
        '4. Staatliches Zentrales Interservice-Testgelände (GTsMP): Start- und Erprobungsbasis für russische Mittelstreckenraketen („Oreschnik“ IRBM), Iskander-M und S-500-Abwehrraketen',
      lat: 48.586,
      lon: 45.722,
      radiusKm: 75,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🚀 Strategisches ABM- & Anti-Satelliten-Testzentrum Sary-Schagan (Balchaschsee / Priosersk, Kasachstan)',
      kind: 'missile_site',
      theater: 'Kasachstan / Russland (Balchaschsee)',
      details:
        '10. Staatliches Testgelände der russischen Luft- und Weltraumkräfte: Erprobungszentrum für exo-atmosphärische ABM-Abfangraketen (A-235 Nudol), Pereswet-Laser und Don-2NP-Radare',
      lat: 46.031,
      lon: 73.614,
      radiusKm: 75,
      minutesAgo: 12,
    }),
    pointFeature({
      name: '🏰 Base Aérienne 942 Lyon-Mont Verdun (CNOA — Französischer Unterirdischer Luftverteidigungs-Kommandobunker, Frankreich)',
      kind: 'bunker',
      theater: 'Frankreich (Auvergne-Rhône-Alpes / Lyon)',
      details:
        'Atombombensicherer unterirdischer Kommandobunker des Centre National des Opérations Aériennes (CNOA) und NATO Air Command and Control System (ACCS) im Mont-Verdun-Massiv',
      lat: 45.849,
      lon: 4.784,
      radiusKm: 40,
      minutesAgo: 11,
    }),
    // =========================================================================
    // 🏛️ NORDIC, BALTIC, EUROPEAN & MEDITERRANEAN NATO STRATEGIC BASES (WAVE 13)
    // =========================================================================
    pointFeature({
      name: '🏛️ Bodø Main Air Station & Reitan Joint Headquarters (FOH — Norwegisches Oberkommando & NATO CAOC, Norwegen)',
      kind: 'military_base',
      theater: 'Norwegen (Nordland / Arktis-Polarkreis)',
      details:
        'Operatives Hauptquartier der norwegischen Streitkräfte (Forsvarets operative hovedkvarter) in der unterirdischen Felsenanlage Reitan sowie strategischer NATO-Luftwaffenstützpunkt nördlich des Polarkreises',
      lat: 67.2692,
      lon: 14.3653,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Evenes Air Station (F-35A QRA & P-8A Poseidon Seefernaufklärung, Nordnorwegen)',
      kind: 'military_base',
      theater: 'Norwegen (Ofoten / Europäische Arktis)',
      details:
        'Vorgeschobener arktischer NATO-Luftwaffenstützpunkt (133. Luftgeschwader): Heimatbasis der norwegischen P-8A Poseidon U-Boot-Jagdflugzeuge zur Überwachung der Barentssee und F-35A Alarmrotte (QRA)',
      lat: 68.4913,
      lon: 16.6781,
      radiusKm: 50,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Rovaniemi Air Base — Lapland Air Command (F/A-18 Hornet & F-35A, Finnland)',
      kind: 'military_base',
      theater: 'Finnland (Lappland / Polarkreis)',
      details:
        'Nördlichster Haupteinsatzflugplatz der finnischen Luftwaffe (Lapin lennosto / Hävittäjälentolaivue 11) direkt am Polarkreis für F/A-18C/D Hornet und die ersten finnischen F-35A Lightning II',
      lat: 66.5648,
      lon: 25.8304,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Luleå-Kallax Air Base — Norrbotten Wing F 21 (JAS 39 Gripen, Nordschweden)',
      kind: 'military_base',
      theater: 'Schweden (Norrbotten / Bottnischer Meerbusen)',
      details:
        'Strategischer Luftwaffenstützpunkt der schwedischen Luftstreitkräfte (Norrbottens flygflottilj F 21) mit JAS 39C/D/E Gripen Kampfjets zur Verteidigung Nordskandinaviens und des Ostseeraums',
      lat: 65.5438,
      lon: 22.1219,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Keflavik Naval Air Station (GIUK-Lücke P-8A U-Boot-Jagd & NATO Iceland Air Policing, Island)',
      kind: 'military_base',
      theater: 'Island / Nordatlantik (GIUK-Lücke)',
      details:
        'Schlüsselstützpunkt der NATO im Nordatlantik zur Überwachung der Grönland-Island-UK-Lücke (GIUK Gap) gegen russische Atom-U-Boote (US Navy P-8A Poseidon & rotierende NATO-Abfangjäger)',
      lat: 63.985,
      lon: -22.6056,
      radiusKm: 55,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Ämari Air Base (NATO Baltic Air Policing & Estnische Luftwaffe, Estland)',
      kind: 'military_base',
      theater: 'Estland / Baltikum (Finnischer Meerbusen)',
      details:
        'Vorgeschobener NATO-Luftverteidigungsstützpunkt für das Baltic Air Policing (QRA-Abfangjäger) und das Control and Reporting Centre zur Überwachung des Finnischen Meerbusens',
      lat: 59.2603,
      lon: 24.2085,
      radiusKm: 40,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Šiauliai Air Base (NATO Baltic Air Policing Hauptstützpunkt, Litauen)',
      kind: 'military_base',
      theater: 'Litauen / Baltikum (NATO-Ostflanke)',
      details:
        'Wichtigster Einsatzhorst der NATO Baltic Air Policing Mission zum Schutz des baltischen Luftraums nahe Kaliningrad und Belarus, geschützt durch NASAMS-III-Luftabwehr',
      lat: 55.8939,
      lon: 23.395,
      radiusKm: 45,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Łask Air Base — 32. Taktischer Fliegerhorst (F-16C/D & F-35A „Husarz“, Polen)',
      kind: 'military_base',
      theater: 'Polen (Woiwodschaft Łódź / Zentralpolen)',
      details:
        'Zentraler polnischer NATO-Kampfjetstützpunkt (32. Baza Lotnictwa Taktycznego) für F-16 Block 52+, erste polnische F-35A „Husarz“ Tarnkappenjets sowie US Air Force Rotationsstaffeln',
      lat: 51.5517,
      lon: 19.1791,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ RAF Lossiemouth (Eurofighter Typhoon QRA Nord, P-8A Poseidon & E-7 Wedgetail, Schottland, UK)',
      kind: 'military_base',
      theater: 'Großbritannien (Schottland / Nordatlantik-Sektor)',
      details:
        'Strategischer Haupteinsatzhorst der Royal Air Force für die nördliche Quick Reaction Alert (Typhoon FGR4), alle britischen P-8A Poseidon Seefernaufklärer und E-7 Wedgetail AWACS',
      lat: 57.7052,
      lon: -3.3392,
      radiusKm: 50,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ RAF Coningsby (Eurofighter Typhoon QRA Südsektor, England, UK)',
      kind: 'military_base',
      theater: 'Großbritannien (Lincolnshire / Nordsee-Sektor)',
      details:
        'Südlicher Haupteinsatzhorst der britischen Eurofighter-Typhoon-Flotte (No. 3 & XI Fighter Squadrons) für die Luftraumverteidigung Großbritanniens und der südlichen Nordsee',
      lat: 53.093,
      lon: -0.166,
      radiusKm: 45,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Volkel Air Base (RNLAF F-35A Lightning II & NATO Nukleare Teilhabe, Niederlande)',
      kind: 'military_base',
      theater: 'Niederlande (Nordbrabant)',
      details:
        'Haupteinsatzbasis der Königlich Niederländischen Luftwaffe (312. & 313. Staffel F-35A Lightning II) sowie Standort von US B61-12 Nuklearwaffen (703rd Munitions Support Squadron)',
      lat: 51.6564,
      lon: 5.7086,
      radiusKm: 40,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Kleine Brogel Air Base (10. Taktisches Geschwader F-16 / F-35A & NATO Nukleare Teilhabe, Belgien)',
      kind: 'military_base',
      theater: 'Belgien (Limburg)',
      details:
        'Strategischer belgischer Luftwaffenstützpunkt (10th Tactical Wing F-16AM/BM & F-35A) und Standort des USAF 701st Munitions Support Squadron für die nukleare Abschreckung der NATO',
      lat: 51.1683,
      lon: 5.47,
      radiusKm: 40,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🏛️ Base Aérienne 125 Istres-Le Tubé (Forces Aériennes Stratégiques & A330 MRTT Phénix, Frankreich)',
      kind: 'military_base',
      theater: 'Frankreich (Provence / Mittelmeer)',
      details:
        'Strategische Großbasis der französischen Nuklearstreitkräfte (FAS): Heimatbasis der gesamten A330 MRTT „Phénix“ Tankerflotte, nuklearer Rafale-B-Einsätze und einer 5.000-Meter-Startbahn',
      lat: 43.5236,
      lon: 4.9242,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ NSA Souda Bay & Marathi Deepwater Carrier Pier (NATO Marine- & Luftstützpunkt Kreta, Griechenland)',
      kind: 'military_base',
      theater: 'Griechenland (Kreta / Östliches Mittelmeer)',
      details:
        'Einziger Tiefwasser-Flugzeugträgerkai (Marathi Pier) der US Navy und NATO im östlichen Mittelmeer, kombiniert mit dem Luftwaffenstützpunkt des 115. Griechischen Kampfgeschwaders (F-16V) und RC-135/P-8A Aufklärung',
      lat: 35.4919,
      lon: 24.1481,
      radiusKm: 50,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ RAF Akrotiri & Cape Gata PLUTO II OTH-Radar (Sovereign Base Area, Zypern)',
      kind: 'military_base',
      theater: 'Zypern / Östliches Mittelmeer (Levante)',
      details:
        'Strategischer britischer Luftwaffen- und SIGINT-Aufklärungsstützpunkt (903 Expeditionary Air Wing Typhoon FGR4, Voyager KC3, RC-135W Rivet Joint & PLUTO II Überhorizontradar)',
      lat: 34.5904,
      lon: 32.9879,
      radiusKm: 50,
      minutesAgo: 6,
    }),
    // =========================================================================
    // 🏛️ WAVE 16: STRATEGIC MILITARY BASES, NAVAL BASES, AIR DEFENSE & SPACE/RADAR SITES (+12)
    // =========================================================================
    pointFeature({
      name: '🏛️ Naval Station Rota (US Navy Aegis BMD Destroyer Squadron 60 & NATO-Marinestützpunkt Cádiz, Spanien)',
      kind: 'military_base',
      theater: 'Spanien (Cádiz / Straße von Gibraltar — Atlantik-Mittelmeer-Tor)',
      details:
        'Strategischer US/Spanischer Marine- und Luftwaffenstützpunkt am westlichen Zugang zur Straße von Gibraltar: Heimathafen der vorgeschobenen US Navy Arleigh-Burke-Klasse Aegis-BMD-Raketenabwehrzerstörer (DESRON 60) sowie der spanischen Flugzeugträger-/Amphibienflotte (Juan Carlos I)',
      lat: 36.6236,
      lon: -6.3314,
      radiusKm: 50,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Ghedi Air Base — 6° Stormo „Diavoli Rossi“ (F-35A Lightning II & NATO Nukleare Teilhabe B61-12, Italien)',
      kind: 'military_base',
      theater: 'Italien (Lombardei / Brescia — Südalpen-Sektor)',
      details:
        'Haupteinsatzbasis des 6. Geschwaders der italienischen Luftwaffe (F-35A Lightning II Tarnkappenjets & Tornado IDS/ECR) sowie Standort des USAF 704th Munitions Support Squadron mit unterirdischen WS3-Vaults für taktische US B61-12 Nuklearbomben',
      lat: 45.4319,
      lon: 10.2786,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Mihail Kogălniceanu Air Base (NATO Black Sea Air Policing & US Southeastern Europe Hub, Constanța, Rumänien)',
      kind: 'military_base',
      theater: 'Rumänien (Dobrudscha / Westliches Schwarzes Meer)',
      details:
        'Wichtigster vorgeschobener NATO-Luftwaffen- und Heeresstützpunkt an der Schwarzmeerküste (57. Rumänische Luftwaffenbasis, NATO Enhanced Air Policing Kampfjets, US Army Rotationsbrigaden & MQ-9 Reaper Schwarzmeer-Aufklärung)',
      lat: 44.3622,
      lon: 28.4883,
      radiusKm: 50,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Haakonsvern Naval Base (Hauptstützpunkt der Königlich Norwegischen Marine & NATO Nordatlantik-U-Boot-Basis, Bergen)',
      kind: 'military_base',
      theater: 'Norwegen (Vestland / Nordsee – Nordatlantik)',
      details:
        'Größter Marinestützpunkt Skandinaviens und zentraler NATO-Logistikknoten für alliierte Atom-U-Boote, Fridtjof-Nansen-Klasse Aegis-Fregatten und Ula-/Typ-212CD-Jagd-U-Boote inklusive in den Fels gesprengter Trockendocks',
      lat: 60.3389,
      lon: 5.2308,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Muskö Underground Naval Base (Schwedische Unterirdische Felsen-Marinebasis & Ostsee-Flottenkommando, Schweden)',
      kind: 'military_base',
      theater: 'Schweden (Stockholmer Schärengarten / Zentrale Ostsee)',
      details:
        'Gigantischer atombombensicherer unterirdischer Marine- und Werftkomplex direkt im Granitfels der Insel Muskö (über 20 km Tunnelnetz, unterirdische Schiffsdocks für Gotland-Klasse U-Boote und Visby-Stealth-Korvetten sowie Führungszentrale der schwedischen Marine)',
      lat: 58.9958,
      lon: 18.1256,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Base Navale de Toulon (Hauptstützpunkt der Französischen Mittelmeerflotte & SNA Atom-Jagd-U-Boote, Frankreich)',
      kind: 'military_base',
      theater: 'Frankreich (Provence-Alpes-Côte d’Azur / Westliches Mittelmeer)',
      details:
        'Größter Marinestützpunkt Frankreichs: Heimathafen des nukleargetriebenen Flugzeugträgers FS Charles de Gaulle (R91), sämtlicher 6 französischen Atom-Jagd-U-Boote (Suffren- & Rubis-Klasse SNA) sowie der Horizon- und FREMM-Luftabwehrfregatten',
      lat: 43.1167,
      lon: 5.9125,
      radiusKm: 50,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ INS Kadamba / Project Seabird (Karwar — Indiens Größte Strategische Tiefwasser-Marinebasis, Indien)',
      kind: 'military_base',
      theater: 'Indien (Karnataka / Arabisches Meer)',
      details:
        'Strategischer Großstützpunkt der indischen Westflotte (Project Seabird) für Flugzeugträger (INS Vikramaditya / INS Vikrant), Kalvari-Klasse U-Boote und Lenkwaffenzerstörer zur Kontrolle der Seewege im Indischen Ozean',
      lat: 14.7644,
      lon: 74.1489,
      radiusKm: 50,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🏛️ RAAF Base Tindal (USAF B-52H Bomber Task Force & RAAF F-35A Indo-Pazifik-Stützpunkt, Australien)',
      kind: 'military_base',
      theater: 'Australien (Northern Territory / Timorsee – Indo-Pazifik)',
      details:
        'Strategischer Luftwaffenstützpunkt im Norden Australiens (RAAF No. 75 Squadron F-35A Lightning II, MQ-4C Triton Seefernaufklärungsdrohnen & ausgebaute Vorfeld-/Treibstoffinfrastruktur für rotierende US Air Force B-52H Stratofortress Langstreckenbomber)',
      lat: -14.5214,
      lon: 132.3778,
      radiusKm: 55,
      minutesAgo: 10,
    }),
    pointFeature({
      name: '🛡️ Taiwan Leshan PAVE PAWS (AN/FPS-115) Hochgebirgs-Frühwarnradar (2.620 m ü. M., Hsinchu/Miaoli, Taiwan)',
      kind: 'air_defense',
      theater: 'Taiwan (Zentralgebirge Hsinchu / Taiwanstraße)',
      details:
        'Strategisches dreiseitiges UHF-Phased-Array-Frühwarnradar (AN/FPS-115 PAVE PAWS) auf 2.620 m Gipfelhöhe mit 5.000 km Erfassungsreichweite zur Echtzeit-Detektion von ballistischen Raketenstarts, Hyperschallgleitern und Marschflugkörpern tief im chinesischen Festland',
      lat: 24.4986,
      lon: 121.0714,
      radiusKm: 110,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ Globus II / III („Have Stare“) Strategisches Weltraum- & Raketenfrühwarnradar Vardø (Finnmark, Norwegen)',
      kind: 'air_defense',
      theater: 'Norwegen (Finnmark / Barentssee — 30 km vor Kola-Halbinsel)',
      details:
        'Hocharktischer US/Norwegischer X-Band- und S-Band-Hochleistungs-Radarkomplex (AN/FPS-129 Have Stare & Globus III) auf der Insel Vardø zur Überwachung russischer Nordflotten-Raketenstarts (Bulawa/Zirkon), Weltraumobjekte und polarer ICBM-Flugbahnen',
      lat: 70.3672,
      lon: 31.1269,
      radiusKm: 105,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ Russisches Strategisches Frühwarnradar „Woronesch-M“ Usolje-Sibirskoje / Mischteljowka (Irkutsk, Russland)',
      kind: 'air_defense',
      theater: 'Russland (Irkutsk / Ostsibirien – Baikalsee-Sektor)',
      details:
        'Zweiseitiges strategisches VHF-Phased-Array-Raketenfrühwarnradar (6.000 km Reichweite) der russischen Weltraumtruppen zur Überwachung des gesamten asiatisch-pazifischen Raums von China bis zur US-Westküste',
      lat: 52.8556,
      lon: 103.2319,
      radiusKm: 110,
      minutesAgo: 11,
    }),
    pointFeature({
      name: '🛡️ Chinesisches Strategisches Groß-Phased-Array-Frühwarnradar (LPAR) & ABM-Testkomplex Korla (Xinjiang, China)',
      kind: 'air_defense',
      theater: 'China (Xinjiang / Zentralasiatischer Sektor)',
      details:
        'Strategischer PLA-Raketenfrühwarn-Radarkomplex (LPAR) kombiniert mit Chinas wichtigstem Test- und Abfangzentrum für exo-atmosphärische Midcourse-Raketenabwehr (HQ-19 / DN-2 / DN-3 Anti-Satelliten- & ABM-Abfangraketen)',
      lat: 41.6528,
      lon: 86.175,
      radiusKm: 110,
      minutesAgo: 10,
    }),
    // =========================================================================
    // 🏛️ WAVE 19: STRATEGIC MILITARY BASES, SUBMARINE BASES, AIR DEFENSE & RADAR SITES (+10)
    // =========================================================================
    pointFeature({
      name: '🏛️ HMNB Clyde — Faslane Nuclear Submarine Base & Coulport Trident Warhead Depot (Schottland, UK)',
      kind: 'military_base',
      theater: 'Großbritannien (Schottland / Firth of Clyde — Nordatlantik-Zugang)',
      details:
        'Heimatbasis der gesamten britischen Nuklearabschreckung (Continuous At-Sea Deterrence): Stützpunkt aller 4 Vanguard-Klasse SSBN-Atom-U-Boote (Trident II D5) und der Astute-Klasse Jagd-U-Boote sowie des unterirdischen Nuklearsprengkopf-Depots RNAD Coulport',
      lat: 56.0669,
      lon: -4.8194,
      radiusKm: 50,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🏛️ Île Longue Strategic Nuclear Submarine Base (FOST SNLE Triomphant-Klasse & M51 SLBM, Brest, Frankreich)',
      kind: 'military_base',
      theater: 'Frankreich (Bretagne / Rade de Brest — Atlantik)',
      details:
        'Hochgesicherte Halbinsel-Basis der französischen Force Océanique Stratégique (FOST): Heimathafen aller 4 nuklearen Raketen-U-Boote der Triomphant-Klasse (SNLE mit M51.3 Interkontinentalraketen), geschützt durch verbunkerte Trockendocks und Pyrotechnik-Kavernen',
      lat: 48.3056,
      lon: -4.5075,
      radiusKm: 50,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Ørland Main Air Station (RNorAF F-35A Hauptkampfflugplatz & NATO AWACS Forward Operating Base, Norwegen)',
      kind: 'military_base',
      theater: 'Norwegen (Trøndelag / Norwegische See – Nordatlantik)',
      details:
        'Zentraler Kampfjet-Haupteinsatzhorst der Königlich Norwegischen Luftwaffe (132. Luftgeschwader mit sämtlichen norwegischen F-35A Lightning II), geschützt durch NASAMS-III-Luftabwehr und NATO E-3A AWACS Forward Operating Base',
      lat: 63.6989,
      lon: 9.6039,
      radiusKm: 50,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Pirkkala / Tampere Air Base — Satakunta Air Command (Finnische Luftwaffe F/A-18C/D & F-35A Hub, Finnland)',
      kind: 'military_base',
      theater: 'Finnland (Pirkanmaa / Südwestfinnland – Ostsee)',
      details:
        'Strategischer Haupteinsatzhorst des Satakunta-Luftkommandos der finnischen Luftstreitkräfte (Satakunnan lennosto), Zentrum für elektronische Kampfführung, Aufklärung und US-DCA-Kooperationsstützpunkt im Ostseeraum',
      lat: 61.4142,
      lon: 23.6044,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Amendola Air Base — 32° Stormo (Italienische F-35A/B Lightning II & MQ-9A Reaper Haupteinsatzbasis, Apulien, Italien)',
      kind: 'military_base',
      theater: 'Italien (Apulien / Adria – Zentrales Mittelmeer)',
      details:
        'Erster europäischer Einsatzhorst für F-35A und STOVL-fähige F-35B Tarnkappenkampfjets (13° Gruppo) sowie Haupteinsatzbasis der italienischen MQ-9A Predator-B/Reaper Langstrecken-Aufklärungsdrohnen (28° Gruppo)',
      lat: 41.5414,
      lon: 15.7181,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Andravida Air Base — 117th Combat Wing & Fighter Weapons School (F-4E AUP & F-35A Zukunftshorst, Griechenland)',
      kind: 'military_base',
      theater: 'Griechenland (Peloponnes / Ionisches Meer – Mittelmeer)',
      details:
        'Strategischer Luftwaffenstützpunkt der griechischen Luftstreitkräfte auf dem westlichen Peloponnes (Hellenic Air Tactics Center, Gastgeber der multinationalen Großübung INIOCHOS und designierter Heimatstützpunkt der griechischen F-35A-Flotte)',
      lat: 37.9208,
      lon: 21.2925,
      radiusKm: 45,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🛡️ US Aegis Ashore Ballistic Missile Defense System Deveselu (NSF Deveselu SM-3 Block IB/IIA, Rumänien)',
      kind: 'air_defense',
      theater: 'Rumänien (Olt / Walachei — NATO Südostflanke BMD)',
      details:
        'Operativer landgestützter US/NATO Aegis-Ashore-Raketenabwehrkomplex (AN/SPY-1D(V) Phased-Array-Radar & 24× Mk 41 VLS-Silos mit RIM-161 Standard Missile 3 Abfangraketen) zur exo-atmosphärischen Abwehr ballistischer Mittelstreckenraketen',
      lat: 44.0764,
      lon: 24.4158,
      radiusKm: 120,
      minutesAgo: 6,
    }),
    pointFeature({
      name: '🛡️ NATO Kürecik Early Warning Radar Base (AN/TPY-2 X-Band Ballistic Missile Defense Radar, Malatya, Türkei)',
      kind: 'air_defense',
      theater: 'Türkei (Ostanatolien / Malatya — 2.085 m ü. M.)',
      details:
        'Vorgeschobene hochalpine US/NATO-Raketenfrühwarn-Radarstation (Raytheon AN/TPY-2 X-Band-Radar in Forward-Based-Mode) zur sofortigen Erfassung und Bahnverfolgung ballistischer Raketenstarts im Nahen Osten für die Aegis-Ashore-Batterien in Deveselu und Redzikowo',
      lat: 38.3489,
      lon: 37.7936,
      radiusKm: 115,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🛡️ RAF Fylingdales — AN/FPS-132 Upgraded Early Warning Radar (BMEWS Solid-State Phased Array, North Yorkshire, UK)',
      kind: 'air_defense',
      theater: 'Großbritannien (North Yorkshire / Nordsee – GIUK-Sektor)',
      details:
        'Dreiseitiges 360°-UHF-Festkörper-Phased-Array-Frühwarnradar (AN/FPS-132 UEWR) des US/UK Ballistic Missile Early Warning System (BMEWS) mit 5.000 km Reichweite zur Überwachung von ICBM-/SLBM-Starts und Weltraumobjekten über Europa, der Arktis und dem Nordatlantik',
      lat: 54.3617,
      lon: -0.67,
      radiusKm: 115,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Misawa Air Base (USAF 35th Fighter Wing F-16CM SEAD, US Navy P-8A & JASDF F-35A Nordjapan-Basis, Japan)',
      kind: 'military_base',
      theater: 'Japan (Aomori / Nord-Honshu — Tsugaru-Straße & Nordwestpazifik)',
      details:
        'Strategischer trinationaler Luft- und Seeaufklärungsstützpunkt am Ausgang zur Tsugaru-Straße und zum Ochotskischen Meer: Heimatbasis des USAF 35th Fighter Wing (Wild Weasel SEAD), der ersten japanischen JASDF F-35A-Geschwader (3rd Air Wing) und US Navy P-8A Poseidon U-Boot-Jäger',
      lat: 40.7032,
      lon: 141.3684,
      radiusKm: 55,
      minutesAgo: 10,
    }),
    // =========================================================================
    // 🏛️ WAVE 22: EUROPEAN & ALPINE STRATEGIC MILITARY & DEFENSE BASES (+8)
    // =========================================================================
    pointFeature({
      name: '🏛️ Militärflugplatz Locarno — Magadino (PC-7 Team, Fallschirmaufklärer Compagnia 17 & Helikopterbasis, Tessin, Schweiz)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Tessin / Lago Maggiore – Alpensüdseite)',
      details:
        'Südlicher Haupteinsatzflugplatz der Schweizer Luftwaffe in der Magadinoebene (LSZL): Heimatbasis der Pilatus-PC-7-Pilotenschule, der Fallschirmaufklärerkompanie 17 (KSK) sowie Gebirgs-Helikopterstützpunkt für Super Puma und Rega',
      lat: 46.1608,
      lon: 8.8786,
      radiusKm: 35,
      minutesAgo: 7,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Andermatt & Kompetenzzentrum Gebirgsdienst der Armee (Gotthard-Zentralreduit, Uri, Schweiz)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Uri / Gotthard-Alpenkreuz)',
      details:
        'Traditionsreicher Hochgebirgs-Waffenplatz im Herzen des Gotthard-Massivs (Kompetenzzentrum Gebirgsdienst der Armee Komp Zen Geb DA, hochalpine Gefechtsausbildung, Lawinendienst & unmittelbarer Zugang zu den Reduit-Festungen Bäzberg und Gütsch)',
      lat: 46.6356,
      lon: 8.5944,
      radiusKm: 35,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Waffenplatz Monte Ceneri — Kaserne Rivera (Führungsunterstützungsbasis & Elektronische Kriegsführung Süd, Tessin, Schweiz)',
      kind: 'military_base',
      theater: 'Schweiz (Kanton Tessin / Monte-Ceneri-Pass)',
      details:
        'Strategischer Alpenpass-Waffenplatz der Schweizer Armee auf dem Monte Ceneri (Führungsunterstützungsbrigade 41, Richtstrahl-, Funkaufklärungs- und Cyber-/EKF-Verbände zur Sicherung der Nord-Süd-Alpenachse)',
      lat: 46.1408,
      lon: 8.9189,
      radiusKm: 35,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Brumowski — Langenlebarn (Österreichisches Bundesheer S-70 Black Hawk & Luftunterstützung, Niederösterreich)',
      kind: 'military_base',
      theater: 'Österreich (Niederösterreich / Tullnerfeld – Raum Wien)',
      details:
        'Zentraler Luftwaffenstützpunkt des Österreichischen Bundesheeres westlich von Wien (LOXT): Heimatbasis der mittleren Transporthubschrauberstaffel (Sikorsky S-70A-42 Black Hawk), der OH-58B Kiowa Staffel, PC-6 Turbo Porter und der Flieger- und Fliegerabwehrtruppenschule',
      lat: 48.3192,
      lon: 16.1136,
      radiusKm: 40,
      minutesAgo: 8,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Fiala-Fernbrugg — Aigen im Ennstal (Hochgebirgs-Helikopterbasis AW169M Lion, Steiermark, Österreich)',
      kind: 'military_base',
      theater: 'Österreich (Steiermark / Ennstaler Alpen)',
      details:
        'Spezialisierter Alpen-Hubschrauberstützpunkt des Österreichischen Bundesheeres (LOXA): Haupteinsatz- und Ausbildungsbasis der neuen Leonardo AW169M „Lion“ Mehrzweck-Gebirgshubschrauber für Hochgebirgsrettung (SAR) und Alpinoperationen',
      lat: 47.5358,
      lon: 14.1414,
      radiusKm: 40,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Fliegerhorst Laupheim — Hubschraubergeschwader 64 (Luftwaffe CH-53GA & H145M Spezialkräfte-Lufttransport, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Baden-Württemberg / Oberschwaben – Bodensee-Sektor)',
      details:
        'Haupteinsatzbasis des Hubschraubergeschwaders 64 (HSG 64) der Deutschen Luftwaffe (ETHL): Schwerer Transporthubschrauber Sikorsky CH-53GA/GS (künftig CH-47F Chinook) sowie die Spezialkräfte-Fliegerstaffel (H145M LUH SOF für das KSK)',
      lat: 48.2203,
      lon: 9.9101,
      radiusKm: 40,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Edelweiß-Kaserne & Karwendel-Kaserne Mittenwald (Gebirgsjägerbataillon 233 & Hochgebirgs-Spezialkräfte, Bayern, Deutschland)',
      kind: 'military_base',
      theater: 'Deutschland (Bayern / Karwendel – Nordalpen)',
      details:
        'Traditionsstandort der deutschen Gebirgstruppe unmittelbar an der österreichischen Tiroler Grenze: Garnison des Gebirgsjägerbataillons 233, des Ausbildungsstützpunkts Gebirgs- und Winterkampf Luttensee sowie der Hochgebirgsjägerzüge',
      lat: 47.4325,
      lon: 11.2619,
      radiusKm: 35,
      minutesAgo: 9,
    }),
    pointFeature({
      name: '🏛️ Base Aérienne 116 Luxeuil-Saint-Sauveur (Escadron de Chasse 1/2 „Cigognes“ & künftige Rafale-F5-Nuklearbasis, Frankreich)',
      kind: 'military_base',
      theater: 'Frankreich (Bourgogne-Franche-Comté / Südvogesen — 85 km vor Basel)',
      details:
        'Strategischer französischer Luftwaffenstützpunkt nahe dem Dreiländereck Schweiz/Deutschland/Frankreich (LFSX): Heimatbasis der Jagdgruppe 1/2 „Cigognes“ (Mirage 2000-5F Luftverteidigung) und designierter Stützpunkt für zwei Rafale-F5-Staffeln mit hyperschallschnellen ASN4G-Nuklearflugkörpern',
      lat: 47.7831,
      lon: 6.3642,
      radiusKm: 45,
      minutesAgo: 8,
    }),
    ...WORLDWIDE_STRATEGIC_FACILITIES.map((item) => pointFeature(item)),
  ];
}

let _strategicPointsCache = null;

function getStrategicPoints() {
  if (!_strategicPointsCache) {
    _strategicPointsCache = buildStrategicMilitaryDataset()
      .filter((f) => f?.geometry?.type === 'Point')
      .map((f) => ({
        name: String(f.properties?.name || '').trim(),
        cleanName: String(f.properties?.name || '')
          .replace(/^[^\p{L}\p{N}]+/u, '')
          .trim(),
        kind: String(f.properties?.kind || ''),
        theater: String(f.properties?.theater || ''),
        details: String(f.properties?.details || ''),
        lat: Number(f.geometry.coordinates[1]),
        lon: Number(f.geometry.coordinates[0]),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }
  return _strategicPointsCache;
}

const STRATEGIC_CATEGORY_RE =
  /\b(raketenabwehr\w*|flugabwehr\w*|flugverteidigung\w*|luftabwehr\w*|luftverteidigung\w*|iron\s*dome|iron\s*beam|david'?s\s*sling|arrow[-\s]?[23]|patriot|thaad|aegis\s*ashore|skyshield|bodluv|florako|goldhaube|s-?[345]00|bavar[-\s]?373|khordad|hq-?9|nasams|iris-?t|raketenbasis|raketenstellung\w*|raketenabschuss\w*|raketensilo\w*|icbm|irbm|missile\s*(site|base|silo|defense|launch|city)|air\s*defense|sam\s*(site|battery)|bunker\w*|festung\w*|artilleriewerk|führungsanlage|kommandobunker|reduit\w*|militärbasis|militaerbasis|militärstützpunkt|fliegerhorst|luftwaffenbasis|air\s*base|airbase|kaserne\w*|waffenplatz|kavernenflugplatz|flugzeugträger|carrier\s*strike|seeblockade|nuklearanlage|urananreicherung|biowaffen\w*|bsl-?4|forschungsanlage)\b/i;

const STRATEGIC_FACILITY_NAME_RE =
  /\b(palmachim|sdot\s*micha|ein\s*shemer|hatzor|hatzerim|ramat\s*david|nevatim|tel\s*nof|ovda|dimona|soreq|har\s*qeren|site\s*512|kermanschah|kenesht|khorramabad|imam\s*ali\s*base|haji\s*abad|semnan|schahrud|bidganeh|modarres|khojir|parchin|natanz|fordow|buschehr|bushehr|redzikowo|deveselu|fylingdales|holzdorf|schönewalde|k20|gotthard\s*bunker|san\s*carlo|sasso\s*da\s*pigna|savatan|dailly|heldsberg|furggels|magletsch|waldbrand|ramstein|büchel|buechel|spangdahlem|incirlik|al\s*udeid|al\s*dhafra|prince\s*sultan|diego\s*garcia|andersen\s*afb|kadena|yokosuka|malmstrom|minot\s*afb|f\.?\s*e\.?\s*warren|vandenberg|fort\s*greely|cheyenne\s*mountain|raven\s*rock|site\s*r|mount\s*weather|greenbrier|yamantau|mezhgorye|kosvinsky|plesetsk|dombarovsky|yasny|kozelsk|tatishchevo|uzhur|engels-?2|olenya|hmeimim|tartus|gadzhiyevo|vilyuchinsk|yumen|hami|ordos|jilantai|taiyuan|xichang|jiuquan|wenchang|yulin|longpo|sohae|tongchang|sinpo|punggye|porton\s*down|fort\s*detrick|dugway|area\s*51|groom\s*lake|tonopah|plant\s*42|skunk\s*works|los\s*alamos|sandia|lawrence\s*livermore|oak\s*ridge|pantex|labor\s*spiez|uss\s*abraham\s*lincoln|uss\s*harry\s*s\.?\s*truman|uss\s*gerald\s*r\.?\s*ford|uss\s*ronald\s*reagan|schöllenen|bäzberg|albulapass|julierpass|malojapass|splügenpass|crestawald|gondo|simplon|follatères|chillon|champex|reuenthal|ebersberg|obermatt|bregenz|bludesch|walgau|schwarzenbergkaserne|frundsbergkaserne|wallnerkaserne|edelweißkaserne|laupheim|kaufbeuren|sonthofen|grünten|gruenten|ummendorf|messstetten|meßstetten|erndtebrück|grafenwöhr|hohenfels|vilseck|patch\s*barracks|panzerkaserne|böblingen|kalkar|uedem|seedorf|nordholz|eckernförde|wunstorf|lechfeld|geilenkirchen|camp\s*bondsteel|falkenhagen|harnekop|wünsdorf|machulishchy|zyabrovka|baranovichi|chkalovsk|chernyakhovsk|millerovo|morozovsk|yeisk|primorsko-akhtarsk|belbek|saky|dzhankoi|mozdok|gyumri|erebuni|khmeimim|al-tanf|ain\s*al-asad|ali\s*al\s*salem|camp\s*arifjan|muwaffaq\s*salti|camp\s*lemonnier|wadi\s*seidna|al-khadim|al-jufra|al-wattiyah|changi|sembawang|paya\s*lebar|tengah|subic|fiery\s*cross|subi\s*reef|mischief\s*reef|woody\s*island|tindal|amberley|pine\s*gap|woomera|sangnam-ni|chiha-ri|sunchon|pukchang|wonsan|musudan-ri|kunsan|pyeongtaek|camp\s*humphreys|camp\s*casey|yokota|iwakuni|atsugi|sasebo|maizuru|kure|chitose|nyutabaru|tsuiki|kyogamisaki|shariki|fuchu|ichigaya|camp\s*zama|hsinchu|ching\s*chuan\s*kang|chiayi|hualien|jiashan|taitung|penghu|kinmen|matsu|dongyin|pave\s*paws|zuoying|su-ao|jiupeng|ncsist|longtian|huian|suixi|zhanjiang|korla|malan|plant\s*221|plant\s*404|plant\s*821|mianyang|caep|plant\s*816|fujian\s*carrier|shandong\s*carrier|liaoning\s*carrier|charles\s*de\s*gaulle|queen\s*elizabeth|prince\s*of\s*wales|cavour|vikrant|vikramaditya|ins\s*arihant|kalpakkam|tarapur|barc|trombay|pokhran|chandipur|wheeler\s*island|kalam\s*island|sriharikota|visakhapatnam|ins\s*varsha|rambilli|karwar|ins\s*kadamba|ambala|pathankot|adampur|halwara|jodhpur|jaisalmer|bhuj|jamnagar|lohegaon|gwalior|tezpur|chabua|hashimara|kalaikunda|hindon|avantipur|thoise|nyoma|daulat\s*beg\s*oldi|kahuta|khushab|chashma|kanupp|masroor|bholari|jacobabad|samungli|sargodha|mushaf|rafiqui|shorkot|kamra|minhas|chaklala|nur\s*khan|ormara|gwadar|chagai|kirana\s*hills|akrotiri|dhekelia|souda\s*bay|larissa|alexandroupoli|aviano|sigonella|gaeta|capodichino|camp\s*darby|ghedi|amendola|gioia\s*del\s*colle|decimomannu|pratica\s*di\s*mare|rota|morón|moron|torrejón|torrejon|zaragoza|los\s*llanos|lajes|kleine\s*brogel|florennes|chièvres|shape|volkel|leeuwarden|gilze-rijen|brunssum|skrydstrup|karup|thule|pituffik|keflavik|örland|evenes|bardufoss|bodö|haakonsvern|reitan|olavsvern|vardö|globus\s*ii|globus\s*iii|andöya|luleå|kallax|sätenäs|ronneby|muskö|karlskrona|rovaniemi|pirkkala|upinniemi|ämari|lielvārde|ādaži|šiauliai|powidz|łask|krzesiny|malbork|świdwin|mirosławiec|świnoujście|drawsko|bemowo\s*piskie|żagań|sliač|čáslav|náměšť|kecskemét|pápa|câmpia\s*turzii|mihail\s*kogălniceanu|fetești|cincu|graf\s*ignatievo|bezmer|novo\s*selo|batajnica|pleso|cerklje|kuçovë|pashaliman|gjadër|tanagra|andravidia|araxos|elefsis|salamis|armavir|lechtussi|lekhtusi|pionerski|pionersky|orsk|jenisseisk|yeniseysk|kowylkino|kovylkino|konteyner|olenegorsk|petschora|pechora|cavalier|parcs|yiyuan|xueshan|lintong|lishan|baal\s*hatzor|kapustin\s*yar|kapustin\s*jar|oreschnik|oreshnik|sary-?shagan|sary-?schagan|mont\s*verdun|lossiemouth|coningsby|istres)\b/i;

const STRATEGIC_STOP_TOKENS = new Set([
  'zeige',
  'zeig',
  'mir',
  'mich',
  'eine',
  'einer',
  'einem',
  'einen',
  'ein',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'und',
  'oder',
  'bitte',
  'nach',
  'zu',
  'zum',
  'zur',
  'in',
  'im',
  'von',
  'auf',
  'für',
  'the',
  'and',
  'show',
  'fly',
  'take',
  'raketenabwehrstellung',
  'raketenabwehr',
  'flugabwehr',
  'flugverteidigung',
  'luftabwehr',
  'luftverteidigung',
  'luftabwehrstellung',
  'raketenbasis',
  'raketenstellung',
  'raketenabschuss',
  'militärbasis',
  'militaerbasis',
  'bunker',
  'festung',
  'kaserne',
  'stellung',
  'anlage',
  'standort',
]);

const COUNTRY_HINTS = [
  [
    /\b(israel\w*|idf|tel\s*aviv|haifa|jerusalem|eilat|ashkelon|ashdod|sderot|netivot|beerscheba|negev|galil[äa]a|safed|meron|dimona|palmachim|ein\s*shemer|sdot\s*micha|ramat\s*david|hatzor|hatzerim|nevatim|iron\s*dome|david'?s\s*sling)\b/i,
    /israel|gaza|negev|galil|tel aviv|haifa|jerusalem|eilat|palmachim|sdot micha|dimona/i,
  ],
  [
    /\b(iran\w*|irgc|teheran|tehran|isfahan|natanz|fordow|qom|kermanschah|khorramabad|täbris|tabriz|schiras|shiraz|buschehr|bushehr|hormus|semnan|parchin|khojir|bavar|khordad)\b/i,
    /iran|hormus|persischer golf/i,
  ],
  [
    /\b(schweiz\w*|swiss|switzerland|eidgen\w*|bodluv|florako|reduit|kandersteg|k20|gotthard|airolo|san\s*carlo|amsteg|vitznau|meiringen|payerne|emmen|dübendorf|savatan|dailly|heldsberg|rheintal|sargans|magletsch|furggels|buchs|chur|brugg|thun|spiez|zimmerwald|onyx|davos|weißfluhjoch)\b/i,
    /schweiz|alpen|gotthard|rheintal|sargans|graubünden|wallis|bern|zentralschweiz|zürich/i,
  ],
  [
    /\b(deutsch\w*|germany|bundeswehr|luftwaffe|ramstein|büchel|buechel|spangdahlem|holzdorf|schönewalde|husum|sanitz|jagel|laage|neuburg|nörvenich|grafenwöhr|baumholder)\b/i,
    /deutschland/i,
  ],
  [
    /\b(österreich\w*|austria|bundesheer|goldhaube|zeltweg|kolomannsberg)\b/i,
    /österreich/i,
  ],
  [
    /\b(ukrain\w*|kiew|kyiv|odessa|lwiw|lviv|charkiw)\b/i,
    /ukraine/i,
  ],
  [
    /\b(russ\w*|moskau|moscow|kaliningrad|krim|sewastopol|plesetsk|dombarovsky|kozelsk|yamantau|kosvinsky|engels|olenya|murmansk|gadzhiyevo|vilyuchinsk)\b/i,
    /russland|kaliningrad|krim/i,
  ],
  [
    /\b(usa|us\b|amerikan\w*|united\s*states|washington|pentagon|norad|cheyenne|raven\s*rock|mount\s*weather|malmstrom|minot|warren|vandenberg|greely|alaska|montana|wyoming|nevada|area\s*51|groom\s*lake|skunk\s*works|los\s*alamos|sandia|livermore|fort\s*detrick|dugway|guam|andersen)\b/i,
    /usa|guam|pazifik|nordamerika/i,
  ],
  [
    /\b(chin\w*|pla\b|peking|beijing|yumen|hami|ordos|jilantai|taiyuan|xichang|jiuquan|wenchang|yulin|hainan|lop\s*nur|wuhan)\b/i,
    /china|südchinesisches meer/i,
  ],
  [
    /\b(taiwan\w*|taipeh|taipei|sky\s*bow|tien\s*kung)\b/i,
    /taiwan/i,
  ],
  [
    /\b(nordkorea\w*|north\s*korea|dprk|pjöngjang|pyongyang|sohae|tongchang|sinpo|punggye|yongbyon)\b/i,
    /nordkorea/i,
  ],
  [
    /\b(südkorea\w*|south\s*korea|seongju|osan|japan\w*|misawa|kadena|yokosuka|okinawa)\b/i,
    /korea|japan/i,
  ],
  [
    /\b(uk\b|brit\w*|großbritannien|england|schottland|fylingdales|porton\s*down|faslane|lakenheath|akrotiri)\b/i,
    /großbritannien|schottland|zypern/i,
  ],
  [
    /\b(frankreich|france|französ\w*|ile\s*longue|brest|istres|toulon|valduc)\b/i,
    /frankreich/i,
  ],
  [
    /\b(polen|poland|poln\w*|redzikowo|rzesz[oó]w)\b/i,
    /polen/i,
  ],
  [
    /\b(rumän\w*|romania|deveselu)\b/i,
    /rumänien/i,
  ],
  [
    /\b(türk\w*|turkey|incirlik|kürecik|malatya)\b/i,
    /türkei/i,
  ],
  [
    /\b(jemen\w*|yemen\w*|huthi\w*|houthi\w*|sanaa|saada|hodeidah)\b/i,
    /jemen|rotes meer/i,
  ],
  [
    /\b(syrien|syria|syrisch\w*|hmeimim|tartus|masyaf|qalamoun|damaskus|libanon|lebanon|libanes\w*|hisbollah|bekaa|baalbek)\b/i,
    /syrien|libanon/i,
  ],
  [
    /\b(saudi\w*|riad|riyadh|dhahran|al-watah|al-sulayyil|katar|qatar|al\s*udeid|vae|uae|emirat\w*|al\s*dhafra)\b/i,
    /saudi|katar|emirate|persischer golf/i,
  ],
];

/**
 * Resolve a strategic military facility or tactical category query (air defense,
 * Iron Dome, missile launch site, bunker, military base, nuclear/BSL-4 research)
 * into a Google Geocoding API-shaped response (`{ status: 'OK', results }`).
 * Returns null if the query is not a strategic military query.
 * @param {string} rawQuery
 * @returns {{status: 'OK', results: Array<object>, provider: string} | null}
 */
export function matchStrategicFacility(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query || query.length > 200) return null;
  if (
    !STRATEGIC_CATEGORY_RE.test(query) &&
    !STRATEGIC_FACILITY_NAME_RE.test(query)
  ) {
    return null;
  }

  let desiredKind = null;
  if (
    /\b(raketenabwehr\w*|flugabwehr\w*|flugverteidigung\w*|luftabwehr\w*|luftverteidigung\w*|iron\s*dome|iron\s*beam|david'?s\s*sling|arrow[-\s]?[23]|patriot|thaad|aegis\s*ashore|skyshield|bodluv|florako|goldhaube|s-?[345]00|bavar[-\s]?373|khordad|hq-?9|nasams|iris-?t|air\s*defense|sam\s*(site|battery))\b/i.test(
      query,
    )
  ) {
    desiredKind = 'air_defense';
  } else if (
    /\b(raketenbasis|raketenstellung\w*|raketenabschuss\w*|raketensilo\w*|icbm|irbm|missile\s*(site|base|silo|launch|city)|minuteman|sarmat|yars|jericho|shahab|fattah|sejjil|sdot\s*micha|kermanschah|khorramabad)\b/i.test(
      query,
    )
  ) {
    desiredKind = 'missile_site';
  } else if (
    /\b(bunker\w*|festung\w*|artilleriewerk|führungsanlage|kommandobunker|reduit\w*|k20|furggels|magletsch|heldsberg|cheyenne\s*mountain|raven\s*rock|yamantau)\b/i.test(
      query,
    )
  ) {
    desiredKind = 'bunker';
  } else if (
    /\b(militärbasis|militaerbasis|militärstützpunkt|fliegerhorst|luftwaffenbasis|air\s*base|airbase|kaserne\w*|waffenplatz|kavernenflugplatz)\b/i.test(
      query,
    )
  ) {
    desiredKind = 'military_base';
  } else if (
    /\b(nuklearanlage|urananreicherung|biowaffen\w*|bsl-?4|forschungsanlage|skunk\s*works|area\s*51|groom\s*lake|dimona|natanz|fordow|porton\s*down|fort\s*detrick|labor\s*spiez)\b/i.test(
      query,
    )
  ) {
    desiredKind = 'research';
  } else if (
    /\b(flugzeugträger|carrier\s*strike|uss\s+abraham|uss\s+harry|uss\s+gerald|uss\s+ronald)\b/i.test(
      query,
    )
  ) {
    desiredKind = 'carrier';
  }

  let countryFilterRe = null;
  for (const [triggerRe, targetRe] of COUNTRY_HINTS) {
    if (triggerRe.test(query)) {
      countryFilterRe = targetRe;
      break;
    }
  }

  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STRATEGIC_STOP_TOKENS.has(t));

  const points = getStrategicPoints();
  const scored = [];
  for (const p of points) {
    let score = 0;
    const hayName = p.name.toLowerCase();
    const hayTheater = p.theater.toLowerCase();
    const hayDetails = p.details.toLowerCase();
    const hayAll = `${hayName} ${hayTheater} ${hayDetails}`;

    if (desiredKind) {
      if (p.kind === desiredKind) score += 55;
      else score -= 40;
    }
    if (countryFilterRe) {
      if (countryFilterRe.test(hayAll)) score += 65;
      else score -= 45;
    }
    for (const token of tokens) {
      if (hayName.includes(token)) score += 40;
      else if (hayTheater.includes(token)) score += 25;
      else if (hayDetails.includes(token)) score += 15;
    }
    // Default priority for bare air-defense queries ("Raketenabwehrstellung Flugverteidigung")
    if (
      desiredKind === 'air_defense' &&
      !countryFilterRe &&
      /israel/i.test(p.theater)
    ) {
      score += 20;
    }
    if (score > 0) scored.push({ p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  if (!top.length) return null;

  const results = top.map(({ p }) => ({
    formatted_address: `${p.cleanName} (${p.theater})`,
    address_components: [
      {
        long_name: p.cleanName,
        short_name: p.cleanName,
        types: ['point_of_interest', 'establishment'],
      },
      {
        long_name: p.theater || 'Strategic OSINT',
        short_name: p.theater || 'OSINT',
        types: ['country', 'political'],
      },
    ],
    types: ['point_of_interest', 'establishment', `strategic_${p.kind}`],
    geometry: {
      location: { lat: p.lat, lng: p.lon },
      viewport: {
        southwest: { lat: p.lat - 0.03, lng: p.lon - 0.04 },
        northeast: { lat: p.lat + 0.03, lng: p.lon + 0.04 },
      },
    },
  }));

  return {
    status: 'OK',
    results,
    provider: 'strategic-osint',
  };
}

function mergeRegionalFeatures(baseSnapshot) {
  const strategic = buildStrategicMilitaryDataset();
  const baseFeatures = simplifyDeepStateFeatures(baseSnapshot?.map?.features);
  return {
    datetime: baseSnapshot?.datetime || new Date().toISOString(),
    map: {
      type: 'FeatureCollection',
      features: [...strategic, ...baseFeatures],
    },
    fallback: Boolean(baseSnapshot?.fallback),
  };
}

function adaptFallback(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  if (!features.length) return null;
  const names = {
    russian_control: 'Окуповано /// Occupied /// fallback feed',
    contact_line: 'Лінія фронту /// Contact line /// fallback feed',
    ukrainian_control_in_russia:
      'Український контроль /// Ukrainian control in Russia',
  };
  return {
    datetime: String(features[0]?.properties?.date || new Date().toISOString()),
    map: {
      type: 'FeatureCollection',
      features: features.map((feature) => ({
        type: 'Feature',
        properties: {
          name:
            names[feature?.properties?.kind] ||
            String(feature?.properties?.kind || ''),
        },
        geometry: feature.geometry,
      })),
    },
    fallback: true,
  };
}

export async function frontlineSnapshot() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  try {
    const primary = await fetchPrimary();
    if (primary) {
      const merged = mergeRegionalFeatures(primary);
      cache.at = Date.now();
      cache.body = merged;
      return merged;
    }
  } catch {
    /* fall through to strategic regional dataset if primary times out */
  }
  if (cache.body) return cache.body;
  const fallbackMerged = mergeRegionalFeatures({
    datetime: new Date().toISOString(),
    map: { type: 'FeatureCollection', features: [] },
    fallback: true,
  });
  cache.at = Date.now();
  cache.body = fallbackMerged;
  return fallbackMerged;
}

async function fetchPrimary() {
  const response = await fetch(URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'gods-eye-view/1.0',
    },
    signal: AbortSignal.timeout(1_800),
  });
  if (!response.ok) return null;
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(body?.map?.features) || !body.map.features.length)
    return null;
  return body;
}
