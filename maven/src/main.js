import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { t } from './i18n/index.js';
import { initPlainMavenExperience } from './plainMaven/index.js';

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

const application = createStandaloneApplication({
  googleApiKey: '',
  cesiumToken: '',
  allowQaRegistration: import.meta.env.DEV,
});

application
  .start()
  .then((components) =>
    initPlainMavenExperience({
      application,
      ...components,
    }),
  )
  .catch((error) => {
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
  });

export { application };
