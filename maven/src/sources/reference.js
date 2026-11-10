import { createUsgsEarthquakeSource } from '../layers/earthquakes/source.js';
import { createEcccAirQualitySource } from '../layers/airQuality/source.js';
import { createWfigsPerimeterSource } from '../layers/perimeters/source.js';
import { createAdsbGnssSource } from '../layers/gnss/source.js';
import { createFrontlineSource } from '../layers/frontline/source.js';
import { createFrontFiresSource } from '../layers/frontfires/source.js';
import { createOsintSource } from '../layers/osint/source.js';
import { createBordersSource } from '../layers/borders/source.js';
import { createHotspotsSource } from '../layers/hotspots/source.js';

/** Construct reference feeds using strictly open/compliant sources. */
export function createReferenceSources() {
  return {
    earthquakes: createUsgsEarthquakeSource(),
    'air-quality': createEcccAirQualitySource(),
    'fire-perimeters': createWfigsPerimeterSource(),
    cables: null,
    'gnss-integrity': createAdsbGnssSource(),
    frontline: createFrontlineSource(),
    frontfires: createFrontFiresSource(),
    osint: createOsintSource(),
    borders: createBordersSource(),
    hotspots: createHotspotsSource(),
  };
}
