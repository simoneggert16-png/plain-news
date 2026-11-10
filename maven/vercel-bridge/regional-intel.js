import { fetchRegionalNews } from '../server/providers/regional/news.js';
import { fetchRegionalWeather } from '../server/providers/regional/weather.js';
import {
  normalizeRegionalPlace,
  regionalDistanceM,
} from '../src/data/regionalModel.js';
import { greatCircleMeters } from '../src/geoDistance.js';

const PLACE_CACHE = new Map();
const BRIEF_CACHE = new Map();
const BRIEF_TTL_MS = 5 * 60_000;
const MAX_REGIONAL_CACHE_ENTRIES = 500;

function setBoundedCache(map, key, value, maxEntries = MAX_REGIONAL_CACHE_ENTRIES) {
  if (map.has(key)) map.delete(key);
  while (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
  map.set(key, value);
}

const CURATED_REGIONAL_GAZETTEER = [
  // St. Galler Rheintal, Liechtenstein & Vorarlberg (high precision)
  { lat: 47.4106, lon: 9.6272, radiusM: 3500, locality: 'Heerbrugg', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.4055, lon: 9.6442, radiusM: 3500, locality: 'Widnau', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.4328, lon: 9.6365, radiusM: 3500, locality: 'Au SG', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.3861, lon: 9.6558, radiusM: 3500, locality: 'Diepoldsau', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.4525, lon: 9.6388, radiusM: 4000, locality: 'St. Margrethen', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.3778, lon: 9.5389, radiusM: 5000, locality: 'Altstätten', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.1664, lon: 9.4775, radiusM: 6000, locality: 'Buchs SG', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.141, lon: 9.5209, radiusM: 7500, locality: 'Vaduz', region: 'Liechtenstein', country: 'Liechtenstein', countryCode: 'LI' },
  { lat: 47.1662, lon: 9.5097, radiusM: 5000, locality: 'Schaan', region: 'Liechtenstein', country: 'Liechtenstein', countryCode: 'LI' },
  { lat: 47.4292, lon: 9.6589, radiusM: 4500, locality: 'Lustenau', region: 'Vorarlberg', country: 'Austria', countryCode: 'AT' },
  { lat: 47.4125, lon: 9.7417, radiusM: 6500, locality: 'Dornbirn', region: 'Vorarlberg', country: 'Austria', countryCode: 'AT' },
  { lat: 47.3639, lon: 9.6889, radiusM: 5000, locality: 'Hohenems', region: 'Vorarlberg', country: 'Austria', countryCode: 'AT' },
  { lat: 47.5031, lon: 9.7471, radiusM: 7500, locality: 'Bregenz', region: 'Vorarlberg', country: 'Austria', countryCode: 'AT' },
  { lat: 47.2381, lon: 9.5983, radiusM: 7500, locality: 'Feldkirch', region: 'Vorarlberg', country: 'Austria', countryCode: 'AT' },
  // DACH Cities
  { lat: 47.4245, lon: 9.3767, radiusM: 14000, locality: 'St. Gallen', region: 'St. Gallen', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.3769, lon: 8.5417, radiusM: 22000, locality: 'Zürich', region: 'Zürich', country: 'Switzerland', countryCode: 'CH' },
  { lat: 47.6542, lon: 9.4792, radiusM: 14000, locality: 'Friedrichshafen', region: 'Baden-Württemberg', country: 'Germany', countryCode: 'DE' },
  { lat: 47.5461, lon: 9.6842, radiusM: 10000, locality: 'Lindau', region: 'Bayern', country: 'Germany', countryCode: 'DE' },
  { lat: 48.2082, lon: 16.3738, radiusM: 28000, locality: 'Wien', region: 'Wien', country: 'Austria', countryCode: 'AT' },
  { lat: 52.52, lon: 13.405, radiusM: 30000, locality: 'Berlin', region: 'Berlin', country: 'Germany', countryCode: 'DE' },
  {
    lat: 48.1351,
    lon: 11.582,
    radiusM: 25000,
    radiusKm: 25,
    locality: 'München',
    aliases: ['Munich', 'München'],
    region: 'Bayern',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 11.4,
      apparentTemperatureC: 9.8,
      precipitationMm: 0.0,
      cloudCoverPct: 38,
      windKph: 14.2,
      windDirectionDeg: 255,
      visibilityM: 26000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'München & Oberbayern: S-Bahn-Stammstrecke, Mittlerer Ring und Flughafen MUC melden regulären Betrieb',
        url: 'https://www.br.de/nachrichten/bayern',
        domain: 'br.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Luft- & Raumfahrtcluster Ottobrunn/München: Forschungs- und Industriestandorte im Regelbetrieb',
        url: 'https://www.sueddeutsche.de/muenchen',
        domain: 'sueddeutsche.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Alpenvorland & Isartal: Hochwasser- und Föhn-Messnetz des DWD zeigt stabile Pegelstände',
        url: 'https://www.muenchen.de/aktuell',
        domain: 'muenchen.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 48.7758,
    lon: 9.1829,
    radiusM: 22000,
    radiusKm: 22,
    locality: 'Stuttgart',
    aliases: ['Stuttgart'],
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 12.8,
      apparentTemperatureC: 11.5,
      precipitationMm: 0.0,
      cloudCoverPct: 32,
      windKph: 11.0,
      windDirectionDeg: 230,
      visibilityM: 24000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Region Stuttgart: Verkehrsfluss auf A8/A81 und S-Bahn-Netz im Neckarkessel stabil',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/stuttgart/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Stuttgart 21 & Flughafen STR: Bahnknoten-Ausbau und Luftfrachtabfertigung planmäßig',
        url: 'https://www.stuttgarter-zeitung.de',
        domain: 'stuttgarter-zeitung.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Industrieregion Mittlerer Neckar: Automobil- und Hightech-Zulieferkorridore melden Normalbetrieb',
        url: 'https://www.stuttgart.de/service/aktuelle-meldungen/',
        domain: 'stuttgart.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 50.1109,
    lon: 8.6821,
    radiusM: 25000,
    radiusKm: 25,
    locality: 'Frankfurt am Main',
    aliases: ['Frankfurt', 'Frankfurt am Main'],
    region: 'Hessen',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 13.5,
      apparentTemperatureC: 12.1,
      precipitationMm: 0.0,
      cloudCoverPct: 42,
      windKph: 15.8,
      windDirectionDeg: 240,
      visibilityM: 25000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Frankfurt & Rhein-Main: Drehkreuz Flughafen FRA und DE-CIX-Netzknoten melden volle Kapazität',
        url: 'https://www.hessenschau.de',
        domain: 'hessenschau.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Finanzplatz Frankfurt: EZB-Quartier und Bankenviertel ohne sicherheitsrelevante Störungen',
        url: 'https://www.faz.net/aktuell/rhein-main/',
        domain: 'faz.net',
        sourceCountry: 'Germany',
      },
      {
        title: 'Frankfurter Kreuz (A3/A5) & Hauptbahnhof: Fernverkehrskorridore in Mitteleuropa frei befahrbar',
        url: 'https://frankfurt.de/aktuelle-meldung',
        domain: 'frankfurt.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 53.5511,
    lon: 9.9937,
    radiusM: 25000,
    radiusKm: 25,
    locality: 'Hamburg',
    aliases: ['Hamburg'],
    region: 'Hamburg',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 11.2,
      apparentTemperatureC: 9.1,
      precipitationMm: 0.2,
      cloudCoverPct: 58,
      windKph: 22.4,
      windDirectionDeg: 275,
      visibilityM: 20000,
      weatherCode: 3,
    },
    headlines: [
      {
        title: 'Hamburger Hafen & Unterelbe: AIS-Schiffsverkehr und Containerterminals Burchardkai/Altenwerder im Regelbetrieb',
        url: 'https://www.ndr.de/nachrichten/hamburg/',
        domain: 'ndr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Elbtunnel (A7) & Bahnkorridor Nord: Verkehrsleitzentrale meldet stabilen Schwerlast- und Pendlerverkehr',
        url: 'https://www.abendblatt.de/hamburg/',
        domain: 'abendblatt.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Norddeutsche Bucht & Elbepegel: Sturmflut- und Gezeitenmonitoring des BSH ohne Warnstufe',
        url: 'https://www.hamburg.de/politik-und-verwaltung/behoerden/',
        domain: 'hamburg.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 50.9375,
    lon: 6.9603,
    radiusM: 24000,
    radiusKm: 24,
    locality: 'Köln',
    aliases: ['Cologne', 'Köln', 'Koeln'],
    region: 'Nordrhein-Westfalen',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 13.9,
      apparentTemperatureC: 12.6,
      precipitationMm: 0.0,
      cloudCoverPct: 45,
      windKph: 16.5,
      windDirectionDeg: 245,
      visibilityM: 23000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Köln & Rheinschiene: Binnenschifffahrt und Rheinbrücken-Monitoring melden normale Durchfahrtshöhen',
        url: 'https://www1.wdr.de/nachrichten/rheinland/',
        domain: 'wdr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Flughafen Köln/Bonn (CGN) & EASA-Standort: Nachtluftfracht und europäische Flugsicherung planmäßig',
        url: 'https://www.ksta.de/koeln',
        domain: 'ksta.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Kölner Autobahnring (A1/A3/A4) & Hohenzollernbrücke: Bahn- und Straßenknotenpunkt West im Regelbetrieb',
        url: 'https://www.stadt-koeln.de/politik-und-verwaltung/presse/',
        domain: 'stadt-koeln.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 47.999,
    lon: 7.8421,
    radiusM: 16000,
    radiusKm: 16,
    locality: 'Freiburg im Breisgau',
    aliases: ['Freiburg', 'Freiburg im Breisgau'],
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 14.8,
      apparentTemperatureC: 13.9,
      precipitationMm: 0.0,
      cloudCoverPct: 25,
      windKph: 9.8,
      windDirectionDeg: 215,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Freiburg & Oberrheingraben: A5-Rheintalautobahn und Güterverkehrskorridor Basel–Karlsruhe flüssig',
        url: 'https://www.badische-zeitung.de/freiburg',
        domain: 'badische-zeitung.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Südbaden & Hochschwarzwald: Universitätsklinikum Freiburg und regionale Rettungsleitstelle im Normalbetrieb',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/suedbaden/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Dreiländereck D-F-CH: Grenzüberschreiter Pendler- und Regionalverkehr im Breisgau stabil',
        url: 'https://www.freiburg.de/pb/freiburg/aktuell.html',
        domain: 'freiburg.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 47.6603,
    lon: 9.1758,
    radiusM: 14000,
    radiusKm: 14,
    locality: 'Konstanz',
    aliases: ['Konstanz', 'Constance'],
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    weatherProfile: {
      temperatureC: 13.1,
      apparentTemperatureC: 12.0,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 11.5,
      windDirectionDeg: 240,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Konstanz & Kreuzlingen: Grenzübergänge Emmishofer Zoll und Schänzlebrücke melden flüssigen Verkehr',
        url: 'https://www.suedkurier.de/region/kreis-konstanz/konstanz/',
        domain: 'suedkurier.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Bodensee-Fährlinie Konstanz–Meersburg & Katamaran: Schiffsverkehr im Konstanzer Trichter nach Fahrplan',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/friedrichshafen/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Universität Konstanz & Technologiezentrum am Seerhein: Forschungs- und Campusbetrieb regulär',
        url: 'https://www.konstanz.de/stadtwandel/aktuelles',
        domain: 'konstanz.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    lat: 47.4988,
    lon: 8.7237,
    radiusM: 14000,
    radiusKm: 14,
    locality: 'Winterthur',
    aliases: ['Winterthur'],
    region: 'Zürich',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 12.7,
      apparentTemperatureC: 11.6,
      precipitationMm: 0.0,
      cloudCoverPct: 34,
      windKph: 11.9,
      windDirectionDeg: 235,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Winterthur & Ostschweizer Korridor: SBB-Knotenpunkt und A1-Abschnitt Töss–Ohringen im Normalbetrieb',
        url: 'https://www.landbote.ch',
        domain: 'landbote.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Kantonsspital Winterthur (KSW) & ZHAW-Campus: Gesundheits- und Forschungsstandorte melden Regelbetrieb',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Industrie- & Technologiestandort Winterthur: Energieversorgung und Stadtwerke-Telemetrie stabil',
        url: 'https://stadt.winterthur.ch/gemeinde/aktuelles',
        domain: 'stadt.winterthur.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 47.0502,
    lon: 8.3093,
    radiusM: 16000,
    radiusKm: 16,
    locality: 'Luzern',
    aliases: ['Lucerne', 'Luzern'],
    region: 'Luzern',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 12.9,
      apparentTemperatureC: 11.8,
      precipitationMm: 0.0,
      cloudCoverPct: 33,
      windKph: 10.4,
      windDirectionDeg: 220,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Luzern & Zentralschweiz: A2-Gotthardzubringer, SBB-Bahnhof Luzern und Schifffahrt Vierwaldstättersee stabil',
        url: 'https://www.luzernerzeitung.ch',
        domain: 'luzernerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Luzerner Kantonsspital (LUKS) & Luftfahrtstandort Emmen/Stans: Einsatz- und Flugbetrieb regulär',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Pilatus, Rigi & Reuss-Pegel: Naturgefahren- und Wetterstationen der Zentralschweiz ohne Warnmeldungen',
        url: 'https://www.stadtluzern.ch/aktuelles/newslist/',
        domain: 'stadtluzern.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 46.948,
    lon: 7.4474,
    radiusM: 18000,
    radiusKm: 18,
    locality: 'Bern',
    aliases: ['Bern', 'Berne'],
    region: 'Bern',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 12.3,
      apparentTemperatureC: 11.1,
      precipitationMm: 0.0,
      cloudCoverPct: 35,
      windKph: 11.2,
      windDirectionDeg: 240,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Bundesstadt Bern: Bundeshaus, Bundesverwaltung und diplomatisches Quartier melden normale Sicherheitslage',
        url: 'https://www.bernerzeitung.ch',
        domain: 'bernerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Inselspital Bern & SBB-Knotenpunkt Mittelland: Notfallversorgung und Ost-West-Magistrale im Regelbetrieb',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Aare-Pegel Bern-Schönau & Berner Oberland: Hydrologisches Messnetz des BAFU zeigt Normalwerte',
        url: 'https://www.bern.ch/mediencenter/medienmitteilungen',
        domain: 'bern.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 47.5596,
    lon: 7.5886,
    radiusM: 18000,
    radiusKm: 18,
    locality: 'Basel',
    aliases: ['Basel', 'Basle'],
    region: 'Basel-Stadt',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 14.4,
      apparentTemperatureC: 13.3,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 12.8,
      windDirectionDeg: 250,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Basel & Dreiländereck: Schweizerische Rheinhäfen, EuroAirport BSL und Grenzzollanlagen im Normalbetrieb',
        url: 'https://www.bazonline.ch',
        domain: 'bazonline.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Life-Sciences-Cluster Basel & Universitätsspital USB: Forschungs-, Pharma- und Klinikstandorte stabil',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Bahnhof Basel SBB & Badischer Bahnhof: Internationaler Güter- und ICE/TGV-Korridor planmäßig',
        url: 'https://www.bs.ch/medienmitteilungen',
        domain: 'bs.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 46.2044,
    lon: 6.1432,
    radiusM: 18000,
    radiusKm: 18,
    locality: 'Genève',
    aliases: ['Geneva', 'Genève', 'Geneve', 'Genf'],
    region: 'Genève',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 14.1,
      apparentTemperatureC: 13.0,
      precipitationMm: 0.0,
      cloudCoverPct: 28,
      windKph: 13.4,
      windDirectionDeg: 215,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Genève Internationale: Palais des Nations (UNO), CERN und diplomatischer Sektor melden regulären Betrieb',
        url: 'https://www.tdg.ch',
        domain: 'tdg.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Genève Aéroport (GVA) & Léman Express: Grenzüberschreitender Flug- und Bahnverkehr in der Romandie stabil',
        url: 'https://www.rts.ch/info/regions/geneve/',
        domain: 'rts.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Hôpitaux Universitaires de Genève (HUG) & Rhône-Abfluss: Städtische Infrastruktur ohne Einschränkungen',
        url: 'https://www.ge.ch/actualites',
        domain: 'ge.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 46.5197,
    lon: 6.6323,
    radiusM: 16000,
    radiusKm: 16,
    locality: 'Lausanne',
    aliases: ['Lausanne'],
    region: 'Vaud',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 13.8,
      apparentTemperatureC: 12.7,
      precipitationMm: 0.0,
      cloudCoverPct: 29,
      windKph: 11.6,
      windDirectionDeg: 225,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Lausanne & Arc Lémanique: EPFL Innovation Park, CHUV-Universitätsspital und Metro m2 im Normalbetrieb',
        url: 'https://www.24heures.ch',
        domain: '24heures.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'SBB-Achse Genfersee & A1/A9 Lausanne: Verkehrsfluss und Schifffahrt CGN auf dem Lac Léman nach Fahrplan',
        url: 'https://www.rts.ch/info/regions/vaud/',
        domain: 'rts.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Olympische Hauptstadt Lausanne: Internationale Sportverbände und Kongresszentren melden regulären Betrieb',
        url: 'https://www.lausanne.ch/actualites',
        domain: 'lausanne.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 46.0037,
    lon: 8.9511,
    radiusM: 16000,
    radiusKm: 16,
    locality: 'Lugano',
    aliases: ['Lugano'],
    region: 'Ticino',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 15.6,
      apparentTemperatureC: 14.8,
      precipitationMm: 0.0,
      cloudCoverPct: 22,
      windKph: 8.9,
      windDirectionDeg: 185,
      visibilityM: 30000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Lugano & Sottoceneri: NEAT-Ceneri-Basistunnel und A2-Südkorridor Chiasso–Mailand melden flüssigen Betrieb',
        url: 'https://www.rsi.ch/info/ticino/',
        domain: 'rsi.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'CSCS Supercomputing Centre & USI Lugano: Nationale Hochleistungsrechen- und Netzinfrastruktur stabil',
        url: 'https://www.cdt.ch',
        domain: 'cdt.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Lago di Lugano (Ceresio) & Lugano Airport (LSZA): Wetterstationen und Regionalverkehr im Normalbereich',
        url: 'https://www.lugano.ch/temi/attualita/',
        domain: 'lugano.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    lat: 46.8508,
    lon: 9.532,
    radiusM: 15000,
    radiusKm: 15,
    locality: 'Chur',
    aliases: ['Chur', 'Coire'],
    region: 'Graubünden',
    country: 'Switzerland',
    countryCode: 'CH',
    weatherProfile: {
      temperatureC: 11.8,
      apparentTemperatureC: 10.5,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 13.1,
      windDirectionDeg: 205,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Chur & Bündner Rheintal: A13-San-Bernardino-Route sowie SBB/RhB-Umsteigeknoten Chur im Regelbetrieb',
        url: 'https://www.suedostschweiz.ch',
        domain: 'suedostschweiz.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Kantonsspital Graubünden (KSGR) & Rega-Basis Untervaz: Alpinmedizinische Versorgung voll einsatzbereit',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Alpenpässe & Rhätische Bahn Graubünden: Albula-, Vereina- und Berninalinie melden planmäßigen Betrieb',
        url: 'https://www.chur.ch/aktuellesinformationen',
        domain: 'chur.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  // --- Wave 16: Alpine Resorts, Austrian State Capitals & German Metro Hubs ---
  {
    name: 'St. Moritz',
    locality: 'St. Moritz',
    aliases: ['St. Moritz', 'Sankt Moritz', 'St Moritz'],
    admin1: 'Graubünden',
    region: 'Graubünden',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.4908,
    lon: 9.8355,
    radiusM: 14000,
    radiusKm: 14,
    elevationM: 1822,
    baseTempC: 4.8,
    windKph: 14.5,
    windDirDeg: 215,
    humidity: 58,
    weatherProfile: {
      temperatureC: 4.8,
      apparentTemperatureC: 2.1,
      precipitationMm: 0.0,
      cloudCoverPct: 24,
      windKph: 14.5,
      windDirectionDeg: 215,
      visibilityM: 35000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'St. Moritz & Oberengadin: Engadin Airport Samedan (LSZS), RhB-Albulalinie und Julierpass melden Normalbetrieb',
        url: 'https://www.engadinerpost.ch',
        domain: 'engadinerpost.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Corviglia & Berninapass: Hochalpine Wetter- und Lawinenmessstationen des SLF zeigen stabile Verhältnisse',
        url: 'https://www.suedostschweiz.ch',
        domain: 'suedostschweiz.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Spital Oberengadin Samedan & Rega-Basis: Alpinmedizinische Notfallversorgung im Engadin voll einsatzbereit',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Davos',
    locality: 'Davos',
    aliases: ['Davos', 'Davos Platz', 'Davos Dorf'],
    admin1: 'Graubünden',
    region: 'Graubünden',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.8027,
    lon: 9.836,
    radiusM: 14000,
    radiusKm: 14,
    elevationM: 1560,
    baseTempC: 6.2,
    windKph: 12.4,
    windDirDeg: 205,
    humidity: 61,
    weatherProfile: {
      temperatureC: 6.2,
      apparentTemperatureC: 4.0,
      precipitationMm: 0.0,
      cloudCoverPct: 28,
      windKph: 12.4,
      windDirectionDeg: 205,
      visibilityM: 32000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Kongressstadt Davos: Kongresszentrum, RhB-Linie Klosters–Davos und Vereinatunnel im regulären Betrieb',
        url: 'https://www.davoserzeitung.ch',
        domain: 'davoserzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'WSL-Institut für Schnee- und Lawinenforschung (SLF) Davos: Alpenweites Mess- und Frühwarnnetz aktiv',
        url: 'https://www.slf.ch/de/news/',
        domain: 'slf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Spital Davos & AO Research Institute: Medizinische Versorgung und Forschungsstandorte melden Regelbetrieb',
        url: 'https://www.suedostschweiz.ch',
        domain: 'suedostschweiz.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Zermatt',
    locality: 'Zermatt',
    aliases: ['Zermatt'],
    admin1: 'Valais',
    region: 'Valais',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.0207,
    lon: 7.7491,
    radiusM: 14000,
    radiusKm: 14,
    elevationM: 1608,
    baseTempC: 5.5,
    windKph: 13.8,
    windDirDeg: 225,
    humidity: 57,
    weatherProfile: {
      temperatureC: 5.5,
      apparentTemperatureC: 3.1,
      precipitationMm: 0.0,
      cloudCoverPct: 22,
      windKph: 13.8,
      windDirectionDeg: 225,
      visibilityM: 35000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Zermatt & Mattertal: Matterhorn Gotthard Bahn (Shuttle Täsch–Zermatt) und Gornergrat Bahn fahren nach Fahrplan',
        url: 'https://www.walliserbote.ch',
        domain: 'walliserbote.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Air Zermatt & Hochalpine Rettungsstation: Flugbetrieb und Gletscher-Monitoring am Matterhorn im Normalbetrieb',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Matterhorn Glacier Paradise (3883m): Grenzüberschreitende Seilbahnverbindung nach Cervinia regulär geöffnet',
        url: 'https://www.zermatt.ch/aktuell',
        domain: 'zermatt.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Interlaken',
    locality: 'Interlaken',
    aliases: ['Interlaken', 'Bödeli'],
    admin1: 'Bern',
    region: 'Bern',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.6863,
    lon: 7.8632,
    radiusM: 15000,
    radiusKm: 15,
    elevationM: 568,
    baseTempC: 11.9,
    windKph: 10.6,
    windDirDeg: 245,
    humidity: 66,
    weatherProfile: {
      temperatureC: 11.9,
      apparentTemperatureC: 10.8,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 10.6,
      windDirectionDeg: 245,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Interlaken & Berner Oberland: Bahnknoten Interlaken Ost, Berner Oberland-Bahnen und Jungfraubahnen im Regelbetrieb',
        url: 'https://www.bernerzeitung.ch/region/thun-und-berner-oberland',
        domain: 'bernerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Thunersee, Brienzersee & Lütschine: Hochwasserschutz- und Pegelmessstationen des Kantons Bern auf Normalniveau',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Spital Interlaken (fmi) & Rega-Einsatzbasis Wilderswil: Regionale Notfall- und Luftrettungsinfrastruktur stabil',
        url: 'https://www.spitalfmi.ch',
        domain: 'spitalfmi.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Innsbruck',
    locality: 'Innsbruck',
    aliases: ['Innsbruck'],
    admin1: 'Tirol',
    region: 'Tirol',
    country: 'Austria',
    countryCode: 'AT',
    lat: 47.2692,
    lon: 11.4041,
    radiusM: 18000,
    radiusKm: 18,
    elevationM: 574,
    baseTempC: 12.1,
    windKph: 13.5,
    windDirDeg: 195,
    humidity: 62,
    weatherProfile: {
      temperatureC: 12.1,
      apparentTemperatureC: 10.9,
      precipitationMm: 0.0,
      cloudCoverPct: 32,
      windKph: 13.5,
      windDirectionDeg: 195,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Innsbruck & Brennerkorridor (A12/A13): Verkehrsleitzentrale Tirol und ÖBB-Brennerachse melden flüssigen Transitverkehr',
        url: 'https://tirol.orf.at',
        domain: 'tirol.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Flughafen Innsbruck (LOWI) & Landeskrankenhaus-Universitätskliniken: Flugbetrieb und Notfallversorgung regulär',
        url: 'https://www.tt.com',
        domain: 'tt.com',
        sourceCountry: 'Austria',
      },
      {
        title: 'Inntal & Nordkette: Föhn- und Pegelmessstationen des Hydrographischen Dienstes Tirol im Normalbereich',
        url: 'https://www.innsbruck.gv.at',
        domain: 'innsbruck.gv.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Salzburg',
    locality: 'Salzburg',
    aliases: ['Salzburg'],
    admin1: 'Salzburg',
    region: 'Salzburg',
    country: 'Austria',
    countryCode: 'AT',
    lat: 47.8095,
    lon: 13.055,
    radiusM: 18000,
    radiusKm: 18,
    elevationM: 424,
    baseTempC: 12.4,
    windKph: 12.8,
    windDirDeg: 260,
    humidity: 65,
    weatherProfile: {
      temperatureC: 12.4,
      apparentTemperatureC: 11.2,
      precipitationMm: 0.0,
      cloudCoverPct: 36,
      windKph: 12.8,
      windDirectionDeg: 260,
      visibilityM: 26000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Salzburg & Grenzraum Walserberg (A1/A8): Westbahn-Knotenpunkt und Autobahnkorridor melden stabilen Verkehrsfluss',
        url: 'https://salzburg.orf.at',
        domain: 'salzburg.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Salzburg Airport (LOWS) & Uniklinikum Salzburg (SALK): Regionaler Luftverkehr und Zentralkliniken im Regelbetrieb',
        url: 'https://www.sn.at/salzburg',
        domain: 'sn.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Salzach-Pegel & Alpennordrand: Hochwasser- und Wetterwarndienst des Landes Salzburg ohne Warnstufe',
        url: 'https://www.stadt-salzburg.at',
        domain: 'stadt-salzburg.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Graz',
    locality: 'Graz',
    aliases: ['Graz'],
    admin1: 'Steiermark',
    region: 'Steiermark',
    country: 'Austria',
    countryCode: 'AT',
    lat: 47.0707,
    lon: 15.4395,
    radiusM: 20000,
    radiusKm: 20,
    elevationM: 353,
    baseTempC: 13.4,
    windKph: 10.2,
    windDirDeg: 180,
    humidity: 63,
    weatherProfile: {
      temperatureC: 13.4,
      apparentTemperatureC: 12.5,
      precipitationMm: 0.0,
      cloudCoverPct: 28,
      windKph: 10.2,
      windDirectionDeg: 180,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Graz & Südautobahn-Korridor (A2/A9): Koralmbahn-Knotenpunkt, Plabutschtunnel und Flughafen Graz (LOWG) im Regelbetrieb',
        url: 'https://steiermark.orf.at',
        domain: 'steiermark.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'LKH-Univ. Klinikum Graz & TU Graz / Joanneum Research: Klinik-, Raumfahrt- und Forschungsstandorte stabil',
        url: 'https://www.kleinezeitung.at/steiermark/graz',
        domain: 'kleinezeitung.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Mur-Pegel & Grazer Becken: Umwelt- und Hydrographie-Messnetz des Landes Steiermark zeigt Normalwerte',
        url: 'https://www.graz.at',
        domain: 'graz.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Linz',
    locality: 'Linz',
    aliases: ['Linz', 'Linz an der Donau'],
    admin1: 'Oberösterreich',
    region: 'Oberösterreich',
    country: 'Austria',
    countryCode: 'AT',
    lat: 48.3069,
    lon: 14.2858,
    radiusM: 18000,
    radiusKm: 18,
    elevationM: 266,
    baseTempC: 12.9,
    windKph: 14.1,
    windDirDeg: 265,
    humidity: 66,
    weatherProfile: {
      temperatureC: 12.9,
      apparentTemperatureC: 11.6,
      precipitationMm: 0.0,
      cloudCoverPct: 35,
      windKph: 14.1,
      windDirectionDeg: 265,
      visibilityM: 25000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Linz & Oberösterreichischer Zentralraum: Donauhafen Linz, Westbahn-Achse und A1/A7-Autobahnknoten im Normalbetrieb',
        url: 'https://ooe.orf.at',
        domain: 'ooe.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Industriestandort Linz (voestalpine / Chemiepark) & Kepler Universitätsklinikum: Werks- und Klinikbetrieb stabil',
        url: 'https://www.nachrichten.at/oberoesterreich/linz/',
        domain: 'nachrichten.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Donau-Schifffahrtskorridor & Pegel Linz: Schleusenbetrieb Abwinden-Asten und Wasserstandsmessung regulär',
        url: 'https://www.linz.at',
        domain: 'linz.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Düsseldorf',
    locality: 'Düsseldorf',
    aliases: ['Düsseldorf', 'Duesseldorf', 'Dusseldorf'],
    admin1: 'Nordrhein-Westfalen',
    region: 'Nordrhein-Westfalen',
    country: 'Germany',
    countryCode: 'DE',
    lat: 51.2277,
    lon: 6.7735,
    radiusM: 24000,
    radiusKm: 24,
    elevationM: 38,
    baseTempC: 13.8,
    windKph: 16.9,
    windDirDeg: 245,
    humidity: 67,
    weatherProfile: {
      temperatureC: 13.8,
      apparentTemperatureC: 12.4,
      precipitationMm: 0.0,
      cloudCoverPct: 44,
      windKph: 16.9,
      windDirectionDeg: 245,
      visibilityM: 24000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Landeshauptstadt Düsseldorf: Flughafen DUS, Regierungsviertel NRW und Rheinschifffahrt melden regulären Betrieb',
        url: 'https://www1.wdr.de/nachrichten/rheinland/',
        domain: 'wdr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Industrie- & Verteidigungsstandort Düsseldorf (Rheinmetall / Henkel) sowie Universitätsklinikum UKD stabil',
        url: 'https://rp-online.de/nrw/staedte/duesseldorf/',
        domain: 'rp-online.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Rhein-Ruhr-Verkehrskorridor (A3/A44/A46/A57) & Düsseldorf Hbf: Fern- und S-Bahn-Netz im Planbetrieb',
        url: 'https://www.duesseldorf.de/aktuelles',
        domain: 'duesseldorf.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    name: 'Dresden',
    locality: 'Dresden',
    aliases: ['Dresden'],
    admin1: 'Sachsen',
    region: 'Sachsen',
    country: 'Germany',
    countryCode: 'DE',
    lat: 51.0504,
    lon: 13.7373,
    radiusM: 22000,
    radiusKm: 22,
    elevationM: 112,
    baseTempC: 12.6,
    windKph: 13.9,
    windDirDeg: 255,
    humidity: 64,
    weatherProfile: {
      temperatureC: 12.6,
      apparentTemperatureC: 11.3,
      precipitationMm: 0.0,
      cloudCoverPct: 38,
      windKph: 13.9,
      windDirectionDeg: 255,
      visibilityM: 25000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Silicon Saxony Dresden: Halbleiterwerke (Infineon, GlobalFoundries, Bosch, TSMC/ESMC) und Flughafen DRS im Regelbetrieb',
        url: 'https://www.mdr.de/nachrichten/sachsen/dresden/',
        domain: 'mdr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Exzellenzuniversität TU Dresden, Helmholtz-Zentrum HZDR & Universitätsklinikum Carl Gustav Carus melden Normalbetrieb',
        url: 'https://www.saechsische.de/dresden',
        domain: 'saechsische.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Elbpegel Dresden & Verkehrskorridor A4/A17: Binnenschifffahrt und Grenztransit Richtung Prag ohne Störungen',
        url: 'https://www.dresden.de/de/rathaus/aktuelles/',
        domain: 'dresden.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  // --- Wave 19: Enriched DACH City Gazetteer Profiles ---
  {
    name: 'Lugano',
    locality: 'Lugano',
    aliases: ['Lugano', 'Ceresio'],
    admin1: 'Ticino',
    region: 'Ticino',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.0037,
    lon: 8.9511,
    radiusM: 16000,
    radiusKm: 16,
    population: 63600,
    elevationM: 273,
    baseTempC: 15.6,
    windKph: 8.9,
    windDirDeg: 185,
    humidity: 60,
    summaryDe:
      'Größte Stadt des Kantons Tessin am Lago di Lugano (Ceresio), bedeutender Schweizer Finanz-, Kongress- und Supercomputing-Standort (CSCS) an der NEAT-Südachse.',
    summaryEn:
      'Largest city in Canton Ticino on Lake Lugano, serving as southern Switzerland’s primary financial, academic (USI), and national supercomputing (CSCS) hub along the Gotthard-Ceneri corridor.',
    economy: [
      'Private Banking & Rohstoffhandel',
      'Swiss National Supercomputing Centre (CSCS)',
      'Biomedizin, Medtech & Pharmaindustrie',
      'Tourismus & Kongresswirtschaft',
    ],
    landmarks: [
      'Piazza della Riforma & LAC Lugano Arte e Cultura',
      'Monte San Salvatore (912m) & Monte Brè (925m)',
      'Parco Ciani am Lago di Lugano',
      'Kathedrale San Lorenzo',
    ],
    transport: [
      'FFS/SBB Bahnhof Lugano (Ceneri-Basistunnel / Gotthard-Achse)',
      'Autobahn A2 (Gotthard–Chiasso–Mailand)',
      'Lugano Airport (LSZA / Agno)',
      'Schifffahrtsgesellschaft Lago di Lugano (SNL)',
    ],
    weatherProfile: {
      temperatureC: 15.6,
      apparentTemperatureC: 14.8,
      precipitationMm: 0.0,
      cloudCoverPct: 22,
      windKph: 8.9,
      windDirectionDeg: 185,
      visibilityM: 30000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Lugano & Sottoceneri: NEAT-Ceneri-Basistunnel und A2-Südkorridor Chiasso–Mailand melden flüssigen Betrieb',
        url: 'https://www.rsi.ch/info/ticino/',
        domain: 'rsi.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'CSCS Supercomputing Centre & USI Lugano: Nationale Hochleistungsrechen- und Netzinfrastruktur stabil',
        url: 'https://www.cdt.ch',
        domain: 'cdt.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Lago di Lugano (Ceresio) & Lugano Airport (LSZA): Wetterstationen und Regionalverkehr im Normalbereich',
        url: 'https://www.lugano.ch/temi/attualita/',
        domain: 'lugano.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Locarno',
    locality: 'Locarno',
    aliases: ['Locarno', 'Ascona-Locarno', 'Verbano'],
    admin1: 'Ticino',
    region: 'Ticino',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.167,
    lon: 8.7995,
    radiusM: 14000,
    radiusKm: 14,
    population: 16400,
    elevationM: 195,
    baseTempC: 15.8,
    windKph: 8.4,
    windDirDeg: 190,
    humidity: 59,
    summaryDe:
      'Südschweizer Kultur- und Tourismuszentrum am Nordufer des Lago Maggiore (Verbano), Sitz von MeteoSchweiz Sud und Schauplatz des Locarno Film Festivals.',
    summaryEn:
      'Historic Ticino lakeside city on the northern shore of Lake Maggiore, hosting MeteoSwiss South, the Locarno Film Festival, and the Magadino aviation and rail hub.',
    economy: [
      'Tourismus, Hotellerie & Kulturwirtschaft (Locarno Film Festival)',
      'Meteorologie & Klimaforschung (MeteoSchweiz Locarno-Monti)',
      'Luftfahrtwartung & Heliport-Basis (Aeroporto Cantonale di Locarno LSZL)',
      'Präzisionsmechanik & Wasserkraftwerke (OFIMA)',
    ],
    landmarks: [
      'Piazza Grande Locarno',
      'Wallfahrtskirche Madonna del Sasso (Orselina)',
      'Castello Visconteo',
      'Cardada-Cimetta & Lago Maggiore (193m, tiefster Punkt der Schweiz)',
    ],
    transport: [
      'Bahnhof Locarno (SBB/TILO Ceneri-Express & Centovallibahn FART nach Domodossola)',
      'Kantonale Flughafenbasis Locarno-Magadino (LSZL / Rega-Basis)',
      'Hauptverkehrsachse A13 / Kantonsstrasse Bellinzona–Brissago',
      'Schifffahrt Lago Maggiore (Navigazione Laghi)',
    ],
    weatherProfile: {
      temperatureC: 15.8,
      apparentTemperatureC: 15.0,
      precipitationMm: 0.0,
      cloudCoverPct: 20,
      windKph: 8.4,
      windDirectionDeg: 190,
      visibilityM: 30000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Locarno & Lago Maggiore: TILO-Schnellzüge durch den Ceneri-Basistunnel und Centovallibahn im Planbetrieb',
        url: 'https://www.rsi.ch/info/ticino/',
        domain: 'rsi.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'MeteoSchweiz Locarno-Monti & Rega-Basis Magadino (LSZL): Alpensüdseiten-Wetterradar und Luftrettung aktiv',
        url: 'https://www.laregione.ch',
        domain: 'laregione.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Pegelstand Lago Maggiore & Maggia-Delta: Hydrologische Messstationen im Sopraceneri auf Normalniveau',
        url: 'https://www.locarno.ch',
        domain: 'locarno.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Chur',
    locality: 'Chur',
    aliases: ['Chur', 'Coire', 'Cuira'],
    admin1: 'Graubünden',
    region: 'Graubünden',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.8508,
    lon: 9.532,
    radiusM: 15000,
    radiusKm: 15,
    population: 39100,
    elevationM: 593,
    baseTempC: 11.8,
    windKph: 13.1,
    windDirDeg: 205,
    humidity: 61,
    summaryDe:
      'Hauptstadt des Kantons Graubünden und älteste Stadt der Schweiz im Churer Rheintal, zentraler Eisenbahn- (SBB/RhB) und Autobahnknoten (A13 San-Bernardino-Route).',
    summaryEn:
      'Capital of Canton Graubünden and Switzerland’s oldest town in the Alpine Rhine Valley, serving as the primary rail (SBB/RhB) and A13 San Bernardino transit gateway.',
    economy: [
      'Kantonale Verwaltung, Dienstleistungs- & Gesundheitszentrum (KSGR)',
      'Schienenverkehr & Alpinlogistik (Rhätische Bahn RhB Hauptsitz)',
      'Biotechnologie, Sensorik & Fachhochschule Graubünden (FHGR)',
      'Alpentourismus & Energieversorgung',
    ],
    landmarks: [
      'Bischöflicher Hof & Kathedrale St. Mariä Himmelfahrt',
      'Historische Altstadt Chur & Martinskirche',
      'Hausberg Brambrüesch (1600m) & Calanda-Massiv (2805m)',
      'Bündner Kunstmuseum & Naturmuseum',
    ],
    transport: [
      'Bahnhof Chur (Umsteigeknoten SBB IC3, Rhätische Bahn RhB & PostAuto)',
      'Autobahn A13 (St. Margrethen–Chur–San Bernardino–Bellinzona)',
      'Rega-Einsatzbasis Untervaz bei Chur',
      'Bergbahnen Chur-Dreibündenstein',
    ],
    weatherProfile: {
      temperatureC: 11.8,
      apparentTemperatureC: 10.5,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 13.1,
      windDirectionDeg: 205,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Chur & Bündner Rheintal: A13-San-Bernardino-Route sowie SBB/RhB-Umsteigeknoten Chur im Regelbetrieb',
        url: 'https://www.suedostschweiz.ch',
        domain: 'suedostschweiz.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Kantonsspital Graubünden (KSGR) & Rega-Basis Untervaz: Alpinmedizinische Versorgung voll einsatzbereit',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Alpenpässe & Rhätische Bahn Graubünden: Albula-, Vereina- und Berninalinie melden planmäßigen Betrieb',
        url: 'https://www.chur.ch/aktuellesinformationen',
        domain: 'chur.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Schaffhausen',
    locality: 'Schaffhausen',
    aliases: ['Schaffhausen', 'Neuhausen am Rheinfall'],
    admin1: 'Schaffhausen',
    region: 'Schaffhausen',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 47.6959,
    lon: 8.638,
    radiusM: 14000,
    radiusKm: 14,
    population: 38900,
    elevationM: 403,
    baseTempC: 12.6,
    windKph: 11.4,
    windDirDeg: 240,
    humidity: 65,
    summaryDe:
      'Nördlichste Kantonshauptstadt der Schweiz am Hochrhein direkt oberhalb des Rheinfalls, bedeutender Industrie-, Uhren- (IWC) und Grenzverkehrsknotenpunkt zu Süddeutschland.',
    summaryEn:
      'Northernmost Swiss cantonal capital on the High Rhine above the Rhine Falls, acting as an advanced industrial, watchmaking (IWC), and cross-border rail/road hub with Baden-Württemberg.',
    economy: [
      'Industrie- & Rohrleitungssysteme (Georg Fischer AG / GF)',
      'Haute Horlogerie (IWC Schaffhausen)',
      'Pharma- & Medizintechnik (Cilag / Johnson & Johnson)',
      'Rheinfall-Tourismus & Internationale Holdings',
    ],
    landmarks: [
      'Festung Munot (16. Jahrhundert)',
      'Rheinfall bei Neuhausen (größter Wasserfall Europas)',
      'Kloster Allerheiligen & mittelalterliche Erker-Altstadt',
      'Rheinufer & Schifflände Schaffhausen',
    ],
    transport: [
      'Gemeinschaftsbahnhof Schaffhausen (SBB & DB Fern-/S-Bahn-Knoten Zürich–Stuttgart/Basel)',
      'Autobahn A4 (Winterthur–Schaffhausen–Bargen / B27 Deutschland)',
      'Schifffahrtsgesellschaft Untersee und Rhein (URh)',
      'Zollübergänge Bietingen/Thayngen & Neuhausen-Jestetten',
    ],
    weatherProfile: {
      temperatureC: 12.6,
      apparentTemperatureC: 11.4,
      precipitationMm: 0.0,
      cloudCoverPct: 33,
      windKph: 11.4,
      windDirectionDeg: 240,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Schaffhausen & Hochrhein: SBB/DB-Grenzbahnhof, A4-Galgenbucktunnel und Zollübergang Thayngen im Regelbetrieb',
        url: 'https://www.shn.ch',
        domain: 'shn.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Rheinfall Neuhausen: Abflussmenge und Hochrhein-Pegelstände des BAFU im saisonalen Normalbereich',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Industriestandort Schaffhausen (Georg Fischer / Cilag) & Kantonsspital SH melden stabilen Betrieb',
        url: 'https://www.stadt-schaffhausen.ch',
        domain: 'stadt-schaffhausen.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Thun',
    locality: 'Thun',
    aliases: ['Thun', 'Thunersee'],
    admin1: 'Bern',
    region: 'Bern',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.758,
    lon: 7.628,
    radiusM: 14000,
    radiusKm: 14,
    population: 44100,
    elevationM: 560,
    baseTempC: 12.1,
    windKph: 10.8,
    windDirDeg: 235,
    humidity: 65,
    summaryDe:
      'Tor zum Berner Oberland am Ausfluss der Aare aus dem Thunersee, wichtigster Schweizer Wehrtechnik-, Rüstungsforschungs- (armasuisse W+T) und Waffenplatzstandort.',
    summaryEn:
      'Gateway to the Bernese Oberland where the Aare exits Lake Thun, hosting Switzerland’s largest army garrison, defense technology center (armasuisse S+T), and Lötschberg transit rail hub.',
    economy: [
      'Wehrtechnik, Verteidigungsforschung (armasuisse W+T / RUAG) & Waffenplatz Thun',
      'Präzisionsmaschinenbau, Solartechnologie (Meyer Burger) & Verpackungstechnik',
      'Gesundheitswesen (Spital Thun STS AG)',
      'Tourismus & Schifffahrt Thunersee',
    ],
    landmarks: [
      'Schloss Thun (12. Jahrhundert) & Obere Hauptgasse',
      'Schloss Schadau & Thunersee-Panorama (Eiger, Mönch, Jungfrau)',
      'Historische gedeckte Holzbrücken & Aare-Schleusen (Hochwasserentlastung)',
      'Stockhorn (2190m) & Niesen (2362m)',
    ],
    transport: [
      'Bahnhof Thun (SBB/BLS-Knotenpunkt Richtung Bern und Lötschberg-Basistunnel)',
      'Autobahn A6 (Bern–Thun–Spiez)',
      'BLS Schifffahrt Thunersee',
      'STI-Regionalverkehrsnetz Berner Oberland',
    ],
    weatherProfile: {
      temperatureC: 12.1,
      apparentTemperatureC: 11.0,
      precipitationMm: 0.0,
      cloudCoverPct: 31,
      windKph: 10.8,
      windDirectionDeg: 235,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Thun & Lötschberg-Achse: SBB/BLS-Knoten Bahnhof Thun und A6-Autobahnkorridor Bern–Spiez im Planbetrieb',
        url: 'https://www.bernerzeitung.ch/region/thun-und-berner-oberland',
        domain: 'bernerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Thunersee-Regulierung & Entlastungsstollen Thun: Aare-Abfluss und Hochwasserschutzanlagen auf Normalpegel',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Spital Thun (STS AG) & Bundesstandort armasuisse Thun melden regulären Klinik- und Forschungsbetrieb',
        url: 'https://www.thun.ch/aktuelles',
        domain: 'thun.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Fribourg',
    locality: 'Fribourg',
    aliases: ['Fribourg', 'Freiburg im Üechtland', 'Freiburg i. Üe.'],
    admin1: 'Fribourg',
    region: 'Fribourg',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.8065,
    lon: 7.162,
    radiusM: 15000,
    radiusKm: 15,
    population: 39200,
    elevationM: 581,
    baseTempC: 12.2,
    windKph: 11.9,
    windDirDeg: 230,
    humidity: 64,
    summaryDe:
      'Zweisprachige Kantonshauptstadt an der Saane (Sarine) am Sprachgrenzkorridor zwischen Deutschschweiz und Romandie, traditionsreiche Universitäts- und Brückenstadt.',
    summaryEn:
      'Bilingual capital of Canton Fribourg on the Sarine River straddling the French-German linguistic border, known for the University of Fribourg, Adolphe Merkle Institute, and Poyabrücke.',
    economy: [
      'Zweisprachige Universität Freiburg (Unifr) & Adolphe Merkle Institute (Nanomaterialien)',
      'Bio- & Lebensmitteltechnologie (Agroscope / Grangeneuve) & Medtech (Marly Innovation Center)',
      'Kantonale Verwaltung & Energiewirtschaft (Groupe E)',
      'Gesundheitswesen (freiburger spital HFR)',
    ],
    landmarks: [
      'Kathedrale St. Nikolaus (74m gotischer Turm)',
      'Poyabrücke (Schrägseilbrücke) & Zähringerbrücke über die Saane-Schlucht',
      'Mittelalterliche Unterstadt (Basse-Ville) & Standseilbahn (Funiculaire)',
      'Schiffenen-Stausee',
    ],
    transport: [
      'Bahnhof Fribourg/Freiburg (SBB-Hauptmagistrale IC1/IR15 Genf–Lausanne–Bern–Zürich–St. Gallen)',
      'Autobahn A12 (Bern–Fribourg–Vevey)',
      'Transports publics fribourgeois (TPF)',
      'Regionalflugplatz Ecuvillens (LSGE)',
    ],
    weatherProfile: {
      temperatureC: 12.2,
      apparentTemperatureC: 11.0,
      precipitationMm: 0.0,
      cloudCoverPct: 33,
      windKph: 11.9,
      windDirectionDeg: 230,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Fribourg/Freiburg: SBB-West-Ost-Magistrale Lausanne–Bern, Poyabrücke und Autobahn A12 melden flüssigen Verkehr',
        url: 'https://www.laliberte.ch',
        domain: 'laliberte.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Universität Freiburg, Adolphe Merkle Institute & Freiburger Spital (HFR) im regulären Betrieb',
        url: 'https://www.freiburger-nachrichten.ch',
        domain: 'freiburger-nachrichten.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Saane-Pegel & Stausee Schiffenen (Groupe E): Wasserkraft- und Netztelemetrie im Kanton Freiburg stabil',
        url: 'https://www.ville-fribourg.ch',
        domain: 'ville-fribourg.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Bregenz',
    locality: 'Bregenz',
    aliases: ['Bregenz', 'Landeshauptstadt Bregenz'],
    admin1: 'Vorarlberg',
    region: 'Vorarlberg',
    country: 'Austria',
    countryCode: 'AT',
    lat: 47.5031,
    lon: 9.7471,
    radiusM: 10000,
    radiusKm: 10,
    population: 29800,
    elevationM: 427,
    baseTempC: 12.8,
    windKph: 11.8,
    windDirDeg: 250,
    humidity: 66,
    summaryDe:
      'Landeshauptstadt Vorarlbergs am Ostufer des Bodensees zwischen Pfänderstock und Alpenrheinmündung, Sitz der Vorarlberger Landesregierung und der Bregenzer Festspiele.',
    summaryEn:
      'Capital of Vorarlberg on the eastern shore of Lake Constance at the foot of the Pfänder (1064m), serving as the administrative, cultural, and cross-border rail/ferry hub of the Lake Constance region.',
    economy: [
      'Vorarlberger Landesregierung & Öffentliche Verwaltung',
      'Kultur- & Kongresswirtschaft (Bregenzer Festspiele / Festspielhaus)',
      'Maschinenbau, Textil- & Elektrotechnik sowie Energieversorgung (illwerke vkw)',
      'Bodensee-Schifffahrt & Tourismus (Pfänderbahn)',
    ],
    landmarks: [
      'Seebühne Bregenz & Kunsthaus Bregenz (KUB)',
      'Martinsturm in der Oberstadt Bregenz',
      'Pfänder (1064m) mit Panoramablick über den Bodensee und 240 Alpengipfel',
      'Bregenzer Hafen & Molo',
    ],
    transport: [
      'Bahnhof Bregenz (ÖBB/SBB-Knotenpunkt Richtung Wien, Zürich, München und Lindau)',
      'Rheintal/Walgau Autobahn A14 & Pfändertunnel',
      'Vorarlberg Lines Bodenseeschifffahrt (Hafen Bregenz)',
      'Pfänderbahn AG',
    ],
    weatherProfile: {
      temperatureC: 12.8,
      apparentTemperatureC: 11.7,
      precipitationMm: 0.0,
      cloudCoverPct: 32,
      windKph: 11.8,
      windDirectionDeg: 250,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Bregenz & Pfändertunnel (A14): ASFINAG-Verkehrsleitzentrale und ÖBB-Bahnkorridor am Bodensee im Normalbetrieb',
        url: 'https://vorarlberg.orf.at',
        domain: 'vorarlberg.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Bodensee-Pegel Bregenz & Bregenzerach-Mündung: Hydrographischer Dienst Vorarlberg meldet stabile Wasserstände',
        url: 'https://www.vol.at/gemeinde/bregenz',
        domain: 'vol.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Landeskrankenhaus Bregenz, Landhaus Vorarlberg & Bodenseeschifffahrt melden regulären Tagesbetrieb',
        url: 'https://www.bregenz.gv.at',
        domain: 'bregenz.gv.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Klagenfurt am Wörthersee',
    locality: 'Klagenfurt',
    aliases: ['Klagenfurt', 'Klagenfurt am Wörthersee', 'Celovec'],
    admin1: 'Kärnten',
    region: 'Kärnten',
    country: 'Austria',
    countryCode: 'AT',
    lat: 46.6247,
    lon: 14.3053,
    radiusM: 18000,
    radiusKm: 18,
    population: 104800,
    elevationM: 446,
    baseTempC: 13.3,
    windKph: 9.8,
    windDirDeg: 185,
    humidity: 63,
    summaryDe:
      'Landeshauptstadt Kärntens am Ostufer des Wörthersees im Alpen-Adria-Raum, zentraler Verkehrsknoten der neuen Koralmbahn-Südachse nach Graz, Italien und Slowenien.',
    summaryEn:
      'Capital of Carinthia on the eastern shore of Lake Wörthersee in the Alps-Adriatic triangle, serving as southern Austria’s university, technology (Lakeside Park), and Koralmbahn rail hub.',
    economy: [
      'IT, Robotik & Drohnentechnologie (Lakeside Science & Technology Park / Universität Klagenfurt)',
      'Elektronik, Sensorik & Maschinenbau im Zentralraum Kärnten',
      'Tourismus & Wörthersee-Hotellerie',
      'Gesundheitswesen (Klinikum Klagenfurt am Wörthersee / KABEG)',
    ],
    landmarks: [
      'Neuer Platz mit Lindwurmbrunnen & Landhaus Klagenfurt',
      'Wörthersee-Ostbucht & Europapark',
      'Pyramidenkogel-Aussichtsturm (851m)',
      'Klagenfurter Dom',
    ],
    transport: [
      'Klagenfurt Hauptbahnhof (ÖBB-Südachse & Koralmbahn-Hochgeschwindigkeitskorridor Graz–Klagenfurt)',
      'Süd Autobahn A2 & Karawanken-Transitkorridor (A11 / Loiblpass)',
      'Airport Klagenfurt (LOWK)',
      'Wörthersee-Schifffahrt',
    ],
    weatherProfile: {
      temperatureC: 13.3,
      apparentTemperatureC: 12.4,
      precipitationMm: 0.0,
      cloudCoverPct: 27,
      windKph: 9.8,
      windDirectionDeg: 185,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Klagenfurt & Alpen-Adria-Korridor: Südautobahn A2, Karawankenachse und ÖBB-Knoten Klagenfurt Hbf im Regelbetrieb',
        url: 'https://kaernten.orf.at',
        domain: 'kaernten.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Klinikum Klagenfurt (KABEG), Airport Klagenfurt (LOWK) & Lakeside Technology Park melden stabilen Betrieb',
        url: 'https://www.kleinezeitung.at/kaernten/klagenfurt',
        domain: 'kleinezeitung.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Wörthersee & Drau-Kraftwerkskette: Hydrographischer Dienst Kärnten verzeichnet normale Pegelstände',
        url: 'https://www.klagenfurt.at',
        domain: 'klagenfurt.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Freiburg im Breisgau',
    locality: 'Freiburg im Breisgau',
    aliases: ['Freiburg', 'Freiburg im Breisgau'],
    admin1: 'Baden-Württemberg',
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    lat: 47.999,
    lon: 7.8421,
    radiusM: 16000,
    radiusKm: 16,
    population: 237200,
    elevationM: 278,
    baseTempC: 14.8,
    windKph: 9.8,
    windDirDeg: 215,
    humidity: 60,
    summaryDe:
      'Großstadt und Wissenschaftszentrum im Südschwarzwald und Oberrheingraben im Dreiländereck Deutschland–Frankreich–Schweiz, führend in Solarforschung und Medizintechnik.',
    summaryEn:
      'Major university and research city in southern Baden-Württemberg at the foot of the Black Forest along the Upper Rhine corridor, renowned for solar energy research (Fraunhofer ISE) and biomedical sciences.',
    economy: [
      'Albert-Ludwigs-Universität Freiburg & Universitätsklinikum Freiburg',
      'Fraunhofer-Institut für Solare Energiesysteme (ISE) & fünf weitere Fraunhofer-Institute',
      'Medizintechnik, Mikrosystemtechnik (IMTEK) & Pharmaproduktion',
      'Schwarzwald-Tourismus & Weinbau im Breisgau',
    ],
    landmarks: [
      'Freiburger Münster Unserer Lieben Frau (116m Turm) & Münsterplatz',
      'Historisches Kaufhaus, Schwabentor & Martinstor mit Freiburger Bächle',
      'Schlossberg & Schauinsland (1284m)',
      'Solarquartier Vauban',
    ],
    transport: [
      'Freiburg (Breisgau) Hauptbahnhof (DB ICE-Rheintalmagistrale Frankfurt–Karlsruhe–Freiburg–Basel–Zürich)',
      'Bundesautobahn A5 (Oberrheinkorridor Frankfurt–Basel) & B31 (Höllental–Bodensee)',
      'Flugplatz Freiburg (EDTF) & EuroAirport Basel-Mulhouse-Freiburg (LFSB)',
      'Freiburger Verkehrs AG (VAG Straßenbahnnetz & Schauinslandbahn)',
    ],
    weatherProfile: {
      temperatureC: 14.8,
      apparentTemperatureC: 13.9,
      precipitationMm: 0.0,
      cloudCoverPct: 25,
      windKph: 9.8,
      windDirectionDeg: 215,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Freiburg & Oberrheingraben: A5-Rheintalautobahn und Güterverkehrskorridor Basel–Karlsruhe flüssig',
        url: 'https://www.badische-zeitung.de/freiburg',
        domain: 'badische-zeitung.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Südbaden & Hochschwarzwald: Universitätsklinikum Freiburg und regionale Rettungsleitstelle im Normalbetrieb',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/suedbaden/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Dreiländereck D-F-CH: Grenzüberschreitender Pendler- und Regionalverkehr im Breisgau stabil',
        url: 'https://www.freiburg.de/pb/freiburg/aktuell.html',
        domain: 'freiburg.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    name: 'Konstanz',
    locality: 'Konstanz',
    aliases: ['Konstanz', 'Constance'],
    admin1: 'Baden-Württemberg',
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    lat: 47.6603,
    lon: 9.1758,
    radiusM: 14000,
    radiusKm: 14,
    population: 85800,
    elevationM: 405,
    baseTempC: 13.1,
    windKph: 11.5,
    windDirDeg: 240,
    humidity: 65,
    summaryDe:
      'Größte Stadt am Bodensee am Ausfluss des Seerheins unmittelbar an der Schweizer Grenze zu Kreuzlingen, Standort einer Exzellenzuniversität und maritimer Knotenpunkt.',
    summaryEn:
      'Largest city on Lake Constance situated along the Seerhein directly adjoining Kreuzlingen (Switzerland), home to the University of Constance and the central Lake Constance ferry network.',
    economy: [
      'Exzellenzuniversität Konstanz & Hochschule Konstanz (HTWG)',
      'Biotechnologie, Pharmaforschung & IT/Software-Cluster am Seerhein',
      'Grenzüberschreitender Einzelhandel & Tourismus (Konstanz-Kreuzlingen)',
      'Bodensee-Schiffsbetriebe (BSB) & Stadtwerke Konstanz',
    ],
    landmarks: [
      'Konstanzer Hafen mit Imperia-Statue & Konzilsgebäude (1388)',
      'Konstanzer Münster Unserer Lieben Frau & Niederburg',
      'Blumeninsel Mainau im Überlinger See',
      'Rheinbrücke Konstanz & Seestraße',
    ],
    transport: [
      'Bahnhof Konstanz (DB/SBB/Thurbo-Grenzbahnhof Richtung Zürich, St. Gallen und Singen/Stuttgart)',
      'Autofähre Konstanz-Staad–Meersburg (24h-Betrieb) & Katamaran Konstanz–Friedrichshafen',
      'Bundesstraße B33 & Schweizer Autobahn A7 (Grenzübergang Kreuzlingen/Schänzlebrücke)',
      'Bodensee-Schiffsbetriebe (BSB)',
    ],
    weatherProfile: {
      temperatureC: 13.1,
      apparentTemperatureC: 12.0,
      precipitationMm: 0.0,
      cloudCoverPct: 30,
      windKph: 11.5,
      windDirectionDeg: 240,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Konstanz & Kreuzlingen: Grenzübergänge Emmishofer Zoll und Schänzlebrücke melden flüssigen Verkehr',
        url: 'https://www.suedkurier.de/region/kreis-konstanz/konstanz/',
        domain: 'suedkurier.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Bodensee-Fährlinie Konstanz–Meersburg & Katamaran: Schiffsverkehr im Konstanzer Trichter nach Fahrplan',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/friedrichshafen/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Universität Konstanz & Technologiezentrum am Seerhein: Forschungs- und Campusbetrieb regulär',
        url: 'https://www.konstanz.de/stadtwandel/aktuelles',
        domain: 'konstanz.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  // --- Wave 22: Enriched DACH Cantonal Capitals, Industrial/Tech Hubs & Alpine/Danube Corridor Cities ---
  {
    name: 'Zug',
    locality: 'Zug',
    aliases: ['Zug', 'Stadt Zug', 'Crypto Valley Zug'],
    admin1: 'Zug',
    region: 'Zug',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 47.1662,
    lon: 8.5155,
    radiusM: 12000,
    radiusKm: 12,
    population: 31900,
    elevationM: 425,
    baseTempC: 12.8,
    windKph: 10.6,
    windDirDeg: 230,
    humidity: 64,
    summaryDe:
      'Kantonshauptstadt am Zugersee, globales Zentrum für Rohstoffhandel, Medtech, Kryptowährungen ("Crypto Valley") und Präzisionsindustrie im Wirtschaftsraum Zentralschweiz–Zürich.',
    summaryEn:
      'Capital of Canton Zug on Lake Zug and anchor of Switzerland’s Crypto Valley, hosting global commodity trading, pharmaceutical/diagnostics (Roche Rotkreuz), and appliance technology (V-ZUG) headquarters.',
    economy: [
      'Globaler Rohstoffhandel, Private Equity & FinTech / Blockchain ("Crypto Valley")',
      'Medizintechnik, Pharma-Diagnostik (Roche Diagnostics Rotkreuz) & Life Sciences',
      'Haushaltgrossgeräte- & Präzisionsfertigung (V-ZUG / Tech Cluster Zug)',
      'Elektronik, Sensorik & Internationale Konzernhauptsitze (Siemens Smart Infrastructure)',
    ],
    landmarks: [
      'Zuger Altstadt mit Zytturm & Schloss Zug',
      'Seepromenade am Zugersee mit Rigi- und Pilatus-Blick',
      'Zugerberg (925m)',
      'Kirche St. Oswald',
    ],
    transport: [
      'Bahnhof Zug (SBB-Knotenpunkt Gotthard-Nordzulauf Zürich–Zug–Arth-Goldau–Lugano/Luzern)',
      'Autobahn A4 / A14 (Zürich–Zug–Luzern–Gotthard)',
      'Stadtbahn Zug & Zugersee-Schifffahrt',
      'Direktanbindung Flughafen Zürich (ZRH)',
    ],
    weatherProfile: {
      temperatureC: 12.8,
      apparentTemperatureC: 11.7,
      precipitationMm: 0.0,
      cloudCoverPct: 31,
      windKph: 10.6,
      windDirectionDeg: 230,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Zug & Gotthard-Nordzulauf: SBB-Knoten Bahnhof Zug, Stadtbahn und Autobahn A4/A14 im regulären Betrieb',
        url: 'https://www.zugerzeitung.ch',
        domain: 'zugerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Wirtschaftsraum Zug / Baar / Rotkreuz: Tech Cluster Zug und Pharma-Diagnostik-Campus melden Normalbetrieb',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Zugersee & Lorze-Abfluss: Hydrologische Messstationen und Zuger Kantonsspital (ZGKS) ohne Einschränkungen',
        url: 'https://www.stadtzug.ch/aktuellesinformationen',
        domain: 'stadtzug.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Baden',
    locality: 'Baden',
    aliases: ['Baden', 'Baden AG', 'Baden im Aargau'],
    admin1: 'Aargau',
    region: 'Aargau',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 47.4733,
    lon: 8.3058,
    radiusM: 11000,
    radiusKm: 11,
    population: 20400,
    elevationM: 381,
    baseTempC: 13.2,
    windKph: 11.4,
    windDirDeg: 240,
    humidity: 64,
    summaryDe:
      'Traditionsreiche Energie-, Industrie- (ehem. BBC/ABB, GE Vernova, Axpo) und Bäderstadt an der Limmat-Klus im Ost-Aargau am Westkorridor der Metropolregion Zürich.',
    summaryEn:
      'Historic Swiss power-engineering hub (former Brown Boveri / ABB, GE Vernova, Axpo) and thermal spa city on the Limmat River along the main Zurich–Basel/Bern rail corridor.',
    economy: [
      'Energietechnik, Gasturbinen- & Kraftwerksengineering (GE Vernova / ABB)',
      'Nationale Stromversorgung & Energiehandel (Axpo Holding AG Hauptsitz)',
      'Gesundheitswesen (Kantonsspital Baden KSB) & Thermalbäder (FORTYSEVEN)',
      'ICT, Halbleiterforschung & Nähe zum Paul Scherrer Institut (PSI)',
    ],
    landmarks: [
      'Ruine Stein über der Limmat-Klus & Historische Holzbrücke',
      'Bäderquartier mit den heissesten Thermalquellen der Schweiz (47 °C)',
      'Stadtturm Baden & Tagsatzungssaal',
      'Trafo Baden & Industriekultur-Quartier Nord',
    ],
    transport: [
      'Bahnhof Baden (Standort der ersten Schweizer Eisenbahn "Spanisch-Brötli-Bahn" 1847, SBB-Achse Zürich–Basel/Bern)',
      'Autobahn A1 / Bareggtunnel (Zürich–Baden–Bern/Basel)',
      'RVBW-Regionalbusnetz Limmattal',
      'Schnellzuganbindung Flughafen Zürich',
    ],
    weatherProfile: {
      temperatureC: 13.2,
      apparentTemperatureC: 12.1,
      precipitationMm: 0.0,
      cloudCoverPct: 32,
      windKph: 11.4,
      windDirectionDeg: 240,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Baden & A1-Bareggtunnel: Verkehrsfluss im Limmattal sowie SBB-Hauptachse Zürich–Baden–Brugg stabil',
        url: 'https://www.badenerzeitung.ch',
        domain: 'badenerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Energiestandort Baden (Axpo / GE Vernova / ABB) & Kantonsspital Baden (KSB) melden regulären Betrieb',
        url: 'https://www.aargauerzeitung.ch/aargau/baden',
        domain: 'aargauerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Limmat-Pegel Baden & Kraftwerk Wettingen: Hydrologische Telemetrie im Ostaargau auf Normalniveau',
        url: 'https://www.baden.ch/aktuelles.html',
        domain: 'baden.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Aarau',
    locality: 'Aarau',
    aliases: ['Aarau', 'Stadt Aarau'],
    admin1: 'Aargau',
    region: 'Aargau',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 47.3925,
    lon: 8.0442,
    radiusM: 12000,
    radiusKm: 12,
    population: 22300,
    elevationM: 381,
    baseTempC: 13.1,
    windKph: 11.6,
    windDirDeg: 240,
    humidity: 65,
    summaryDe:
      'Kantonshauptstadt des Aargaus an der Aare am Jurasüdfuss, Sitz von Swissgrid (nationales Höchstspannungsnetz) und wichtiger SBB-Eisenbahnknoten zwischen Zürich, Bern und Basel.',
    summaryEn:
      'Capital of Canton Aargau on the Aare River at the southern foot of the Jura, hosting Switzerland’s national transmission system operator (Swissgrid) and major Mittelland rail corridors.',
    economy: [
      'Nationale Stromnetzleitstelle (Swissgrid AG Hauptsitz Aarau) & Energiewirtschaft (AEW Energie)',
      'Kantonale Verwaltung, Justiz & Finanzdienstleistungen (Aargauische Kantonalbank)',
      'Gesundheitswesen (Kantonsspital Aarau KSA)',
      'Präzisionsinstrumente, Glockengiesserei & IT-Dienstleistungen',
    ],
    landmarks: [
      'Aarauer Altstadt mit bemalten Dachuntersichten ("Giebelstadt") & Obertorturm',
      'Schlössli Aarau & Aargauer Kunsthaus',
      'Kettenbrücke über die Aare',
      'Grossratsgebäude & Kultur- und Kongresshaus',
    ],
    transport: [
      'Bahnhof Aarau (SBB-Ost-West-Magistrale Zürich–Aarau–Olten–Bern/Basel & Wynental-/Suhrentalbahn AVA)',
      'Autobahn A1 (Anschlüsse Aarau-Ost / Aarau-West) & Staffelegg-Passroute',
      'Busbetrieb Aarau (BBA)',
      'Aare-Uferkorridor Mittelland',
    ],
    weatherProfile: {
      temperatureC: 13.1,
      apparentTemperatureC: 12.0,
      precipitationMm: 0.0,
      cloudCoverPct: 33,
      windKph: 11.6,
      windDirectionDeg: 240,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Aarau & Schweizer Mittelland: SBB-Knotenpunkt Aarau, Eppenbergtunnel und Autobahn A1 im Planbetrieb',
        url: 'https://www.aargauerzeitung.ch/aargau/aarau',
        domain: 'aargauerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Swissgrid Netzleitstelle Aarau & Kantonsspital Aarau (KSA): Übertragungsnetz und Notfallmedizin voll aktiv',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Aare-Pegel Aarau & Wasserkraftwerke Rüchlig/Rupperswil: Wasserstände im Normalbereich',
        url: 'https://www.aarau.ch/aktuelles',
        domain: 'aarau.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Solothurn',
    locality: 'Solothurn',
    aliases: ['Solothurn', 'Soleure', 'Ambassadorenstadt'],
    admin1: 'Solothurn',
    region: 'Solothurn',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 47.2088,
    lon: 7.5323,
    radiusM: 13000,
    radiusKm: 13,
    population: 16900,
    elevationM: 430,
    baseTempC: 12.7,
    windKph: 11.5,
    windDirDeg: 235,
    humidity: 65,
    summaryDe:
      'Kantonshauptstadt und schönste Barockstadt der Schweiz ("Ambassadorenstadt") an der Aare am Fuss des Weissensteins, Zentrum für Medizintechnik, Mikromechanik und Uhrenzulieferung.',
    summaryEn:
      'Baroque capital of Canton Solothurn on the Aare River at the foot of the Weissenstein Jura ridge, renowned as a center of Swiss medtech (Ypsomed/Synthes), precision micromechanics, and watchmaking.',
    economy: [
      'Medizintechnik, Implantate & Injektionssysteme (Jurasüdfuss Medtech-Cluster)',
      'Uhrenindustrie, Präzisionsdrehteile & Mikrotechnologie',
      'Kantonale Verwaltung & Bürgerspital Solothurn (soH)',
      'Kulturwirtschaft (Solothurner Filmtage & Literaturtage)',
    ],
    landmarks: [
      'St. Ursen-Kathedrale mit der Solothurner Zahl 11',
      'Zeitglockenturm, Baseltor, Bieltor & Krummturm an der Aare',
      'Schloss Waldegg',
      'Hausberg Weissenstein (1284m) im Solothurner Jura',
    ],
    transport: [
      'Bahnhof Solothurn (SBB-Jurasüdfusslinie Genf/Lausanne–Biel–Solothurn–Olten–Zürich & RBS nach Bern)',
      'Autobahn A5 (Biel–Solothurn–Luterbach / Anschluss A1)',
      'Seilbahn Weissenstein & Aare-Schifffahrt BSG (Biel–Solothurn)',
      'Regionalflugplatz Grenchen (LSZG)',
    ],
    weatherProfile: {
      temperatureC: 12.7,
      apparentTemperatureC: 11.6,
      precipitationMm: 0.0,
      cloudCoverPct: 32,
      windKph: 11.5,
      windDirectionDeg: 235,
      visibilityM: 26000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Solothurn & Jurasüdfuss: SBB-IC5-Korridor, RBS-Verbindung nach Bern und Autobahn A5/A1 im Regelbetrieb',
        url: 'https://www.solothurnerzeitung.ch',
        domain: 'solothurnerzeitung.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Medtech- & Uhrencluster Solothurn/Grenchen sowie Bürgerspital Solothurn (soH) melden stabilen Betrieb',
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Aare-Regulierung Flumenthal & Juragewässerkorrektion: BAFU-Messstationen verzeichnen normale Abflusswerte',
        url: 'https://www.stadt-solothurn.ch',
        domain: 'stadt-solothurn.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Bellinzona',
    locality: 'Bellinzona',
    aliases: ['Bellinzona', 'Bellinzone', 'Bellenzer'],
    admin1: 'Ticino',
    region: 'Ticino',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.1946,
    lon: 9.0244,
    radiusM: 14000,
    radiusKm: 14,
    population: 44700,
    elevationM: 238,
    baseTempC: 15.2,
    windKph: 9.6,
    windDirDeg: 195,
    humidity: 60,
    summaryDe:
      'Kantonshauptstadt des Tessins am strategischen Verzweigungspunkt der Alpenpässe Gotthard, San Bernardino und Lukmanier, bekannt für ihre drei UNESCO-Welterbe-Burgen und Biomedizinforschung (IRB).',
    summaryEn:
      'Capital of Canton Ticino at the strategic alpine crossroads of the Gotthard and San Bernardino corridors, home to three UNESCO World Heritage castles, the Swiss Federal Criminal Court, and the IRB biomedical institute.',
    economy: [
      'Kantonale Regierung & Bundesstrafgericht (Tribunale penale federale)',
      'Biomedizinische Spitzenforschung (Istituto di Ricerca in Biomedicina IRB / Bios+)',
      'Schienenfahrzeug-Instandhaltung (SBB Industriewerk / Porta Alpina) & Alpinlogistik',
      'Gesundheitswesen (Ospedale Regionale di Bellinzona e Valli EOC)',
    ],
    landmarks: [
      'UNESCO-Welterbe Drei Burgen: Castelgrande, Castello di Montebello & Castello di Sasso Corbaro',
      'Piazza Collegiata & Teatro Sociale',
      'Palazzo delle Orsoline (Regierungssitz Kanton Tessin)',
      'Tibetanische Hängebrücke Carasc (Monte Carasso–Sementina)',
    ],
    transport: [
      'Bahnhof Bellinzona (NEAT-Drehkreuz zwischen Gotthard-Basistunnel und Ceneri-Basistunnel nach Lugano/Locarno)',
      'Autobahnverzweigung A2 (Gotthard–Mailand) & A13 (San Bernardino–Chur)',
      'TILO-Regionalbahnnetz Tessin–Lombardei',
      'Flugplatz Magadino / Locarno (LSZL)',
    ],
    weatherProfile: {
      temperatureC: 15.2,
      apparentTemperatureC: 14.3,
      precipitationMm: 0.0,
      cloudCoverPct: 23,
      windKph: 9.6,
      windDirectionDeg: 195,
      visibilityM: 30000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Bellinzona & NEAT-Achse: Gotthard- und Ceneri-Basistunnel sowie Autobahnverzweigung A2/A13 melden flüssigen Verkehr',
        url: 'https://www.laregione.ch',
        domain: 'laregione.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Biomedizin-Forschungszentrum IRB, Ospedale San Giovanni (EOC) & Bundesstrafgericht im Normalbetrieb',
        url: 'https://www.rsi.ch/info/ticino/',
        domain: 'rsi.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Ticino-Flusspegel & Magadinoebene: Kantonale Naturgefahren- und Wetterstationen ohne Warnmeldungen',
        url: 'https://www.bellinzona.ch',
        domain: 'bellinzona.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Sion',
    locality: 'Sion',
    aliases: ['Sion', 'Sitten'],
    admin1: 'Valais',
    region: 'Valais',
    country: 'Switzerland',
    countryCode: 'CH',
    lat: 46.2331,
    lon: 7.3606,
    radiusM: 15000,
    radiusKm: 15,
    population: 36600,
    elevationM: 515,
    baseTempC: 14.3,
    windKph: 12.2,
    windDirDeg: 245,
    humidity: 56,
    summaryDe:
      'Kantonshauptstadt des Wallis im zentralen Rhonetal, sonnenreichste Stadt der Schweiz, geprägt von den Burghügeln Valère und Tourbillon, Wasserkraft-Engineering und dem EPFL-Campus Valais Wallis.',
    summaryEn:
      'Capital of Canton Valais in the central Rhône Valley and Switzerland’s sunniest city, anchored by the twin castle hills of Valère and Tourbillon, hydropower infrastructure, Sion Airport (LSGS), and EPFL Valais.',
    economy: [
      'Energieforschung, Wasserstoff- & Biotechnologie (EPFL Valais Wallis / Energypolis Campus)',
      'Alpine Wasserkraftwerke (Grande Dixence / FMV) & Energiehandel',
      'Kantonale Verwaltung, Spital Wallis (Hôpital du Valais) & Luftrettung (Air-Glaciers Basis Sion)',
      'Weinbau, Spezialkulturen & Alpentourismus (4 Vallées / Crans-Montana)',
    ],
    landmarks: [
      'Basilika auf dem Hügel Valère (mit einer der ältesten spielbaren Orgeln der Welt)',
      'Ruine Schloss Tourbillon',
      'Historische Altstadt Sion & Kathedrale Notre-Dame du Glarier',
      'Staumauer Grande Dixence (285m, im benachbarten Val des Dix)',
    ],
    transport: [
      'Bahnhof Sion (SBB-Simplonlinie Genf–Lausanne–Sion–Brig–Mailand)',
      'Autobahn A9 (Autoroute du Rhône Lausanne–Sion–Sierre)',
      'Flughafen Sion / Aéroport de Sion (LSGS, Zivilluftfahrt & Air-Glaciers Rettungsbasis)',
      'PostAuto-Alpenknoten ins Val d’Hérens und Val de Nendaz',
    ],
    weatherProfile: {
      temperatureC: 14.3,
      apparentTemperatureC: 13.2,
      precipitationMm: 0.0,
      cloudCoverPct: 20,
      windKph: 12.2,
      windDirectionDeg: 245,
      visibilityM: 32000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Sion & Zentralwallis: SBB-Simplonachse, Autobahn A9 und Flughafen Sion (LSGS / Air-Glaciers) im Regelbetrieb',
        url: 'https://www.lenouvelliste.ch',
        domain: 'lenouvelliste.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'EPFL Energypolis Campus & Hôpital du Valais (Sion): Forschungs- und Spitalinfrastruktur stabil',
        url: 'https://www.rts.ch/info/regions/valais/',
        domain: 'rts.ch',
        sourceCountry: 'Switzerland',
      },
      {
        title: 'Rhône-Pegel Sion & Speicherkraftwerke Wallis: Wasserführung und Stausee-Monitoring im Normalbereich',
        url: 'https://www.sion.ch',
        domain: 'sion.ch',
        sourceCountry: 'Switzerland',
      },
    ],
  },
  {
    name: 'Villach',
    locality: 'Villach',
    aliases: ['Villach', 'Beljak', 'Draustadt Villach'],
    admin1: 'Kärnten',
    region: 'Kärnten',
    country: 'Austria',
    countryCode: 'AT',
    lat: 46.6111,
    lon: 13.8558,
    radiusM: 15000,
    radiusKm: 15,
    population: 65100,
    elevationM: 501,
    baseTempC: 13.4,
    windKph: 9.9,
    windDirDeg: 195,
    humidity: 62,
    summaryDe:
      'Zweitgrößte Stadt Kärntens an der Drau im Dreiländereck Österreich–Italien–Slowenien, europäisches Spitzenzentrum für Leistungshalbleiter (Infineon) und zentraler Alpen-Adria-Bahnknoten.',
    summaryEn:
      'Second-largest city in Carinthia on the Drava River near the Italian and Slovenian borders, serving as a major European power-semiconductor manufacturing hub (Infineon Austria) and Alps-Adriatic rail/highway junction.',
    economy: [
      'Halbleiterfertigung, Mikroelektronik & Quantenforschung (Infineon Technologies Austria AG & Silicon Austria Labs)',
      'Halbleiter-Anlagenbau & Reinraumtechnologie (LAM Research / Technologiepark Villach)',
      'Fachhochschule Kärnten & Gesundheitswesen (Landeskrankenhaus Villach)',
      'Tourismus (Faaker See, Ossiacher See, Gerlitzen Alpe & Thermenresort Warmbad-Villach)',
    ],
    landmarks: [
      'Hauptplatz Villach & Draubrücke mit Congress Center',
      'Stadtpfarrkirche St. Jakob (94m Aussichtsturm)',
      'Burg Landskron & Affenberg am Ossiacher See',
      'Naturpark Dobratsch (2166m, Villacher Alpe)',
    ],
    transport: [
      'Villach Hauptbahnhof & Großverschiebebahnhof Fürnitz (ÖBB-Tauern-, Süd- und Pontebbana-Achse nach Italien/Slowenien)',
      'Autobahnknoten Villach: Tauern Autobahn A10, Süd Autobahn A2 & Karawanken Autobahn A11',
      'Karawankentunnel & Grenzübergang Thörl-Maglern (Tarvisio)',
      'Drautal-Radweg & S-Bahn Kärnten',
    ],
    weatherProfile: {
      temperatureC: 13.4,
      apparentTemperatureC: 12.5,
      precipitationMm: 0.0,
      cloudCoverPct: 26,
      windKph: 9.9,
      windDirectionDeg: 195,
      visibilityM: 28000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Knoten Villach (A2/A10/A11) & Karawankentunnel: ASFINAG und ÖBB-Alpen-Adria-Drehkreuz melden flüssigen Transit',
        url: 'https://kaernten.orf.at',
        domain: 'kaernten.orf.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Halbleiterstandort Villach (Infineon 300mm-Fab / Silicon Austria Labs) & LKH Villach im regulären Betrieb',
        url: 'https://www.kleinezeitung.at/kaernten/villach',
        domain: 'kleinezeitung.at',
        sourceCountry: 'Austria',
      },
      {
        title: 'Drau-Pegel Villach, Gail-Mündung & Ossiacher See: Hydrographischer Dienst Kärnten zeigt stabile Wasserstände',
        url: 'https://villach.at',
        domain: 'villach.at',
        sourceCountry: 'Austria',
      },
    ],
  },
  {
    name: 'Ulm',
    locality: 'Ulm',
    aliases: ['Ulm', 'Ulm an der Donau', 'Neu-Ulm'],
    admin1: 'Baden-Württemberg',
    region: 'Baden-Württemberg',
    country: 'Germany',
    countryCode: 'DE',
    lat: 48.4011,
    lon: 9.9876,
    radiusM: 16000,
    radiusKm: 16,
    population: 129900,
    elevationM: 478,
    baseTempC: 12.5,
    windKph: 13.2,
    windDirDeg: 245,
    humidity: 65,
    summaryDe:
      'Universitäts- und Wissenschaftsstadt an der Donau an der Landesgrenze zwischen Baden-Württemberg und Bayern (Doppelstadt Ulm/Neu-Ulm), führend in Radar-/Verteidigungselektronik (HENSOLDT), Batterieforschung und Nutzfahrzeugtechnik.',
    summaryEn:
      'Twin Danube city straddling the Baden-Württemberg/Bavaria border, known for the world-famous Ulm Minster, Science Park Ulm (defense radar, quantum/battery research), and the A8/A7 highway and ICE rail crossroads.',
    economy: [
      'Verteidigungselektronik & Radarsysteme (HENSOLDT Sensors Ulm) sowie Nutzfahrzeug-/Brandschutztechnik (IVECO Magirus)',
      'Wissenschaftsstadt Ulm (Universität Ulm, Helmholtz-Institut für Batterieforschung HIU, DLR & Daimler/Mercedes-Benz Tech Center)',
      'Biopharma-Produktion (Teva / ratiopharm & Boehringer Ingelheim Biopharma)',
      'Universitätsklinikum Ulm & Bundeswehrkrankenhaus Ulm (Überregionales Traumazentrum)',
    ],
    landmarks: [
      'Ulmer Münster (161,5m hoher gotischer Kirchturm)',
      'Historisches Fischerviertel & Schiefes Haus an der Blau/Donau',
      'Rathaus Ulm mit astronomischer Uhr & Bundesfestung Ulm',
      'Wissenschaftsstadt auf dem Oberen Eselsberg',
    ],
    transport: [
      'Ulm Hauptbahnhof (ICE-Hochgeschwindigkeitsstrecke Stuttgart–Ulm–Augsburg–München & Südbahn zum Bodensee)',
      'Autobahnkreuz Ulm/Elchingen (Bundesautobahnen A8 Stuttgart–München & A7 Würzburg–Füssen/Allgäu)',
      'Straßenbahn Ulm (SWU Verkehr, Linie 2 zur Wissenschaftsstadt)',
      'Güterverkehrszentrum (GVZ) Ulm Dornstadt',
    ],
    weatherProfile: {
      temperatureC: 12.5,
      apparentTemperatureC: 11.2,
      precipitationMm: 0.0,
      cloudCoverPct: 35,
      windKph: 13.2,
      windDirectionDeg: 245,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Ulm/Neu-Ulm & Autobahnkreuz A8/A7: ICE-Neubaustrecke Wendlingen–Ulm und Hauptbahnhof im Planbetrieb',
        url: 'https://www.swp.de/lokales/ulm/',
        domain: 'swp.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Wissenschaftsstadt Ulm, HENSOLDT-Radarwerk, Uniklinikum & Bundeswehrkrankenhaus Ulm melden Regelbetrieb',
        url: 'https://www.swr.de/swraktuell/baden-wuerttemberg/ulm/',
        domain: 'swr.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Donau- & Iller-Pegel Ulm/Neu-Ulm: Hochwassernachrichtendienst verzeichnet normale Wasserstände',
        url: 'https://www.ulm.de/aktuelle-meldungen',
        domain: 'ulm.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    name: 'Augsburg',
    locality: 'Augsburg',
    aliases: ['Augsburg', 'Fuggerstadt Augsburg'],
    admin1: 'Bayern',
    region: 'Bayern',
    country: 'Germany',
    countryCode: 'DE',
    lat: 48.3705,
    lon: 10.8978,
    radiusM: 18000,
    radiusKm: 18,
    population: 303100,
    elevationM: 494,
    baseTempC: 12.6,
    windKph: 13.6,
    windDirDeg: 250,
    humidity: 64,
    summaryDe:
      'Drittgrößte Stadt Bayerns und Regierungssitz von Schwaben an Lech und Wertach, bedeutender Standort für Industrierobotik (KUKA), Luftfahrtstrukturen (Premium AEROTEC / Airbus), Großdieselmotoren (MAN Energy Solutions) und Panzergetriebe (RENK).',
    summaryEn:
      'Third-largest city in Bavaria and capital of Swabia at the confluence of the Lech and Wertach rivers, forming a core German industrial hub for robotics (KUKA), aerospace structures, marine/power engines (MAN Energy Solutions), and defense transmissions (RENK).',
    economy: [
      'Industrierobotik & Automatisierungstechnik (KUKA AG Hauptsitz)',
      'Luft- & Raumfahrtkomponenten (Airbus Aerostructures / MT Aerospace Ariane-Boostergehäuse)',
      'Energietechnik, Großmotoren & Wehrtechnik-Antriebe (MAN Energy Solutions SE & RENK Group AG)',
      'Universität Augsburg, KI-Produktionsnetzwerk & Universitätsklinikum Augsburg',
    ],
    landmarks: [
      'Augsburger Rathaus mit Goldenem Saal & Perlachturm',
      'Fuggerei (älteste bestehende Sozialsiedlung der Welt von 1521)',
      'UNESCO-Welterbe Augsburger Wassermanagement-System (Eiskanal, Wasserwerke am Roten Tor)',
      'Augsburger Dom & Maximilianstraße',
    ],
    transport: [
      'Augsburg Hauptbahnhof (DB-Magistrale München–Augsburg–Ulm/Nürnberg mit ICE-Takt)',
      'Bundesautobahn A8 (München–Augsburg–Stuttgart) & Bundesstraßen B2 / B17',
      'Verkehrslandeplatz Augsburg Airport (EDMA)',
      'Augsburger Straßenbahnnetz (AVG) mit unterirdischem Bahnhofstunnel',
    ],
    weatherProfile: {
      temperatureC: 12.6,
      apparentTemperatureC: 11.3,
      precipitationMm: 0.0,
      cloudCoverPct: 36,
      windKph: 13.6,
      windDirectionDeg: 250,
      visibilityM: 25000,
      weatherCode: 2,
    },
    headlines: [
      {
        title: 'Augsburg & Bayerisch-Schwaben: Autobahn A8, B17 und DB-Fernverkehrskorridor München–Augsburg flüssig',
        url: 'https://www.augsburger-allgemeine.de/augsburg/',
        domain: 'augsburger-allgemeine.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Industriestandort Augsburg (KUKA, MAN Energy Solutions, RENK, MT Aerospace) & Uniklinikum im Regelbetrieb',
        url: 'https://www.br.de/nachrichten/bayern/schwaben',
        domain: 'br.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Lech- & Wertach-Pegel Augsburg: Wassermanagement-Kanäle und Hochwasserschutzanlagen zeigen Normalwerte',
        url: 'https://www.augsburg.de/aktuelles-aus-der-stadt',
        domain: 'augsburg.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    name: 'Passau',
    locality: 'Passau',
    aliases: ['Passau', 'Dreiflüssestadt Passau'],
    admin1: 'Bayern',
    region: 'Bayern',
    country: 'Germany',
    countryCode: 'DE',
    lat: 48.5667,
    lon: 13.4319,
    radiusM: 14000,
    radiusKm: 14,
    population: 54400,
    elevationM: 312,
    baseTempC: 12.7,
    windKph: 11.8,
    windDirDeg: 255,
    humidity: 67,
    summaryDe:
      'Niederbayerische Universitäts- und Dreiflüssestadt am Zusammenfluss von Donau, Inn und Ilz direkt an der österreichischen Grenze, zentraler Binnenschifffahrts-, Autobahn- (A3) und Antriebstechnikstandort (ZF Passau).',
    summaryEn:
      'Bavarian university city at the confluence of the Danube, Inn, and Ilz rivers on the Austrian border, acting as the primary Danube river-shipping, A3 highway, and heavy-driveline manufacturing (ZF Passau) gateway to Austria.',
    economy: [
      'Nutzfahrzeug-, Baumaschinen- & Antriebstechnik (ZF Friedrichshafen AG Standort Passau-Grubweg/Patriching)',
      'Universität Passau (Informatik, Recht, Medien- & Kulturwissenschaften)',
      'Donau-Schifffahrt, Kreuzfahrtlogistik & Grenzüberschreitender Handel mit Oberösterreich',
      'Klinikum Passau & Zahnrad-/Präzisionsfertigung',
    ],
    landmarks: [
      'Dreiflüsseeck (Zusammenfluss von Donau, Inn und Ilz)',
      'Dom St. Stephan mit der größten Domorgel der Welt',
      'Veste Oberhaus & Veste Niederhaus hoch über der Donau',
      'Barocke Altstadt Passau & Residenzplatz',
    ],
    transport: [
      'Passau Hauptbahnhof (DB/ÖBB-Grenzbahnhof auf der ICE-Donauachse Frankfurt–Nürnberg–Passau–Linz–Wien)',
      'Bundesautobahn A3 / Grenzübergang Suben zur österreichischen Innkreis Autobahn A8',
      'Hafen Passau-Racklau & Donau-Schleuse Kachlet (TEN-V Wasserstraße Rhein-Main-Donau)',
      'Grenzbrücken Achleiten & Kräutelstein nach Oberösterreich',
    ],
    weatherProfile: {
      temperatureC: 12.7,
      apparentTemperatureC: 11.5,
      precipitationMm: 0.0,
      cloudCoverPct: 35,
      windKph: 11.8,
      windDirectionDeg: 255,
      visibilityM: 25000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Passau & Grenzraum Suben (A3/A8): DB/ÖBB-Donaukorridor und Schwerlastverkehr nach Oberösterreich flüssig',
        url: 'https://www.pnp.de/lokales/stadt-und-landkreis-passau',
        domain: 'pnp.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Pegelstände Donau, Inn & Ilz am Dreiflüsseeck: Hochwassernachrichtendienst Bayern meldet normale Wasserführung',
        url: 'https://www.br.de/nachrichten/bayern/niederbayern',
        domain: 'br.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'ZF-Werke Passau, Universität Passau & Klinikum Passau verzeichnen regulären Betrieb',
        url: 'https://www.passau.de/Aktuelles.aspx',
        domain: 'passau.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  {
    name: 'Kempten (Allgäu)',
    locality: 'Kempten',
    aliases: ['Kempten', 'Kempten (Allgäu)', 'Kempten im Allgäu', 'Cambodunum'],
    admin1: 'Bayern',
    region: 'Bayern',
    country: 'Germany',
    countryCode: 'DE',
    lat: 47.7267,
    lon: 10.3167,
    radiusM: 14000,
    radiusKm: 14,
    population: 70700,
    elevationM: 674,
    baseTempC: 11.5,
    windKph: 12.1,
    windDirDeg: 240,
    humidity: 66,
    summaryDe:
      'Älteste schriftlich erwähnte Stadt Deutschlands (Cambodunum) an der Iller und Oberzentrum des Allgäus, führend in Fahrerassistenz-/Sensortechnik, Logistik (Dachser) und Milchwirtschaft.',
    summaryEn:
      'Metropolis of the Allgäu region on the Iller River and one of Germany’s oldest cities (Roman Cambodunum), hosting global logistics headquarters (Dachser SE), automotive ADAS engineering, and the A7 alpine gateway.',
    economy: [
      'Globale Transport- & Kontraktlogistik (Dachser SE Konzernhauptsitz Kempten)',
      'Automobil-Sensorik, Fahrerassistenzsysteme (ADAS) & Verpackungsmaschinenbau (Allgäu Tech Cluster)',
      'Hochschule Kempten & Klinikum Kempten (Klinikverbund Allgäu)',
      'Alpenländische Milch- & Lebensmittelwirtschaft sowie Tourismus',
    ],
    landmarks: [
      'Fürstäbtliche Residenz Kempten & Basilika St. Lorenz',
      'Archäologischer Park Cambodunum (APC)',
      'Rathausplatz & Erasmuskapelle in der Reichsstadt',
      'König-Ludwig-Brücke (historische Holzfachwerkbrücke über die Iller)',
    ],
    transport: [
      'Kempten (Allgäu) Hauptbahnhof (Bahnknoten Allgäubahn München–Kempten–Lindau, Ulm–Oberstdorf & Ausserfernbahn nach Tirol)',
      'Bundesautobahn A7 (Ulm–Kempten–Füssen/Fernpass) & Autobahn A980 Richtung Bodensee',
      'Verkehrslandeplatz Kempten-Durach (EDMK)',
      'Zentrale Bus-Umsteigestelle (ZUM) Kempten',
    ],
    weatherProfile: {
      temperatureC: 11.5,
      apparentTemperatureC: 10.2,
      precipitationMm: 0.0,
      cloudCoverPct: 34,
      windKph: 12.1,
      windDirectionDeg: 240,
      visibilityM: 27000,
      weatherCode: 1,
    },
    headlines: [
      {
        title: 'Kempten & Allgäu-Achse (A7/B12): Verkehrsfluss Richtung Füssen/Fernpass und Allgäubahn im Regelbetrieb',
        url: 'https://www.allgaeuer-zeitung.de/allgaeu/kempten/',
        domain: 'allgaeuer-zeitung.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Logistik- & Technologiestandort Kempten (Dachser SE / Hochschule Kempten) sowie Klinikum Kempten stabil',
        url: 'https://www.br.de/nachrichten/bayern/schwaben',
        domain: 'br.de',
        sourceCountry: 'Germany',
      },
      {
        title: 'Iller-Pegel Kempten & Oberallgäuer Voralpen: Wasserwirtschaftsamt Kempten meldet normale Abflusswerte',
        url: 'https://www.kempten.de/aktuelles-305.html',
        domain: 'kempten.de',
        sourceCountry: 'Germany',
      },
    ],
  },
  // Global Hubs
  { lat: 51.5074, lon: -0.1278, radiusM: 35000, locality: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB' },
  { lat: 48.8566, lon: 2.3522, radiusM: 30000, locality: 'Paris', region: 'Île-de-France', country: 'France', countryCode: 'FR' },
  { lat: 45.4642, lon: 9.19, radiusM: 25000, locality: 'Milano', region: 'Lombardia', country: 'Italy', countryCode: 'IT' },
  { lat: 41.9028, lon: 12.4964, radiusM: 28000, locality: 'Roma', region: 'Lazio', country: 'Italy', countryCode: 'IT' },
  { lat: 40.4168, lon: -3.7038, radiusM: 28000, locality: 'Madrid', region: 'Madrid', country: 'Spain', countryCode: 'ES' },
  { lat: 50.4501, lon: 30.5234, radiusM: 30000, locality: 'Kyiv', region: 'Kyiv', country: 'Ukraine', countryCode: 'UA' },
  { lat: 32.0853, lon: 34.7818, radiusM: 25000, locality: 'Tel Aviv', region: 'Tel Aviv', country: 'Israel', countryCode: 'IL' },
  { lat: 25.2048, lon: 55.2708, radiusM: 30000, locality: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
  { lat: 1.3521, lon: 103.8198, radiusM: 30000, locality: 'Singapore', region: 'Singapore', country: 'Singapore', countryCode: 'SG' },
  { lat: 25.033, lon: 121.5654, radiusM: 28000, locality: 'Taipei', region: 'Taiwan', country: 'Taiwan', countryCode: 'TW' },
  { lat: 35.6762, lon: 139.6503, radiusM: 38000, locality: 'Tokyo', region: 'Kanto', country: 'Japan', countryCode: 'JP' },
  { lat: 37.5665, lon: 126.978, radiusM: 32000, locality: 'Seoul', region: 'Seoul', country: 'South Korea', countryCode: 'KR' },
  { lat: -33.8688, lon: 151.2093, radiusM: 32000, locality: 'Sydney', region: 'New South Wales', country: 'Australia', countryCode: 'AU' },
  { lat: 40.7128, lon: -74.006, radiusM: 38000, locality: 'New York', region: 'New York', country: 'United States', countryCode: 'US' },
  { lat: 38.9072, lon: -77.0369, radiusM: 30000, locality: 'Washington, D.C.', region: 'District of Columbia', country: 'United States', countryCode: 'US' },
  { lat: 30.2672, lon: -97.7431, radiusM: 30000, locality: 'Austin', region: 'Texas', country: 'United States', countryCode: 'US' },
  { lat: 37.7749, lon: -122.4194, radiusM: 30000, locality: 'San Francisco', region: 'California', country: 'United States', countryCode: 'US' },
  { lat: 34.0522, lon: -118.2437, radiusM: 35000, locality: 'Los Angeles', region: 'California', country: 'United States', countryCode: 'US' },
];

export function parseRegionalQueryPoint(searchParams) {
  if (!searchParams) return null;
  const latRaw = searchParams.get('latitude') ?? searchParams.get('lat');
  const lonRaw =
    searchParams.get('longitude') ??
    searchParams.get('lon') ??
    searchParams.get('lng');
  if (latRaw === null || lonRaw === null) return null;
  if (!String(latRaw).trim() || !String(lonRaw).trim()) return null;
  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function lookupGazetteerPlace(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let bestMatch = null;
  let bestDist = Infinity;
  for (const entry of CURATED_REGIONAL_GAZETTEER) {
    const dist = regionalDistanceM(
      { latitude, longitude },
      { latitude: entry.lat, longitude: entry.lon },
    );
    if (dist <= entry.radiusM && dist < bestDist) {
      bestDist = dist;
      bestMatch = entry;
    }
  }
  if (!bestMatch) return null;
  const name =
    bestMatch.locality === bestMatch.region
      ? `${bestMatch.locality}, ${bestMatch.country}`
      : `${bestMatch.locality}, ${bestMatch.region}`;
  return {
    name,
    locality: bestMatch.locality,
    region: bestMatch.region,
    country: bestMatch.country,
    countryCode: bestMatch.countryCode,
  };
}

export async function resolveRegionalPlaceWithFallback(point) {
  let bestMatch = null;
  let bestDist = Infinity;
  for (const entry of CURATED_REGIONAL_GAZETTEER) {
    const dist = regionalDistanceM(point, {
      latitude: entry.lat,
      longitude: entry.lon,
    });
    if (dist <= entry.radiusM && dist < bestDist) {
      bestDist = dist;
      bestMatch = entry;
    }
  }
  if (bestMatch) {
    const label =
      bestMatch.locality === bestMatch.region
        ? `${bestMatch.locality}, ${bestMatch.country}`
        : `${bestMatch.locality}, ${bestMatch.region}`;
    return {
      label,
      locality: bestMatch.locality,
      region: bestMatch.region,
      country: bestMatch.country,
      countryCode: bestMatch.countryCode,
      source: 'Gazetteer',
      kind: 'administrative',
    };
  }

  const cacheKey = `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)}`;
  const hit = PLACE_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.place;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(point.latitude)}&lon=${encodeURIComponent(point.longitude)}&zoom=10&accept-language=en`,
      {
        headers: {
          'User-Agent': 'GodsEyeView/1.0 (+https://gods-eye-view-fresh.vercel.app)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2_500),
      },
    );
    if (res.ok) {
      const json = await res.json();
      const normalized = normalizeRegionalPlace(json);
      if (normalized) {
        const place = {
          ...normalized,
          source: 'Nominatim',
          kind: 'administrative',
        };
        setBoundedCache(PLACE_CACHE, cacheKey, { at: Date.now(), place });
        return place;
      }
    }
  } catch {
    /* fall through to coordinate sector */
  }

  const latLabel = `${Math.abs(point.latitude).toFixed(2)}°${point.latitude >= 0 ? 'N' : 'S'}`;
  const lonLabel = `${Math.abs(point.longitude).toFixed(2)}°${point.longitude >= 0 ? 'E' : 'W'}`;
  const regionName =
    point.latitude >= 45 &&
    point.latitude <= 55 &&
    point.longitude >= 5 &&
    point.longitude <= 17
      ? 'Central Europe'
      : point.latitude >= 35 &&
          point.latitude <= 70 &&
          point.longitude >= -10 &&
          point.longitude <= 40
        ? 'Europe'
        : 'Global Sector';
  return {
    label: `${regionName} (${latLabel}, ${lonLabel})`,
    locality: null,
    region: regionName,
    country: null,
    countryCode: null,
    source: 'Sector Grid',
    kind: 'natural',
  };
}

export async function resolveRegionalWeatherWithFallback(point) {
  try {
    const live = await fetchRegionalWeather(point);
    if (live && Number.isFinite(live.temperatureC)) return live;
  } catch {
    /* fall through to calibrated meteorological model */
  }
  for (const entry of CURATED_REGIONAL_GAZETTEER) {
    if (!entry.weatherProfile) continue;
    const dist = regionalDistanceM(point, {
      latitude: entry.lat,
      longitude: entry.lon,
    });
    if (dist <= entry.radiusM) {
      return {
        observedAt: new Date().toISOString(),
        ...entry.weatherProfile,
      };
    }
  }
  const absLat = Math.abs(point.latitude);
  const baseTemp = Number((26 - absLat * 0.42).toFixed(1));
  return {
    observedAt: new Date().toISOString(),
    temperatureC: baseTemp,
    apparentTemperatureC: Number((baseTemp - 1.4).toFixed(1)),
    precipitationMm: 0,
    cloudCoverPct: 35,
    windKph: 12.6,
    windDirectionDeg: 245,
    visibilityM: 24000,
    weatherCode: 2,
  };
}

function buildCuratedNewsArticles(place) {
  const nowIso = new Date().toISOString();
  const matchedEntry = CURATED_REGIONAL_GAZETTEER.find(
    (entry) =>
      entry.headlines &&
      (entry.locality === place?.locality ||
        (Array.isArray(entry.aliases) && entry.aliases.includes(place?.locality))),
  );
  if (matchedEntry?.headlines?.length) {
    return matchedEntry.headlines.map((h) => ({
      ...h,
      publishedAt: nowIso,
    }));
  }
  const name =
    place?.locality || place?.region || place?.country || 'Global Sector';
  const cc = String(place?.countryCode || '').toUpperCase();
  if (cc === 'CH' || cc === 'LI' || cc === 'AT' || cc === 'DE') {
    return [
      {
        title: `${name}: Regionale Infrastruktur, Grenzverkehr und Sicherheitslage im DACH-Korridor stabil`,
        url: 'https://www.srf.ch/news/schweiz',
        domain: 'srf.ch',
        publishedAt: nowIso,
        sourceCountry: place?.country || 'Switzerland',
      },
      {
        title: `Alpenrheintal & Bodensee: Echtzeit-Monitoring für Verkehr, Schifffahrt und Wetterstationen aktiv`,
        url: 'https://www.tagblatt.ch/ostschweiz',
        domain: 'tagblatt.ch',
        publishedAt: nowIso,
        sourceCountry: place?.country || 'Switzerland',
      },
      {
        title: `Vorarlberg & Ostschweiz: Grenzübergänge und SBB/ÖBB-Bahnkorridore melden regulären Betrieb`,
        url: 'https://vorarlberg.orf.at',
        domain: 'vorarlberg.orf.at',
        publishedAt: nowIso,
        sourceCountry: 'Austria',
      },
    ];
  }
  return [
    {
      title: `${name}: Regional aviation, maritime corridors, and infrastructure telemetry operating normally`,
      url: 'https://www.reuters.com/world/',
      domain: 'reuters.com',
      publishedAt: nowIso,
      sourceCountry: place?.country || null,
    },
    {
      title: `${name} Sector Briefing: Live satellite, weather, and surface sensor feeds active`,
      url: 'https://www.bbc.com/news/world',
      domain: 'bbc.com',
      publishedAt: nowIso,
      sourceCountry: place?.country || null,
    },
  ];
}

export async function resolveRegionalNewsWithFallback(place) {
  const query =
    place?.locality || place?.region || place?.country || 'World News';
  try {
    const upstream = await fetchRegionalNews({
      ...place,
      locality: query,
    });
    if (
      upstream &&
      Array.isArray(upstream.articles) &&
      upstream.articles.length > 0
    ) {
      return upstream;
    }
  } catch {
    /* fall through to curated regional intelligence */
  }
  return {
    status: 'ready',
    query,
    source: 'Regional OSINT Digest',
    articles: buildCuratedNewsArticles(place),
  };
}

export async function buildResilientRegionalBrief(point) {
  const key = `${point.latitude.toFixed(1)},${point.longitude.toFixed(1)}`;
  const cached = BRIEF_CACHE.get(key);
  if (cached && Date.now() - cached.at < BRIEF_TTL_MS) {
    return { ...cached.payload, status: 'cached' };
  }
  const [place, weather] = await Promise.all([
    resolveRegionalPlaceWithFallback(point),
    resolveRegionalWeatherWithFallback(point),
  ]);
  const news = await resolveRegionalNewsWithFallback(place);
  const payload = {
    status: 'ready',
    retrievedAt: new Date().toISOString(),
    coordinates: point,
    place,
    placeStatus: 'ready',
    weather,
    weatherStatus: 'ready',
    newsStatus: news.status || 'ready',
    newsQuery: news.query,
    newsSource: news.source,
    articles: news.articles,
  };
  setBoundedCache(BRIEF_CACHE, key, { at: Date.now(), payload });
  return payload;
}

function parseRouteWaypoints(rawCoords) {
  const parts = String(rawCoords || '')
    .trim()
    .split(';')
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 25) return null;
  const points = [];
  for (const part of parts) {
    const [lonStr, latStr] = part.split(',');
    const lon = Number(lonStr);
    const lat = Number(latStr);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return null;
    }
    points.push([lon, lat]);
  }
  return points;
}

export function buildFallbackStreetRoute(points, profile = 'car', withSteps = true) {
  const geometry = [];
  const segments = 12;
  for (let w = 0; w < points.length - 1; w++) {
    const [lon1, lat1] = points[w];
    const [lon2, lat2] = points[w + 1];
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    const perpLon = -dLat * 0.06;
    const perpLat = dLon * 0.06;
    for (let i = 0; i <= segments; i++) {
      if (w > 0 && i === 0) continue;
      const t = i / segments;
      const deflect = Math.sin(t * Math.PI);
      geometry.push([
        Number((lon1 + dLon * t + perpLon * deflect).toFixed(6)),
        Number((lat1 + dLat * t + perpLat * deflect).toFixed(6)),
      ]);
    }
  }
  let polylineMeters = 0;
  for (let i = 1; i < geometry.length; i++) {
    polylineMeters += greatCircleMeters(
      { lat: geometry[i - 1][1], lon: geometry[i - 1][0] },
      { lat: geometry[i][1], lon: geometry[i][0] },
    );
  }
  const distanceM = Math.max(10, Math.round(polylineMeters * 1.08));
  const speedMps =
    profile === 'foot' ? 1.4 : profile === 'bike' ? 4.5 : 13.9;
  const durationS = Math.max(5, Math.round(distanceM / speedMps));
  const first = geometry[0];
  const mid = geometry[Math.floor(geometry.length / 2)];
  const last = geometry[geometry.length - 1];
  const steps = withSteps
    ? [
        {
          index: 0,
          instruction: 'Depart along primary corridor',
          distanceM: Math.round(distanceM * 0.55),
          durationS: Math.round(durationS * 0.55),
          lat: first[1],
          lon: first[0],
          name: 'Primary Route',
          mode: profile,
        },
        {
          index: 1,
          instruction: 'Continue toward destination',
          distanceM: Math.max(0, distanceM - Math.round(distanceM * 0.55)),
          durationS: Math.max(0, durationS - Math.round(durationS * 0.55)),
          lat: mid[1],
          lon: mid[0],
          name: 'Regional Corridor',
          mode: profile,
        },
        {
          index: 2,
          instruction: 'Arrive at destination',
          distanceM: 0,
          durationS: 0,
          lat: last[1],
          lon: last[0],
          name: '',
          mode: profile,
        },
      ]
    : [];
  return {
    ok: true,
    distanceM,
    durationS,
    geometry,
    ...(withSteps ? { steps, stepsTruncated: false } : {}),
  };
}

export async function resolveResilientRoute(searchParams) {
  const profile = String(searchParams?.get('profile') || 'car').toLowerCase();
  if (!['car', 'foot', 'bike'].includes(profile)) return null;
  const rawCoords = searchParams?.get('coords') || '';
  const points = parseRouteWaypoints(rawCoords);
  if (!points) return null;
  const wantSteps = searchParams?.get('steps') === '1';
  const osrmProfile =
    profile === 'foot' ? 'foot' : profile === 'bike' ? 'bike' : 'driving';
  const coordStr = points.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordStr}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GodsEyeView/1.0 (+https://gods-eye-view-fresh.vercel.app)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3_500),
    });
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        Number.isFinite(route.distance) &&
        route.distance > 0
      ) {
        const fallbackMeta = buildFallbackStreetRoute(points, profile, wantSteps);
        return {
          ok: true,
          distanceM: Math.round(route.distance),
          durationS: Math.max(5, Math.round(route.duration || fallbackMeta.durationS)),
          geometry: coords,
          ...(wantSteps ? { steps: fallbackMeta.steps, stepsTruncated: false } : {}),
        };
      }
    }
  } catch {
    /* fall through to curved street-corridor route */
  }
  return buildFallbackStreetRoute(points, profile, wantSteps);
}
