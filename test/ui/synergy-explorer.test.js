import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildExplorer, filterExplorer, garrisonsForForm } from '../../public/synergy/model.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url), 'utf8'));
const explorer = buildExplorer(read('chess'), read('bonds'), read('garrisons'));
const row = (name) => explorer.rows.find((entry) => entry.normal.name === name);

test('independent explorer includes every alliance and the visible standard roster', () => {
  assert.equal(explorer.bonds.length, 23);
  assert.equal(explorer.bonds.filter((bond) => bond.isCore).length, 8);
  assert.equal(explorer.rows.length, 112);
  assert.ok(explorer.bonds.some((bond) => bond.bondId === 'emptyShip'));
});

test('timing filters use garrison eventType across normal and elite forms', () => {
  assert.deepEqual(row('铃兰').mechanismIds, ['prep-start']);
  assert.deepEqual(row('魔王').mechanismIds, ['battle']);
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['gain']) }).length, 22);
  // Unlike a source-to-target synergy list, a timing facet includes 白面鸮 / 塞雷娅 themselves.
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['prep-start']) }).length, 11);
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['prep-end']) }).length, 24);
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['battle']) }).length, 29);
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['battle-benefit']) }).length, 21);
  assert.equal(filterExplorer(explorer.rows, { mechanisms: new Set(['other']) }).length, 7);
  assert.ok(explorer.rows.every((entry) => entry.mechanismIds.length > 0));
  assert.deepEqual(row('风丸').mechanismIds, ['other']);
  assert.deepEqual(row('德克萨斯').mechanismIds, ['other']);
  assert.deepEqual(row('拉普兰德').mechanismIds, ['other']);
  assert.deepEqual(row('至简').mechanismIds, ['other']);
  assert.deepEqual(row('耀骑士临光').mechanismIds, ['battle-benefit']);
  assert.ok(garrisonsForForm(row('荒芜拉普兰德').elite, explorer.garrisons).some((garrison) => garrison.eventType === 'IN_BATTLE'));
});

test('alliance groups intersect and multiple selections within one group can match any or all', () => {
  const kazimierz = new Set(['kazimierzShip']);
  const swift = new Set(['swiftShip']);
  const gain = new Set(['gain']);
  assert.ok(filterExplorer(explorer.rows, { core: kazimierz, addon: swift, mechanisms: gain }).some((entry) => entry.normal.name === '野鬃'));
  assert.ok(!filterExplorer(explorer.rows, { core: kazimierz, addon: swift, mechanisms: gain }).some((entry) => entry.normal.name === '砾'));
  const both = new Set(['gain', 'battle']);
  assert.ok(filterExplorer(explorer.rows, { mechanisms: both }).length >= filterExplorer(explorer.rows, { mechanisms: both, matchAll: true }).length);
  assert.deepEqual(filterExplorer(explorer.rows, { query: 'Suzuran' }).map((entry) => entry.normal.name), ['铃兰']);
});

test('battle operators are classified by layer gain, grant, amplifier, battle benefit and unclassified effects', () => {
  const battle = explorer.rows.filter((entry) => entry.battleRelation);
  const counts = Object.groupBy(battle, (entry) => entry.battleRelation.role);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, rows]) => [key, rows.length])), {
    other: 1, direct: 24, benefit: 21, granter: 4, amplifier: 1,
  });
  assert.equal(row('魔王').battleRelation.role, 'amplifier');
  assert.equal(row('莫斯提马').battleRelation.role, 'direct');
  assert.equal(row('华法琳').battleRelation.role, 'granter');
  assert.equal(row('耀骑士临光').battleRelation.role, 'benefit');
  assert.equal(row('深巡').battleRelation.role, 'benefit');
  assert.equal(row('风丸').battleRelation.role, 'other');
  assert.equal(row('荒芜拉普兰德').battleRelation.role, 'direct');
  assert.equal(row('荒芜拉普兰德').battleRelation.grantsLayers, true);
  assert.equal(row('铃兰').battleRelation, null);
});
