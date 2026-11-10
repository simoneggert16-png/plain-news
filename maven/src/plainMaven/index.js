import * as Cesium from 'cesium';
import { DATA_CREDITS } from '../data/dataCredits.js';
import {
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from '../renderGovernor.js';
import { usePanelChromeStore } from '../ui/stores/panelChrome.js';
import { applicationPinia } from '../ui/vueRuntime.js';

const PLAIN_PROD_ORIGIN = 'https://www.plain-news.ch';
const FEED_REFRESH_MS = 180_000;

const QUICK_SENSORS = [
  { id: 'flights', label: 'AIR ADS-B', title: 'Civil ADS-B transponder air traffic (adsb.lol · ODbL)' },
  { id: 'military', label: 'MIL AIR', title: 'Military & government aircraft transponders (adsb.lol · ODbL)' },
  { id: 'ais-live-vessels', label: 'MARITIME', title: 'Live AIS maritime vessel tracking (AISStream)' },
  { id: 'satellites', label: 'ORBITAL', title: 'Active orbital satellites via SGP4 TLEs (CelesTrak)' },
  { id: 'earthquakes', label: 'SEISMIC', title: 'Global seismic events & magnitudes (USGS)' },
  { id: 'local-firms', label: 'FIRMS', title: 'Satellite thermal anomalies & active fires (NASA FIRMS)' },
  { id: 'weather-radar', label: 'WX RADAR', title: 'Live precipitation & weather radar (NOAA / RainViewer)' },
  { id: 'cctv', label: 'WEBCAMS', title: 'Public open-data traffic & weather webcams (DOT / Windy)' },
  { id: 'gnss-integrity', label: 'GNSS JAM', title: 'ADS-B derived GNSS interference & jamming integrity' },
];

const AOI_SWEEP_LAYERS = [
  'flights',
  'military',
  'ais-live-vessels',
  'earthquakes',
  'local-firms',
  'cctv',
];

const THEATERS = [
  { key: 'global', label: { de: 'GLOBAL // WELTLAGE', en: 'GLOBAL // WORLD' }, lon: 14.5, lat: 28.0, alt: 16_800_000 },
  { key: 'europe', label: { de: 'EUROPA / DACH', en: 'EUROPE / DACH' }, lon: 10.2, lat: 48.8, alt: 3_100_000 },
  { key: 'mideast', label: { de: 'NAHOST / LEVANTE', en: 'MIDDLE EAST' }, lon: 38.5, lat: 30.8, alt: 3_400_000 },
  { key: 'ukraine', label: { de: 'OSTEUROPA / UKRAINE', en: 'EASTERN EUROPE' }, lon: 32.5, lat: 48.6, alt: 2_300_000 },
  { key: 'indopac', label: { de: 'INDO-PAZIFIK', en: 'INDO-PACIFIC' }, lon: 121.5, lat: 23.2, alt: 4_800_000 },
  { key: 'americas', label: { de: 'NORDAMERIKA', en: 'NORTH AMERICA' }, lon: -95.0, lat: 38.5, alt: 6_200_000 },
  { key: 'arctic', label: { de: 'ARKTIS / NORDMEER', en: 'ARCTIC' }, lon: 18.0, lat: 72.0, alt: 5_200_000 },
];

const COPY = {
  de: {
    railKicker: 'LAGEBILD // VERIFIZIERTE MELDUNGEN',
    railTitle: 'PLAIN. Lagemeldungen',
    reopenRail: '◆ LAGEMELDUNGEN',
    searchPlaceholder: 'Ort, Land, Akteur oder Thema filtern…',
    allSensors: '⊞ ALLE SENSOREN',
    allSensorsTitle: 'Alle 30+ legalen Live-Sensoren, Kartenebenen & Optiken öffnen',
    creditsBtn: 'CREDITS',
    cats: [
      { key: 'all', label: 'ALLE' },
      { key: 'live', label: 'LIVE' },
      { key: 'world', label: 'WELT' },
      { key: 'politics', label: 'POLITIK' },
      { key: 'business', label: 'WIRTSCHAFT' },
      { key: 'tech', label: 'TECH' },
      { key: 'science', label: 'WISSEN' },
      { key: 'climate', label: 'KLIMA' },
    ],
    targetLock: 'TARGET LOCK',
    verifiedFacts: 'VERIFIZIERTE KERNFAKTEN',
    primarySources: 'PRIMÄRQUELLEN & AGENTUREN',
    aoiSweep: '◎ AOI LIVE-SENSOREN AKTIVIEREN (ADS-B · AIS · FIRMS · CAMS)',
    aoiSweepDone: '✓ AOI SENSOR-AUFKLÄRUNG AKTIV',
    readReport: 'VOLLSTÄNDIGEN BERICHT LESEN',
    liveTag: 'LIVE',
    sourcesLabel: 'Quellen',
    emptyFeed: 'Keine passenden georeferenzierten Meldungen für diesen Filter.',
    loadingFeed: 'Lade verifizierte PLAIN.-Meldungen…',
    creditsHeading: 'PLAIN. MAVEN — Architektur, Lizenzen & Credits',
    creditsIntro:
      'PLAIN. MAVEN verbindet unabhängigen, doppelt quellenverifizierten Journalismus von PLAIN. (plain-news.ch) mit Echtzeit-Geodaten und offenen Sensoren.',
    complianceTitle: 'Rechtliche & Lizenz-Compliance',
    compliancePoints: [
      'Alle nicht-kommerziellen Datensätze (CC BY-NC / CC BY-NC-SA) wurden für PLAIN. MAVEN vollständig physisch ausgeschlossen und deaktiviert.',
      'Sämtliche API-Schlüssel (NASA FIRMS, AISStream, Windy, TomTom) verbleiben strikt serverseitig hinter Origin-geschützten Vercel-Proxys und werden niemals im Browser exponiert.',
      'Alle eingebundenen Live-Ebenen stammen aus offenen Behörden-, Wissenschafts- oder korrekt lizenzierten Community-Quellen (ODbL, CC BY 4.0, Public Domain, Open Government Licences).',
    ],
    dataSourcesHeading: 'Verwendete Open-Data-Quellen & Attributionen',
  },
  en: {
    railKicker: 'SITUATION // VERIFIED DISPATCHES',
    railTitle: 'PLAIN. Dispatches',
    reopenRail: '◆ DISPATCHES',
    searchPlaceholder: 'Filter place, country, actor, or topic…',
    allSensors: '⊞ ALL SENSORS',
    allSensorsTitle: 'Open all 30+ legal live sensors, map stacks & visual modes',
    creditsBtn: 'CREDITS',
    cats: [
      { key: 'all', label: 'ALL' },
      { key: 'live', label: 'LIVE' },
      { key: 'world', label: 'WORLD' },
      { key: 'politics', label: 'POLITICS' },
      { key: 'business', label: 'BUSINESS' },
      { key: 'tech', label: 'TECH' },
      { key: 'science', label: 'SCIENCE' },
      { key: 'climate', label: 'CLIMATE' },
    ],
    targetLock: 'TARGET LOCK',
    verifiedFacts: 'VERIFIED KEY FACTS',
    primarySources: 'PRIMARY SOURCES & AGENCIES',
    aoiSweep: '◎ ACTIVATE AOI SENSORS (ADS-B · AIS · FIRMS · CAMS)',
    aoiSweepDone: '✓ AOI SENSOR SWEEP ACTIVE',
    readReport: 'READ FULL REPORT',
    liveTag: 'LIVE',
    sourcesLabel: 'sources',
    emptyFeed: 'No geocoded dispatches match the active filter.',
    loadingFeed: 'Loading verified PLAIN. dispatches…',
    creditsHeading: 'PLAIN. MAVEN — Architecture, Licenses & Credits',
    creditsIntro:
      'PLAIN. MAVEN pairs two-source verified journalism from PLAIN. (plain-news.ch) with open real-time geospatial intelligence layers.',
    complianceTitle: 'Legal & API Compliance',
    compliancePoints: [
      'All Non-Commercial datasets (CC BY-NC / CC BY-NC-SA) are physically excluded and disabled in PLAIN. MAVEN.',
      'All provider API keys remain strictly server-side behind Origin-verified proxies and are never shipped to client bundles.',
      'All active telemetry layers derive from open government, scientific, ODbL, CC BY 4.0, or licensed API sources with full attribution.',
    ],
    dataSourcesHeading: 'Open Data Sources & Attributions',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolvePlainApiBases() {
  const params = new URLSearchParams(window.location.search);
  const explicitOrigin = params.get('plainOrigin');
  const candidates = [];
  if (explicitOrigin && /^https:\/\//i.test(explicitOrigin)) {
    candidates.push(explicitOrigin.replace(/\/+$/, ''));
  }
  candidates.push(PLAIN_PROD_ORIGIN);
  return [...new Set(candidates)];
}

function formatRelativeUtc(iso, locale = 'de') {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 2) return locale === 'de' ? 'GERADE EBEN' : 'JUST NOW';
  if (diffMin < 60) return `${diffMin}M`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 36) return `${diffH}H`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}D`;
}

/**
 * Draw crisp Palantir Maven tactical diamond / reticle icons onto an offscreen
 * high-DPI canvas so Cesium billboards stay razor-sharp at every zoom level.
 */
const iconCache = new Map();
function buildMavenDiamondIcon({
  variant = 'dispatch',
  theme = 'obsidian',
  selected = false,
} = {}) {
  const key = `${variant}:${theme}:${selected ? 'sel' : 'norm'}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const size = selected ? 44 : 34;
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const c = size / 2;
  const isPaper = theme === 'paper';

  let fill = isPaper ? '#0d0d0b' : '#eae3d2';
  let stroke = isPaper ? '#eae3d2' : '#0d0d0b';
  let outerRing = isPaper ? '#a3321f' : '#d97706';

  if (variant === 'live') {
    fill = '#dc2626';
    stroke = '#ffffff';
    outerRing = '#dc2626';
  } else if (variant === 'priority') {
    fill = isPaper ? '#a3321f' : '#d97706';
    stroke = isPaper ? '#ffffff' : '#0d0d0b';
    outerRing = fill;
  }

  // Outer tactical diamond halo for live, priority, or selected targets
  if (variant === 'live' || variant === 'priority' || selected) {
    const rOuter = selected ? 16 : 12.5;
    ctx.beginPath();
    ctx.moveTo(c, c - rOuter);
    ctx.lineTo(c + rOuter, c);
    ctx.lineTo(c, c + rOuter);
    ctx.lineTo(c - rOuter, c);
    ctx.closePath();
    ctx.fillStyle =
      variant === 'live'
        ? 'rgba(220, 38, 38, 0.22)'
        : 'rgba(217, 119, 6, 0.18)';
    ctx.fill();
    ctx.lineWidth = selected ? 1.8 : 1.2;
    ctx.strokeStyle = outerRing;
    ctx.stroke();
  }

  // Crisp inner diamond
  const rInner = selected ? 8.5 : variant === 'live' ? 7.5 : 6.2;
  ctx.beginPath();
  ctx.moveTo(c, c - rInner);
  ctx.lineTo(c + rInner, c);
  ctx.lineTo(c, c + rInner);
  ctx.lineTo(c - rInner, c);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // Center pinpoint dot for live/selected
  if (variant === 'live' || selected) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c - 1.2, c - 1.2, 2.4, 2.4);
  }

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(key, dataUrl);
  return dataUrl;
}

