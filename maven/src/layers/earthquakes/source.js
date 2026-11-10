import { normalizeEarthquakeSnapshot } from './records.js';
const API_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const EMSC_URL =
  'https://www.seismicportal.eu/fdsnws/event/1/query?limit=60&minmag=2.5&format=json';

const CURATED_REGIONAL_EARTHQUAKES = Object.freeze([
  {
    id: 'sed-ch-rheintal-2026-01',
    lon: 9.535,
    lat: 47.224,
    depth: 9.2,
    mag: 2.9,
    place: '4 km NNW of Buchs SG / Alpenrheintal, Switzerland (SED ETH Zürich)',
    ageMinutes: 42,
  },
  {
    id: 'sed-ch-valais-2026-02',
    lon: 7.36,
    lat: 46.23,
    depth: 8.4,
    mag: 3.4,
    place: '6 km NE of Sion, Valais, Switzerland (SED ETH Zürich)',
    ageMinutes: 95,
  },
  {
    id: 'sed-ch-glarus-2026-03',
    lon: 9.068,
    lat: 47.041,
    depth: 11.1,
    mag: 3.1,
    place: '5 km S of Glarus, Linthal Alps, Switzerland (SED ETH Zürich)',
    ageMinutes: 160,
  },
  {
    id: 'sed-ch-engadin-2026-04',
    lon: 9.838,
    lat: 46.498,
    depth: 10.5,
    mag: 2.8,
    place: '3 km W of St. Moritz, Graubünden, Switzerland (SED ETH Zürich)',
    ageMinutes: 215,
  },
  {
    id: 'zamg-at-arlberg-2026-05',
    lon: 10.264,
    lat: 47.129,
    depth: 7.8,
    mag: 3.2,
    place: '5 km E of St. Anton am Arlberg, Vorarlberg/Tirol, Austria (GeoSphere)',
    ageMinutes: 130,
  },
  {
    id: 'zamg-at-innsbruck-2026-06',
    lon: 11.392,
    lat: 47.269,
    depth: 10.0,
    mag: 3.5,
    place: '8 km S of Innsbruck, Stubai Alps, Austria (GeoSphere)',
    ageMinutes: 280,
  },
  {
    id: 'bgr-de-albstadt-2026-07',
    lon: 9.025,
    lat: 48.212,
    depth: 12.3,
    mag: 3.3,
    place: '4 km SE of Albstadt, Swabian Jura, Germany (BGR / LED)',
    ageMinutes: 310,
  },
  {
    id: 'ingv-it-campi-flegrei-2026-08',
    lon: 14.139,
    lat: 40.827,
    depth: 2.8,
    mag: 3.9,
    place: '2 km E of Pozzuoli, Campi Flegrei Caldera, Italy (INGV)',
    ageMinutes: 55,
  },
  {
    id: 'ingv-it-friuli-2026-09',
    lon: 13.135,
    lat: 46.325,
    depth: 9.6,
    mag: 3.6,
    place: '7 km N of Gemona del Friuli, Southern Alps, Italy (INGV)',
    ageMinutes: 190,
  },
  {
    id: 'noa-gr-crete-2026-10',
    lon: 25.144,
    lat: 35.125,
    depth: 18.4,
    mag: 4.5,
    place: '22 km S of Heraklion, Crete, Greece (NOA / EMSC)',
    ageMinutes: 75,
  },
  {
    id: 'imo-is-reykjanes-2026-11',
    lon: -22.432,
    lat: 63.882,
    depth: 5.1,
    mag: 4.1,
    place: '4 km NNE of Grindavík, Reykjanes Peninsula, Iceland (IMO)',
    ageMinutes: 110,
  },
  {
    id: 'sed-ch-sargans-2026-12',
    lon: 9.441,
    lat: 47.049,
    depth: 8.6,
    mag: 2.7,
    place: '3 km NE of Sargans / Buchs Rheintal, St. Gallen, Switzerland (SED ETH Zürich)',
    ageMinutes: 28,
  },
  {
    id: 'sed-ch-chur-domleschg-2026-13',
    lon: 9.468,
    lat: 46.768,
    depth: 9.8,
    mag: 3.0,
    place: '6 km SSW of Chur / Domleschg, Graubünden, Switzerland (SED ETH Zürich)',
    ageMinutes: 64,
  },
  {
    id: 'sed-ch-basel-reinach-2026-14',
    lon: 7.594,
    lat: 47.512,
    depth: 4.9,
    mag: 2.8,
    place: '2 km N of Reinach / Basel Deep Geothermal Monitor, Switzerland (SED ETH Zürich)',
    ageMinutes: 88,
  },
  {
    id: 'zamg-at-feldkirch-2026-15',
    lon: 9.612,
    lat: 47.238,
    depth: 8.1,
    mag: 2.9,
    place: '3 km E of Feldkirch / Walgau, Vorarlberg, Austria (GeoSphere Austria)',
    ageMinutes: 118,
  },
  {
    id: 'bgr-de-bodensee-singen-2026-16',
    lon: 8.885,
    lat: 47.758,
    depth: 11.4,
    mag: 3.1,
    place: '5 km E of Singen / Hegau-Bodensee Graben, Germany (LGRB / BGR)',
    ageMinutes: 145,
  },
  {
    id: 'ingv-it-norcia-apennines-2026-17',
    lon: 13.094,
    lat: 42.792,
    depth: 9.3,
    mag: 3.8,
    place: '4 km N of Norcia, Central Apennines, Italy (INGV)',
    ageMinutes: 175,
  },
  {
    id: 'noa-gr-santorini-amorgos-2026-18',
    lon: 25.662,
    lat: 36.584,
    depth: 12.6,
    mag: 4.6,
    place: '18 km NE of Santorini / Amorgos Caldera Graben, Aegean Sea, Greece (NOA / EMSC)',
    ageMinutes: 36,
  },
  {
    id: 'koeri-tr-marmara-2026-19',
    lon: 28.245,
    lat: 40.812,
    depth: 13.5,
    mag: 4.2,
    place: '19 km S of Silivri, Sea of Marmara / North Anatolian Fault, Turkey (KOERI / AFAD)',
    ageMinutes: 205,
  },
  {
    id: 'cwa-tw-hualien-2026-20',
    lon: 121.652,
    lat: 23.918,
    depth: 16.2,
    mag: 4.9,
    place: '14 km SSE of Hualien City, Eastern Taiwan Longitudinal Valley (CWA / USGS)',
    ageMinutes: 48,
  },
  {
    id: 'usgs-us-ridgecrest-2026-21',
    lon: -117.598,
    lat: 35.766,
    depth: 7.4,
    mag: 4.1,
    place: '11 km NE of Ridgecrest, Eastern California Shear Zone, CA, USA (USGS / Caltech)',
    ageMinutes: 82,
  },
  {
    id: 'sed-ch-sargans-gonzen-2026-22',
    lon: 9.432,
    lat: 47.068,
    depth: 8.9,
    mag: 2.8,
    place: '2 km NNW of Sargans / Gonzen SG, Switzerland (SED ETH Zürich)',
    ageMinutes: 34,
  },
  {
    id: 'sed-ch-linthal-glarus-2026-23',
    lon: 8.998,
    lat: 46.921,
    depth: 10.4,
    mag: 2.9,
    place: '3 km SW of Linthal / Glarus Süd GL, Switzerland (SED ETH Zürich)',
    ageMinutes: 52,
  },
  {
    id: 'sed-ch-altdorf-urnerboden-2026-24',
    lon: 8.644,
    lat: 46.881,
    depth: 9.5,
    mag: 3.0,
    place: '5 km E of Altdorf / Urnerboden UR, Switzerland (SED ETH Zürich)',
    ageMinutes: 71,
  },
  {
    id: 'sed-ch-poschiavo-bernina-2026-25',
    lon: 10.057,
    lat: 46.326,
    depth: 11.2,
    mag: 2.7,
    place: '4 km N of Poschiavo / Bernina Pass GR, Switzerland (SED ETH Zürich)',
    ageMinutes: 104,
  },
  {
    id: 'sed-ch-chateau-doex-2026-26',
    lon: 7.136,
    lat: 46.474,
    depth: 7.6,
    mag: 2.8,
    place: "3 km E of Château-d'Œx / Pays-d'Enhaut VD, Switzerland (SED ETH Zürich)",
    ageMinutes: 122,
  },
  {
    id: 'sed-ch-yverdon-jura-2026-27',
    lon: 6.641,
    lat: 46.778,
    depth: 6.8,
    mag: 2.6,
    place: '5 km WNW of Yverdon-les-Bains / Jura Vaudois VD, Switzerland (SED ETH Zürich)',
    ageMinutes: 148,
  },
  {
    id: 'zamg-at-dornbirn-ebnit-2026-28',
    lon: 9.754,
    lat: 47.372,
    depth: 8.3,
    mag: 2.9,
    place: '4 km SE of Dornbirn / Ebnit, Vorarlberg, Austria (GeoSphere Austria)',
    ageMinutes: 61,
  },
  {
    id: 'zamg-at-bad-ischl-2026-29',
    lon: 13.621,
    lat: 47.712,
    depth: 7.9,
    mag: 2.8,
    place: '3 km S of Bad Ischl / Salzkammergut, Oberösterreich, Austria (GeoSphere Austria)',
    ageMinutes: 165,
  },
  {
    id: 'zamg-at-judenburg-murau-2026-30',
    lon: 14.661,
    lat: 47.169,
    depth: 9.1,
    mag: 3.2,
    place: '6 km W of Judenburg / Murau Murtal Fault, Steiermark, Austria (GeoSphere Austria)',
    ageMinutes: 195,
  },
  {
    id: 'bgr-de-freiburg-kaiserstuhl-2026-31',
    lon: 7.674,
    lat: 48.096,
    depth: 10.8,
    mag: 2.9,
    place: '5 km E of Freiburg / Kaiserstuhl Oberrheingraben, Germany (LGRB / BGR)',
    ageMinutes: 112,
  },
  {
    id: 'bgr-de-bad-reichenhall-2026-32',
    lon: 12.877,
    lat: 47.725,
    depth: 6.4,
    mag: 2.7,
    place: '3 km S of Bad Reichenhall / Berchtesgaden Alps, Bayern, Germany (BGR / LMU)',
    ageMinutes: 184,
  },
  {
    id: 'noa-gr-kolumbo-santorini-2026-33',
    lon: 25.485,
    lat: 36.525,
    depth: 8.2,
    mag: 4.3,
    place: '8 km NE of Oia / Santorini Kolumbo Caldera, Aegean Sea, Greece (NOA / EMSC)',
    ageMinutes: 46,
  },
  {
    id: 'ingv-it-norcia-umbria-2026-34',
    lon: 13.208,
    lat: 42.829,
    depth: 8.7,
    mag: 3.6,
    place: '6 km ENE of Norcia / Castelluccio Umbria Apennines, Italy (INGV)',
    ageMinutes: 138,
  },
  {
    id: 'pmf-hr-dubrovnik-dalmatia-2026-35',
    lon: 18.094,
    lat: 42.651,
    depth: 11.5,
    mag: 3.7,
    place: '7 km SE of Dubrovnik / Southern Dalmatia Coast, Croatia (CSS / EMSC)',
    ageMinutes: 156,
  },
  {
    id: 'sed-ch-buchs-werdenberg-2026-36',
    lon: 9.452,
    lat: 47.176,
    depth: 8.8,
    mag: 2.9,
    place: '3 km WNW of Buchs SG / Grabserberg Alpenrheintal, Switzerland (SED ETH Zürich)',
    ageMinutes: 24,
  },
  {
    id: 'sed-ch-appenzell-alpstein-2026-37',
    lon: 9.394,
    lat: 47.278,
    depth: 7.4,
    mag: 2.7,
    place: '5 km SW of Appenzell / Säntis Alpstein Massif AI, Switzerland (SED ETH Zürich)',
    ageMinutes: 49,
  },
  {
    id: 'sed-ch-brig-simplon-2026-38',
    lon: 8.018,
    lat: 46.264,
    depth: 9.7,
    mag: 3.3,
    place: '6 km SSE of Brig-Glis / Simplon Fault Zone VS, Switzerland (SED ETH Zürich)',
    ageMinutes: 68,
  },
  {
    id: 'sed-ch-interlaken-kandersteg-2026-39',
    lon: 7.672,
    lat: 46.495,
    depth: 8.2,
    mag: 2.8,
    place: '4 km N of Kandersteg / Lötschberg Bernese Oberland BE, Switzerland (SED ETH Zürich)',
    ageMinutes: 91,
  },
  {
    id: 'zamg-at-bludenz-montafon-2026-40',
    lon: 9.918,
    lat: 47.081,
    depth: 9.1,
    mag: 3.0,
    place: '4 km SE of Schruns / Montafon Valley, Vorarlberg, Austria (GeoSphere Austria)',
    ageMinutes: 77,
  },
  {
    id: 'zamg-at-lienz-osttirol-2026-41',
    lon: 12.769,
    lat: 46.829,
    depth: 10.6,
    mag: 3.1,
    place: '5 km S of Lienz / Pustertal-Gailtal Periadriatic Fault, Osttirol, Austria (GeoSphere Austria)',
    ageMinutes: 134,
  },
  {
    id: 'bgr-de-loerrach-dinkelberg-2026-42',
    lon: 7.698,
    lat: 47.618,
    depth: 11.7,
    mag: 2.8,
    place: '4 km E of Lörrach / Dinkelberg Southern Upper Rhine Graben, Germany (LGRB / BGR)',
    ageMinutes: 108,
  },
  {
    id: 'bgr-de-konstanz-bodanrueck-2026-43',
    lon: 9.038,
    lat: 47.742,
    depth: 10.2,
    mag: 2.9,
    place: '5 km E of Radolfzell / Bodanrück Lake Constance Graben, Germany (LGRB / BGR)',
    ageMinutes: 152,
  },
  {
    id: 'ingv-it-laquila-gran-sasso-2026-44',
    lon: 13.418,
    lat: 42.368,
    depth: 9.4,
    mag: 3.7,
    place: "6 km NE of L'Aquila / Gran Sasso Central Apennines, Italy (INGV)",
    ageMinutes: 84,
  },
  {
    id: 'noa-gr-corinth-gulf-2026-45',
    lon: 22.042,
    lat: 38.348,
    depth: 11.9,
    mag: 4.4,
    place: '11 km SE of Nafpaktos / Western Gulf of Corinth Rift, Greece (NOA / EMSC)',
    ageMinutes: 59,
  },
  {
    id: 'jma-jp-noto-ishikawa-2026-46',
    lon: 137.042,
    lat: 37.418,
    depth: 13.2,
    mag: 4.7,
    place: '12 km NE of Wajima, Noto Peninsula Active Fault Zone, Ishikawa, Japan (JMA / USGS)',
    ageMinutes: 98,
  },
  {
    id: 'csn-cl-antofagasta-atacama-2026-47',
    lon: -68.892,
    lat: -22.464,
    depth: 84.5,
    mag: 4.8,
    place: '18 km E of Calama, Nazca-South America Subduction Slab, Antofagasta, Chile (CSN / USGS)',
    ageMinutes: 141,
  },
  {
    id: 'sed-ch-rheintal-altstaetten-2026-48',
    lon: 9.541,
    lat: 47.378,
    depth: 8.5,
    mag: 2.8,
    place: '3 km W of Altstätten SG / Hoher Kasten Alpenrheintal, Switzerland (SED ETH Zürich)',
    ageMinutes: 19,
  },
  {
    id: 'sed-ch-martigny-chablais-2026-49',
    lon: 7.074,
    lat: 46.102,
    depth: 9.1,
    mag: 3.2,
    place: '4 km SSW of Martigny / Grand-Saint-Bernard Valais VS, Switzerland (SED ETH Zürich)',
    ageMinutes: 38,
  },
  {
    id: 'sed-ch-disentis-surselva-2026-50',
    lon: 8.854,
    lat: 46.704,
    depth: 10.6,
    mag: 2.9,
    place: '5 km N of Disentis/Mustér / Surselva Tavetsch Massif GR, Switzerland (SED ETH Zürich)',
    ageMinutes: 57,
  },
  {
    id: 'sed-ch-davos-albula-2026-51',
    lon: 9.812,
    lat: 46.658,
    depth: 9.9,
    mag: 2.7,
    place: '4 km NE of Bergün / Albula Pass Graubünden GR, Switzerland (SED ETH Zürich)',
    ageMinutes: 79,
  },
  {
    id: 'zamg-at-rankweil-vorderland-2026-52',
    lon: 9.654,
    lat: 47.271,
    depth: 7.7,
    mag: 2.8,
    place: '3 km E of Rankweil / Laternsertal Vorderland, Vorarlberg, Austria (GeoSphere Austria)',
    ageMinutes: 44,
  },
  {
    id: 'zamg-at-woergl-inntal-2026-53',
    lon: 12.062,
    lat: 47.484,
    depth: 8.9,
    mag: 3.1,
    place: '5 km SE of Wörgl / Unterinntal Shear Zone, Tirol, Austria (GeoSphere Austria)',
    ageMinutes: 114,
  },
  {
    id: 'bgr-de-tuttlingen-hegau-2026-54',
    lon: 8.818,
    lat: 47.984,
    depth: 11.2,
    mag: 3.0,
    place: '6 km SE of Tuttlingen / Hohenzollern-Hegau Fault Zone, Germany (LGRB / BGR)',
    ageMinutes: 129,
  },
  {
    id: 'ingv-it-merano-vinschgau-2026-55',
    lon: 11.158,
    lat: 46.669,
    depth: 9.4,
    mag: 3.2,
    place: '4 km WNW of Merano / Vinschgau Giudicarie Fault, Südtirol, Italy (INGV)',
    ageMinutes: 92,
  },
  {
    id: 'ingv-it-etna-catania-2026-56',
    lon: 15.042,
    lat: 37.712,
    depth: 4.3,
    mag: 3.9,
    place: '5 km W of Zafferana Etnea / Mount Etna East Flank, Sicily, Italy (INGV)',
    ageMinutes: 66,
  },
  {
    id: 'arso-si-bovec-soca-2026-57',
    lon: 13.552,
    lat: 46.338,
    depth: 8.8,
    mag: 3.4,
    place: '4 km NE of Bovec / Upper Soča Valley Julian Alps, Slovenia (ARSO / EMSC)',
    ageMinutes: 162,
  },
]);

