import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { t } from './i18n/index.js';
import { initPlainMavenExperience } from './plainMaven/index.js';

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
