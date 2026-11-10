function installSessionTransport(sessionToken) {
  if (!sessionToken || globalThis.__pmTransportWrapped) return;
  globalThis.__pmTransportWrapped = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const token = localStorage.getItem('_pm_s') || sessionToken;
      if (token) {
        const rawUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input?.url || '';
        if (rawUrl) {
          const resolved = new URL(rawUrl, window.location.origin);
          if (
            resolved.origin === window.location.origin &&
            resolved.pathname.startsWith('/api/')
          ) {
            const headers = new Headers(
              init?.headers ||
                (input instanceof Request ? input.headers : undefined),
            );
            if (!headers.has('x-pm-s')) headers.set('x-pm-s', token);
            return nativeFetch(input, { ...init, headers });
          }
        }
      }
    } catch {
      // fall through to native fetch
    }
    return nativeFetch(input, init);
  };

  if (typeof window.EventSource === 'function') {
    const NativeEventSource = window.EventSource;
    window.EventSource = function PatchedEventSource(url, config) {
      try {
        const token = localStorage.getItem('_pm_s') || sessionToken;
        if (token) {
          const resolved = new URL(String(url), window.location.origin);
          if (
            resolved.origin === window.location.origin &&
            resolved.pathname.startsWith('/api/') &&
            !resolved.searchParams.has('_s')
          ) {
            resolved.searchParams.set('_s', token);
            return new NativeEventSource(resolved.toString(), config);
          }
        }
      } catch {
        // fall through
      }
      return new NativeEventSource(url, config);
    };
    window.EventSource.prototype = NativeEventSource.prototype;
  }
}

async function resolveSessionConfig() {
  let savedToken = '';
  try {
    savedToken = String(localStorage.getItem('_pm_s') || '').trim();
  } catch {
    savedToken = '';
  }
  if (!savedToken) return { cesiumToken: '' };

  installSessionTransport(savedToken);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await window.fetch('/api/ui/sync', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      try {
        localStorage.removeItem('_pm_s');
      } catch {
        // ignore
      }
      return { cesiumToken: '' };
    }
    const data = await res.json();
    if (data?.ok === 1) {
      globalThis.__PM_EXT__ = true;
      document.body?.classList.add('pm-ext');
      return { cesiumToken: String(data.ion || '').trim() };
    }
  } catch {
    // network hiccup: keep stored token for retry on next load
  } finally {
    window.clearTimeout(timer);
  }
  return { cesiumToken: '' };
}

try {
  const p = new URLSearchParams(window.location.search);
  const qTheme = p.get('theme');
  const saved = localStorage.getItem('plain-maven:theme');
  const theme =
    qTheme === 'paper' || qTheme === 'obsidian'
      ? qTheme
      : saved === 'paper'
        ? 'paper'
        : 'obsidian';
  document.documentElement.setAttribute('data-maven-theme', theme);
  const qLang = p.get('locale') || p.get('lang');
  if (qLang) {
    const code = qLang.slice(0, 2).toLowerCase();
    document.documentElement.setAttribute('lang', code);
    localStorage.setItem('gev:locale', code);
  }
  sessionStorage.setItem('gev:first-run-mission-session:v1', '1');
  localStorage.setItem('gev:first-run-mission:v1', '1');
} catch {
  // ignore storage restrictions in private mode
}

let exportedApplication = null;

(async () => {
  const { cesiumToken } = await resolveSessionConfig();
  const [
    { createStandaloneApplication },
    { describeError },
    { t },
    { initPlainMavenExperience },
  ] = await Promise.all([
    import('./standalone/application.js'),
    import('./standalone/errors.js'),
    import('./i18n/index.js'),
    import('./plainMaven/index.js'),
  ]);

  try {
    const application = createStandaloneApplication({
      googleApiKey: '',
      cesiumToken,
      allowQaRegistration: import.meta.env.DEV,
    });
    exportedApplication = application;
    const components = await application.start();
    await initPlainMavenExperience({
      application,
      ...components,
    });
  } catch (error) {
    console.error('PLAIN. MAVEN initialization failed:', error);
    const loaderStatus = document.querySelector(
      '#loading-screen .loader-status',
    );
    if (loaderStatus) {
      loaderStatus.textContent = t('Error: {message}', {
        message: describeError(error),
      });
      loaderStatus.style.color = '#dc2626';
    }
  }
})();

export { exportedApplication as application };
