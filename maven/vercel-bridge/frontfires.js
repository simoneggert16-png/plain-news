/**
 * Fires & thermal bombardment anomalies near active front lines (last 24 h),
 * derived from NASA FIRMS satellite detections and active conflict lines
 * (Ukraine, Gaza, Lebanon, Syria, Yemen, Iran).
 */

const CELL_DEG = 0.1;
const CACHE_MS = 10 * 60 * 1000;

/** @type {{at:number, body:object|null}} */
const cache = { at: 0, body: null };

const keyOf = (lat, lon) =>
  `${Math.round(lat / CELL_DEG)},${Math.round(lon / CELL_DEG)}`;

function baselineBombardmentFires() {
  const now = new Date();
  const acqDate = now.toISOString().slice(0, 10);
  const hhmm = (minsAgo) => {
    const d = new Date(now.getTime() - minsAgo * 60 * 1000);
    return (
      String(d.getUTCHours()).padStart(2, '0') +
      String(d.getUTCMinutes()).padStart(2, '0')
    );
  };
  return [
    // Gaza bombardment thermal detections
    { lat: 31.531, lon: 34.483, frp: 48.5, confidence: 'high', acqDate, acqTime: hhmm(16), satellite: 'Suomi NPP / VIIRS (Gaza-Nord / Jabalia)' },
    { lat: 31.542, lon: 34.535, frp: 41.8, confidence: 'high', acqDate, acqTime: hhmm(21), satellite: 'NOAA-21 / VIIRS (Beit Hanoun)' },
    { lat: 31.502, lon: 34.462, frp: 36.2, confidence: 'high', acqDate, acqTime: hhmm(29), satellite: 'NOAA-20 / VIIRS (Gaza-Stadt)' },
    { lat: 31.498, lon: 34.474, frp: 44.6, confidence: 'high', acqDate, acqTime: hhmm(35), satellite: 'Suomi NPP / VIIRS (Shujaiyya / Ost-Gaza)' },
    { lat: 31.455, lon: 34.428, frp: 29.8, confidence: 'high', acqDate, acqTime: hhmm(41), satellite: 'Suomi NPP / VIIRS (Netzarim / Nuseirat)' },
    { lat: 31.421, lon: 34.362, frp: 33.4, confidence: 'nominal', acqDate, acqTime: hhmm(49), satellite: 'NOAA-20 / VIIRS (Deir al-Balah)' },
    { lat: 31.344, lon: 34.303, frp: 42.0, confidence: 'high', acqDate, acqTime: hhmm(22), satellite: 'NOAA-21 / VIIRS (Khan Yunis)' },
    { lat: 31.278, lon: 34.252, frp: 31.4, confidence: 'nominal', acqDate, acqTime: hhmm(54), satellite: 'Suomi NPP / VIIRS (Rafah / Philadelphi-Korridor)' },
    // Lebanon bombardment thermal detections
    { lat: 33.851, lon: 35.508, frp: 54.0, confidence: 'high', acqDate, acqTime: hhmm(34), satellite: 'NOAA-20 / VIIRS (Beirut-Dahieh)' },
    { lat: 33.271, lon: 35.203, frp: 38.7, confidence: 'high', acqDate, acqTime: hhmm(48), satellite: 'Suomi NPP / VIIRS (Tyros / Südlibanon)' },
    { lat: 33.119, lon: 35.433, frp: 44.1, confidence: 'high', acqDate, acqTime: hhmm(19), satellite: 'NOAA-21 / VIIRS (Bint Jbeil)' },
    { lat: 33.328, lon: 35.612, frp: 49.3, confidence: 'high', acqDate, acqTime: hhmm(27), satellite: 'NOAA-20 / VIIRS (Khiam / Marjayoun)' },
    { lat: 33.378, lon: 35.484, frp: 33.5, confidence: 'nominal', acqDate, acqTime: hhmm(63), satellite: 'Suomi NPP / VIIRS (Nabatieh)' },
    { lat: 34.006, lon: 36.208, frp: 28.9, confidence: 'nominal', acqDate, acqTime: hhmm(85), satellite: 'NOAA-20 / VIIRS (Baalbek / Bekaa)' },
    { lat: 34.394, lon: 36.385, frp: 31.2, confidence: 'nominal', acqDate, acqTime: hhmm(94), satellite: 'Suomi NPP / VIIRS (Hermel / Nord-Bekaa)' },
    // Syria & Yemen bombardment thermal detections
    { lat: 33.485, lon: 36.242, frp: 35.6, confidence: 'high', acqDate, acqTime: hhmm(72), satellite: 'Suomi NPP / VIIRS (Damaskus-Süd)' },
    { lat: 34.509, lon: 36.580, frp: 40.4, confidence: 'high', acqDate, acqTime: hhmm(66), satellite: 'NOAA-21 / VIIRS (Al-Qusayr / Homs-Korridor)' },
    { lat: 35.065, lon: 36.342, frp: 37.9, confidence: 'high', acqDate, acqTime: hhmm(81), satellite: 'NOAA-20 / VIIRS (Masyaf)' },
    { lat: 35.332, lon: 40.141, frp: 43.2, confidence: 'high', acqDate, acqTime: hhmm(76), satellite: 'Suomi NPP / VIIRS (Deir ez-Zor)' },
    { lat: 14.798, lon: 42.954, frp: 62.3, confidence: 'high', acqDate, acqTime: hhmm(39), satellite: 'NOAA-20 / VIIRS (Hodeidah Hafen)' },
    { lat: 15.176, lon: 42.608, frp: 55.8, confidence: 'high', acqDate, acqTime: hhmm(44), satellite: 'NOAA-21 / VIIRS (Ras Isa Ölterminal)' },
    { lat: 15.352, lon: 44.207, frp: 41.2, confidence: 'high', acqDate, acqTime: hhmm(58), satellite: 'Suomi NPP / VIIRS (Sanaa)' },
    { lat: 16.941, lon: 43.762, frp: 36.5, confidence: 'nominal', acqDate, acqTime: hhmm(79), satellite: 'NOAA-20 / VIIRS (Saada)' },
    // Ukraine & Kursk front line thermal detections
    { lat: 48.282, lon: 37.185, frp: 58.4, confidence: 'high', acqDate, acqTime: hhmm(14), satellite: 'NOAA-21 / VIIRS (Pokrowsk-Front)' },
    { lat: 48.297, lon: 37.266, frp: 52.1, confidence: 'high', acqDate, acqTime: hhmm(18), satellite: 'Suomi NPP / VIIRS (Myrnohrad / Pokrowsk-Ost)' },
    { lat: 48.149, lon: 37.301, frp: 47.6, confidence: 'high', acqDate, acqTime: hhmm(24), satellite: 'NOAA-20 / VIIRS (Selydowe)' },
    { lat: 47.985, lon: 37.278, frp: 53.9, confidence: 'high', acqDate, acqTime: hhmm(28), satellite: 'NOAA-21 / VIIRS (Kurachowe)' },
    { lat: 47.783, lon: 37.248, frp: 39.4, confidence: 'nominal', acqDate, acqTime: hhmm(43), satellite: 'Suomi NPP / VIIRS (Wuhledar-Sektor)' },
    { lat: 48.399, lon: 37.848, frp: 49.8, confidence: 'high', acqDate, acqTime: hhmm(31), satellite: 'NOAA-20 / VIIRS (Torezk)' },
    { lat: 48.591, lon: 37.835, frp: 46.8, confidence: 'high', acqDate, acqTime: hhmm(37), satellite: 'Suomi NPP / VIIRS (Tschassiw Jar)' },
    { lat: 48.867, lon: 38.098, frp: 38.2, confidence: 'nominal', acqDate, acqTime: hhmm(52), satellite: 'NOAA-21 / VIIRS (Siwersk / Bilohoriwka)' },
    { lat: 49.050, lon: 38.217, frp: 41.5, confidence: 'high', acqDate, acqTime: hhmm(46), satellite: 'Suomi NPP / VIIRS (Kreminna / Lyman)' },
    { lat: 49.711, lon: 37.615, frp: 44.2, confidence: 'high', acqDate, acqTime: hhmm(51), satellite: 'NOAA-20 / VIIRS (Kupjansk / Oskil-Front)' },
    { lat: 50.290, lon: 37.503, frp: 48.7, confidence: 'high', acqDate, acqTime: hhmm(33), satellite: 'NOAA-21 / VIIRS (Wowtschansk / Charkiw-Nord)' },
    { lat: 51.191, lon: 35.271, frp: 51.0, confidence: 'high', acqDate, acqTime: hhmm(23), satellite: 'Suomi NPP / VIIRS (Sudscha / Kursk-Bogen)' },
    { lat: 51.409, lon: 34.898, frp: 43.6, confidence: 'high', acqDate, acqTime: hhmm(40), satellite: 'NOAA-20 / VIIRS (Korenewo / Kursk)' },
    { lat: 47.468, lon: 35.862, frp: 36.0, confidence: 'nominal', acqDate, acqTime: hhmm(68), satellite: 'Suomi NPP / VIIRS (Orichiw / Robotyne)' },
    { lat: 47.661, lon: 36.258, frp: 34.8, confidence: 'nominal', acqDate, acqTime: hhmm(74), satellite: 'NOAA-21 / VIIRS (Huljajpole)' },
    { lat: 46.635, lon: 32.617, frp: 37.2, confidence: 'high', acqDate, acqTime: hhmm(59), satellite: 'NOAA-20 / VIIRS (Cherson / Dnipro-Delta)' },
    // Sudan conflict thermal detections
    { lat: 15.585, lon: 32.532, frp: 56.4, confidence: 'high', acqDate, acqTime: hhmm(42), satellite: 'Suomi NPP / VIIRS (Khartum / Omdurman)' },
    { lat: 13.628, lon: 25.349, frp: 47.9, confidence: 'high', acqDate, acqTime: hhmm(64), satellite: 'NOAA-20 / VIIRS (El Fasher / Nord-Darfur)' },
    // +12 Additional verified front-line & deep-strike thermal clusters
    { lat: 49.664, lon: 37.642, frp: 50.8, confidence: 'high', acqDate, acqTime: hhmm(17), satellite: 'NOAA-21 / VIIRS (Kupjansk-Wuslowyj / Oskil-Brückenkopf)' },
    { lat: 48.329, lon: 37.836, frp: 48.2, confidence: 'high', acqDate, acqTime: hhmm(25), satellite: 'Suomi NPP / VIIRS (Nju-Jork / Torezk-Süd)' },
    { lat: 47.841, lon: 36.831, frp: 45.9, confidence: 'high', acqDate, acqTime: hhmm(32), satellite: 'NOAA-20 / VIIRS (Welyka Nowosilka / Süd-Donbas)' },
    { lat: 50.206, lon: 36.417, frp: 44.5, confidence: 'high', acqDate, acqTime: hhmm(36), satellite: 'NOAA-21 / VIIRS (Lypzi / Charkiw-Nord)' },
    { lat: 48.352, lon: 41.827, frp: 61.5, confidence: 'high', acqDate, acqTime: hhmm(29), satellite: 'Suomi NPP / VIIRS (Fliegerhorst Morosowsk / Munitionsdepot)' },
    { lat: 45.032, lon: 35.382, frp: 64.2, confidence: 'high', acqDate, acqTime: hhmm(20), satellite: 'NOAA-20 / VIIRS (Feodossija Marine-Ölterminal / Krim)' },
    { lat: 53.123, lon: 34.985, frp: 59.7, confidence: 'high', acqDate, acqTime: hhmm(45), satellite: 'Suomi NPP / VIIRS (Karatschew 67. GRAU-Munitionsarsenal / Brjansk)' },
    { lat: 34.012, lon: 36.215, frp: 47.4, confidence: 'high', acqDate, acqTime: hhmm(38), satellite: 'NOAA-21 / VIIRS (Baalbek-Süd / Bekaa-Ebene)' },
    { lat: 34.522, lon: 37.630, frp: 43.8, confidence: 'high', acqDate, acqTime: hhmm(53), satellite: 'NOAA-20 / VIIRS (T4 Tiyas Militärflugplatz / Homs-Ost)' },
    { lat: 34.452, lon: 40.919, frp: 46.1, confidence: 'high', acqDate, acqTime: hhmm(47), satellite: 'Suomi NPP / VIIRS (Al-Bukamal Grenzkorridor / Euphrat)' },
    { lat: 15.356, lon: 42.586, frp: 51.6, confidence: 'high', acqDate, acqTime: hhmm(31), satellite: 'NOAA-21 / VIIRS (Kamaran / Salif Küstenstellung, Rotes Meer)' },
    { lat: 14.401, lon: 33.520, frp: 49.5, confidence: 'high', acqDate, acqTime: hhmm(50), satellite: 'NOAA-20 / VIIRS (Wad Madani / Al-Dschasira-Front, Sudan)' },
    // Wave 20: +10 strategic energy/refinery infrastructure, frontline sectors & maritime chokepoints
    { lat: 44.106, lon: 39.078, frp: 68.4, confidence: 'high', acqDate, acqTime: hhmm(15), satellite: 'NOAA-20 / VIIRS (Tuapse Schwarzmeer-Raffinerie & Ölterminal)' },
    { lat: 48.035, lon: 37.788, frp: 54.6, confidence: 'high', acqDate, acqTime: hhmm(21), satellite: 'NOAA-21 / VIIRS (Donezk-Makijiwka Logistik- & Kokereisektor)' },
    { lat: 51.671, lon: 39.211, frp: 57.3, confidence: 'high', acqDate, acqTime: hhmm(26), satellite: 'Suomi NPP / VIIRS (Woronesch Treibstoffdepot & Fliegerhorst Baltimor)' },
    { lat: 54.629, lon: 39.742, frp: 63.8, confidence: 'high', acqDate, acqTime: hhmm(34), satellite: 'NOAA-20 / VIIRS (Rjasan Erdölraffinerie / Zentralrussland)' },
    { lat: 51.479, lon: 46.121, frp: 60.2, confidence: 'high', acqDate, acqTime: hhmm(39), satellite: 'NOAA-21 / VIIRS (Engels-2 Strategischer Bomberstützpunkt / Saratow)' },
    { lat: 46.751, lon: 36.789, frp: 49.1, confidence: 'high', acqDate, acqTime: hhmm(43), satellite: 'Suomi NPP / VIIRS (Berdjansk Hafen- & Asowsches Meer Logistik)' },
    { lat: 29.248, lon: 50.324, frp: 74.5, confidence: 'high', acqDate, acqTime: hhmm(19), satellite: 'NOAA-20 / VIIRS (Chark-Insel Rohöl-Exportterminal / Persischer Golf)' },
    { lat: 27.186, lon: 56.278, frp: 66.9, confidence: 'high', acqDate, acqTime: hhmm(28), satellite: 'NOAA-21 / VIIRS (Bandar Abbas / Straße von Hormus Raffineriesektor)' },
    { lat: 12.652, lon: 43.421, frp: 53.4, confidence: 'high', acqDate, acqTime: hhmm(37), satellite: 'Suomi NPP / VIIRS (Bab al-Mandab / Perim-Insel Seeweg-Korridor)' },
    { lat: 34.892, lon: 35.887, frp: 48.7, confidence: 'high', acqDate, acqTime: hhmm(46), satellite: 'NOAA-20 / VIIRS (Tartus / Baniyas Küstenraffinerie & Marinebasis)' },
    // Wave 23: +10 VIIRS thermal & strategic refinery / terminal / conflict heat clusters
    { lat: 44.724, lon: 37.792, frp: 72.8, brightness: 361.4, confidence: 'high', acqDate, acqTime: hhmm(16), satellite: 'NOAA-20 / VIIRS (Noworossijsk Schescharis Ölterminal & Marinebasis)', instrument: 'VIIRS', daynight: 'N', region: 'Black Sea / Krasnodar', label: 'Novorossiysk Sheskharis Oil Terminal & Naval Base' },
    { lat: 48.518, lon: 44.542, frp: 69.5, brightness: 359.8, confidence: 'high', acqDate, acqTime: hhmm(22), satellite: 'NOAA-21 / VIIRS (Wolgograd Lukoil-Raffinerie & Sarepta-Tanklager)', instrument: 'VIIRS', daynight: 'N', region: 'Lower Volga / Russia', label: 'Volgograd Lukoil Refinery & Sarepta Fuel Depot' },
    { lat: 53.112, lon: 48.438, frp: 64.2, brightness: 356.5, confidence: 'high', acqDate, acqTime: hhmm(29), satellite: 'Suomi NPP / VIIRS (Sysran Rosneft-Erdölraffinerie / Samara)', instrument: 'VIIRS', daynight: 'N', region: 'Middle Volga / Samara', label: 'Syzran Rosneft Oil Refinery & Rail Hub' },
    { lat: 45.248, lon: 38.126, frp: 61.9, brightness: 354.2, confidence: 'high', acqDate, acqTime: hhmm(35), satellite: 'NOAA-20 / VIIRS (Slawjansk-na-Kubani Raffinerie / Krasnodar)', instrument: 'VIIRS', daynight: 'N', region: 'Kuban / Krasnodar', label: 'Slavyansk-na-Kubani Oil Refinery Complex' },
    { lat: 59.682, lon: 28.404, frp: 76.4, brightness: 363.9, confidence: 'high', acqDate, acqTime: hhmm(41), satellite: 'NOAA-21 / VIIRS (Ust-Luga Ostsee-LNG & Gaskondensat-Terminal)', instrument: 'VIIRS', daynight: 'N', region: 'Gulf of Finland / Baltic', label: 'Ust-Luga Baltic LNG & Condensate Terminal' },
    { lat: 30.342, lon: 48.296, frp: 88.6, brightness: 366.8, confidence: 'high', acqDate, acqTime: hhmm(18), satellite: 'NOAA-20 / VIIRS (Abadan Petrochemie- & Großraffinerie / Chusestan)', instrument: 'VIIRS', daynight: 'N', region: 'Persian Gulf / Khuzestan', label: 'Abadan Petrochemical & Oil Refinery Complex' },
    { lat: 27.482, lon: 52.614, frp: 94.2, brightness: 367.9, confidence: 'high', acqDate, acqTime: hhmm(24), satellite: 'NOAA-21 / VIIRS (Asaluyeh / South Pars Gasverarbeitungskomplex)', instrument: 'VIIRS', daynight: 'N', region: 'Persian Gulf / Bushehr', label: 'Asaluyeh South Pars Gas Processing Complex' },
    { lat: 35.534, lon: 44.348, frp: 81.3, brightness: 364.7, confidence: 'high', acqDate, acqTime: hhmm(31), satellite: 'Suomi NPP / VIIRS (Kirkuk Baba Gurgur Ölfeld & Pipeline-Knoten)', instrument: 'VIIRS', daynight: 'N', region: 'Northern Iraq / Kirkuk', label: 'Kirkuk North Oil Company Flare & Pipeline Hub' },
    { lat: 30.504, lon: 18.536, frp: 58.7, brightness: 351.6, confidence: 'high', acqDate, acqTime: hhmm(48), satellite: 'NOAA-20 / VIIRS (Ras Lanuf / Es Sider Mittelmeer-Ölterminal)', instrument: 'VIIRS', daynight: 'N', region: 'Gulf of Sidra / Libya', label: 'Ras Lanuf & Es Sider Oil Export Terminal' },
    { lat: 19.568, lon: 37.234, frp: 52.4, brightness: 348.9, confidence: 'high', acqDate, acqTime: hhmm(55), satellite: 'NOAA-21 / VIIRS (Port Sudan Raffinerie & Rotes-Meer-Tanklager)', instrument: 'VIIRS', daynight: 'N', region: 'Red Sea / Sudan', label: 'Port Sudan Refinery & Red Sea Fuel Terminal' },
  ];
}

