import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  GHOSTMAPS_MAX_FILE_BYTES,
  GHOSTMAPS_REPO,
  buildGhostMapsCatalog,
  ghostMapsRawUrl,
  parseGitRefAdvertisement,
} from '../../src/layers/ghostMaps/catalog.js';
import {
  readResponseBytesCapped,
  readResponseJsonCapped,
  readResponseTextCapped,
} from './common/http.js';

// S2 Underground GhostMaps (public GitHub repository of KMZ intel products).
// The repository is not ours, so there is no webhook: the watcher reads the
// branch head through git's smart-HTTP ref advertisement (~0.5 KB, outside the
// REST API rate limit) every few seconds, and only a new commit costs REST
// calls (tree + commit). Browsers hear about a new commit over server-sent
// events and fetch only the products whose blob changed. Files are fetched by
// commit-pinned raw URLs and kept on disk by blob sha.

const DEFAULT_POLL_MS = 15_000;
const MIN_POLL_MS = 5_000;
const FAILURE_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
const TIMEOUT_MS = 15_000;
const FILE_TIMEOUT_MS = 120_000;
const HEARTBEAT_MS = 25_000;
const MAX_SUBSCRIBERS = 64;
const MAX_REF_BYTES = 64 * 1024;
const MAX_TREE_BYTES = 16 * 1024 * 1024;
const MAX_COMMIT_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'gods-eye-view-ghostmaps/1.0';
const REPO_PATH = `${GHOSTMAPS_REPO.owner}/${GHOSTMAPS_REPO.name}`;
const DEFAULT_CACHE_DIR = path.join(process.cwd(), '.gev-cache', 'ghostmaps');

const BUNDLED_GHOSTMAPS_CATALOG = Object.freeze({
  commit: 'f6fb49a5d5789e9c64101931c1d6e92b6233e965',
  committedAt: 1793653581000,
  message: 'Nov 2 Update',
  changedAt: 1793698020752,
  products: [
    {
      id: 'cip',
      title: 'Common Intelligence Picture',
      defaultOn: true,
      path: 'ArcGIS Data for ATAK (KMZs)/Common Intelligence Picture/Master Database/S2Underground_Common_Intelligence_Picture_November_2_2026_Export_1.kmz',
      fileName: 'S2Underground_Common_Intelligence_Picture_November_2_2026_Export_1.kmz',
      version: 'e153fcc1ac8f176dd0d5ff451f488483114575cb',
      size: 3409816,
      dateMs: 1793577600000,
      edition: 1,
      fileTitle: 'Common Intelligence Picture November 2 2026 Export 1',
    },
    {
      id: 'kinetic-30d',
      title: 'Kinetic Activity (30 days)',
      defaultOn: true,
      path: 'ArcGIS Data for ATAK (KMZs)/Common Intelligence Picture/30-Day Pulls/Kinetic_Activities_Last_30_Days.kmz',
      fileName: 'Kinetic_Activities_Last_30_Days.kmz',
      version: '65286206e3054e7040b7d54c708be2b8db1eeedf',
      size: 6595,
      dateMs: null,
      edition: 0,
      fileTitle: 'Kinetic Activities Last 30 Days',
    },
    {
      id: 'border-crisis',
      title: 'Border Crisis Map',
      defaultOn: false,
      path: 'ArcGIS Data for ATAK (KMZs)/Border Crisis Map/S2Underground_Border_Crisis_Map_October_5_2026_Export_v1.kmz',
      fileName: 'S2Underground_Border_Crisis_Map_October_5_2026_Export_v1.kmz',
      version: '79b064ea7cedb31815af4daabef53362cd3dcdb3',
      size: 254271,
      dateMs: 1791158400000,
      edition: 1,
      fileTitle: 'Border Crisis Map October 5 2026 Export v1',
    },
    {
      id: 'iran-cip',
      title: 'Iran Common Intelligence Picture',
      defaultOn: false,
      path: 'Incident Response Products for ATAK (KMZs and Documents)/Iran 2026/Iran Common Intelligence Picture/Iran_CIP_October_10_2026_v1.kmz',
      fileName: 'Iran_CIP_October_10_2026_v1.kmz',
      version: 'fe533c70cd00a3d6b8bc90b188656228263c54be',
      size: 137076,
      dateMs: 1791590400000,
      edition: 1,
      fileTitle: 'Iran CIP October 10 2026 v1',
    },
    {
      id: 'iran-kinetic',
      title: 'Iran Kinetic Events',
      defaultOn: false,
      path: 'Incident Response Products for ATAK (KMZs and Documents)/Iran 2026/Iran Kinetic Events/Iran_Kinetic_Events_October_15_2026_v1.kmz',
      fileName: 'Iran_Kinetic_Events_October_15_2026_v1.kmz',
      version: '1a6b991a01964a8e7dd9b7559ae81366e6e6b9c8',
      size: 125323,
      dateMs: 1792022400000,
      edition: 1,
      fileTitle: 'Iran Kinetic Events October 15 2026 v1',
    },
    {
      id: 'yemen-flot',
      title: 'Yemen FLOT',
      defaultOn: false,
      path: 'Incident Response Products for ATAK (KMZs and Documents)/Yemen 2026/Yemen FLOT_October_10_2026.kmz',
      fileName: 'Yemen FLOT_October_10_2026.kmz',
      version: '7fd1cd6b904151a3f399b8976be71eef022a4ad1',
      size: 39925,
      dateMs: 1791590400000,
      edition: 0,
      fileTitle: 'Yemen FLOT October 10 2026',
    },
    {
      id: 'latest-drop',
      title: 'Latest incident drop',
      defaultOn: false,
      path: 'Incident Response Products for ATAK (KMZs and Documents)/Iran 2026/Iran Kinetic Events/Archive/Iran_Kinetic_Events_October_12_2026_v1.kmz',
      fileName: 'Iran_Kinetic_Events_October_12_2026_v1.kmz',
      version: 'f240ff69c5f7f7d1a06af3c3e8ef4c919460f251',
      size: 124919,
      dateMs: 1791763200000,
      edition: 1,
      fileTitle: 'Iran Kinetic Events October 12 2026 v1',
    },
  ],
});

