/**
 * Bundled OpenStreetMap infrastructure layers (datacenters and dams): their
 * data files, line-delimited GeoJSON parsing and analyst records.
 */

// Resolved by Vite in builds and relative to this module in other consumers,
// when read, so importing this module never needs a module URL.
export const INFRASTRUCTURE_DATA_URLS = Object.freeze({
  get 'local-datacenters'() {
    return new URL(
      '../data/local_data/datacenters/datacenters.geojsonl',
      import.meta.url,
    ).href;
  },
  get 'local-dams'() {
    return new URL('../data/local_data/dams/dams.geojsonl', import.meta.url)
      .href;
  },
});

/** Parse GeoJSON Lines: one Feature per non-empty line. */
export function parseGeojsonLines(text) {
  return String(text)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function makeCuratedPointFeature(id, lon, lat, name, tags) {
  return {
    type: 'Feature',
    id,
    properties: {
      osm_id: id,
      name,
      operator: tags.operator || null,
      capacity: tags['capacity:it_load'] || null,
      output: tags['plant:output:electricity'] || null,
      associated_river: tags.associated_river || null,
      tags: {
        name,
        'name:en': tags['name:en'] || name,
        ...tags,
      },
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon, lat],
          [lon + 0.0004, lat],
          [lon + 0.0004, lat + 0.0004],
          [lon, lat],
        ],
      ],
    },
  };
}

