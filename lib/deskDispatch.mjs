// The editor's decision reaches the desk as a run.
//
// When the desk's own GitHub token may start workflows, the run starts
// itself — one click in the newsroom is enough. Otherwise the editor gets the
// pre-filled form: a second click, but a decision that is never lost.

const DEFAULT_REPO = 'simoneggert16-png/plain-news';

export async function dispatchDesk(inputs, { repo, token, fetchImpl = fetch } = {}) {
  const owner = repo || process.env.GITHUB_REPO || DEFAULT_REPO;
  const key = token ?? (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '');
  const values = Object.fromEntries(Object.entries(inputs || {}).map(([k, v]) => [k, String(v)]));

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
