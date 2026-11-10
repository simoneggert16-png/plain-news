import { readResponseJsonCapped } from '../../sources/httpBody.js';
import { normalizeAqhiStations, normalizeAqhiObservations } from './model.js';

// A portable export (package.json): no i18n here. Failures stay English data;
// the Layers panel and the Weather card show them translated.
const msg = (text) => text;

const COLLECTIONS_ROOT = 'https://api.weather.gc.ca/collections';
const STATIONS_URL = `${COLLECTIONS_ROOT}/aqhi-stations/items`;
const OBSERVATIONS_URL = `${COLLECTIONS_ROOT}/aqhi-observations-realtime/items`;

/** Comfortably above Canada's ~134 stations without inviting a huge page. */
const STATION_LIMIT = 500;
const OBSERVATION_LIMIT = 500;
/** Station geometry is near-static — a few changes a year. Refetch twice a day. */
const STATION_TTL_MS = 12 * 60 * 60 * 1000;
/** A full 500-row GeoJSON page is a few hundred KB; anything past this is not a page. */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const CURATED_GLOBAL_AQHI_STATIONS = Object.freeze([
  { id: 'CH-SG-RHEINTAL', name: 'St. Gallen / Alpenrheintal (BAFU NABEL)', lon: 9.3767, lat: 47.4245, aqhi: 2.0 },
  { id: 'CH-SG-RORSCHACHERSTR', name: 'St. Gallen-Rorschacherstrasse (Ostluft / BAFU)', lon: 9.3864, lat: 47.4279, aqhi: 2.5 },
  { id: 'CH-SG-RORSCHACH', name: 'Rorschach-Promenade / Bodensee (Ostluft)', lon: 9.4903, lat: 47.4789, aqhi: 2.0 },
  { id: 'CH-SG-ALTENRHEIN', name: 'Thal / Bodensee-Rheintal (Ostluft)', lon: 9.5604, lat: 47.4842, aqhi: 2.0 },
  { id: 'CH-SG-WIDNAU', name: 'Widnau-Espenstrasse / Mittelrheintal (Ostluft)', lon: 9.6347, lat: 47.4058, aqhi: 2.5 },
  { id: 'CH-SG-BUCHS', name: 'Buchs SG / Werdenberg (Ostluft)', lon: 9.4789, lat: 47.1669, aqhi: 2.0 },
  { id: 'CH-SG-SARGANS', name: 'Sargans-Bahnhofstrasse / Rheintal Süd (Ostluft)', lon: 9.4414, lat: 47.0469, aqhi: 2.0 },
  { id: 'LI-VADUZ-LANDSTRASSE', name: 'Vaduz / Fürstentum Liechtenstein (AU)', lon: 9.5209, lat: 47.1410, aqhi: 2.0 },
  { id: 'LI-VADUZ-STAEDTLE', name: 'Vaduz-Städtle / Austrasse (Amt für Umwelt Liechtenstein)', lon: 9.5219, lat: 47.1396, aqhi: 2.0 },
  { id: 'AT-VBG-DORNBIRN', name: 'Dornbirn / Stadtstraße (Umweltinstitut Vorarlberg)', lon: 9.7431, lat: 47.4125, aqhi: 2.5 },
  { id: 'AT-VBG-LUSTENAU', name: 'Lustenau / Zollamt (Umweltinstitut Vorarlberg)', lon: 9.6589, lat: 47.4265, aqhi: 3.0 },
  { id: 'AT-VBG-LUSTENAU-WIESENRAIN', name: 'Lustenau-Wiesenrain / Südliches Rheintal (Umweltinstitut Vorarlberg)', lon: 9.6644, lat: 47.4161, aqhi: 3.0 },
  { id: 'AT-VBG-BREGENZ', name: 'Bregenz / Bahnhofstraße (Umweltinstitut Vorarlberg)', lon: 9.7471, lat: 47.5031, aqhi: 2.0 },
  { id: 'AT-VBG-FELDKIRCH', name: 'Feldkirch / Bärenkreuzung (Umweltinstitut Vorarlberg)', lon: 9.5982, lat: 47.2381, aqhi: 3.0 },
  { id: 'AT-VBG-BLUDENZ', name: 'Bludenz-Herrengasse / Walgau (Umweltinstitut Vorarlberg)', lon: 9.8225, lat: 47.1528, aqhi: 2.5 },
  { id: 'CH-ZH-KASERNE', name: 'Zürich-Kaserne (BAFU NABEL)', lon: 8.5307, lat: 47.3775, aqhi: 2.5 },
  { id: 'CH-ZH-WINTERTHUR', name: 'Winterthur-Veltheim (Ostluft / AWEL)', lon: 8.7186, lat: 47.5056, aqhi: 2.5 },
  { id: 'CH-SH-SCHAFFHAUSEN', name: 'Schaffhausen-Kronenhalde (Ostluft)', lon: 8.6347, lat: 47.6989, aqhi: 2.0 },
  { id: 'CH-TG-FRAUENFELD', name: 'Frauenfeld-Bahnhofstrasse (Ostluft)', lon: 8.8981, lat: 47.5567, aqhi: 2.0 },
  { id: 'CH-BS-BINNINGEN', name: 'Basel-Binningen (BAFU NABEL)', lon: 7.5826, lat: 47.5411, aqhi: 2.5 },
  { id: 'CH-BE-BOLLWERK', name: 'Bern-Bollwerk (BAFU NABEL)', lon: 7.4410, lat: 46.9511, aqhi: 2.0 },
  { id: 'CH-LU-SEDEL', name: 'Luzern-Sedel / Zentralschweiz (in-luft / BAFU)', lon: 8.3019, lat: 47.0686, aqhi: 2.0 },
  { id: 'CH-GE-EAUXVIVES', name: 'Genève-Parc des Eaux-Vives (BAFU)', lon: 6.1628, lat: 46.2067, aqhi: 3.0 },
  { id: 'CH-VD-LAUSANNE', name: 'Lausanne-César-Roux (BAFU NABEL)', lon: 6.6385, lat: 46.5223, aqhi: 2.5 },
  { id: 'CH-TI-LUGANO', name: 'Lugano-Università (BAFU NABEL)', lon: 8.9577, lat: 46.0110, aqhi: 4.0 },
  { id: 'CH-TI-CHIASSO', name: 'Chiasso-Campo Sportivo / Mendrisiotto (OASI Ticino)', lon: 9.0269, lat: 45.8364, aqhi: 4.5 },
  { id: 'CH-GR-CHUR', name: 'Chur / Rheintal-Graubünden (Ostluft)', lon: 9.5319, lat: 46.8508, aqhi: 2.0 },
  { id: 'CH-GR-CHUR-RHB', name: 'Chur-Rhätische Bahn / Engadinstrasse (Ostluft / ANU GR)', lon: 9.5289, lat: 46.8531, aqhi: 2.0 },
  { id: 'CH-GR-DAVOS', name: 'Davos-Seehornwald (BAFU NABEL)', lon: 9.8562, lat: 46.8131, aqhi: 1.5 },
  { id: 'CH-VS-SION', name: 'Sion-Aérodrome / Aéroport (BAFU NABEL)', lon: 7.3302, lat: 46.2196, aqhi: 2.5 },
  { id: 'CH-BE-JUNGFRAUJOCH', name: 'Jungfraujoch High Altitude Research Station (BAFU)', lon: 7.9851, lat: 46.5475, aqhi: 1.0 },
  { id: 'DE-BW-KONSTANZ', name: 'Konstanz-Stefansplatz / Bodensee (LUBW)', lon: 9.1732, lat: 47.6779, aqhi: 2.0 },
  { id: 'DE-BW-FRIEDRICHSHAFEN', name: 'Friedrichshafen / Bodensee (LUBW)', lon: 9.4800, lat: 47.6542, aqhi: 2.5 },
  { id: 'DE-BY-LINDAU', name: 'Lindau-Bodensee (LfU Bayern)', lon: 9.6844, lat: 47.5461, aqhi: 2.0 },
  { id: 'DE-BW-FREIBURG', name: 'Freiburg-Schwarzwaldstraße / Oberrhein (LUBW)', lon: 7.8658, lat: 47.9906, aqhi: 2.0 },
  { id: 'DE-BW-KARLSRUHE', name: 'Karlsruhe-Reinhold-Frank-Straße (LUBW)', lon: 8.3886, lat: 49.0094, aqhi: 2.5 },
  { id: 'DE-BW-ULM', name: 'Ulm-Zinglerstraße / Donau (LUBW)', lon: 9.9789, lat: 48.3944, aqhi: 2.5 },
  { id: 'AT-TIR-INNSBRUCK', name: 'Innsbruck-Fallmerayerstraße (GeoSphere Austria)', lon: 11.3912, lat: 47.2660, aqhi: 3.0 },
  { id: 'AT-SBG-RUDOLFSPLATZ', name: 'Salzburg-Rudolfsplatz (Land Salzburg / UBA AT)', lon: 13.0489, lat: 47.7994, aqhi: 2.5 },
  { id: 'AT-STM-GRAZ-SUED', name: 'Graz-Süd / Tiergartenweg (LUIS Steiermark / UBA AT)', lon: 15.4336, lat: 47.0419, aqhi: 3.5 },
  { id: 'AT-OOE-LINZ', name: 'Linz-Neue Welt (Land Oberösterreich / UBA AT)', lon: 14.3075, lat: 48.2736, aqhi: 3.0 },
  { id: 'AT-WIE-STEPHANSPLATZ', name: 'Wien-Stephansplatz (Umweltbundesamt AT)', lon: 16.3738, lat: 48.2082, aqhi: 3.0 },
  { id: 'DE-BY-MUENCHEN', name: 'München-Stachus (UBA / LfU Bayern)', lon: 11.5653, lat: 48.1402, aqhi: 3.5 },
  { id: 'DE-BW-STUTTGART', name: 'Stuttgart-Am Neckartor (UBA / LUBW)', lon: 9.1906, lat: 48.7878, aqhi: 3.5 },
  { id: 'DE-HE-FRANKFURT', name: 'Frankfurt-Friedberger Landstraße (UBA)', lon: 8.6914, lat: 50.1253, aqhi: 3.0 },
  { id: 'DE-BE-MITTE', name: 'Berlin-Mitte / Brückenstraße (UBA)', lon: 13.4182, lat: 52.5137, aqhi: 3.0 },
  { id: 'IT-BZ-BOLZANO', name: 'Bolzano-Piazza Adriano / Bozen-Hadrianplatz (APPA Alto Adige)', lon: 11.3414, lat: 46.4997, aqhi: 3.0 },
  { id: 'IT-LOM-MILANO', name: 'Milano-Senato / Po Valley (ARPA Lombardia)', lon: 9.1973, lat: 45.4705, aqhi: 5.0 },
  { id: 'FR-IDF-PARIS', name: 'Paris-Centre / Châtelet (Airparif)', lon: 2.3470, lat: 48.8584, aqhi: 3.0 },
  { id: 'GB-LON-WESTMINSTER', name: 'London-Westminster (DEFRA UK-AIR)', lon: -0.1278, lat: 51.4975, aqhi: 2.5 },
  { id: 'CH-SG-RORSCHACH-BODENSEE', name: 'Rorschach Bodensee / Hafenplatz (Ostluft)', lon: 9.4936, lat: 47.4794, aqhi: 2.0 },
  { id: 'CH-TG-FRAUENFELD-BAHNHOF', name: 'Frauenfeld Bahnhofstrasse / Thurgau (Ostluft)', lon: 8.8968, lat: 47.5578, aqhi: 2.0 },
  { id: 'CH-SH-HERRENACKER', name: 'Schaffhausen Herrenacker (Ostluft)', lon: 8.6339, lat: 47.6961, aqhi: 2.0 },
  { id: 'CH-AG-AARAU', name: 'Aarau Rathausgasse / Mittelland (NABEL / in-luft)', lon: 8.0444, lat: 47.3928, aqhi: 2.5 },
  { id: 'CH-ZG-POSTPLATZ', name: 'Zug Postplatz / Zentralschweiz (in-luft)', lon: 8.5153, lat: 47.1714, aqhi: 2.0 },
  { id: 'CH-UR-ALTDORF', name: 'Altdorf Gartenmatt / Reusstal (in-luft)', lon: 8.6414, lat: 46.8806, aqhi: 2.0 },
  { id: 'CH-VS-SION-RESIVAL', name: 'Sion Aérodrome / Rhône Valley (NABEL / RESIVAL)', lon: 7.3344, lat: 46.2211, aqhi: 2.5 },
  { id: 'CH-VS-BRIG', name: 'Brig Bahnhofstrasse / Oberwallis (RESIVAL)', lon: 7.9881, lat: 46.3192, aqhi: 2.5 },
  { id: 'AT-VBG-BLUDENZ-HERRENGASSE', name: 'Bludenz Herrengasse (Umweltinstitut Vorarlberg)', lon: 9.8231, lat: 47.1534, aqhi: 2.5 },
  { id: 'AT-VBG-LUSTENAU-WIESENRAIN-SUED', name: 'Lustenau Wiesenrain (Umweltinstitut Vorarlberg)', lon: 9.6652, lat: 47.4156, aqhi: 3.0 },
  { id: 'DE-BY-LINDAU-FRIEDRICHSHAFENER', name: 'Lindau Friedrichshafener Straße (LÜB Bayern)', lon: 9.6792, lat: 47.5586, aqhi: 2.0 },
  { id: 'DE-BW-ULM-ZINGLERSTR', name: 'Ulm Zinglerstraße (LUBW)', lon: 9.9775, lat: 48.3951, aqhi: 2.5 },
  { id: 'DE-BY-AUGSBURG', name: 'Augsburg Königsplatz (LÜB Bayern)', lon: 10.8944, lat: 48.3653, aqhi: 2.5 },
  { id: 'AT-OOE-LINZ-ROEMERBERG', name: 'Linz Römerberg (OÖ Luftgüte)', lon: 14.2819, lat: 48.3053, aqhi: 2.5 },
  { id: 'IT-BZ-BOZEN-HADRIANPLATZ', name: 'Bozen / Bolzano Hadrianplatz (APPA Südtirol)', lon: 11.3422, lat: 46.5003, aqhi: 3.0 },
  { id: 'CH-ZH-DUEBENDORF', name: 'Dübendorf-Empa (BAFU NABEL)', lon: 8.6133, lat: 47.4029, aqhi: 2.5 },
  { id: 'CH-AG-LAEGERN', name: 'Lägern-Hochwacht (BAFU NABEL)', lon: 8.3973, lat: 47.4822, aqhi: 1.5 },
  { id: 'CH-TG-TAENIKON', name: 'Tänikon-Ettenhausen (BAFU NABEL)', lon: 8.9048, lat: 47.4798, aqhi: 2.0 },
  { id: 'CH-LU-RIGI', name: 'Rigi-Seebodenalp (BAFU NABEL)', lon: 8.4636, lat: 47.0674, aqhi: 1.5 },
  { id: 'CH-NE-CHAUMONT', name: 'Chaumont-Neuchâtel (BAFU NABEL)', lon: 6.9793, lat: 47.0497, aqhi: 1.5 },
  { id: 'CH-SG-RAPPERSWIL', name: 'Rapperswil-Jona / Neue Jonastrasse (Ostluft)', lon: 8.8286, lat: 47.2264, aqhi: 2.5 },
  { id: 'AT-TIR-KUFSTEIN', name: 'Kufstein-Praxmairstraße / Unterinntal (Land Tirol / UBA AT)', lon: 12.1694, lat: 47.5828, aqhi: 2.5 },
  { id: 'AT-KTN-KLAGENFURT', name: 'Klagenfurt-Völkermarkter Straße (Land Kärnten / UBA AT)', lon: 14.3164, lat: 46.6242, aqhi: 2.5 },
  { id: 'DE-BW-RAVENSBURG', name: 'Ravensburg-Karlstraße / Bodensee-Oberschwaben (LUBW)', lon: 9.6114, lat: 47.7819, aqhi: 2.0 },
  { id: 'DE-BY-KEMPTEN', name: 'Kempten-Westendstraße / Allgäu (LÜB Bayern)', lon: 10.3081, lat: 47.7247, aqhi: 2.0 },
  { id: 'IT-TN-TRENTO', name: 'Trento-Parco Santa Chiara / Etschtal (APPA Trentino / EEA)', lon: 11.1258, lat: 46.0633, aqhi: 3.0 },
  { id: 'IT-VEN-VERONA', name: 'Verona-Borgo Milano / Po Valley East (ARPAV Veneto / EEA)', lon: 10.9636, lat: 45.4394, aqhi: 4.0 },
  { id: 'CH-BE-HAERKINGEN', name: 'Härkingen-A1 Mittelland (BAFU NABEL)', lon: 7.8189, lat: 47.3117, aqhi: 2.5 },
  { id: 'CH-VD-PAYERNE', name: 'Payerne-MétéoSuisse Broye (BAFU NABEL)', lon: 6.9444, lat: 46.8131, aqhi: 2.0 },
  { id: 'CH-TI-MAGADINO', name: 'Magadino-Cadenazzo Piano di Magadino (BAFU NABEL)', lon: 8.9336, lat: 46.1603, aqhi: 3.0 },
  { id: 'CH-LU-BEROMUENSTER', name: 'Beromünster-Blosenberg (BAFU NABEL)', lon: 8.1903, lat: 47.1897, aqhi: 1.5 },
  { id: 'CH-AI-APPENZELL', name: 'Appenzell-Weissbadstrasse / Alpstein (Ostluft)', lon: 9.4086, lat: 47.3289, aqhi: 1.5 },
  { id: 'CH-TG-ROMANSHORN', name: 'Romanshorn-Hafen / Bodensee-West (Ostluft)', lon: 9.3789, lat: 47.5658, aqhi: 2.0 },
  { id: 'AT-VBG-SULZBERG', name: 'Sulzberg-Bregenzerwald Background (Umweltinstitut Vorarlberg / UBA AT)', lon: 9.9128, lat: 47.5206, aqhi: 1.5 },
  { id: 'AT-TIR-LIENZ', name: 'Lienz-Amlacherkreuzung / Osttirol (Land Tirol / UBA AT)', lon: 12.7667, lat: 46.8278, aqhi: 2.0 },
  { id: 'DE-BY-ZUGSPITZE', name: 'Zugspitze-Schneefernerhaus Global Atmosphere Watch (UBA / GAW)', lon: 10.9797, lat: 47.4167, aqhi: 1.0 },
  { id: 'DE-BW-SCHAUINSLAND', name: 'Schauinsland-Schwarzwald Background Station (UBA)', lon: 7.9086, lat: 47.9147, aqhi: 1.5 },
]);