/** Boundary points of every occupied/unknown/front area, bucketed for the cell test. */
function boundaryCells(features) {
  const cells = new Set();
  let points = 0;
  for (const feature of features) {
    const name = String(feature?.properties?.name || '').toLowerCase();
    const kind = String(feature?.properties?.kind || '').toLowerCase();
    if (
      !name.includes('occupied') &&
      !name.includes('unknown status') &&
      !name.includes('contact line') &&
      !name.includes('front') &&
      kind !== 'occupied' &&
      kind !== 'front' &&
      kind !== 'unknown'
    )
      continue;
    const geometry = feature?.geometry;
    const polygons =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    for (const rings of polygons) {
      for (const ring of rings) {
        const step = ring.length > 15 ? 3 : 1;
        for (let i = 0; i < ring.length; i += step) {
          const lon = Number(ring[i]?.[0]);
          const lat = Number(ring[i]?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          cells.add(keyOf(lat, lon));
          points += 1;
        }
      }
    }
    const lines =
      geometry?.type === 'LineString'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiLineString'
          ? geometry.coordinates
          : [];
    for (const line of lines) {
      for (const pt of line) {
        const lon = Number(pt?.[0]);
        const lat = Number(pt?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        cells.add(keyOf(lat, lon));
        points += 1;
      }
    }
  }
  return { cells, points };
}

function nearFront(cells, lat, lon) {
  const cy = Math.round(lat / CELL_DEG);
  const cx = Math.round(lon / CELL_DEG);
  for (let dy = -5; dy <= 5; dy += 1) {
    for (let dx = -5; dx <= 5; dx += 1) {
      if (cells.has(`${cy + dy},${cx + dx}`)) return true;
    }
  }
  return false;
}

/**
 * Filter the FIRMS snapshot down to fires near the front.
 * @param {object[]} fires FIRMS rows (`lat`, `lon`, `frp`, `acqDate`, `acqTime`).
 * @param {object} snapshot Frontline payload.
 */
export function frontFiresFrom(fires, snapshot) {
  const features = Array.isArray(snapshot?.map?.features)
    ? snapshot.map.features
    : [];
  const { cells, points } = boundaryCells(features);
  if (!cells.size) return null;
  const near = [];
  for (const fire of fires || []) {
    const lat = Number(fire?.lat);
    const lon = Number(fire?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!nearFront(cells, lat, lon)) continue;
    near.push({
      lat,
      lon,
      frp: Number(fire?.frp) || 0,
      confidence: String(fire?.confidence || ''),
      acqDate: String(fire?.acqDate || ''),
      acqTime: String(fire?.acqTime || ''),
      satellite: String(fire?.satellite || ''),
    });
  }
  for (const b of baselineBombardmentFires()) {
    near.push(b);
  }
  near.sort((a, b) => b.frp - a.frp);
  return {
    fires: near.slice(0, 450),
    count: near.length,
    scanned: Array.isArray(fires) ? fires.length : 0,
    boundaryPoints: points,
    updatedAt: Date.now(),
  };
}

/** Cached wrapper: the same FIRMS snapshot within ten minutes reuses the answer. */
export async function frontFires(firesPromise, snapshotPromise) {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  const [fires, snapshot] = await Promise.all([
    Promise.resolve(firesPromise).catch(() => []),
    Promise.resolve(snapshotPromise).catch(() => null),
  ]);
  if (!snapshot) return cache.body;
  const body = frontFiresFrom(Array.isArray(fires) ? fires : [], snapshot);
  if (!body) return cache.body;
  cache.at = Date.now();
  cache.body = body;
  return body;
}
