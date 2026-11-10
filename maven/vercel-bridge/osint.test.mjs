import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyWeapon,
  locateImpactAndOrigin,
  osintReports,
} from './osint.js';

test('classifies missile, drone, rocket, and airstrike headlines with weapon models', () => {
  assert.deepEqual(
    classifyWeapon(
      'Iskander-M ballistic missile launched from Crimea strikes port in Odesa',
    ),
    { weaponType: 'missile', weaponModel: 'Iskander-M' },
  );
  assert.deepEqual(
    classifyWeapon(
      'Shahed-136 drone wave launched from Kursk targets Kyiv substation',
    ),
    { weaponType: 'drone', weaponModel: 'Shahed-136 / Geran-2' },
  );
  assert.deepEqual(
    classifyWeapon('BM-21 Grad rocket barrage hits northern Kharkiv'),
    { weaponType: 'rocket', weaponModel: 'BM-21 Grad MLRS' },
  );
  assert.deepEqual(
    classifyWeapon('KAB glide bomb strike reported near Kupiansk'),
    { weaponType: 'airstrike', weaponModel: 'KAB / FAB Gleitbombe' },
  );
});

test('resolves explicit launch origin and impact site from directional headlines', () => {
  const odessaStrike = locateImpactAndOrigin(
    'Iskander-M ballistic missile launched from Crimea strikes port in Odesa',
    'missile',
  );
  assert.equal(odessaStrike.place, 'Odesa');
  assert.equal(odessaStrike.originPlace, 'Krim (Startbasis)');
  assert.equal(odessaStrike.originInferred, false);
  assert.ok(odessaStrike.distanceKm > 300 && odessaStrike.distanceKm < 550);

  const eilatStrike = locateImpactAndOrigin(
    'Ballistic missile and Samad-3 drone attack launched from Sanaa in Yemen towards Eilat',
    'missile',
  );
  assert.equal(eilatStrike.place, 'Eilat');
  assert.equal(eilatStrike.originPlace, 'Sanaa / Jemen (Startraum)');
  assert.ok(eilatStrike.distanceKm > 1600);
});

test('osintReports returns located rocket and drone strike trajectories even without live relay', async () => {
  const snapshot = await osintReports({ url: '' });
  assert.ok(snapshot);
  assert.ok(Array.isArray(snapshot.reports));
  assert.ok(snapshot.located >= 10);
  assert.ok(snapshot.trajectories >= 10);
  const sample = snapshot.reports[0];
  assert.ok(Number.isFinite(sample.lat) && Number.isFinite(sample.lon));
  assert.ok(
    Number.isFinite(sample.originLat) && Number.isFinite(sample.originLon),
  );
  assert.ok(sample.weaponType);
});