export const CURATED_DATACENTER_FEATURES = Object.freeze([
  makeCuratedPointFeature('curated-dc-sak-sg', 9.3358, 47.4325, 'SAK Rechenzentrum Ostschweiz (St. Gallen / Gaiserwald)', {
    operator: 'St.Gallisch-Appenzellische Kraftwerke AG (SAK)',
    'capacity:it_load': '8 MW · Tier III+ · Ostschweiz Cloud Hub',
  }),
  makeCuratedPointFeature('curated-dc-rheintal-buchs', 9.4812, 47.1695, 'Rheintal-IX & FL-Datacenter (Buchs SG / Vaduz)', {
    operator: 'Telecom Liechtenstein / Rheintal IX',
    'capacity:it_load': '6 MW · Cross-Border Carrier Hotel CH–LI–AT',
  }),
  makeCuratedPointFeature('curated-dc-vorarlberg-dornbirn', 9.7345, 47.4192, 'illwerke vkw / Russmedia Rechenzentrum Vorarlberg (Dornbirn)', {
    operator: 'illwerke vkw / V-Cloud',
    'capacity:it_load': '5 MW · 100% Alpine Hydro Power',
  }),
  makeCuratedPointFeature('curated-dc-equinix-zh5', 8.5138, 47.3914, 'Equinix ZH4 / ZH5 Zürich-West (SwissIX Core)', {
    operator: 'Equinix Switzerland (SwissIX Peering Core)',
    'capacity:it_load': '24 MW · FinTech & Low-Latency Hub',
  }),
  makeCuratedPointFeature('curated-dc-green-lupfig', 8.2045, 47.4452, 'Green Datacenter Campus Zürich-West (Lupfig)', {
    operator: 'Green.ch AG',
    'capacity:it_load': '85 MW · Hyperscale Campus (AWS / Azure / Google Cloud)',
  }),
  makeCuratedPointFeature('curated-dc-green-dielsdorf', 8.4612, 47.4815, 'Green Datacenter Metro-Campus Zürich-Nord (Dielsdorf)', {
    operator: 'Green.ch AG',
    'capacity:it_load': '46 MW · Hyperscale AI & Cloud Campus',
  }),
  makeCuratedPointFeature('curated-dc-interxion-zhr', 8.5642, 47.4318, 'Digital Realty / Interxion ZHR1–ZHR4 (Glattbrugg)', {
    operator: 'Digital Realty Switzerland',
    'capacity:it_load': '38 MW · Cloud Interconnect Campus',
  }),
  makeCuratedPointFeature('curated-dc-cscs-lugano', 8.9614, 46.0128, 'CSCS Swiss National Supercomputing Centre („Alps“ Grace-Hopper AI)', {
    operator: 'ETH Zürich / CSCS',
    'capacity:it_load': '20 MW · 10,752× NVIDIA Grace Hopper Superchips',
  }),
  makeCuratedPointFeature('curated-dc-safehost-gva', 6.1128, 46.1665, 'Safe Host SH1/SH4 Geneva (Plan-les-Ouates / Gland)', {
    operator: 'Safe Host SA',
    'capacity:it_load': '32 MW · UN & Banking Cloud Core',
  }),
  makeCuratedPointFeature('curated-dc-mount10-kandersteg', 7.6485, 46.4982, 'MOUNT10 „Swiss Fort Knox“ Alpen-Bunker-Rechenzentrum', {
    operator: 'MOUNT10 AG / SIAG',
    'capacity:it_load': 'EMP-geschützter Hochsicherheits-Felsbunker',
  }),
  makeCuratedPointFeature('curated-dc-decix-fra', 8.7315, 50.1235, 'DE-CIX & Digital Realty Frankfurt Campus (FRA1–FRA18)', {
    operator: 'Digital Realty / Equinix / DE-CIX',
    'capacity:it_load': '380 MW · Größter Internetknoten Europas (16+ Tbit/s)',
  }),
  makeCuratedPointFeature('curated-dc-vienna-ntt', 16.3985, 48.2612, 'NTT Global Data Centers & VIX Floridsdorf (Wien)', {
    operator: 'NTT Global Data Centers / Vienna Internet eXchange',
    'capacity:it_load': '28 MW · CEE Backbone Gateway',
  }),
  makeCuratedPointFeature('curated-dc-ashburn-dc2', -77.4875, 39.0438, 'Equinix DC1–DC15 & AWS us-east-1 „Data Center Alley“ (Ashburn, VA)', {
    operator: 'Equinix / AWS / Microsoft Azure',
    'capacity:it_load': '1,200 MW · Global Internet Core',
  }),
  makeCuratedPointFeature('curated-dc-telehouse-lon', -0.0028, 51.5112, 'Telehouse London Docklands & LINX Core', {
    operator: 'Telehouse / KDDI (LINX)',
    'capacity:it_load': '95 MW · UK Financial & Submarine Cable Hub',
  }),
  makeCuratedPointFeature('curated-dc-equinix-sg1', 103.6975, 1.3212, 'Equinix SG1–SG5 Ayer Rajah / Jurong (Singapore)', {
    operator: 'Equinix Asia-Pacific',
    'capacity:it_load': '110 MW · Indo-Pacific Subsea Cable Hub',
  }),
  makeCuratedPointFeature('curated-dc-equinix-gv1-gv2', 6.0985, 46.2218, 'Equinix GV1 / GV2 Geneva (CERN CIXP & Diplomatic Cloud Core)', {
    operator: 'Equinix Switzerland',
    'capacity:it_load': '18 MW · CIXP & International Org Peering',
  }),
  makeCuratedPointFeature('curated-dc-swisscom-wankdorf', 7.4642, 46.9685, 'Swisscom Modular Datacenter Bern-Wankdorf (Swiss GovCloud Core)', {
    operator: 'Swisscom AG',
    'capacity:it_load': '16 MW · Tier IV · Bundes- & Banken-Core',
  }),
  makeCuratedPointFeature('curated-dc-mix-milan-ml5', 9.1118, 45.4752, 'Equinix ML5 & MIX Caldera Campus (Mailand, Italien)', {
    operator: 'Equinix Italy / Milan Internet eXchange',
    'capacity:it_load': '65 MW · Südalpen- & Mittelmeer-Subsea-Gateway',
  }),
  makeCuratedPointFeature('curated-dc-interxion-mrs', 5.3698, 43.2965, 'Digital Realty MRS1–MRS4 Subsea Cable Campus (Marseille)', {
    operator: 'Digital Realty / Interxion France',
    'capacity:it_load': '90 MW · 16× Seekabel-Landepunkt (2Africa / PEACE / Blue-Raman)',
  }),
  makeCuratedPointFeature('curated-dc-amsix-equinix-am5', 4.9542, 52.3562, 'Equinix AM5 / AM7 & AMS-IX Core Campus (Amsterdam)', {
    operator: 'Equinix Netherlands / AMS-IX',
    'capacity:it_load': '140 MW · European Cloud & Subsea Core',
  }),
  // Strategic Alpine & European Broadcast / Radar / Telecom Towers
  makeCuratedPointFeature('curated-tower-saentis', 9.3432, 47.2494, 'Sendeturm & Richtfunkknoten Säntis (2502 m · Swisscom / Skyguide / BAKOM)', {
    operator: 'Swisscom Broadcast AG / Skyguide',
    'capacity:it_load': '123 m GFK-Mast · DAB+/UKW/Richtfunk-Backbone Ostschweiz–Bodensee',
  }),
  makeCuratedPointFeature('curated-tower-pfaender', 9.7803, 47.5072, 'Sender Pfänder Bregenz (1064 m · ORS / ORF Richtfunk Dreiländereck)', {
    operator: 'ORS / Österreichischer Rundfunk (ORF)',
    'capacity:it_load': '94 m Stahlfachwerkturm · 100 kW ERP · DVB-T2/DAB+/UKW Bodensee',
  }),
  makeCuratedPointFeature('curated-tower-uetliberg', 8.4903, 47.3514, 'Fernsehturm Uetliberg Zürich (870 m · Swisscom Broadcast / Richtfunk-Zentralknoten)', {
    operator: 'Swisscom Broadcast AG',
    'capacity:it_load': '186.7 m Turm · Richtfunk-, DAB+- & Polycom-Hauptknoten Zürich',
  }),
  makeCuratedPointFeature('curated-tower-bantiger', 7.5286, 46.9778, 'Sendeturm Bantiger Bern (947 m · Swisscom Broadcast / Bundes-Richtfunkknoten)', {
    operator: 'Swisscom Broadcast AG / FUB',
    'capacity:it_load': '196 m Turm · Richtfunk-Drehscheibe Mittelland–Berner Alpen',
  }),
  makeCuratedPointFeature('curated-tower-chasseral', 7.0544, 47.1275, 'Sendeturm Chasseral Berner Jura (1607 m · Swisscom Broadcast / Westschweiz-Link)', {
    operator: 'Swisscom Broadcast AG / armasuisse',
    'capacity:it_load': '118 m Turm · Strategischer Richtfunkknoten Jura–Alpen–Romandie',
  }),
  makeCuratedPointFeature('curated-tower-chrischona', 7.6872, 47.5717, 'Fernsehturm St. Chrischona Basel (250 m · Höchstes freistehendes Bauwerk der Schweiz)', {
    operator: 'Swisscom Broadcast AG',
    'capacity:it_load': '250 m Stahlbetonturm · Richtfunk & Rundfunk Dreiländereck CH–DE–FR',
  }),
  makeCuratedPointFeature('curated-tower-monte-generoso', 9.0203, 45.9286, 'Sendeturm & Richtfunkstation Monte Generoso (1701 m · Tessin–Lombardei-Link)', {
    operator: 'Swisscom Broadcast AG',
    'capacity:it_load': 'Richtfunk-Brücke Gotthard–Südalpen–Mailand & DAB+ Tessin',
  }),
  makeCuratedPointFeature('curated-tower-jungfraujoch', 7.9853, 46.5475, 'Richtfunk- & Forschungsstation Sphinx / Jungfraujoch (3571 m · Höchste Richtfunkstation Europas)', {
    operator: 'Swisscom / Hochalpine Forschungsstation HFSJG',
    'capacity:it_load': '3571 m ü.M. · Transalpine Richtfunkbrücke Berner Alpen–Wallis',
  }),
  makeCuratedPointFeature('curated-tower-pilatus-florako', 8.2556, 46.9792, 'Radar- & Richtfunkstation Pilatus / Oberhaupt (2106 m · FLORAKO Luftraumüberwachung)', {
    operator: 'Schweizer Luftwaffe / Skyguide / Swisscom',
    'capacity:it_load': 'FLORAKO Primär-/Sekundärradar & Alpen-Richtfunkknoten Zentralschweiz',
  }),
  makeCuratedPointFeature('curated-tower-weisshorn-florako', 9.6389, 46.7889, 'Radarstation Weisshorn Arosa & Scopi (2653 m · FLORAKO Sektor Südost)', {
    operator: 'Schweizer Luftwaffe (Führungsunterstützungsbasis FUB)',
    'capacity:it_load': 'FLORAKO Master-Radar & Gebirgs-Richtfunk Graubünden',
  }),
  makeCuratedPointFeature('curated-tower-valluga-arlberg', 10.2131, 47.1575, 'Richtfunk- & Wetterradarstation Valluga St. Anton am Arlberg (2811 m · Austro Control)', {
    operator: 'Austro Control / ORS',
    'capacity:it_load': '2811 m ü.A. · C-Band-Alpenradar & Richtfunkbrücke Vorarlberg–Tirol',
  }),
  makeCuratedPointFeature('curated-tower-patscherkofel', 11.4614, 47.2086, 'Sender & Flugsicherungsradar Patscherkofel Innsbruck (2246 m · ORS / Austro Control)', {
    operator: 'ORS / Austro Control',
    'capacity:it_load': 'Richtfunk-, UKW/DVB-T2- & Radar-Knoten Brenner-Nordzulauf',
  }),
  makeCuratedPointFeature('curated-tower-kolomansberg-goldhaube', 13.2764, 47.8803, 'Ortsfeste Radarstation Kolomansberg (1114 m · Bundesheer LRÜ „Goldhaube“)', {
    operator: 'Österreichisches Bundesheer (Luftraumüberwachung Goldhaube)',
    'capacity:it_load': '3D-Phased-Array-Weitbereichsradar RAT-31DL · Reichweite ~500 km',
  }),
  makeCuratedPointFeature('curated-tower-zugspitze', 10.9853, 47.4211, 'Richtfunk- & Radarstation Zugspitze (2962 m · DFMG / DWD Wetterradar)', {
    operator: 'DFMG / Deutscher Wetterdienst (DWD)',
    'capacity:it_load': '2962 m ü.NHN · Höchster Richtfunk- & Dual-Pol-Dopplerradar-Standort Deutschlands',
  }),
  // Wave 12: European Hyperscale & Colocation Datacenters
  makeCuratedPointFeature('curated-dc-green-lupfig-campus', 8.2089, 47.4458, 'Green Datacenter Zürich-West (Lupfig Campus)', {
    operator: 'Green.ch AG',
    'capacity:it_load': '85 MW · Hyperscale Cloud & AI Campus (AWS / Azure / Google Cloud)',
  }),
  makeCuratedPointFeature('curated-dc-green-dielsdorf-metro', 8.4586, 47.4792, 'Green Datacenter Zürich-Metro (Dielsdorf)', {
    operator: 'Green.ch AG',
    'capacity:it_load': '46 MW · Hyperscale Metro-Campus Zürich-Nord',
  }),
  makeCuratedPointFeature('curated-dc-equinix-gv1-gv2-cern', 6.0858, 46.2189, 'Equinix GV1 & GV2 Genève (CERN IXP Hub)', {
    operator: 'Equinix Switzerland (CIXP)',
    'capacity:it_load': '18 MW · CERN Internet Exchange Point & Diplomatic Cloud Hub',
  }),
  makeCuratedPointFeature('curated-dc-safehost-sh2-plo', 6.1086, 46.1669, 'Safe Host SH2 Plan-les-Ouates (Genève)', {
    operator: 'Safe Host SA (NorthC Group)',
    'capacity:it_load': '22 MW · Tier III+ Institutional & Banking Cloud Hub Geneva',
  }),
  makeCuratedPointFeature('curated-dc-swisscom-bern-wankdorf', 7.4658, 46.9686, 'Swisscom Datacenter Bern-Wankdorf', {
    operator: 'Swisscom AG',
    'capacity:it_load': '16 MW · Tier IV · PUE 1.2 · Swiss Sovereign & GovCloud Core',
  }),
  makeCuratedPointFeature('curated-dc-ckw-rotkreuz', 8.4358, 47.1458, 'CKW Datacenter Rotkreuz (Zug / Luzern)', {
    operator: 'Centralschweizerische Kraftwerke AG (CKW / Axpo)',
    'capacity:it_load': '10 MW · Tier III+ · Crypto Valley & Central Switzerland Cloud Hub',
  }),
  makeCuratedPointFeature('curated-dc-interxion-vienna-vie', 16.3986, 48.2658, 'Digital Realty / Interxion Vienna Campus (VIE1–VIE3)', {
    operator: 'Digital Realty Austria (Interxion)',
    'capacity:it_load': '42 MW · VIX Core & Central/Eastern Europe Peering Gateway',
  }),
  makeCuratedPointFeature('curated-dc-equinix-mu1-mu4', 11.6558, 48.1358, 'Equinix MU1 & MU4 München', {
    operator: 'Equinix Germany',
    'capacity:it_load': '26 MW · Southern German Cloud, Automotive & Industrial AI Hub',
  }),
  makeCuratedPointFeature('curated-dc-vantage-zur1', 8.7558, 47.4986, 'Vantage Data Centers Zürich (ZUR1 Winterthur)', {
    operator: 'Vantage Data Centers Switzerland',
    'capacity:it_load': '40 MW · Hyperscale Campus Winterthur / Zürich-Ost',
  }),
  makeCuratedPointFeature('curated-dc-ntt-fra1', 8.6058, 50.1258, 'NTT Global Data Centers Frankfurt 1 (FRA1)', {
    operator: 'NTT Global Data Centers EMEA',
    'capacity:it_load': '82 MW · Frankfurt-Sossenheim Hyperscale & DE-CIX Backbone Campus',
  }),
  makeCuratedPointFeature('curated-dc-equinix-pa4', 2.3558, 48.9186, 'Equinix PA4 Paris Saint-Denis', {
    operator: 'Equinix France',
    'capacity:it_load': '38 MW · France-IX Core & Paris Hyperscale Interconnect Hub',
  }),
  makeCuratedPointFeature('curated-dc-equinix-am5-scipark', 4.9558, 52.3558, 'Equinix AM5 Amsterdam Science Park', {
    operator: 'Equinix Netherlands (AMS-IX)',
    'capacity:it_load': '45 MW · AMS-IX Core & European Low-Latency Carrier Hotel',
  }),
  makeCuratedPointFeature('curated-dc-equinix-ld8-docklands', -0.0058, 51.5119, 'Equinix LD8 London Docklands (Telehouse)', {
    operator: 'Equinix UK (LINX)',
    'capacity:it_load': '36 MW · Harbour Exchange LINX Core & Subsea Cable Termination',
  }),
  makeCuratedPointFeature('curated-dc-data4-milan', 9.0158, 45.4958, 'Data4 Milan Campus (Cornaredo)', {
    operator: 'DATA4 Group Italy',
    'capacity:it_load': '110 MW · Hyperscale AI & Cloud Campus Milano-Ovest',
  }),
  // Wave 16: European & DACH Hyperscale, Colocation & AI Datacenters
  makeCuratedPointFeature('curated-dc-green-lupfig-west', 8.2015, 47.4468, 'Green Datacenter Lupfig West (Hyperscale Campus Aargau)', {
    operator: 'Green.ch AG',
    'capacity:it_load': '90 MW · Hyperscale Cloud & AI Expansion Campus Zürich-West',
  }),
  makeCuratedPointFeature('curated-dc-safehost-gland', 6.2652, 46.4215, 'Safe Host Gland / Geneva (SH1 Lake Geneva Campus)', {
    operator: 'Safe Host SA (NorthC Group)',
    'capacity:it_load': '16 MW · Tier III+ Lake Geneva Institutional & Cloud Campus',
  }),
  makeCuratedPointFeature('curated-dc-stack-avenches-gva', 7.0425, 46.8812, 'Stack Infrastructure Avenches / Geneva (GVA01 / AVN01 Hyperscale)', {
    operator: 'STACK Infrastructure EMEA',
    'capacity:it_load': '48 MW · Romandie Hyperscale Cloud & High-Density AI Campus',
  }),
  makeCuratedPointFeature('curated-dc-interxion-vie2', 16.3998, 48.2665, 'Interxion / Digital Realty Vienna VIE2 (Floridsdorf Cloud Hub)', {
    operator: 'Digital Realty Austria (Interxion)',
    'capacity:it_load': '36 MW · VIX1 Peering Core & CEE Hyperscale Interconnect',
  }),
  makeCuratedPointFeature('curated-dc-ntt-munich-2', 11.6485, 48.1882, 'NTT Global Data Centers Munich 2 (MUC2 Unterföhring)', {
    operator: 'NTT Global Data Centers EMEA',
    'capacity:it_load': '22 MW · Tier III+ Bavarian Cloud, Media & Automotive AI Hub',
  }),
  makeCuratedPointFeature('curated-dc-equinix-fr8', 8.5892, 50.0985, 'Equinix FR8 Frankfurt (Griesheim xScale Hyperscale)', {
    operator: 'Equinix Germany',
    'capacity:it_load': '54 MW · xScale Hyperscale & DE-CIX Low-Latency Campus',
  }),
  makeCuratedPointFeature('curated-dc-equinix-am7', 4.9485, 52.3012, 'Equinix AM7 Amsterdam (Zuidoost AMS-IX Core)', {
    operator: 'Equinix Netherlands (AMS-IX)',
    'capacity:it_load': '42 MW · Amsterdam Zuidoost AMS-IX & Cloud Backbone Hub',
  }),
  makeCuratedPointFeature('curated-dc-kaodata-harlow', 0.1285, 51.7712, 'Kao Data London Harlow (UK Innovation Corridor AI & HPC Campus)', {
    operator: 'Kao Data Ltd',
    'capacity:it_load': '40 MW · NVIDIA DGX-Ready AI & Life-Sciences Supercomputing Campus',
  }),
  // Wave 19: European Hyperscale, Sovereign Cloud & EuroHPC Exascale AI Datacenters
  makeCuratedPointFeature('curated-dc-stack-zhr01-ruemlang', 8.5382, 47.4485, 'STACK Infrastructure ZHR01 / ZHR02 (Zürich-Rümlang Hyperscale Campus)', {
    operator: 'STACK Infrastructure Switzerland',
    'capacity:it_load': '32 MW · Tier III+ · Cloud & AI Hyperscale Campus Zürich-Flughafen',
  }),
  makeCuratedPointFeature('curated-dc-vantage-fra1-offenbach', 8.7615, 50.0982, 'Vantage Data Centers Frankfurt (FRA1 Offenbach Hyperscale Campus)', {
    operator: 'Vantage Data Centers EMEA',
    'capacity:it_load': '55 MW · DE-CIX Connected Hyperscale Cloud Campus Frankfurt-Ost',
  }),
  makeCuratedPointFeature('curated-dc-northc-muenchenstein-bs', 7.6185, 47.5192, 'NorthC Datacenter Basel-Münchenstein (Life Sciences & Pharma Cloud Hub)', {
    operator: 'NorthC Datacenters Switzerland',
    'capacity:it_load': '12 MW · Tier III+ · Tri-Border Pharma & FinTech Cloud Core CH–DE–FR',
  }),
  makeCuratedPointFeature('curated-dc-iwb-basel-margarethen', 7.6012, 47.5385, 'IWB Rechenzentrum Basel & Telehouse Dreispitz (Basel-Stadt)', {
    operator: 'Industrielle Werke Basel (IWB)',
    'capacity:it_load': '8 MW · 100% Rhein-Wasserkraft & Fernwärme-Abwärmenutzung Basel',
  }),
  makeCuratedPointFeature('curated-dc-lrz-garching-supermuc', 11.6664, 48.2618, 'Leibniz-Rechenzentrum (LRZ) Garching — SuperMUC-NG & EuroHPC Quantum Hub', {
    operator: 'Bayerische Akademie der Wissenschaften / LRZ',
    'capacity:it_load': '24 MW · SuperMUC-NG & Munich Quantum Valley Supercomputing Core',
  }),
  makeCuratedPointFeature('curated-dc-jsc-juelich-jupiter', 6.4085, 50.9052, 'Jülich Supercomputing Centre (JSC) — EuroHPC „JUPITER“ Exascale AI Supercomputer', {
    operator: 'Forschungszentrum Jülich / EuroHPC JU',
    'capacity:it_load': '35 MW · Erster Europäischer Exascale-Supercomputer (24,000× NVIDIA GH200 Grace Hopper)',
  }),
  makeCuratedPointFeature('curated-dc-cineca-bologna-leonardo', 11.3742, 44.5125, 'CINECA Bologna Tecnopolo — EuroHPC „Leonardo“ AI Supercomputer & ECMWF Data Centre', {
    operator: 'CINECA / EuroHPC JU / ECMWF',
    'capacity:it_load': '30 MW · 240 PFLOPS „Leonardo“ GPU-Booster & Europäisches Wetterrechenzentrum',
  }),
  makeCuratedPointFeature('curated-dc-csc-kajaani-lumi', 27.7125, 64.2285, 'CSC Kajaani Data Center — EuroHPC „LUMI“ Pre-Exascale Supercomputer (Finnland)', {
    operator: 'CSC – IT Center for Science / EuroHPC JU',
    'capacity:it_load': '28 MW · 380 PFLOPS · 100% Wasserkraft & Fernwärme-Rückspeisung Kajaani',
  }),
  // Wave 22: European Sovereign AI, HPC & Regional Cloud Datacenters
  makeCuratedPointFeature('curated-dc-ostschweiz-gossau-sg', 9.2618, 47.4125, 'Rechenzentrum Ostschweiz RZO (Gossau SG / St. Gallen Metro Cloud)', {
    operator: 'Rechenzentrum Ostschweiz AG (RZO / SAK)',
    'capacity:it_load': '6 MW · Tier IV (EN 50600 VK4) · Ostschweizer KMU- & Behörden-Cloud-Anker',
  }),
  makeCuratedPointFeature('curated-dc-ewz-herdern-zurich', 8.5082, 47.3885, 'ewz Rechenzentrum Zürich-Herdern & Swiss Sovereign Cloud Node', {
    operator: 'Elektrizitätswerk der Stadt Zürich (ewz)',
    'capacity:it_load': '12 MW · 100% Alpine Wasserkraft & Fernwärme-Verbund Zürich-West',
  }),
  makeCuratedPointFeature('curated-dc-infomaniak-d4-geneva', 6.1245, 46.1782, 'Infomaniak Sovereign AI & District-Heating Datacenter D4 (Genève)', {
    operator: 'Infomaniak Network SA',
    'capacity:it_load': '10 MW · 100% Wärmerückgewinnung ins Genfer Fernwärmenetz (CAD SIG)',
  }),
  makeCuratedPointFeature('curated-dc-bsc-barcelona-marenostrum5', 2.1158, 41.3894, 'Barcelona Supercomputing Center (BSC-CNS) — EuroHPC „MareNostrum 5“ AI Supercomputer', {
    operator: 'BSC-CNS / EuroHPC JU',
    'capacity:it_load': '18 MW · 314 PFLOPS · NVIDIA Hopper H100 AI Factory & Europäischer RISC-V-Inkubator',
  }),
  makeCuratedPointFeature('curated-dc-hlrs-stuttgart-hunter', 9.0972, 48.7418, 'Höchstleistungsrechenzentrum Stuttgart (HLRS) — „Hunter“ & „Herder“ Exascale HPC', {
    operator: 'Universität Stuttgart / Gauss Centre for Supercomputing (GCS)',
    'capacity:it_load': '15 MW · Industrielles Luft-/Raumfahrt- & Klima-Supercomputing Baden-Württemberg',
  }),
  makeCuratedPointFeature('curated-dc-ovhcloud-strasbourg-sbg', 7.7942, 48.5695, 'OVHcloud Sovereign European Cloud Campus Strasbourg (SBG5 / Rhein-Hafen)', {
    operator: 'OVHcloud SAS',
    'capacity:it_load': '45 MW · SecNumCloud-zertifizierter Oberrhein-Hyperscale-Campus',
  }),
]);

