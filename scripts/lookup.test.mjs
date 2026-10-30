// The desk must write to the right address, or to nobody.
//
// Twenty-one contacts on one dossier had no address, so no letter was ever
// sent. The desk now finds the address itself: from the organisation's name,
// on the organisation's own site, and only when the site really is theirs.
// These tests keep the rules that stop it from writing to a stranger.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  organisationName,
  organisationQualifier,
  organisationTokens,
  organisationPhrases,
  candidateHosts,
  hostBelongsTo,
  pageMatchesOrganisation,
  namesOrganisation,
  pickAddress,
} = await import('../bots/lib/lookup.mjs');

test('the name is the organisation, not the tag in brackets', () => {
  assert.equal(organisationName('Tether (USDT Issuer)'), 'Tether');
  assert.equal(organisationName('Circle (USDC Issuer)'), 'Circle');
  assert.equal(organisationName('U.S. Treasury – Office of Foreign Assets Control (OFAC)'), 'U.S. Treasury');
  assert.equal(organisationName('Hong Kong Securities and Futures Commission (SFC)'), 'Hong Kong Securities and Futures Commission');
});

test('the tag in brackets is the qualifier, when it is short', () => {
  assert.equal(organisationQualifier('Tether (USDT Issuer)'), 'USDT Issuer');
  assert.equal(organisationQualifier('Hong Kong Securities and Futures Commission (SFC)'), 'SFC');
  assert.equal(organisationQualifier('Office of the Director of Financial Intelligence (FIU)'), 'FIU');
  assert.equal(organisationQualifier('Federal Trade Commission'), '');
  // A long explanation in brackets is part of the description, not a tag.
  assert.equal(organisationQualifier('Tether (the company that issues the dollar token USDT)'), '');
});

test('the country mark in front of a name is not part of it', () => {
  assert.deepEqual(organisationTokens('U.S. Department of Justice').brandWords, ['department', 'of', 'justice']);
  assert.deepEqual(organisationTokens('Bank of England').brandWords, ['bank', 'of', 'england']);
});

test('the desk guesses the right site for a body and for a company', () => {
  const justice = candidateHosts('U.S. Department of Justice');
  assert.ok(justice.includes('justice.gov'), 'justice.gov is the Justice Department');
  assert.ok(candidateHosts('Federal Trade Commission').includes('ftc.gov'), 'ftc.gov is the Federal Trade Commission');
  assert.ok(candidateHosts('Hong Kong Securities and Futures Commission (SFC)').includes('sfc.hk'), 'sfc.hk is the Hong Kong regulator');
  assert.ok(candidateHosts('Bank of England').includes('bankofengland.co.uk'), 'bankofengland.co.uk is the Bank of England');
  assert.ok(candidateHosts('TRM Labs').includes('trmlabs.com'), 'trmlabs.com is TRM Labs');
  assert.ok(candidateHosts('Office of the Director of Financial Intelligence (FIU)').some((h) => h.startsWith('fiu.')), 'fiu.gov is the Financial Intelligence Unit');
});

test('a host belongs to the organisation when it carries its name', () => {
  assert.ok(hostBelongsTo('sfc.hk', 'Hong Kong Securities and Futures Commission (SFC)'));
  assert.ok(hostBelongsTo('home.treasury.gov', 'U.S. Treasury'));
  assert.ok(hostBelongsTo('fatf-gafi.org', 'Financial Action Task Force (FATF)'));
  assert.ok(!hostBelongsTo('bbc.com', 'U.S. Department of Justice'));
  assert.ok(!hostBelongsTo('circle.org', 'Circle (USDC Issuer)') === false, 'the circle domain carries the name');
});

test('a piece of a word is not the name', () => {
  // The American regulator must not answer for the Hong Kong one: "sec" is
  // only a piece of "Securities".
  assert.ok(!hostBelongsTo('sec.gov', 'Hong Kong Securities and Futures Commission (SFC)'));
  assert.ok(hostBelongsTo('sfc.hk', 'Hong Kong Securities and Futures Commission (SFC)'));
  assert.ok(hostBelongsTo('sec.gov', 'U.S. Securities and Exchange Commission (SEC)'));
  // The initials of the name without its glue: securities, exchange,
  // commission is sec.
  assert.ok(hostBelongsTo('ftc.gov', 'Federal Trade Commission'));
  assert.ok(!hostBelongsTo('ftc.gov', 'Federal Trade Administration'));
  assert.ok(hostBelongsTo('bankofengland.co.uk', 'Bank of England'));
});

test('a page belongs to the organisation when it says so', () => {
  const sfc = 'The Securities and Futures Commission of Hong Kong (SFC) is the regulator.';
  assert.ok(pageMatchesOrganisation(sfc, 'Hong Kong Securities and Futures Commission (SFC)'));
  // A Yiddish school in New York is not the stablecoin issuer.
  assert.ok(!pageMatchesOrganisation('The Workers Circle is a Jewish labour movement.', 'Circle (USDC Issuer)'));
  // The trade department is not the trade commission.
  assert.ok(!pageMatchesOrganisation('The International Trade Administration promotes American exports.', 'Federal Trade Commission'));
});

test('the whole name has to be on the page when the site is taken from the encyclopaedia', () => {
  assert.ok(namesOrganisation('European Banking Authority is an EU agency.', 'European Banking Authority'));
  assert.ok(!namesOrganisation('The European Parliament and the Banking Committee met.', 'European Banking Authority'));
});

test('the desk prefers the press office of the organisation it is writing to', () => {
  const emails = ['info@trmlabs.com', 'press@trmlabs.com', 'support@trmlabs.com'];
  assert.equal(pickAddress(emails, 'trmlabs.com'), 'press@trmlabs.com');
  // The press office wins over the desk that takes every letter.
  assert.equal(pickAddress(['contact@trmlabs.com', 'press@trmlabs.com'], 'trmlabs.com'), 'press@trmlabs.com');
  // A press office on a government domain is still the press office.
  assert.equal(pickAddress(['press@usdoj.gov'], 'justice.gov'), 'press@usdoj.gov');
  // An address of a stranger is never taken.
  assert.equal(pickAddress(['reporter@someblog.com'], 'justice.gov'), null);
  // A mailbox that is no desk at all gets no letter.
  assert.equal(pickAddress(['hr@sfc.hk'], 'sfc.hk'), null);
});
