import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { filterRoster, rosterOf } from '../../public/js/ui/loadoutModel.js';
import { TRAIT_SYNERGIES, traitSynergyForGarrison } from '../../public/js/ui/traitSynergy.js';

const chess = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url)));
const garrisons = JSON.parse(readFileSync(new URL('../../data/garrisons.json', import.meta.url)));
const roster = rosterOf(Object.values(chess));
const getChess = (id) => chess[id] || null;
const getGarrison = (id) => garrisons[id] || null;
const filtered = (synergy, extra = {}) => filterRoster(roster, { ...extra, synergy }, {}, getChess, () => null, null, null, getGarrison);

test('the three direct trait combinations use their source garrisons and target event types', () => {
  for (const preset of TRAIT_SYNERGIES) {
    const source = getChess(preset.sourceChessId);
    assert.ok(source?.visible && !source.isGolden);
    assert.ok(preset.sourceGarrisons.every((id) => traitSynergyForGarrison(id) === preset));
    assert.ok(source.garrisonIds.some((id) => preset.sourceGarrisons.includes(id)));
  }
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