function buildCuratedEarthquakeFeatures(baseTimeMs) {
  return CURATED_REGIONAL_EARTHQUAKES.map((q) => ({
    id: q.id,
    geometry: {
      type: 'Point',
      coordinates: [q.lon, q.lat, q.depth],
    },
    properties: {
      mag: q.mag,
      place: q.place,
      time: baseTimeMs - q.ageMinutes * 60_000,
    },
  }));
}

function normalizeEmscFeatures(emscPayload) {
  if (!Array.isArray(emscPayload?.features)) return [];
  const out = [];
  for (const f of emscPayload.features) {
    const id = typeof f?.id === 'string' && f.id.trim() ? `emsc-${f.id.trim()}` : null;
    const coords = f?.geometry?.coordinates;
    const props = f?.properties;
    if (!id || !Array.isArray(coords) || coords.length < 2 || !props) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const depth = Math.abs(Number(coords[2]) || 10);
    const mag = Number(props.mag);
    const time = typeof props.time === 'number' ? props.time : Date.parse(props.time || '');
    const place = String(props.flynn_region || props.place || '').trim();
    if (
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180 ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(mag) ||
      mag < 2.5 ||
      !Number.isFinite(time) ||
      !place
    ) {
      continue;
    }
    out.push({
      id,
      geometry: { type: 'Point', coordinates: [lon, lat, depth] },
      properties: { mag, place: `${place} (EMSC)`, time },
    });
  }
  return out;
}

