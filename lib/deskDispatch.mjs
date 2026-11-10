// The editor's decision reaches the desk as a run.
//
// When the desk's own GitHub token may start workflows, the run starts
// itself — one click in the newsroom is enough. Otherwise the editor gets the
// pre-filled form: a second click, but a decision that is never lost.

const DEFAULT_REPO = 'simoneggert16-png/plain-news';

export const DOSSIER_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;
export const DESK_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isValidDossierSlug(slug) {
  return typeof slug === 'string' && DOSSIER_SLUG_RE.test(slug);
}

export function isValidDeskId(id) {
  return typeof id === 'string' && DESK_ID_RE.test(id);
}

function validateOutreachSpec(spec) {
  const parts = String(spec).split(':');
  if (parts.length !== 2) return false;
  const [slug, rawIds] = parts;
  if (!isValidDossierSlug(slug)) return false;
  const ids = rawIds.split(',').filter(Boolean);
  return ids.length > 0 && ids.every(isValidDeskId);
}

export function validateDispatchInputs(values) {
  for (const key of ['slug', 'approve']) {
    if (values[key] !== undefined && values[key] !== '' && !isValidDossierSlug(values[key])) {
      throw new Error(`Invalid dossier slug in ${key}`);
    }
  }
  for (const key of ['approve_outreach', 'reject_outreach']) {
    if (values[key] !== undefined && values[key] !== '' && !validateOutreachSpec(values[key])) {
      throw new Error(`Invalid outreach target in ${key}`);
    }
  }
}

export async function dispatchDesk(inputs, { repo, token, fetchImpl = fetch } = {}) {
  const owner = repo || process.env.GITHUB_REPO || DEFAULT_REPO;
  if (!REPO_RE.test(owner)) {
    throw new Error('Invalid repository identifier');
  }
  const key = token ?? (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '');
  const values = Object.fromEntries(Object.entries(inputs || {}).map(([k, v]) => [k, String(v)]));
  validateDispatchInputs(values);

  if (key) {
    try {
      const res = await fetchImpl(
        `https://api.github.com/repos/${owner}/actions/workflows/investigations.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'plain-news-desk',
          },
          body: JSON.stringify({ ref: 'main', inputs: values }),
        },
      );
      if (res.ok) return { started: true, url: null };
    } catch {
      /* the editor gets the form */
    }
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) params.set(`inputs[${k}]`, String(v));
  return {
    started: false,
    url: `https://github.com/${owner}/actions/workflows/investigations.yml/dispatch?${params.toString()}`,
  };
}
