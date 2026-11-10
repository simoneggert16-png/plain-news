import { resolveCatalogSources } from './sourceComposition.js';
import { createWeatherClock } from '../layers/weather/clock.js';
import { createWeatherLayer } from '../layers/weather/index.js';
import { createCyclonesLayer } from '../layers/cyclones/index.js';
import { createWindLayer } from '../layers/wind/index.js';
import { createLayerCatalog } from './catalog.js';
import { LAYER_STATE_REGISTRY } from '../data/layerState.js';
import { createMilitaryRegistry } from '../layers/aircraft/classification.js';
import { createApplicationFlights } from './layers/flights.js';
import { createApplicationMilitary } from './layers/militaryFlights.js';
import { createApplicationVessels } from './layers/aisLiveVessels.js';
import { createApplicationCctv } from './layers/cctv.js';
import { createApplicationRadio } from './layers/radio.js';
import { createApplicationTraffic } from './layers/traffic.js';
import { createApplicationBikeshare } from './layers/bikeshare.js';
import { createApplicationDirections } from './layers/directions.js';
import { createApplicationRecentImagery } from './layers/recentImagery.js';
import { createApplicationTransit } from './layers/transit.js';
import { createApplicationInstallations } from './layers/militaryInstallations.js';
import { createApplicationSatellites } from './layers/satellites.js';
import { createApplicationLaunches } from './layers/rocketLaunches.js';
import { createApplicationAlpr } from './layers/alprCameras.js';
import { createApplicationLocalAdsb } from './layers/localAdsb.js';
import { createApplicationAwareness } from './layers/militaryAwareness.js';
import { createApplicationFirms } from './layers/firms.js';
import { createApplicationEarthquakes } from './layers/earthquakes.js';
import {
  createApplicationFrontline,
  createApplicationStrategicLayers,
} from './layers/frontline.js';
import { createApplicationFrontFires } from './layers/frontfires.js';
import { createApplicationOsint } from './layers/osint.js';
import { createApplicationBorders } from './layers/borders.js';
import { createApplicationHotspots } from './layers/hotspots.js';
import { createApplicationAirQuality } from './layers/airQuality.js';
import { createApplicationFirePerimeters } from './layers/perimeters.js';
import { createApplicationGnssIntegrity } from './layers/gnss.js';
import { createApplicationStreetLevel } from './layers/streetLevel.js';
import { createInfrastructureLayers } from '../data/infrastructure.js';
import { localGeoJsonServices } from './localGeojsonServices.js';

/**
 * Inert stub for Non-Commercial datasets (CC BY-NC) excluded from PLAIN. Maven.
 * Preserves canonical IDs in LAYER_STATE_REGISTRY so share-link codecs and
 * LayerLifecycle.finalizeRegistrations remain 100% compatible without loading
 * any restricted files or endpoints.
 */
function createExcludedComplianceLayer(id, name) {
  return {
    id,
    name,
    icon: '⊘',
    source: 'OMITTED (NC LICENSE)',
    hiddenInPlainMaven: true,
    getSourceAvailability: () => ({
      available: false,
      source: id,
      reason: `${name}: excluded for open-license compliance`,
    }),
    async init() { return false; },
    async enable() { return false; },
    async update() { return false; },
    async disable() { return true; },
    async destroy() {},
    getStats() { return { count: 0, unavailable: true }; },
  };
}

export const LOCAL_ONLY_LAYER_METADATA = Object.freeze([
  Object.freeze({ id: 'local-adsb', disposition: 'local-only' }),
  Object.freeze({ id: 'frontline', disposition: 'local-only' }),
  Object.freeze({ id: 'naval-blockades', disposition: 'local-only' }),
  Object.freeze({ id: 'air-defense', disposition: 'local-only' }),
  Object.freeze({ id: 'missile-sites', disposition: 'local-only' }),
  Object.freeze({ id: 'bunkers', disposition: 'local-only' }),
  Object.freeze({ id: 'military-bases', disposition: 'local-only' }),
  Object.freeze({ id: 'military-research', disposition: 'local-only' }),
  Object.freeze({ id: 'frontfires', disposition: 'local-only' }),
  Object.freeze({ id: 'osint', disposition: 'local-only' }),
  Object.freeze({ id: 'borders', disposition: 'local-only' }),
  Object.freeze({ id: 'hotspots', disposition: 'local-only' }),
]);

export const APPLICATION_LAYER_METADATA = Object.freeze([
  ...LAYER_STATE_REGISTRY,
  ...LOCAL_ONLY_LAYER_METADATA,
]);

