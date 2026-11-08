import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { filterRoster, rosterOf } from '../../public/js/ui/loadoutModel.js';
import { TRAIT_SYNERGIES, traitSynergyForGarrison } from '../../public/js/ui/traitSynergy.js';
import { battleRelation } from '../../public/synergy/model.js';

const chess = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url)));
const garrisons = JSON.parse(readFileSync(new URL('../../data/garrisons.json', import.meta.url)));
const roster = rosterOf(Object.values(chess));
const getChess = (id) => chess[id] || null;
const getGarrison = (id) => garrisons[id] || null;
const filtered = (synergy, extra = {}) => filterRoster(roster, { ...extra, synergy }, {}, getChess, () => null, null, null, getGarrison);

test('all four source operators use their own garrisons', () => {
  for (const preset of TRAIT_SYNERGIES) {
    const source = getChess(preset.sourceChessId);
    assert.ok(source?.visible && !source.isGolden);
    assert.ok(preset.sourceGarrisons.every((id) => traitSynergyForGarrison(id) === preset));
    assert.ok(source.garrisonIds.some((id) => preset.sourceGarrisons.includes(id)));
  }
});

test('Theresa lists direct battle stack gains separately from traits granted to allies', () => {
  const list = filtered('theresa-battle-layers');
  const roles = list.map((c) => battleRelation([c, getChess(c.goldenId)].filter(Boolean), getGarrison)?.role);
  assert.equal(list.length, 28);
  assert.equal(roles.filter((role) => role === 'direct').length, 24);
  assert.equal(roles.filter((role) => role === 'granter').length, 4);
  assert.ok(list.some((c) => c.name === '砾'));
  assert.ok(!list.some((c) => c.name === '魔王'));
});

test('Suzuran finds obtainable effects, not operators whose text merely mentions 获得时', () => {
  const list = filtered('suzuran-gain');
  assert.equal(list.length, 22);
  assert.ok(list.some((c) => c.name === '能天使'));
  assert.ok(list.some((c) => c.name === '诗怀雅'));
  assert.ok(!list.some((c) => c.name === '铃兰'));
  assert.ok(list.every((c) => !c.isGolden && c.visible));
});

test('the two copy effects exclude themselves, include Suzuran for Ptilopsis, and combine with existing filters', () => {
  const start = filtered('ptilopsis-prep-start');
  const end = filtered('saria-prep-end');
  assert.equal(start.length, 10);
  assert.equal(end.length, 23);
  assert.ok(start.some((c) => c.name === '铃兰'));
  assert.ok(!start.some((c) => c.name === '白面鸮'));
  assert.ok(!end.some((c) => c.name === '塞雷娅'));
  const tierOne = filtered('suzuran-gain', { tier: 1 });
  assert.equal(tierOne.length, 6);
  assert.ok(tierOne.every((c) => c.tier === 1));
  assert.ok(tierOne.some((c) => c.name === '角峰'));
});