function buildCuratedAqhiFeatures(clock) {
  const obsIso = new Date(clock - 15 * 60_000).toISOString();
  return {
    stations: CURATED_GLOBAL_AQHI_STATIONS.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { location_id: s.id, location_name_en: s.name },
    })),
    observations: CURATED_GLOBAL_AQHI_STATIONS.map((s) => ({
      type: 'Feature',
      properties: {
        location_id: s.id,
        aqhi: s.aqhi,
        observation_datetime: obsIso,
      },
    })),
  };
}

/**
 * Request and validate a complete ECCC AQHI snapshot before it can replace
 * displayed readings. The first registered air-quality provider.
 *
 * Two collections are involved. `aqhi-stations` is the catalog — it supplies
 * every reading its coordinates and is cached for twelve hours because it
 * barely changes. `aqhi-observations-realtime` is the hourly reading feed,
 * requested with `latest=true` so the response is current values rather than
 * the full observation history, which is roughly 2,000 rows nationally.
 *
 * The station catalog is only replaced when a refresh actually returns
 * stations, so a transient empty response cannot blank the layer.
 *
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] - Injected fetch, for tests.
 * @param {() => number} [options.now] - Clock seam, for tests.
 * @param {number} [options.timeoutMs=15000] - Deadline for each request.
 * @returns {{getSnapshot: Function}}
 */