export function createApplicationCatalog({
  surface,
  sources,
  signal,
  metadata = APPLICATION_LAYER_METADATA,
  vesselOptions,
  resolveAsset,
  streetLevelProviders,
}) {
  if (!signal?.addEventListener)
    throw new TypeError('An application lifetime signal is required');
  signal.throwIfAborted();
  if (!surface?.groundFloor || !surface?.terrain)
    throw new TypeError('Application surface services are required');

  const sourceComposition = resolveCatalogSources(sources);
  sources = sourceComposition.sources;
  const militaryRegistry = createMilitaryRegistry();
  const weatherClock = createWeatherClock();
  const dispose = () => {
    signal.removeEventListener('abort', dispose);
    militaryRegistry.dispose();
    weatherClock.destroy();
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    if (sourceComposition.isConfigured('military'))
      militaryRegistry.configureSource(sources.military, { signal });
    const flights = createApplicationFlights({
      surface,
      source: sources.flights,
      militaryRegistry,
      resolveAsset,
    });
    const military = createApplicationMilitary({
      surface,
      source: sources.military,
      militaryRegistry,
      resolveAsset,
    });
    const vessels = createApplicationVessels({
      source: sources.vessels,
      options: vesselOptions,
    });
    const installations = createApplicationInstallations({
      surface,
      source: sources.installations,
    });
    const satellites = createApplicationSatellites({
      source: sources.satellites,
    });
    const catalog = createLayerCatalog(
      [
        createExcludedComplianceLayer('bhote-koshi-2026', 'Bhote Koshi Reconstruction'),
        createExcludedComplianceLayer('bhote-koshi-locator', 'Bhote Koshi Locator'),
        flights,
        military,
        createApplicationLocalAdsb({
          surface,
          enrichment: sources.flights,
          displayParams: () => flights.getParams(),
          ...(resolveAsset ? { resolveAsset } : {}),
        }),
        createApplicationEarthquakes({ source: sources.earthquakes }),
        createApplicationFrontline({ source: sources.frontline }),
        ...createApplicationStrategicLayers({ source: sources.frontline }),
        createApplicationFrontFires({ source: sources.frontfires }),
        createApplicationOsint({ source: sources.osint }),
        createApplicationBorders({ source: sources.borders }),
        createApplicationHotspots({ source: sources.hotspots }),
        createApplicationAirQuality({ source: sources['air-quality'] }),
        createApplicationFirePerimeters({
          source: sources['fire-perimeters'],
        }),
        createApplicationGnssIntegrity({
          source: sources['gnss-integrity'],
          windowMs: sources['gnss-integrity'].windowMs,
        }),
        createExcludedComplianceLayer('s2-ghostmaps', 'S2 GhostMaps'),
        createApplicationAlpr({ surface, source: sources.alpr }),
        createApplicationStreetLevel({
          surface,
          sources: { mapillary: sources.mapillary },
          providers: streetLevelProviders,
        }),
        satellites,
        createApplicationLaunches({ source: sources.launches, satellites }),
        createApplicationTraffic({ source: sources.traffic, surface }),
        createApplicationCctv({ surface, source: sources.cctv }),
        createApplicationRadio({ surface, source: sources.radio }),
        createApplicationTransit({ surface, source: sources.transit }),
        createApplicationBikeshare({ source: sources.bikeshare }),
        createApplicationDirections({ source: sources.directions }),
        createApplicationRecentImagery({ source: sources['recent-imagery'] }),
        vessels,
        installations,
        createApplicationAwareness({
          flights,
          military,
          vessels,
          installations,
        }),
        createWindLayer({ feed: sources.wind, clock: weatherClock }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-radar',
          clock: weatherClock,
        }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-satellite',
          clock: weatherClock,
        }),
        createWeatherLayer({
          feed: sources.weather,
          id: 'weather-lightning',
          clock: weatherClock,
        }),
        createCyclonesLayer({ feed: sources.cyclones }),
        ...createInfrastructureLayers(localGeoJsonServices),
        createExcludedComplianceLayer('telegeography-submarine-cables', 'Submarine Cables'),
        createApplicationFirms({
          surface,
          id: 'local-firms',
          name: 'FIRMS Active Fires',
          icon: '▲',
          source: 'NASA FIRMS · LIVE',
          feed: sources.firms,
        }),
      ],
      metadata,
    );
    return Object.freeze({
      ...catalog,
      getSourceAvailability: sourceComposition.createAvailabilityLookup(
        catalog.layers,
      ),
      militaryRegistry,
      surface,
      weatherClock,
    });
  } catch (error) {
    dispose();
    throw error;
  }
}