export async function initPlainMavenExperience({
  application,
  scene,
  controls,
  data,
}) {
  const viewer = scene?.viewer;
  const dataManager = data?.dataManager;
  if (!viewer || !dataManager) return null;

  const params = new URLSearchParams(window.location.search);
  const rawLocale = (params.get('locale') || params.get('lang') || document.documentElement.lang || 'de')
    .slice(0, 2)
    .toLowerCase();
  let currentLocale = COPY[rawLocale] ? rawLocale : 'de';
  let currentTheme =
    document.documentElement.getAttribute('data-maven-theme') === 'paper'
      ? 'paper'
      : 'obsidian';

  const apiBases = resolvePlainApiBases();
  const state = {
    stories: [],
    bySlug: new Map(),
    entitiesBySlug: new Map(),
    selectedSlug: null,
    articleCache: new Map(),
    newsLayerEnabled: true,
    railOpen: window.innerWidth > 900,
    activeCategory: 'all',
    searchQuery: '',
    loading: true,
  };

  document.body.classList.toggle('pm-rail-open', state.railOpen);

  // ── 1. Mount PLAIN. × MAVEN DOM Chrome ────────────────────────────────────
  const ui = () => COPY[currentLocale] || COPY.de;

  const topbar = document.createElement('header');
  topbar.id = 'pm-topbar';
  topbar.setAttribute('role', 'banner');

  const rail = document.createElement('aside');
  rail.id = 'pm-rail';
  if (!state.railOpen) rail.classList.add('is-collapsed');

  const railReopen = document.createElement('button');
  railReopen.id = 'pm-rail-reopen';
  railReopen.type = 'button';

  const dossier = document.createElement('section');
  dossier.id = 'pm-dossier';
  dossier.hidden = true;

  const reticle = document.createElement('div');
  reticle.id = 'pm-reticle';
  reticle.hidden = true;
  reticle.innerHTML = `
    <span class="pm-reticle-corner tl"></span>
    <span class="pm-reticle-corner tr"></span>
    <span class="pm-reticle-corner bl"></span>
    <span class="pm-reticle-corner br"></span>
    <span class="pm-reticle-label"></span>
  `;

  const creditBar = document.createElement('footer');
  creditBar.id = 'pm-credit-bar';

  const creditsModal = document.createElement('div');
  creditsModal.id = 'pm-credits-modal';
  creditsModal.hidden = true;

  document.body.append(
    topbar,
    rail,
    railReopen,
    dossier,
    reticle,
    creditBar,
    creditsModal,
  );

  // ── 2. Render Topbar, Rail, Credit Bar & Credits Modal ────────────────────
  function renderTopbar() {
    const copy = ui();
    const sensorChipsHtml = QUICK_SENSORS.map((sensor) => {
      const enabled = dataManager.isEnabled(sensor.id);
      return `
        <button
          type="button"
          class="pm-chip ${enabled ? 'is-active' : ''}"
          data-sensor-id="${sensor.id}"
          title="${escapeHtml(sensor.title)}"
        >
          <span class="pm-chip-dot"></span>
          <span>${escapeHtml(sensor.label)}</span>
          <span class="pm-chip-count" data-sensor-count="${sensor.id}"></span>
        </button>
      `;
    }).join('');

    const theaterOptionsHtml = THEATERS.map((th) => {
      const label = th.label[currentLocale] || th.label.en;
      return `<option value="${th.key}">${escapeHtml(label)}</option>`;
    }).join('');

    const brandHref = `${PLAIN_PROD_ORIGIN}/${currentLocale}`;
    const isEmbedded = window.parent && window.parent !== window;

    topbar.innerHTML = `
      <div class="pm-brand">
        <a
          class="pm-brand-link"
          href="${escapeHtml(brandHref)}"
          ${isEmbedded ? 'target="_top"' : 'target="_blank" rel="noopener"'}
          title="PLAIN. — Nachrichten ohne Lärm"
        >
          <span class="pm-wordmark" translate="no">PLAIN<span class="pm-wordmark-dot">.</span></span>
          <span class="pm-system-tag" translate="no">MAVEN</span>
        </a>
        <span class="pm-zulu" id="pm-zulu-clock">--:--:--Z</span>
      </div>

      <div class="pm-sensors-strip" role="toolbar" aria-label="Live Intelligence Layers">
        <button
          type="button"
          class="pm-chip pm-chip-news ${state.newsLayerEnabled ? 'is-active' : ''}"
          id="pm-toggle-news-layer"
          title="PLAIN. Verified Geocoded News & Live Flashpoints"
        >
          <span class="pm-chip-dot"></span>
          <span>PLAIN NEWS</span>
          <span class="pm-chip-count" id="pm-news-count">${state.stories.length || '…'}</span>
        </button>
        ${sensorChipsHtml}
        <button
          type="button"
          class="pm-chip"
          id="pm-open-all-sensors"
          title="${escapeHtml(copy.allSensorsTitle)}"
        >
          <span>${escapeHtml(copy.allSensors)}</span>
        </button>
      </div>

      <div class="pm-right-controls">
        <select class="pm-theater-select" id="pm-theater-select" aria-label="Theater Jump">
          ${theaterOptionsHtml}
        </select>
        <button type="button" class="pm-chip" id="pm-theme-toggle" title="Switch Obsidian / PLAIN. Paper theme">
          ${currentTheme === 'obsidian' ? 'PAPER' : 'OBSIDIAN'}
        </button>
        <button type="button" class="pm-chip" id="pm-open-credits">
          ${escapeHtml(copy.creditsBtn)}
        </button>
      </div>
    `;

    updateZuluClock();
    syncSensorChips();
  }

  function renderRailFrame() {
    const copy = ui();
    railReopen.textContent = copy.reopenRail;
    const catPillsHtml = copy.cats
      .map(
        (cat) => `
          <button
            type="button"
            class="pm-mini-pill ${state.activeCategory === cat.key ? 'is-active' : ''}"
            data-cat="${cat.key}"
          >${escapeHtml(cat.label)}</button>
        `,
      )
      .join('');

    rail.innerHTML = `
      <div class="pm-rail-head">
        <div class="pm-rail-title-wrap">
          <div class="pm-rail-kicker">${escapeHtml(copy.railKicker)}</div>
          <div class="pm-rail-title">${escapeHtml(copy.railTitle)}</div>
        </div>
        <button type="button" class="pm-icon-btn" id="pm-rail-collapse" title="Minimize panel">✕</button>
      </div>
      <div class="pm-rail-filters">
        <input
          type="search"
          class="pm-search-input"
          id="pm-search-input"
          placeholder="${escapeHtml(copy.searchPlaceholder)}"
          value="${escapeHtml(state.searchQuery)}"
        />
        <div class="pm-cat-row" id="pm-cat-row">
          ${catPillsHtml}
        </div>
      </div>
      <div class="pm-feed-list" id="pm-feed-list" role="list"></div>
    `;
    renderFeedList();
  }

  function renderCreditBarAndModal() {
    const copy = ui();
    creditBar.innerHTML = `
      <div>
        <strong>PLAIN. MAVEN</strong> · 3D Engine:
        <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noopener">
          <strong>God&rsquo;s Eye View by Bilawal Sidhu</strong> (MIT License)
        </a>
      </div>
      <div>
        Open Data: © OpenStreetMap · adsb.lol · AISStream · CelesTrak · USGS · NASA FIRMS · NOAA · Windy ·
        <button type="button" id="pm-credit-bar-more">[${escapeHtml(copy.creditsBtn)} &amp; Lizenzen]</button>
      </div>
    `;

    const creditsListHtml = DATA_CREDITS.map(
      (entry) => `<li>${entry.html}</li>`,
    ).join('');
    const complianceHtml = copy.compliancePoints
      .map((pt) => `<li>${escapeHtml(pt)}</li>`)
      .join('');

    creditsModal.innerHTML = `
      <div class="pm-modal-card" role="dialog" aria-modal="true" aria-labelledby="pm-credits-title">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <h2 id="pm-credits-title">${escapeHtml(copy.creditsHeading)}</h2>
          <button type="button" class="pm-icon-btn" id="pm-credits-close" aria-label="Close">✕</button>
        </div>
        <p>${escapeHtml(copy.creditsIntro)}</p>

        <div class="pm-credit-highlight">
          <div class="pm-dossier-lock" style="margin-bottom:4px;">OPEN-SOURCE SPATIAL ENGINE CREDIT</div>
          <p style="margin:0;color:var(--pm-ink);">
            <strong>God&rsquo;s Eye View</strong> — Created by <strong>Bilawal Sidhu</strong>
            (Copyright &copy; 2026 Bilawal Sidhu, released under the
            <a href="https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>).
            Source repository:
            <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noopener">github.com/bilawalsidhu/gods-eye-view</a>.
            Minimalist editorial &amp; tactical Maven interface designed for <a href="https://www.plain-news.ch" target="_blank" rel="noopener">PLAIN.</a>
          </p>
        </div>

        <div class="pm-dossier-section-label">${escapeHtml(copy.complianceTitle)}</div>
        <ul>${complianceHtml}</ul>

        <div class="pm-dossier-section-label">${escapeHtml(copy.dataSourcesHeading)}</div>
        <ul>${creditsListHtml}</ul>
      </div>
    `;
  }

  // ── 3. Cesium 3D News Layer + Horizon Occlusion ───────────────────────────
  const newsDataSource = new Cesium.CustomDataSource('plain-news-dispatches');
  await viewer.dataSources.add(newsDataSource);

  const occluder = new Cesium.EllipsoidalOccluder(
    Cesium.Ellipsoid.WGS84,
    viewer.scene.camera.positionWC,
  );
  const scratchDir = new Cesium.Cartesian3();
  const scratchWin = new Cesium.Cartesian2();

  function matchesActiveFilters(story) {
    if (state.activeCategory === 'live') {
      if (!story.isLive && story.kind !== 'live') return false;
    } else if (
      state.activeCategory !== 'all' &&
      story.category !== state.activeCategory
    ) {
      return false;
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const hay = `${story.title || ''} ${story.dek || ''} ${story.placeName || ''} ${story.country || ''} ${story.category || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function storyVariant(story) {
    if (story.isLive || story.kind === 'live' || story.importance >= 5) {
      return 'live';
    }
    if (story.kind === 'investigation' || story.importance >= 4) {
      return 'priority';
    }
    return 'dispatch';
  }

  function rebuildGlobeEntities() {
    newsDataSource.entities.suspendEvents();
    newsDataSource.entities.removeAll();
    state.entitiesBySlug.clear();

    const isPaper = currentTheme === 'paper';
    const labelFill = isPaper
      ? Cesium.Color.fromCssColorString('#0d0d0b')
      : Cesium.Color.fromCssColorString('#eae3d2');
    const labelBg = isPaper
      ? Cesium.Color.fromCssColorString('#eae3d2').withAlpha(0.92)
      : Cesium.Color.fromCssColorString('#0d0d0b').withAlpha(0.9);

    // Count co-located dispatches per place so only ONE clean callout renders per city
    const placeCounts = new Map();
    let selectedPlaceKey = null;
    for (const story of state.stories) {
      const pKey = story.canonicalPlace || story.placeName || story.country || story.slug;
      placeCounts.set(pKey, (placeCounts.get(pKey) || 0) + 1);
      if (story.slug === state.selectedSlug) selectedPlaceKey = pKey;
    }
    const labeledPlaces = new Set();

    for (const story of state.stories) {
      if (!Number.isFinite(story.lat) || !Number.isFinite(story.lon)) continue;
      const variant = storyVariant(story);
      const selected = story.slug === state.selectedSlug;
      const worldPos = Cesium.Cartesian3.fromDegrees(story.lon, story.lat, 1800);

      const pKey = story.canonicalPlace || story.placeName || story.country || story.slug;
      const totalAtPlace = placeCounts.get(pKey) || 1;
      const isFirstLabelAtPlace = !labeledPlaces.has(pKey) && pKey !== selectedPlaceKey;
      const showCallout =
        selected ||
        (isFirstLabelAtPlace && (variant === 'live' || story.importance >= 4));
      if (showCallout) labeledPlaces.add(pKey);

      const shortHeadline =
        story.title.length > 38 ? `${story.title.slice(0, 36)}…` : story.title;
      const placeBadge = `${(story.placeName || story.country || '').toUpperCase()}${totalAtPlace > 1 ? ` (+${totalAtPlace - 1})` : ''}`;
      const labelText = `${placeBadge}\n${shortHeadline}`;

      const entity = newsDataSource.entities.add({
        id: `plain-story:${story.slug}`,
        position: worldPos,
        properties: {
          plainSlug: story.slug,
        },
        billboard: {
          image: buildMavenDiamondIcon({
            variant,
            theme: currentTheme,
            selected,
          }),
          width: selected ? 38 : 28,
          height: selected ? 38 : 28,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scaleByDistance: new Cesium.NearFarScalar(2.5e5, 1.18, 1.6e7, 0.78),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: showCallout
          ? {
              text: labelText,
              font: '600 11px "JetBrains Mono", monospace',
              fillColor: labelFill,
              showBackground: true,
              backgroundColor: labelBg,
              backgroundPadding: new Cesium.Cartesian2(6, 4),
              pixelOffset: new Cesium.Cartesian2(0, 24),
              verticalOrigin: Cesium.VerticalOrigin.TOP,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              scaleByDistance: new Cesium.NearFarScalar(2.5e5, 1.0, 9.5e6, 0.72),
              translucencyByDistance: selected
                ? undefined
                : new Cesium.NearFarScalar(8.0e5, 1.0, 8.5e6, 0.0),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          : undefined,
      });

      entity._plainWorldPos = worldPos;
      entity._plainStory = story;
      state.entitiesBySlug.set(story.slug, entity);
    }

    newsDataSource.entities.resumeEvents();
    updateHorizonVisibility();
    governorRequestRender('plain-maven:entities');
  }

  function updateHorizonVisibility() {
    if (!state.newsLayerEnabled) {
      newsDataSource.show = false;
      reticle.hidden = true;
      return;
    }
    newsDataSource.show = true;
    const camPos = viewer.scene.camera.positionWC;
    const camDir = viewer.scene.camera.directionWC;
    occluder.cameraPosition = camPos;

    for (const [slug, entity] of state.entitiesBySlug) {
      const story = entity._plainStory;
      if (!matchesActiveFilters(story) && slug !== state.selectedSlug) {
        entity.show = false;
        continue;
      }
      const world = entity._plainWorldPos;
      Cesium.Cartesian3.subtract(world, camPos, scratchDir);
      const inFrontOfCamera = Cesium.Cartesian3.dot(scratchDir, camDir) > 0;
      const overHorizon = inFrontOfCamera && occluder.isPointVisible(world);
      entity.show = overHorizon;
    }
    updateReticlePosition();
  }

  function updateReticlePosition() {
    if (!state.selectedSlug || !state.newsLayerEnabled) {
      reticle.hidden = true;
      return;
    }
    const entity = state.entitiesBySlug.get(state.selectedSlug);
    if (!entity || !entity.show) {
      reticle.hidden = true;
      return;
    }
    const win = Cesium.SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      entity._plainWorldPos,
      scratchWin,
    );
    if (!win || !Number.isFinite(win.x) || !Number.isFinite(win.y)) {
      reticle.hidden = true;
      return;
    }
    const w = viewer.scene.canvas.clientWidth || window.innerWidth;
    const h = viewer.scene.canvas.clientHeight || window.innerHeight;
    if (win.x < 0 || win.x > w || win.y < 44 || win.y > h - 24) {
      reticle.hidden = true;
      return;
    }
    reticle.hidden = false;
    reticle.style.left = `${Math.round(win.x)}px`;
    reticle.style.top = `${Math.round(win.y)}px`;
    const labelEl = reticle.querySelector('.pm-reticle-label');
    if (labelEl) {
      const st = entity._plainStory;
      labelEl.textContent = (st.placeName || st.country || 'TARGET').toUpperCase();
    }
  }

  viewer.camera.percentageChanged = 0.008;
  viewer.camera.changed.addEventListener(updateHorizonVisibility);
  viewer.scene.postRender.addEventListener(updateReticlePosition);

  // ── 4. Feed List & Target Dossier Rendering ───────────────────────────────
  function renderFeedList() {
    const listEl = document.getElementById('pm-feed-list');
    if (!listEl) return;
    const copy = ui();

    const countEl = document.getElementById('pm-news-count');
    if (countEl) countEl.textContent = String(state.stories.length || 0);

    if (state.loading && !state.stories.length) {
      listEl.innerHTML = `<div style="padding:18px 12px;font-family:var(--pm-mono);font-size:11px;color:var(--pm-muted);">${escapeHtml(copy.loadingFeed)}</div>`;
      return;
    }

    const filtered = state.stories.filter(matchesActiveFilters);
    if (!filtered.length) {
      listEl.innerHTML = `<div style="padding:18px 12px;font-family:var(--pm-mono);font-size:11px;color:var(--pm-muted);">${escapeHtml(copy.emptyFeed)}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((story) => {
        const isSelected = story.slug === state.selectedSlug;
        const placeLabel = [story.placeName, story.countryCode || story.country]
          .filter(Boolean)
          .join(', ');
        const rel = formatRelativeUtc(story.updatedAt || story.publishedAt, currentLocale);
        return `
          <button
            type="button"
            class="pm-story-row ${isSelected ? 'is-selected' : ''}"
            data-story-slug="${escapeHtml(story.slug)}"
            role="listitem"
          >
            <div class="pm-story-meta">
              <span class="pm-story-place">
                ${story.isLive || story.kind === 'live' ? `<span class="pm-live-tag">${escapeHtml(copy.liveTag)}</span>` : '◆ '}
                ${escapeHtml(placeLabel)}
              </span>
              <span>${escapeHtml(story.category || 'world')} · ${escapeHtml(rel)}</span>
            </div>
            <div class="pm-story-headline">${escapeHtml(story.title)}</div>
            <div class="pm-story-foot">
              <span>${escapeHtml(story.tacticalCoord || `${story.lat.toFixed(2)}°, ${story.lon.toFixed(2)}°`)}</span>
              <span>${Number(story.sourceCount || 2)} ${escapeHtml(copy.sourcesLabel)}</span>
            </div>
          </button>
        `;
      })
      .join('');
  }

  async function fetchArticleDetail(slug) {
    const cacheKey = `${currentLocale}:${slug}`;
    if (state.articleCache.has(cacheKey)) {
      return state.articleCache.get(cacheKey);
    }
    for (const base of apiBases) {
      try {
        const res = await fetch(
          `${base}/api/maven/article?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(currentLocale)}`,
        );
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.ok) {
          state.articleCache.set(cacheKey, json);
          return json;
        }
      } catch {
        // try next candidate origin
      }
    }
    return null;
  }

  function renderDossier(story, detail = null) {
    if (!story) {
      dossier.hidden = true;
      document.body.classList.remove('pm-dossier-open');
      return;
    }
    const copy = ui();
    dossier.hidden = false;
    document.body.classList.add('pm-dossier-open');

    const facts =
      detail?.facts?.length > 0
        ? detail.facts
        : Array.isArray(story.facts)
          ? story.facts
          : [];
    const sources = Array.isArray(detail?.sources) ? detail.sources : [];
    const placeHeader = [story.placeName, story.country]
      .filter(Boolean)
      .join(', ')
      .toUpperCase();
    const articleUrl =
      detail?.url ||
      story.url ||
      `${PLAIN_PROD_ORIGIN}/${currentLocale}/${story.kind === 'live' ? 'live' : 'a'}/${story.slug}`;

    const factsHtml = facts.length
      ? `
        <div>
          <div class="pm-dossier-section-label">${escapeHtml(copy.verifiedFacts)}</div>
          <ul class="pm-facts-list">
            ${facts.slice(0, 5).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    const sourcesHtml = sources.length
      ? `
        <div>
          <div class="pm-dossier-section-label">${escapeHtml(copy.primarySources)}</div>
          <div class="pm-sources-wrap">
            ${sources
              .slice(0, 8)
              .map((src) => {
                const label = src.outlet || 'Source';
                if (src.url && /^https?:\/\//i.test(src.url)) {
                  return `<a class="pm-source-chip" href="${escapeHtml(src.url)}" target="_blank" rel="noopener">↗ ${escapeHtml(label)}</a>`;
                }
                return `<span class="pm-source-chip">${escapeHtml(label)}</span>`;
              })
              .join('')}
          </div>
        </div>
      `
      : '';

    dossier.innerHTML = `
      <div class="pm-dossier-head">
        <div>
          <div class="pm-dossier-lock">
            ${story.isLive || story.kind === 'live' ? `<span class="pm-live-tag">${escapeHtml(copy.liveTag)}</span>` : '◆'}
            ${escapeHtml(copy.targetLock)} // ${escapeHtml(placeHeader)}
          </div>
          <div class="pm-dossier-coords">
            ${escapeHtml(story.tacticalCoord || '')} · ${escapeHtml((story.category || 'world').toUpperCase())}
          </div>
        </div>
        <button type="button" class="pm-icon-btn" id="pm-dossier-close" aria-label="Close">✕</button>
      </div>

      <div class="pm-dossier-body">
        <h3 class="pm-dossier-title">${escapeHtml(detail?.title || story.title)}</h3>
        ${detail?.dek || story.dek ? `<p class="pm-dossier-dek">${escapeHtml(detail?.dek || story.dek)}</p>` : ''}
        ${factsHtml}
        ${sourcesHtml}
      </div>

      <div class="pm-dossier-actions">
        <button type="button" class="pm-btn-secondary" id="pm-aoi-sweep-btn">
          <span>${escapeHtml(copy.aoiSweep)}</span>
        </button>
        <a
          class="pm-btn-primary"
          id="pm-open-full-article"
          href="${escapeHtml(articleUrl)}"
          target="_blank"
          rel="noopener"
        >
          <span>${escapeHtml(copy.readReport)}</span>
          <span>→</span>
        </a>
      </div>
    `;
  }

  function flyToStory(story, { customAltitudeMeters } = {}) {
    if (!story || !Number.isFinite(story.lat) || !Number.isFinite(story.lon)) return;
    const defaultAlt =
      story.precision === 'site'
        ? 210_000
        : story.precision === 'city'
          ? 440_000
          : story.precision === 'region'
            ? 920_000
            : 1_650_000;
    const alt = customAltitudeMeters || defaultAlt;

    holdContinuousRender('plain-maven-fly');
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(story.lon, story.lat, alt),
      duration: 1.45,
      complete: () => {
        releaseContinuousRender('plain-maven-fly');
        updateHorizonVisibility();
        governorRequestRender('plain-maven:fly-complete');
      },
      cancel: () => {
        releaseContinuousRender('plain-maven-fly');
        updateHorizonVisibility();
      },
    });
  }

  async function selectStory(slug, { fly = true } = {}) {
    if (!slug || !state.bySlug.has(slug)) {
      state.selectedSlug = null;
      dossier.hidden = true;
      document.body.classList.remove('pm-dossier-open');
      reticle.hidden = true;
      rebuildGlobeEntities();
      renderFeedList();
      return;
    }

    state.selectedSlug = slug;
    const story = state.bySlug.get(slug);

    rebuildGlobeEntities();
    renderFeedList();
    renderDossier(story, null);
    updateHorizonVisibility();
    governorRequestRender('plain-maven:select');

    if (fly) flyToStory(story);

    // Notify embedding parent (plain-news.ch) of URL/selection sync
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'plain-maven:selected',
          slug: story.slug,
          title: story.title,
          placeName: story.placeName,
          country: story.country,
          lat: story.lat,
          lon: story.lon,
          path: story.path,
        },
        '*',
      );
    }

    const detail = await fetchArticleDetail(slug);
    if (detail && state.selectedSlug === slug) {
      renderDossier(story, detail);
    }
  }

  // ── 5. Cesium Left-Click Picker for PLAIN. Globe Diamonds ─────────────────
  const pickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  pickHandler.setInputAction((movement) => {
    if (!state.newsLayerEnabled) return;
    const picked = viewer.scene.pick(movement.position);
    const entity = picked?.id;
    const slug = entity?.properties?.plainSlug?.getValue?.();
    if (slug && state.bySlug.has(slug)) {
      void selectStory(slug, { fly: true });
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ── 6. Sync Sensor Chips with God's Eye View LayerLifecycle ───────────────
  function syncSensorChips() {
    const allById = new Map(
      (dataManager.getAll?.() || []).map((entry) => [entry.id, entry]),
    );
    for (const sensor of QUICK_SENSORS) {
      const btn = topbar.querySelector(`[data-sensor-id="${sensor.id}"]`);
      if (!btn) continue;
      const enabled = dataManager.isEnabled(sensor.id);
      btn.classList.toggle('is-active', enabled);
      const countSpan = btn.querySelector(`[data-sensor-count="${sensor.id}"]`);
      if (countSpan) {
        const stats = allById.get(sensor.id)?.stats;
        const count = Number(stats?.count);
        countSpan.textContent =
          enabled && Number.isFinite(count) && count > 0
            ? count > 999
              ? `${(count / 1000).toFixed(1)}k`
              : String(count)
            : '';
      }
    }
  }

  dataManager.subscribeActivity(() => {
    syncSensorChips();
  });

  // ── 7. Clock, Theme, Events & postMessage Bridge ──────────────────────────
  function updateZuluClock() {
    const el = document.getElementById('pm-zulu-clock');
    if (!el) return;
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}Z`;
  }
  const clockTimer = window.setInterval(updateZuluClock, 1000);

  function applyTheme(nextTheme, { notifyParent = true } = {}) {
    currentTheme = nextTheme === 'paper' ? 'paper' : 'obsidian';
    document.documentElement.setAttribute('data-maven-theme', currentTheme);
    try {
      localStorage.setItem('plain-maven:theme', currentTheme);
    } catch {
      // ignore storage errors
    }
    const toggleBtn = document.getElementById('pm-theme-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = currentTheme === 'obsidian' ? 'PAPER' : 'OBSIDIAN';
    }
    rebuildGlobeEntities();
    if (notifyParent && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'plain-maven:theme-changed', theme: currentTheme },
        '*',
      );
    }
  }

  function toggleAllSensorsDrawer() {
    try {
      const store = usePanelChromeStore(applicationPinia());
      store.act('toggle', 'data-panel');
    } catch {
      const panel = document.getElementById('data-panel');
      if (panel) panel.classList.toggle('collapsed');
    }
  }

  // Event delegation across our chrome
  topbar.addEventListener('click', (event) => {
    const sensorBtn = event.target.closest('[data-sensor-id]');
    if (sensorBtn) {
      const layerId = sensorBtn.getAttribute('data-sensor-id');
      const next = !dataManager.isEnabled(layerId);
      void dataManager.setEnabled(layerId, next, { origin: 'user' });
      syncSensorChips();
      return;
    }
    if (event.target.closest('#pm-toggle-news-layer')) {
      state.newsLayerEnabled = !state.newsLayerEnabled;
      const btn = document.getElementById('pm-toggle-news-layer');
      if (btn) btn.classList.toggle('is-active', state.newsLayerEnabled);
      updateHorizonVisibility();
      governorRequestRender('plain-maven:toggle-news');
      return;
    }
    if (event.target.closest('#pm-open-all-sensors')) {
      toggleAllSensorsDrawer();
      return;
    }
    if (event.target.closest('#pm-theme-toggle')) {
      applyTheme(currentTheme === 'obsidian' ? 'paper' : 'obsidian');
      return;
    }
    if (event.target.closest('#pm-open-credits')) {
      creditsModal.hidden = false;
    }
  });

  topbar.addEventListener('change', (event) => {
    if (event.target.id === 'pm-theater-select') {
      const key = event.target.value;
      const th = THEATERS.find((item) => item.key === key);
      if (th) {
        holdContinuousRender('plain-maven-theater');
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(th.lon, th.lat, th.alt),
          duration: 1.5,
          complete: () => {
            releaseContinuousRender('plain-maven-theater');
            updateHorizonVisibility();
          },
          cancel: () => releaseContinuousRender('plain-maven-theater'),
        });
      }
    }
  });

  rail.addEventListener('click', (event) => {
    if (event.target.closest('#pm-rail-collapse')) {
      state.railOpen = false;
      rail.classList.add('is-collapsed');
      document.body.classList.remove('pm-rail-open');
      return;
    }
    const catBtn = event.target.closest('[data-cat]');
    if (catBtn) {
      state.activeCategory = catBtn.getAttribute('data-cat') || 'all';
      for (const pill of rail.querySelectorAll('[data-cat]')) {
        pill.classList.toggle(
          'is-active',
          pill.getAttribute('data-cat') === state.activeCategory,
        );
      }
      renderFeedList();
      updateHorizonVisibility();
      governorRequestRender('plain-maven:filter');
      return;
    }
    const storyBtn = event.target.closest('[data-story-slug]');
    if (storyBtn) {
      const slug = storyBtn.getAttribute('data-story-slug');
      void selectStory(slug, { fly: true });
    }
  });

  rail.addEventListener('input', (event) => {
    if (event.target.id === 'pm-search-input') {
      state.searchQuery = event.target.value.trim();
      renderFeedList();
      updateHorizonVisibility();
      governorRequestRender('plain-maven:search');
    }
  });

  railReopen.addEventListener('click', () => {
    state.railOpen = true;
    rail.classList.remove('is-collapsed');
    document.body.classList.add('pm-rail-open');
  });

  dossier.addEventListener('click', (event) => {
    if (event.target.closest('#pm-dossier-close')) {
      void selectStory(null);
      return;
    }
    const aoiBtn = event.target.closest('#pm-aoi-sweep-btn');
    if (aoiBtn && state.selectedSlug) {
      const story = state.bySlug.get(state.selectedSlug);
      if (story) {
        flyToStory(story, { customAltitudeMeters: 210_000 });
        for (const layerId of AOI_SWEEP_LAYERS) {
          if (!dataManager.isEnabled(layerId)) {
            void dataManager.setEnabled(layerId, true, { origin: 'user' });
          }
        }
        aoiBtn.innerHTML = `<span>${escapeHtml(ui().aoiSweepDone)}</span>`;
      }
      return;
    }
    const openLink = event.target.closest('#pm-open-full-article');
    if (openLink && state.selectedSlug && window.parent && window.parent !== window) {
      event.preventDefault();
      const story = state.bySlug.get(state.selectedSlug);
      window.parent.postMessage(
        {
          type: 'plain-maven:open-article',
          slug: story.slug,
          kind: story.kind,
          locale: currentLocale,
          path: story.path,
          url: openLink.getAttribute('href'),
        },
        '*',
      );
    }
  });

  creditBar.addEventListener('click', (event) => {
    if (event.target.closest('#pm-credit-bar-more')) {
      creditsModal.hidden = false;
    }
  });

  creditsModal.addEventListener('click', (event) => {
    if (
      event.target === creditsModal ||
      event.target.closest('#pm-credits-close')
    ) {
      creditsModal.hidden = true;
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!creditsModal.hidden) {
        creditsModal.hidden = true;
      } else if (!dossier.hidden) {
        void selectStory(null);
      }
    }
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'plain-maven:set-theme' && msg.theme) {
      applyTheme(msg.theme, { notifyParent: false });
    } else if (msg.type === 'plain-maven:focus-story' && msg.slug) {
      void selectStory(String(msg.slug), { fly: true });
    } else if (msg.type === 'plain-maven:set-locale' && msg.locale) {
      const nextLoc = String(msg.locale).slice(0, 2).toLowerCase();
      if (COPY[nextLoc] && nextLoc !== currentLocale) {
        currentLocale = nextLoc;
        renderTopbar();
        renderRailFrame();
        renderCreditBarAndModal();
        void loadPlainFeed({ initial: false });
      }
    }
  });

  // ── 8. Fetch PLAIN. Geocoded Feed & Handle Initial Deep-Link ──────────────
  async function loadPlainFeed({ initial = false } = {}) {
    state.loading = true;
    if (initial) renderFeedList();

    let payload = null;
    for (const base of apiBases) {
      try {
        const res = await fetch(
          `${base}/api/maven/feed?locale=${encodeURIComponent(currentLocale)}&limit=240`,
        );
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.ok && Array.isArray(json.items)) {
          payload = json;
          break;
        }
      } catch {
        // try next candidate base
      }
    }

    state.loading = false;
    if (payload?.items) {
      state.stories = payload.items;
      state.bySlug = new Map(payload.items.map((item) => [item.slug, item]));
      rebuildGlobeEntities();
      renderFeedList();

      if (initial) {
        const deepSlug = params.get('story') || params.get('slug');
        const qLat = Number(params.get('lat'));
        const qLon = Number(params.get('lon'));
        if (deepSlug && state.bySlug.has(deepSlug)) {
          await selectStory(deepSlug, { fly: true });
        } else if (Number.isFinite(qLat) && Number.isFinite(qLon)) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(qLon, qLat, 650_000),
            duration: 1.3,
          });
        } else {
          // Frame Europe / Mediterranean / Middle East global news arc cleanly on boot
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(18.0, 34.0, 14_500_000),
          });
          updateHorizonVisibility();
          governorRequestRender('plain-maven:initial-view');
        }
      }
    } else {
      renderFeedList();
    }
  }

  // Paint initial chrome immediately and fetch live PLAIN. feed
  renderTopbar();
  renderRailFrame();
  renderCreditBarAndModal();
  void loadPlainFeed({ initial: true });

  // Enable seismic earthquakes layer subtly out of the box so the live globe feels alive immediately
  if (!dataManager.isEnabled('earthquakes')) {
    void dataManager.setEnabled('earthquakes', true, { origin: 'programmatic' });
  }

  const feedTimer = window.setInterval(() => {
    void loadPlainFeed({ initial: false });
  }, FEED_REFRESH_MS);

  return {
    selectStory,
    applyTheme,
    destroy() {
      window.clearInterval(clockTimer);
      window.clearInterval(feedTimer);
      pickHandler.destroy();
      viewer.camera.changed.removeEventListener(updateHorizonVisibility);
      viewer.scene.postRender.removeEventListener(updateReticlePosition);
      viewer.dataSources.remove(newsDataSource, true);
    },
  };
}
