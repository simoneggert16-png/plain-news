import { createFrontlineLayer } from '../../layers/frontline/index.js';
/** Wire the DeepState front line to the application catalog. */
export function createApplicationFrontline(options) {
  return createFrontlineLayer({
    fixedFilter: 'front_only',
    sourceLabel: 'DeepState & UCDP Konflikt-DB',
    coverage: 'Aktive Front- & Kontaktlinien (Ukraine, Gaza, Südlibanon, Syrien, Jemen)',
    ...options,
  });
}

export function createApplicationStrategicLayers({ source }) {
  return [
    createFrontlineLayer({
      source,
      id: 'naval-blockades',
      name: 'Naval Blockades & Aircraft Carriers',
      icon: '⚓',
      sourceLabel: 'USNI / Maritime OSINT',
      coverage: 'Seeblockaden & Flugzeugträger-Kampfgruppen (CSG) weltweit',
      fixedFilter: 'naval',
    }),
    createFrontlineLayer({
      source,
      id: 'air-defense',
      name: 'Air Defense & Iron Dome (Worldwide)',
      icon: '🛡️',
      sourceLabel: 'Strategische Luftabwehr-DB',
      coverage: 'Iron Dome, Arrow-3, Patriot, THAAD, S-400, BODLUV & FLORAKO weltweit',
      fixedFilter: 'air_defense',
    }),
    createFrontlineLayer({
      source,
      id: 'missile-sites',
      name: 'Missile Launch Sites & ICBM Silos',
      icon: '🚀',
      sourceLabel: 'Strategische Raketen-DB',
      coverage: 'ICBM-Silofelder, Raketenbasen & Untergrund-Raketenstädte weltweit',
      fixedFilter: 'missile_site',
    }),
    createFrontlineLayer({
      source,
      id: 'bunkers',
      name: 'Bunkers, Fortresses & Underground Commands',
      icon: '🏰',
      sourceLabel: 'Festungs- & Reduit-DB',
      coverage: 'Schweizer Reduit-Festungen (Heldsberg, Magletsch, Furggels, K20) & Atombunker weltweit',
      fixedFilter: 'bunker',
    }),
    createFrontlineLayer({
      source,
      id: 'military-bases',
      name: 'Military Bases, Barracks & Airbases',
      icon: '🏛️',
      sourceLabel: 'Militär- & Kasernen-DB',
      coverage: 'Schweizer Kasernen, Waffenplätze, Kavernenflugplätze & globale Hauptstützpunkte',
      fixedFilter: 'military_base',
    }),
    createFrontlineLayer({
      source,
      id: 'military-research',
      name: 'Defense, Nuclear & Bioweapons Research',
      icon: '🧬',
      sourceLabel: 'Rüstungs- & BSL-4-Forschungs-DB',
      coverage: 'Lockheed Martin Skunk Works, Area 51, Labor Spiez, BSL-4 Biowaffen- & Nuklearlabore',
      fixedFilter: 'research',
    }),
  ];
}