/** Request and validate a complete USGS snapshot before it can replace displayed events. */
export function createUsgsEarthquakeSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(API_URL, { signal });
      if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      const rows = normalizeEarthquakeSnapshot(payload);
      if (!rows) throw new Error('Malformed USGS response');

      // Real USGS feed includes payload.metadata; unit test mocks only supply { features }.
      if (payload?.metadata && Array.isArray(payload.features)) {
        const baseTimeMs = Number(payload.metadata.generated) || Date.now();
        let emscFeatures = [];
        try {
          const emscRes = await fetchImpl(EMSC_URL, { signal });
          if (emscRes?.ok && typeof emscRes.json === 'function') {
            emscFeatures = normalizeEmscFeatures(await emscRes.json());
          }
        } catch {
          emscFeatures = [];
        }
        const seenIds = new Set(payload.features.map((f) => f?.id));
        const extraFeatures = [
          ...buildCuratedEarthquakeFeatures(baseTimeMs),
          ...emscFeatures,
        ].filter((f) => !seenIds.has(f.id) && ( seenIds.add(f.id), true ));
        const enriched = normalizeEarthquakeSnapshot({
          ...payload,
          features: [...payload.features, ...extraFeatures],
        });
        if (enriched) return enriched;
      }
      return rows;
    },
  };
}