/** Poll interval from GHOSTMAPS_POLL_SECONDS, bounded below at 5 s. */
export function ghostMapsPollMs(raw = process.env.GHOSTMAPS_POLL_SECONDS) {
  const seconds = Number(raw);
  if (!raw || !Number.isFinite(seconds)) return DEFAULT_POLL_MS;
  return Math.max(MIN_POLL_MS, Math.round(seconds * 1000));
}

/**
 * The repository watcher and file cache, independent of HTTP routing.
 * @returns {{start: Function, stop: Function, catalog: Function,
 *   checkNow: Function, file: Function, subscribe: Function}}
 */
export function createGhostMapsWatcher({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  pollMs = ghostMapsPollMs(),
  cacheDir = DEFAULT_CACHE_DIR,
  token = () => String(process.env.GITHUB_TOKEN || '').trim(),
  log = (...args) => console.log(...args),
  warn = (...args) => console.warn(...args),
} = {}) {
  let state = {
    commit: null,
    committedAt: null,
    message: null,
    products: [],
    checkedAt: null,
    changedAt: null,
    error: null,
  };
  let timer = null;
  let running = false;
  let checking = null;
  let failures = 0;
  let diskLoaded = false;
  const listeners = new Set();
  const downloads = new Map();

  const apiHeaders = () => ({
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
  });

  async function get(url, headers, timeoutMs = TIMEOUT_MS) {
    const response = await fetchImpl(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw Object.assign(new Error(`HTTP ${response.status} from ${url}`), {
        status: response.status,
      });
    }
    return response;
  }

  async function readHead() {
    const response = await get(
      `${GHOSTMAPS_REPO.url}.git/info/refs?service=git-upload-pack`,
      { 'User-Agent': USER_AGENT },
    );
    const sha = parseGitRefAdvertisement(
      await readResponseTextCapped(response, MAX_REF_BYTES),
    );
    if (!sha) throw new Error('GhostMaps branch head not advertised');
    return sha;
  }

  async function readCommit(sha) {
    const api = `https://api.github.com/repos/${REPO_PATH}`;
    const tree = await readResponseJsonCapped(
      await get(`${api}/git/trees/${sha}?recursive=1`, apiHeaders()),
      MAX_TREE_BYTES,
    );
    if (!Array.isArray(tree?.tree)) throw new Error('GhostMaps tree malformed');
    if (tree.truncated) warn('[ghostmaps] repository tree listing truncated');
    let committedAt = null;
    let message = null;
    try {
      const commit = await readResponseJsonCapped(
        await get(`${api}/commits/${sha}`, apiHeaders()),
        MAX_COMMIT_BYTES,
      );
      committedAt = Date.parse(commit?.commit?.committer?.date) || null;
      message = String(commit?.commit?.message || '')
        .split('\n')[0]
        .slice(0, 200);
    } catch {
      // The commit date is decoration; the tree is what matters.
    }
    return { products: buildGhostMapsCatalog(tree.tree), committedAt, message };
  }

  async function loadDisk() {
    if (diskLoaded) return;
    diskLoaded = true;
    try {
      const saved = JSON.parse(
        await fsp.readFile(path.join(cacheDir, 'catalog.json'), 'utf8'),
      );
      if (/^[0-9a-f]{40}$/.test(saved?.commit) && Array.isArray(saved.products))
        state = { ...state, ...saved, error: null };
    } catch {
      if (cacheDir === DEFAULT_CACHE_DIR && !state.commit) {
        state = {
          ...state,
          ...BUNDLED_GHOSTMAPS_CATALOG,
          products: BUNDLED_GHOSTMAPS_CATALOG.products.map((p) => ({ ...p })),
          error: null,
        };
      }
    }
  }

  async function saveDisk() {
    try {
      await fsp.mkdir(cacheDir, { recursive: true });
      const { commit, committedAt, message, products, changedAt } = state;
      await fsp.writeFile(
        path.join(cacheDir, 'catalog.json'),
        JSON.stringify({ commit, committedAt, message, products, changedAt }),
      );
    } catch (error) {
      warn('[ghostmaps] could not save catalog:', error.message);
    }
  }

  function emit() {
    const event = publicCatalog();
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* a broken subscriber must not stop the rest */
      }
    }
  }

  async function check() {
    await loadDisk();
    const head = await readHead();
    state.checkedAt = now();
    if (head === state.commit) {
      if (state.error !== null) {
        state.error = null;
        emit();
      }
      return false;
    }
    const next = await readCommit(head);
    const previous = new Map(state.products.map((p) => [p.id, p.version]));
    const changed = next.products
      .filter((p) => previous.get(p.id) !== p.version)
      .map((p) => p.id);
    state = {
      ...state,
      ...next,
      commit: head,
      changedAt: now(),
      error: null,
    };
    log(
      `[ghostmaps] commit ${head.slice(0, 8)}${
        next.message ? ` "${next.message}"` : ''
      }; updated: ${changed.join(', ') || 'none'}`,
    );
    await saveDisk();
    emit();
    // Warm the default products so the first browser load is local.
    for (const product of state.products)
      if (product.defaultOn) file(product.id).catch(() => {});
    return true;
  }

  /** Run one check now, coalescing with one already in flight. */
  function checkNow() {
    if (!checking)
      checking = check()
        .then(
          (changed) => {
            failures = 0;
            return changed;
          },
          (error) => {
            failures += 1;
            state.error = error.message;
            state.checkedAt = now();
            warn('[ghostmaps] check failed:', error.message);
            emit();
            return false;
          },
        )
        .finally(() => {
          checking = null;
        });
    return checking;
  }

  function schedule() {
    clearTimeout(timer);
    if (!running) return;
    const delay = failures
      ? FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1]
      : pollMs;
    timer = setTimeout(async () => {
      await checkNow();
      schedule();
    }, delay);
    timer.unref?.();
  }

  /** Start watching (idempotent); the first check runs immediately. */
  function start() {
    if (running) return checking || Promise.resolve(false);
    running = true;
    const first = checkNow();
    first.then(schedule);
    return first;
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
  }

  function publicCatalog() {
    return {
      repo: GHOSTMAPS_REPO.url,
      branch: GHOSTMAPS_REPO.branch,
      commit: state.commit,
      committedAt: state.committedAt,
      message: state.message,
      checkedAt: state.checkedAt,
      changedAt: state.changedAt,
      pollMs,
      error: state.error,
      products: state.products.map(
        ({
          id,
          title,
          defaultOn,
          fileName,
          fileTitle,
          version,
          size,
          dateMs,
        }) => ({
          id,
          title,
          defaultOn,
          fileName,
          fileTitle,
          version,
          size,
          dateMs,
        }),
      ),
    };
  }

  /** @type {Map<string, Buffer>} */
  const memoryFiles = new Map();

  /**
   * The bytes of one product's current edition, from disk or a commit-pinned
   * download. Only catalog paths are ever fetched.
   */
  async function file(id) {
    const product = state.products.find((p) => p.id === id);
    if (!product) return null;
    const memHit = memoryFiles.get(product.version);
    if (memHit) return { product, bytes: memHit };
    const target = path.join(cacheDir, 'files', `${product.version}.kmz`);
    try {
      const diskBytes = await fsp.readFile(target);
      memoryFiles.set(product.version, diskBytes);
      return { product, bytes: diskBytes };
    } catch {
      /* not cached yet */
    }
    const commit = state.commit;
    let pending = downloads.get(product.version);
    if (!pending) {
      pending = (async () => {
        const response = await get(
          ghostMapsRawUrl(commit, product.path),
          { 'User-Agent': USER_AGENT },
          FILE_TIMEOUT_MS,
        );
        const bytes = Buffer.from(
          await readResponseBytesCapped(response, GHOSTMAPS_MAX_FILE_BYTES),
        );
        memoryFiles.set(product.version, bytes);
        if (memoryFiles.size > 24) {
          memoryFiles.delete(memoryFiles.keys().next().value);
        }
        try {
          await fsp.mkdir(path.dirname(target), { recursive: true });
          const temp = `${target}.${process.pid}.tmp`;
          await fsp.writeFile(temp, bytes);
          await fsp.rename(temp, target);
          await pruneFiles();
        } catch {
          /* Read-only serverless filesystem (/var/task): serve from memoryFiles */
        }
        return bytes;
      })().finally(() => downloads.delete(product.version));
      downloads.set(product.version, pending);
    }
    return { product, bytes: await pending };
  }

  /** Keep only files that a current product still points to. */
  async function pruneFiles() {
    const keep = new Set(state.products.map((p) => `${p.version}.kmz`));
    const dir = path.join(cacheDir, 'files');
    for (const name of await fsp.readdir(dir).catch(() => [])) {
      if (!keep.has(name) && !name.endsWith('.tmp'))
        await fsp.rm(path.join(dir, name), { force: true }).catch(() => {});
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    start,
    stop,
    checkNow,
    catalog: publicCatalog,
    file,
    subscribe,
    subscribers: () => listeners.size,
  };
}