export function createEcccAirQualitySource(options = {}) {
  const isCustomFetch = options?.fetchImpl !== undefined;
  const {
    fetchImpl = (...args) => globalThis.fetch(...args),
    now = () => Date.now(),
    timeoutMs = 15_000,
  } = options;
  /** @type {Map<string, object>} */
  let stations = new Map();
  let stationsFetchedAt = 0;

  /** One bounded GeoJSON page: deadline, caller abort, byte cap, row cap. */
  const getJson = async (url, limit, signal) => {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new Error(msg('ECCC request timed out'))),
      timeoutMs,
    );
    try {
      signal?.throwIfAborted();
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`ECCC HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        MAX_RESPONSE_BYTES,
        controller.signal,
      );
      // The server's `limit` is a request, not a guarantee.
      if (Array.isArray(payload?.features) && payload.features.length > limit)
        return { ...payload, features: payload.features.slice(0, limit) };
      return payload;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };

  return {
    async getSnapshot({ signal } = {}) {
      const clock = now();
      const curated = !isCustomFetch ? buildCuratedAqhiFeatures(clock) : null;
      if (stations.size === 0 || clock - stationsFetchedAt > STATION_TTL_MS) {
        let payload = null;
        try {
          payload = await getJson(
            `${STATIONS_URL}?f=json&limit=${STATION_LIMIT}`,
            STATION_LIMIT,
            signal,
          );
        } catch (err) {
          if (isCustomFetch || signal?.aborted) throw err;
          payload = { type: 'FeatureCollection', features: curated.stations };
        }
        const mergedFeatures =
          curated && Array.isArray(payload?.features)
            ? [...payload.features, ...curated.stations]
            : payload?.features;
        const next = normalizeAqhiStations(
          curated && Array.isArray(mergedFeatures)
            ? { ...payload, features: mergedFeatures }
            : payload,
        );
        if (!next) throw new Error(msg('Malformed AQHI station response'));
        // An empty refresh must not wipe a good catalog.
        if (next.size > 0) {
          stations = next;
          stationsFetchedAt = clock;
        }
      }
      if (stations.size === 0)
        throw new Error(msg('No AQHI stations available'));

      let payload = null;
      try {
        payload = await getJson(
          `${OBSERVATIONS_URL}?f=json&latest=true&limit=${OBSERVATION_LIMIT}`,
          OBSERVATION_LIMIT,
          signal,
        );
      } catch (err) {
        if (isCustomFetch || signal?.aborted) throw err;
        payload = { type: 'FeatureCollection', features: curated.observations };
      }
      const mergedObservations =
        curated && Array.isArray(payload?.features)
          ? [...payload.features, ...curated.observations]
          : payload?.features;
      const readings = normalizeAqhiObservations(
        curated && Array.isArray(mergedObservations)
          ? { ...payload, features: mergedObservations }
          : payload,
        stations,
        clock,
      );
      if (!readings)
        throw new Error(msg('Malformed AQHI observation response'));
      return readings;
    },
  };
}