export const CURATED_DAM_FEATURES = Object.freeze([
  makeCuratedPointFeature('curated-dam-grande-dixence', 7.4036, 46.0806, 'Grande Dixence Staumauer & Kraftwerk Bieudron (VS)', {
    operator: 'Grande Dixence SA / Alpiq',
    associated_river: 'Dixence / Rhône · 285 m Gewichtsstaumauer (höchste Europas)',
    'plant:output:electricity': '2069 MW',
  }),
  makeCuratedPointFeature('curated-dam-linth-limmern', 9.0072, 46.8485, 'Pumpspeicherwerk Limmern & Muttsee-Staumauer (GL)', {
    operator: 'Kraftwerke Linth-Limmern AG (Axpo)',
    associated_river: 'Limmernsee / Muttsee (Ostschweizer Spitzenlast-Batterie)',
    'plant:output:electricity': '1480 MW',
  }),
  makeCuratedPointFeature('curated-dam-mauvoisin', 7.3492, 45.9975, 'Barrage de Mauvoisin (Bogenstaumauer 250 m, VS)', {
    operator: 'Forces Motrices de Mauvoisin SA / Axpo',
    associated_river: 'Dranse de Bagnes',
    'plant:output:electricity': '363 MW',
  }),
  makeCuratedPointFeature('curated-dam-luzzone', 8.9628, 46.5642, 'Diga del Luzzone (Blenio-Tal, TI)', {
    operator: 'Officine Idroelettriche di Blenio (OFIBLE)',
    associated_river: 'Brenno di Luzzone · 225 m Bogenstaumauer',
    'plant:output:electricity': '402 MW',
  }),
  makeCuratedPointFeature('curated-dam-verzasca', 8.8482, 46.1968, 'Diga della Verzasca / Contra („GoldenEye“-Staumauer, TI)', {
    operator: 'Verzasca SA',
    associated_river: 'Verzasca · 220 m Bogenstaumauer',
    'plant:output:electricity': '105 MW',
  }),
  makeCuratedPointFeature('curated-dam-nant-de-drance', 6.9125, 46.0652, 'Pumpspeicherkraftwerk Nant de Drance / Vieux Emosson (VS)', {
    operator: 'Nant de Drance SA (Alpiq / SBB / IWB)',
    associated_river: 'Lac d’Emosson / Vieux Emosson',
    'plant:output:electricity': '900 MW',
  }),
  makeCuratedPointFeature('curated-dam-grimsel', 8.3325, 46.5718, 'Kraftwerke Oberhasli (KWO) Grimsel- & Oberaar-Stauseen (BE)', {
    operator: 'Kraftwerke Oberhasli AG (KWO)',
    associated_river: 'Aare / Grimselsee',
    'plant:output:electricity': '1350 MW',
  }),
  makeCuratedPointFeature('curated-dam-zervreila', 9.1195, 46.5782, 'Zervreila-Staumauer & Kraftwerke Zervreila (Vals, GR)', {
    operator: 'Kraftwerke Zervreila AG (KWZ)',
    associated_river: 'Valser Rhein',
    'plant:output:electricity': '266 MW',
  }),
  makeCuratedPointFeature('curated-dam-lago-di-lei', 9.4562, 46.4815, 'Lago di Lei & Kraftwerke Hinterrhein (Ferrera / Bärenburg, GR)', {
    operator: 'Kraftwerke Hinterrhein AG (KHR)',
    associated_river: 'Reno di Lei / Hinterrhein',
    'plant:output:electricity': '645 MW',
  }),
  makeCuratedPointFeature('curated-dam-waeggital', 8.9022, 47.0985, 'Wägitalersee & Pumpspeicherwerk Siebnen (SZ)', {
    operator: 'AG Kraftwerk Wägital (Axpo / ewz)',
    associated_river: 'Wägitaler Aa',
    'plant:output:electricity': '148 MW',
  }),
  makeCuratedPointFeature('curated-dam-kubel-sg', 9.3275, 47.4028, 'Kraftwerk Kubel & Gübsensee (St. Gallen / Herisau)', {
    operator: 'St.Gallisch-Appenzellische Kraftwerke AG (SAK)',
    associated_river: 'Sitter / Urnäsch / Gübsensee',
    'plant:output:electricity': '14 MW',
  }),
  makeCuratedPointFeature('curated-dam-montlingen-rheintal', 9.5912, 47.3345, 'Rheintaler Binnenkanalwerke Montlingen / Lienz / Blatten (SG)', {
    operator: 'Rheintaler Binnenkanalwerke AG (RBW / SAK)',
    associated_river: 'Rheintaler Binnenkanal / Alpenrhein',
    'plant:output:electricity': '12.5 MW',
  }),
  makeCuratedPointFeature('curated-dam-lawena-samina', 9.5582, 47.1058, 'Kraftwerke Samina & Lawena (Liechtensteinische Kraftwerke LKW)', {
    operator: 'Liechtensteinische Kraftwerke (LKW)',
    associated_river: 'Saminabach / Stausee Steg (FL)',
    'plant:output:electricity': '14.6 MW',
  }),
  makeCuratedPointFeature('curated-dam-luenersee-kops', 9.7405, 47.0562, 'Lünerseewerk & Kopswerk II (illwerke vkw Montafon, Vorarlberg)', {
    operator: 'illwerke vkw AG',
    associated_river: 'Lünersee / Kops-Stausee / Ill',
    'plant:output:electricity': '1305 MW',
  }),
  makeCuratedPointFeature('curated-dam-silvretta', 10.0925, 46.9178, 'Silvretta-Stausee & Obervermuntwerk II (Bielerhöhe, Vorarlberg)', {
    operator: 'illwerke vkw AG',
    associated_river: 'Ill / Silvretta-Stausee (2030 m ü.A.)',
    'plant:output:electricity': '740 MW',
  }),
  makeCuratedPointFeature('curated-dam-kaprun', 12.7215, 47.1678, 'Pumpspeicherkraftwerk Kaprun Limberg I–III & Mooserboden (AT)', {
    operator: 'VERBUND Hydro Power GmbH',
    associated_river: 'Kapruner Ache / Tauernkraftwerke',
    'plant:output:electricity': '1312 MW',
  }),
  makeCuratedPointFeature('curated-dam-koelnbrein', 13.3408, 47.0785, 'Kölnbreinsperre (Malta-Hauptstufe, 200 m Bogenstaumauer, AT)', {
    operator: 'VERBUND Hydro Power GmbH',
    associated_river: 'Malta / Kölnbreinspeicher (Kärnten)',
    'plant:output:electricity': '891 MW',
  }),
  makeCuratedPointFeature('curated-dam-kkw-goesgen', 7.9667, 47.3661, 'Kernkraftwerk Gösgen (KKG — Druckwasserreaktor, SO)', {
    operator: 'Kernkraftwerk Gösgen-Däniken AG (Alpiq / Axpo / CKW)',
    associated_river: 'Aare · Grundlast-Kernkraftwerk',
    'plant:output:electricity': '1010 MW',
  }),
  makeCuratedPointFeature('curated-dam-kkw-leibstadt', 8.1844, 47.6019, 'Kernkraftwerk Leibstadt (KKL — Leistungsstärkstes KKW der Schweiz, AG)', {
    operator: 'Kernkraftwerk Leibstadt AG (Axpo / Alpiq / BKW)',
    associated_river: 'Hochrhein · Siedewasserreaktor',
    'plant:output:electricity': '1275 MW',
  }),
  makeCuratedPointFeature('curated-dam-kkw-beznau', 8.2286, 47.5522, 'Kernkraftwerk Beznau I & II (KKB — Döttingen, AG)', {
    operator: 'Axpo Power AG',
    associated_river: 'Aare · Doppelblock-Druckwasserreaktor & Fernwärme Refuna',
    'plant:output:electricity': '730 MW',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-laufenburg', 8.0608, 47.5528, 'Swissgrid 380-kV-Netzknoten „Stern von Laufenburg“ (AG)', {
    operator: 'Swissgrid AG / Amprion / TransnetBW',
    associated_river: 'Hochrhein · Historischer Verbundnetzknoten Europa (380/220 kV)',
    'plant:output:electricity': '4800 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-bonaduz', 9.3982, 46.8145, 'Swissgrid 380-kV-Unterwerk Bonaduz / Sils im Domleschg (GR)', {
    operator: 'Swissgrid AG',
    associated_river: 'Alpen-Nord-Süd-Höchstspannungsachse (CH–IT–AT)',
    'plant:output:electricity': '3200 MVA',
  }),
  makeCuratedPointFeature('curated-dam-apg-buers-meiningen', 9.5918, 47.2982, 'APG / VKW 380/220-kV-Umspannwerk Meiningen / Bürs (Rheintal / Walgau)', {
    operator: 'Austrian Power Grid (APG) / illwerke vkw',
    associated_river: 'Alpenrhein / Ill · Netzkupplung Österreich–Schweiz–Deutschland',
    'plant:output:electricity': '2800 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-pradella', 10.3125, 46.7942, 'Swissgrid 380/220-kV-Unterwerk Pradella & Kraftwerke Engadin (Scuol, GR)', {
    operator: 'Swissgrid AG / Engadiner Kraftwerke AG (EKW)',
    associated_river: 'Inn · 380-kV-Interkonnektor Pradella–Laatsch (CH–IT) & Westtirol (CH–AT)',
    'plant:output:electricity': '2400 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-sils', 9.4586, 46.7014, 'Swissgrid 380/220-kV-Unterwerk Sils im Domleschg & Kraftwerk Sils (GR)', {
    operator: 'Swissgrid AG / Kraftwerke Hinterrhein (KHR)',
    associated_river: 'Albula / Hinterrhein · 380-kV-Alpen-Nord-Süd-Achse Sils–Soazza–Bulciago',
    'plant:output:electricity': '3600 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-mettlen', 8.3286, 47.1158, 'Swissgrid 380/220-kV-Netzknoten Mettlen (Eschenbach / Luzern, LU)', {
    operator: 'Swissgrid AG',
    associated_river: 'Reuss · Zentraler 380-kV-Hauptknoten Zentralschweiz & Gotthard-Nordzulauf',
    'plant:output:electricity': '4200 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-bassecourt', 7.2414, 47.3364, 'Swissgrid 380/220-kV-Unterwerk Bassecourt (Jura · Interkonnektor CH–FR)', {
    operator: 'Swissgrid AG / RTE France',
    associated_river: 'Sorne · 380-kV-Grenzkuppelstelle Bassecourt–Sierentz (Frankreich–Schweiz)',
    'plant:output:electricity': '3800 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-bickigen', 7.6186, 47.0925, 'Swissgrid 380/220-kV-Unterwerk Bickigen (Wynigen / Burgdorf, BE)', {
    operator: 'Swissgrid AG / BKW',
    associated_river: 'Emme · 380-kV-Hauptknoten Mittelland & Gemmi-Nordachse',
    'plant:output:electricity': '3500 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-chamoson', 7.2342, 46.1978, 'Swissgrid 380-kV-Unterwerk Chamoson (Rhônetal / Wallis, VS)', {
    operator: 'Swissgrid AG',
    associated_river: 'Rhône · 380-kV-Walliser Wasserkraft-Sammler (Grande Dixence / Nant de Drance)',
    'plant:output:electricity': '4500 MVA',
  }),
  makeCuratedPointFeature('curated-dam-apg-westtirol', 10.8486, 47.2458, 'APG 380/220-kV-Umspannwerk Westtirol (Haiming / Imst, Tirol)', {
    operator: 'Austrian Power Grid (APG) / TIWAG',
    associated_river: 'Inn · 380-kV-Alpen-Drehscheibe Österreich–Schweiz–Deutschland–Italien',
    'plant:output:electricity': '4000 MVA',
  }),
  makeCuratedPointFeature('curated-dam-illwerke-buers', 9.8058, 47.1472, 'Umspannwerk Bürs 380/220/110 kV (Vorarlberger Illwerke / APG / TransnetBW, Bludenz)', {
    operator: 'illwerke vkw AG / Austrian Power Grid (APG) / Amprion',
    associated_river: 'Ill · 380-kV-Spitzenlast-Netzknoten Montafon–Tirol–Bodensee (Lünersee/Kops)',
    'plant:output:electricity': '3400 MVA',
  }),
  // Wave 12: Alpine Hydro/Pumped-Storage Dams, Research Facilities & 380kV Grid Hubs
  makeCuratedPointFeature('curated-dam-kll-limmern-1000mw', 9.0064, 46.8481, 'Pumpspeicherwerk Limmern (KLL Linthal 1000 MW)', {
    operator: 'Kraftwerke Linth-Limmern AG (Axpo)',
    associated_river: 'Limmernsee / Muttsee · 1000 MW Kavernen-Pumpspeicherwerk',
    'plant:output:electricity': '1000 MW',
  }),
  makeCuratedPointFeature('curated-dam-nant-de-drance-900mw', 6.9069, 46.0658, 'Pumpspeicherwerk Nant de Drance (Finhaut / Emosson 900 MW)', {
    operator: 'Nant de Drance SA (Alpiq / SBB / IWB / FMV)',
    associated_river: 'Lac d’Emosson / Vieux Emosson · 6× 150 MW Drehzahlvariable Pumpturbinen',
    'plant:output:electricity': '900 MW',
  }),
  makeCuratedPointFeature('curated-dam-mauvoisin-bagnes', 7.3486, 45.9972, 'Staumauer Mauvoisin (Val de Bagnes 250m)', {
    operator: 'Forces Motrices de Mauvoisin SA (FMM / Axpo)',
    associated_river: 'Dranse de Bagnes · 250 m Bogenstaumauer (höchste Bogenstaumauer der Schweiz)',
    'plant:output:electricity': '363 MW',
  }),
  makeCuratedPointFeature('curated-dam-luzzone-blenio', 8.9631, 46.5619, 'Staumauer Luzzone (Blenio Tessin 225m)', {
    operator: 'Officine Idroelettriche di Blenio SA (OFIBLE)',
    associated_river: 'Brenno di Luzzone · 225 m Hochgebirgs-Bogenstaumauer',
    'plant:output:electricity': '402 MW',
  }),
  makeCuratedPointFeature('curated-dam-contra-verzasca', 8.8483, 46.1969, 'Contra / Verzasca Staumauer (Tenero 220m)', {
    operator: 'Verzasca SA',
    associated_river: 'Verzasca / Lago di Vogorno · 220 m Bogenstaumauer',
    'plant:output:electricity': '105 MW',
  }),
  makeCuratedPointFeature('curated-dam-mattmark', 7.9597, 46.0489, 'Staumauer Mattmark (Saas-Almagell)', {
    operator: 'Kraftwerke Mattmark AG (KWM / Axpo)',
    associated_river: 'Saaser Vispa · 120 m Erdschüttdamm (größter Staudamm Europas)',
    'plant:output:electricity': '260 MW',
  }),
  makeCuratedPointFeature('curated-dam-kwo-grimsel-oberaar', 8.3331, 46.5714, 'Grimselpass / Oberaar & Gelmersee Kraftwerke (KWO)', {
    operator: 'Kraftwerke Oberhasli AG (KWO)',
    associated_river: 'Aare / Grimselsee / Oberaarsee / Gelmersee (Grimsel 1–3)',
    'plant:output:electricity': '1350 MW',
  }),
  makeCuratedPointFeature('curated-dam-kopswerk-ii', 10.1186, 46.9742, 'Kopswerk II & Kopssee (illwerke vkw Montafon)', {
    operator: 'illwerke vkw AG',
    associated_river: 'Kops-Stausee / Ill · Hochleistungs-Regelpumpspeicherwerk',
    'plant:output:electricity': '525 MW',
  }),
  makeCuratedPointFeature('curated-dam-luenerseewerk', 9.7447, 47.0558, 'Lünerseewerk & Lünersee (illwerke vkw Brandnertal)', {
    operator: 'illwerke vkw AG',
    associated_river: 'Lünersee (1970 m ü.A.) / Rellstal · Spitzenlast-Pumpspeicherwerk',
    'plant:output:electricity': '230 MW',
  }),
  makeCuratedPointFeature('curated-dam-kaprun-verbund', 12.7244, 47.1658, 'Kraftwerksgruppe Kaprun Hochgebirgsstauseen (VERBUND)', {
    operator: 'VERBUND Hydro Power GmbH',
    associated_river: 'Kapruner Ache / Stauseen Mooserboden & Wasserfallboden (Limberg I–III)',
    'plant:output:electricity': '1312 MW',
  }),
  makeCuratedPointFeature('curated-dam-koelnbrein-malta', 13.3414, 47.0789, 'Kölnbreinsperre / Malta-Reisseck (Kärnten 200m)', {
    operator: 'VERBUND Hydro Power GmbH',
    associated_river: 'Malta / Lieser · 200 m doppelt gekrümmte Bogenstaumauer (höchste Österreichs)',
    'plant:output:electricity': '1026 MW',
  }),
  makeCuratedPointFeature('curated-dam-schluchsee-haeusern', 8.1764, 47.8019, 'Pumpspeicherwerk Schluchsee / Häusern (Schwarzwald)', {
    operator: 'Schluchseewerk AG (EnBW / RWE)',
    associated_river: 'Schluchsee / Schwarza · Kraftwerksgruppe Schluchsee-Hotzenwald',
    'plant:output:electricity': '1858 MW',
  }),
  makeCuratedPointFeature('curated-dam-walchensee', 11.3375, 47.6286, 'Walchenseekraftwerk (Kochel am See Bayern)', {
    operator: 'Uniper Kraftwerke GmbH',
    associated_river: 'Walchensee / Kochelsee / Isar-Überleitung · Bahnstrom- & Spitzenlastwerk',
    'plant:output:electricity': '124 MW',
  }),
  makeCuratedPointFeature('curated-dam-cern-lhc', 6.0557, 46.2330, 'CERN Large Hadron Collider (Meyrin / Genève)', {
    operator: 'CERN (European Organization for Nuclear Research)',
    associated_river: '27 km Supraleitender Teilchenbeschleuniger-Ring (13.6 TeV · 200 MW Spitzenlast)',
    'plant:output:electricity': '200 MW (Last)',
  }),
  makeCuratedPointFeature('curated-dam-psi-villigen', 8.2231, 47.5369, 'Paul Scherrer Institut PSI (Villigen / Aargau)', {
    operator: 'ETH-Bereich / Paul Scherrer Institut (PSI)',
    associated_river: 'Aare · Swiss Light Source (SLS 2.0), SwissFEL & SINQ Spallations-Neutronenquelle',
    'plant:output:electricity': '45 MW (Forschungsnetz)',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-bickigen-be', 7.5792, 47.0956, 'Swissgrid 380kV Unterwerk Bickigen (Bern)', {
    operator: 'Swissgrid AG / BKW Energie AG',
    associated_river: 'Emme · 380/220-kV-Übertragungsnetzknoten Mittelland–Gemmi-Achse',
    'plant:output:electricity': '3500 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-sils-gr', 9.4586, 46.7019, 'Swissgrid 380kV Unterwerk Sils im Domleschg (Graubünden)', {
    operator: 'Swissgrid AG / Kraftwerke Hinterrhein AG (KHR)',
    associated_river: 'Hinterrhein / Albula · 380-kV-Alpen-Nord-Süd-Transversale',
    'plant:output:electricity': '3600 MVA',
  }),
  makeCuratedPointFeature('curated-dam-apg-westtirol-haiming', 10.8658, 47.2419, 'APG 380kV Umspannwerk Westtirol (Haiming / Inntal)', {
    operator: 'Austrian Power Grid (APG) / TIWAG',
    associated_river: 'Inn · 380/220-kV-Alpen-Interkonnektor AT–CH–DE–IT',
    'plant:output:electricity': '4000 MVA',
  }),
  // Wave 16: Alpine Pumped-Storage Plants, High-Head Arch Dams & Reservoir Systems
  makeCuratedPointFeature('curated-dam-hongrin-veytaux', 6.9295, 46.4252, 'Hongrin-Léman Veytaux Pumped Storage (FMHL 480 MW, VD)', {
    operator: 'Forces Motrices Hongrin-Léman SA (FMHL / Romande Energie / Alpiq)',
    associated_river: 'Lac de l’Hongrin / Lac Léman · 125 m Doppelbogenstaumauer & Kavernen-Pumpspeicherwerk Veytaux',
    'plant:output:electricity': '480 MW',
  }),
  makeCuratedPointFeature('curated-dam-emosson-valais', 6.9162, 46.0672, 'Émosson Dam Valais (Barrage d’Émosson 180 m, Finhaut VS)', {
    operator: 'Électricité d’Émosson SA (Alpiq / EDF)',
    associated_river: 'Barberine / Lac d’Émosson · 180 m Bogenstaumauer (Unterbecken Nant de Drance)',
    'plant:output:electricity': '420 MW',
  }),
  makeCuratedPointFeature('curated-dam-mattmark-saastal', 7.9585, 46.0495, 'Mattmark Dam Saastal (Kraftwerke Mattmark 260 MW, VS)', {
    operator: 'Kraftwerke Mattmark AG (KWM / Axpo)',
    associated_river: 'Saaser Vispa / Mattmarksee · 120 m Erdschüttdamm & Kraftwerke Zermeiggern/Stalden',
    'plant:output:electricity': '260 MW',
  }),
  makeCuratedPointFeature('curated-dam-zervreila-vals', 9.1205, 46.5788, 'Zervreila Dam Vals (Kraftwerke Zervreila 266 MW, GR)', {
    operator: 'Kraftwerke Zervreila AG (KWZ)',
    associated_river: 'Valser Rhein · 151 m Bogenstaumauer & dreistufige Kraftwerksgruppe Safien/Rothenbrunnen',
    'plant:output:electricity': '266 MW',
  }),
  makeCuratedPointFeature('curated-dam-lago-di-lei-valle', 9.4575, 46.4822, 'Lago di Lei Valle di Lei (Kraftwerke Hinterrhein 645 MW, GR/IT)', {
    operator: 'Kraftwerke Hinterrhein AG (KHR)',
    associated_river: 'Reno di Lei / Hinterrhein · 141 m Bogenstaumauer & Pumpspeicherwerk Ferrera',
    'plant:output:electricity': '645 MW',
  }),
  makeCuratedPointFeature('curated-dam-silvretta-bielerhoehe', 10.0938, 46.9182, 'Silvretta-Stausee Bielerhöhe Montafon (Obervermuntwerk II, Vorarlberg)', {
    operator: 'illwerke vkw AG',
    associated_river: 'Ill / Silvretta-Stausee & Vermuntsee (2030 m ü.A. · Pumpspeicherwerk Obervermuntwerk II)',
    'plant:output:electricity': '360 MW',
  }),
  makeCuratedPointFeature('curated-dam-gepatschspeicher-kaunertal', 10.7425, 46.9585, 'Gepatschspeicher Kaunertal Tirol (TIWAG Kaunertalkraftwerk 392 MW)', {
    operator: 'TIWAG-Tiroler Wasserkraft AG',
    associated_river: 'Fagge / Inn · 153 m Steinschüttdamm Gepatsch & Kraftwerk Prutz (895 m Fallhöhe)',
    'plant:output:electricity': '392 MW',
  }),
  makeCuratedPointFeature('curated-dam-walchenseekraftwerk-kochel', 11.3385, 47.6292, 'Walchenseekraftwerk Kochel Bayern (Uniper Speicherkraftwerk 124 MW)', {
    operator: 'Uniper Kraftwerke GmbH',
    associated_river: 'Walchensee / Kochelsee / Isar · Hochdruck-Speicherkraftwerk & 110-kV-Bahnstromknoten',
    'plant:output:electricity': '124 MW',
  }),
  // Wave 19: Alpine Pumped-Storage Cascades, 380kV Transmission Nodes & Fusion Research Facilities
  makeCuratedPointFeature('curated-dam-kuehtai-sellrain-silz', 11.0185, 47.2062, 'Speicherkraftwerksgruppe Sellrain-Silz & Pumpspeicher Kühtai (TIWAG Tirol, AT)', {
    operator: 'TIWAG-Tiroler Wasserkraft AG',
    associated_river: 'Finstertaler See / Längentaler Speicher / Kühtai · Hochdruck-Pumpspeicherkaskade Inntal',
    'plant:output:electricity': '990 MW',
  }),
  makeCuratedPointFeature('curated-dam-zillertal-schlegeis-mayrhofen', 11.7038, 47.0392, 'Schlegeisspeicher & Pumpspeicherwerk Roßhag / Mayrhofen (VERBUND Zillertal, AT)', {
    operator: 'VERBUND Hydro Power GmbH',
    associated_river: 'Zemmbach / Schlegeisspeicher (131 m Bogengewichtsmauer) & Kraftwerksgruppe Zemm-Ziller',
    'plant:output:electricity': '847 MW',
  }),
  makeCuratedPointFeature('curated-dam-cleuson-dixence-moiry', 7.5702, 46.1368, 'Barrage de Moiry & Kraftwerke Gougra / Anniviers (Val d’Anniviers, VS)', {
    operator: 'Forces Motrices de la Gougra SA / Alpiq',
    associated_river: 'Gougra / Lac de Moiry · 148 m Bogenstaumauer & Hochdruck-Speicherkaskade Vissoie/Chippis',
    'plant:output:electricity': '167 MW',
  }),
  makeCuratedPointFeature('curated-dam-ofima-robiei-bavona', 8.5142, 46.4458, 'Pumpspeicherwerk Robiei & Cavagnoli-Staumauer (Maggia-Kraftwerke OFIMA, TI)', {
    operator: 'Officine Idroelettriche della Maggia SA (OFIMA)',
    associated_river: 'Bavona / Lago dei Cavagnoli & Lago del Narèt · Alpines Pumpspeicher- & Spitzenlastwerk',
    'plant:output:electricity': '612 MW',
  }),
  makeCuratedPointFeature('curated-dam-grand-maison-isere', 6.1195, 45.2058, 'Barrage de Grand’Maison & Pumpspeicherwerk Eau d’Olle (EDF Isère, Frankreich)', {
    operator: 'Électricité de France (EDF Hydro Alpes)',
    associated_river: 'Eau d’Olle / Romanche · Größtes Pumpspeicherkraftwerk Frankreichs & Europas Spitzenlast-Anker',
    'plant:output:electricity': '1820 MW',
  }),
  makeCuratedPointFeature('curated-dam-entracque-chiotas', 7.3865, 44.2185, 'Impianto Idroelettrico Luigi Einaudi / Entracque Pumped Storage (Enel Piemont, Italien)', {
    operator: 'Enel Green Power Italia',
    associated_river: 'Lago del Chiotas / Lago della Rovina · Größtes Pumpspeicherkraftwerk Italiens (Seealpen)',
    'plant:output:electricity': '1317 MW',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-breite-faellanden', 8.6745, 47.4525, 'Swissgrid 380/220-kV-Unterwerk Breite / Nürensdorf & Netzknoten Zürich-Ost (ZH)', {
    operator: 'Swissgrid AG / Axpo / ewz',
    associated_river: 'Glatt / Töss · Strategischer 380-kV-Versorgungsring Großraum Zürich & Ostschweiz-Achse',
    'plant:output:electricity': '3800 MVA',
  }),
  makeCuratedPointFeature('curated-dam-iter-cadarache-fusion', 5.7622, 43.7064, 'ITER Tokamak Fusionsforschungsanlage & CEA Cadarache (Saint-Paul-lez-Durance, FR)', {
    operator: 'ITER Organization / CEA Cadarache',
    associated_river: 'Durance · Weltgrößter Magneteinschluss-Kernfusionsreaktor (500 MW Fusionsleistung · 400-kV-Netzanschluss)',
    'plant:output:electricity': '500 MW (Fusionsthermisch)',
  }),
  // Wave 22: Alpine Pumped-Storage Reservoirs, 380kV Substations & Cross-Border HVDC Links
  makeCuratedPointFeature('curated-dam-swissgrid-ruethi-winkeln', 9.5385, 47.2942, 'Swissgrid 380/220-kV-Unterwerk Rüthi SG & Winkeln (Alpenrheintal–Ostschweiz-Achse)', {
    operator: 'Swissgrid AG / SAK / Axpo',
    associated_river: 'Alpenrhein · 380-kV-Ostschweiz-Hauptachse Bonaduz–Rüthi–Winkeln & Kuppelleitung Meiningen (AT)',
    'plant:output:electricity': '2600 MVA',
  }),
  makeCuratedPointFeature('curated-dam-swissgrid-soazza-mesocco', 9.2185, 46.3642, 'Swissgrid 380/220-kV-Unterwerk Soazza & Kraftwerke Misox (San-Bernardino-Südachse, GR)', {
    operator: 'Swissgrid AG / Elettricità Industriale SA',
    associated_river: 'Moesa · 380-kV-Alpen-Südportal Sils–Soazza–Bulciago (Hauptinterkonnektor Schweiz–Italien)',
    'plant:output:electricity': '3200 MVA',
  }),
  makeCuratedPointFeature('curated-dam-albegna-palue-bernina', 10.0285, 46.3792, 'Kraftwerke Brusio / Repower — Lago Bianco, Palü & Pumpspeicher Robbia (Valposchiavo, GR)', {
    operator: 'Repower AG',
    associated_river: 'Poschiavino / Lago Bianco (2234 m ü.M.) · Hochgebirgs-Pumpspeicher & 380-kV-Bernina-Übertragungsachse',
    'plant:output:electricity': '245 MW',
  }),
  makeCuratedPointFeature('curated-dam-ritom-ambri-sbb', 8.6782, 46.5138, 'Ritomsee & Bahnstrom-Speicherkraftwerk Ritom II (SBB / AET Piotta, Leventina TI)', {
    operator: 'Ritom SA (SBB 75% / AET 25%)',
    associated_river: 'Foss / Lago Ritom / Ticino · 120 MW 16.7-Hz-Gotthard-Bahnstrom & 50-Hz-Regelkraftwerk',
    'plant:output:electricity': '120 MW',
  }),
  makeCuratedPointFeature('curated-dam-brenner-steinach-apg-terna', 11.4685, 47.0842, '380/220-kV-Alpen-Interkonnektor Steinach am Brenner / Nauders–Glurns (APG / Terna, AT–IT)', {
    operator: 'Austrian Power Grid (APG) / Terna Rete Elettrica Nazionale / ÖBB',
    associated_river: 'Sill / Eisack · Transalpine Höchstspannungs- & Brenner-Basistunnel-Bahnstromachse Tirol–Südtirol',
    'plant:output:electricity': '2800 MVA',
  }),
  makeCuratedPointFeature('curated-dam-hvdc-piedmont-savoie', 7.0415, 45.1925, 'HVDC-Alpen-Interkonnektor „Piemonte–Savoia“ ±320 kV DC (Piossasco–Grande-Île, IT–FR)', {
    operator: 'Terna Rete Elettrica Nazionale / RTE France',
    associated_river: 'Dora Riparia / Arc (Fréjus-Korridor) · 190 km HGÜ-Erdkabelverbindung (2× 600 MW) durch die Westalpen',
    'plant:output:electricity': '1200 MW (HVDC)',
  }),
]);

export function getCuratedInfrastructureFeatures(layerId) {
  if (layerId === 'local-datacenters') return CURATED_DATACENTER_FEATURES;
  if (layerId === 'local-dams') return CURATED_DAM_FEATURES;
  return [];
}

/** The singular label for a local infrastructure layer. */
export function layerTitle(layerId) {
  if (layerId === 'local-datacenters') return 'Datacenter';
  if (layerId === 'local-dams') return 'Dam';
  return 'Feature';
}

/**
 * Map one local infrastructure feature to a JSON-safe analyst record
 * (analyst query engine seam). Pure — no Cesium types. Missing/unknown
 * fields are null, never NaN/undefined. Layer-specific fields that do not
 * apply (river/output on datacenters, capacity on dams) stay null so a
 * shared compact payload can copy them without inventing values.
 * Names are unclamped — overlay cards shorten for paint; queries need the
 * full source string ("Usina Hidrelétrica de Itaipu").
 * @param {Object|null|undefined} raw - {id, lat, lon, properties}.
 * @param {string} [layerId] Local layer id (`local-datacenters` / `local-dams`).
 * @returns {{id: string, name: string|null, lat: number|null, lon: number|null,
 *   operator: string|null, capacity: string|null, river: string|null,
 *   output: string|null}}
 */
export function mapAnalystRecord(raw, layerId = '') {
  const num = (v) => (Number.isFinite(v) ? v : null);
  const text = (v) => {
    const t = String(v ?? '').trim();
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  };
  const props =
    raw?.properties &&
    typeof raw.properties === 'object' &&
    !Array.isArray(raw.properties)
      ? raw.properties
      : {};
  const tags =
    props.tags && typeof props.tags === 'object' && !Array.isArray(props.tags)
      ? props.tags
      : {};
  const name =
    text(props.name) ||
    text(tags.name) ||
    text(tags['name:en']) ||
    text(tags.official_name) ||
    null;
  const operator =
    text(tags.operator) ||
    text(props.operator) ||
    text(tags['operator:short']) ||
    null;
  const capacity =
    layerId === 'local-datacenters'
      ? text(tags['capacity:it_load']) ||
        text(tags.it_load) ||
        text(tags.capacity) ||
        text(props.capacity)
      : null;
  const river =
    layerId === 'local-dams'
      ? text(tags.associated_river) ||
        text(props.associated_river) ||
        text(tags.river) ||
        text(props.river) ||
        text(tags['river:name'])
      : null;
  const output =
    layerId === 'local-dams'
      ? text(props.output) || text(tags['plant:output:electricity'])
      : null;
  return {
    id: name || text(raw?.id) || layerTitle(layerId),
    name,
    lat: num(raw?.lat),
    lon: num(raw?.lon),
    operator,
    capacity,
    river,
    output,
  };
}

/** A representative point for a feature: its point, or its outline's average vertex. */
export function featurePoint(feature) {
  const geometry = feature?.geometry;
  const outline =
    geometry?.type === 'Point'
      ? [geometry.coordinates]
      : geometry?.type === 'LineString'
        ? geometry.coordinates
        : geometry?.type === 'Polygon'
          ? geometry.coordinates?.[0]
          : geometry?.type === 'MultiPolygon'
            ? geometry.coordinates?.[0]?.[0]
            : null;
  const points = (outline || []).filter(
    (point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]),
  );
  if (!points.length) return null;
  return {
    lon: points.reduce((sum, point) => sum + point[0], 0) / points.length,
    lat: points.reduce((sum, point) => sum + point[1], 0) / points.length,
  };
}

/** Read the bundled layers' analyst records through a supplied transport. */
export function createInfrastructureSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  const cache = new Map();
  return {
    async getRecords(layerId, { signal } = {}) {
      const url = INFRASTRUCTURE_DATA_URLS[layerId];
      if (!url) throw new TypeError(`Unknown infrastructure layer: ${layerId}`);
      if (!cache.has(layerId)) {
        signal?.throwIfAborted();
        const response = await fetchImpl(url, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsedFeatures = parseGeojsonLines(await response.text());
        const allFeatures =
          parsedFeatures.length > 500
            ? [...getCuratedInfrastructureFeatures(layerId), ...parsedFeatures]
            : parsedFeatures;
        const records = allFeatures.flatMap(
          (feature) => {
            const point = featurePoint(feature);
            return point
              ? [
                  mapAnalystRecord(
                    {
                      id: feature.properties?.osm_id ?? feature.id,
                      ...point,
                      properties: feature.properties,
                    },
                    layerId,
                  ),
                ]
              : [];
          },
        );
        cache.set(layerId, records);
      }
      return cache.get(layerId);
    },
  };
}