/** Same-origin GhostMaps routes for dev and preview. */
export function ghostMapsProxy({ watcher = createGhostMapsWatcher() } = {}) {
  const json = (res, status, value) => {
    if (res.destroyed) return;
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(status === 405 ? { Allow: 'GET' } : {}),
    });
    res.end(JSON.stringify(value));
  };

  function events(req, res) {
    if (watcher.subscribers() >= MAX_SUBSCRIBERS)
      return json(res, 429, { error: 'too_many_subscribers' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (catalog) =>
      res.write(`event: catalog\ndata: ${JSON.stringify(catalog)}\n\n`);
    res.write('retry: 5000\n\n');
    send(watcher.catalog());
    const unsubscribe = watcher.subscribe(send);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref?.();
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on('close', close);
    res.on('error', close);
  }

  async function handler(req, res) {
    if (req.method !== 'GET')
      return json(res, 405, { error: 'method_not_allowed' });
    const url = new URL(req.url || '/', 'http://local');
    const match = /^\/file\/([a-z0-9-]{1,40})$/.exec(url.pathname);
    if (!['/catalog', '/events'].includes(url.pathname) && !match)
      return json(res, 404, { error: 'unknown_route' });
    // Watching starts with the first request, so an install that never turns
    // the layer on never contacts GitHub.
    const first = watcher.start();
    if (url.pathname === '/catalog') {
      if (!watcher.catalog().commit) await first;
      return json(res, 200, watcher.catalog());
    }
    if (url.pathname === '/events') return events(req, res);
    try {
      if (!watcher.catalog().commit) await first;
      const found = await watcher.file(match[1]);
      if (!found) return json(res, 404, { error: 'unknown_product' });
      const pinned = url.searchParams.get('v') === found.product.version;
      res.writeHead(200, {
        'Content-Type': 'application/vnd.google-earth.kmz',
        'Content-Length': found.bytes.length,
        'X-GhostMaps-Version': found.product.version,
        // A versioned URL names one immutable blob.
        'Cache-Control': pinned
          ? 'private, max-age=31536000, immutable'
          : 'no-store',
      });
      return res.end(found.bytes);
    } catch {
      return json(res, 502, { error: 'ghostmaps_unavailable' });
    }
  }

  return {
    name: 'ghostmaps',
    configureServer({ middlewares }) {
      middlewares.use('/api/ghostmaps', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/ghostmaps', handler);
    },
  };
}
