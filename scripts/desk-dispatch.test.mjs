// What the editor clicks has to reach the desk.
//
// The newsroom's approval travels as a workflow run. If the desk's own
// GitHub token may start workflows, the run starts itself — one click is
// enough. If the token may not, the editor gets the pre-filled form: a
// second click, but never a lost decision.
import test from 'node:test';
import assert from 'node:assert/strict';

const { dispatchDesk } = await import('../lib/deskDispatch.mjs');

const REPO = 'simoneggert16-png/plain-news';

test('a token that may start workflows starts the run itself', async () => {
  const calls = [];
  const run = await dispatchDesk(
    { approve_outreach: 'the-slug:L1', slug: 'the-slug', dry_run: 'false' },
    {
      repo: REPO,
      token: 'secret-token',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 204 };
      },
    },
  );
  assert.equal(run.started, true);
  assert.equal(run.url, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /actions\/workflows\/investigations\.yml\/dispatches$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.ref, 'main');
  assert.equal(body.inputs.approve_outreach, 'the-slug:L1');
  assert.equal(body.inputs.dry_run, 'false');
});

test('a token that may not start workflows hands the editor the form', async () => {
  const run = await dispatchDesk(
    { approve: 'the-slug', dry_run: 'false' },
    {
      repo: REPO,
      token: 'a-token-without-permission',
      fetchImpl: async () => ({ ok: false, status: 403 }),
    },
  );
  assert.equal(run.started, false);
  assert.match(run.url, /^https:\/\/github\.com\/simoneggert16-png\/plain-news\/actions\/workflows\/investigations\.yml\/dispatch\?/);
  assert.match(run.url, /inputs%5Bapprove%5D=the-slug/);
  assert.match(run.url, /inputs%5Bdry_run%5D=false/);
});

test('without a token the decision still reaches the desk', async () => {
  const run = await dispatchDesk(
    { approve: 'the-slug' },
    { repo: REPO, token: '', fetchImpl: async () => { throw new Error('must not be called'); } },
  );
  assert.equal(run.started, false);
  assert.match(run.url, /inputs%5Bapprove%5D=the-slug/);
});

test('a network that does not answer does not swallow the decision', async () => {
  const run = await dispatchDesk(
    { approve: 'the-slug' },
    {
      repo: REPO,
      token: 'secret-token',
      fetchImpl: async () => { throw new Error('network down'); },
    },
  );
  assert.equal(run.started, false);
  assert.match(run.url, /inputs%5Bapprove%5D=the-slug/);
});
