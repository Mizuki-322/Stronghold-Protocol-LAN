// Mode exclusions remove operators from the shop pool; they never suppress a bond's effect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { computeBonds, bondList, bondSnapshot } from '../../server/match/bondsMeta.js';
import { drawDisabledBonds } from '../../server/match/pool.js';
import { createRng } from '../../server/sim/rng.js';
import { DATA } from './harness.js';

let uid = 1;
const piece = (id) => ({ uid: uid++, kind: 'chess', id, items: [] });
const state = ({ board = [] } = {}) => ({
  board: new Map(board.map((p, i) => [`${9 + i},2`, p])),
  hand: new Array(10).fill(null),
  layers: {},
});

test('all four difficulties ban operators by excluded-bond membership, not bond effects', () => {
  for (const difficulty of ['FUNNY', 'NORMAL', 'HARD', 'ABYSS']) {
    for (const type of ['single', 'multi']) {
      const gd = new GameData(DATA, `mode_${type}_${difficulty.toLowerCase()}`);
      const { drawn, staticOff, banned } = drawDisabledBonds(gd, createRng(17));
      const excluded = new Set([...drawn, ...staticOff]);
      for (const id of gd.visibleChess) {
        const bonds = DATA.chess[id].bonds;
        assert.equal(banned.includes(id), bonds.length > 0 && bonds.every((bond) => excluded.has(bond)), `${difficulty}/${type}: ${id}`);
      }
      const surviving = gd.visibleChess.find((id) => !banned.includes(id) && DATA.chess[id].bonds.some((bond) => excluded.has(bond)));
      assert.ok(surviving, `${difficulty}/${type}: a multi-bond operator survives`);
      const bond = DATA.chess[surviving].bonds.find((id) => excluded.has(id));
      const counted = computeBonds(gd, state({ board: [piece(surviving)] }));
      assert.equal(counted[bond].count, 1, `${difficulty}/${type}: excluded bond still counts`);
    }
  }
});

test('standard: a surviving 独行 member activates despite the fixed exclusion', () => {
  const gd = new GameData(DATA, 'mode_single_funny');
  assert.ok(gd.modeInactiveBonds.has('soloShip'));
  const { banned } = drawDisabledBonds(gd, createRng(3));
  const id = gd.visibleChess.find((candidate) => !banned.includes(candidate) && DATA.chess[candidate].bonds.includes('soloShip'));
  assert.ok(id);
  const bonds = computeBonds(gd, state({ board: [piece(id)] }));
  assert.equal(bonds.soloShip.count, 1);
  assert.equal(bonds.soloShip.active, true);
  assert.equal(bondSnapshot(bonds).soloShip.active, true);
  assert.equal(bondList(gd, bonds).find((entry) => entry.bondId === 'soloShip').active, true);
});

test('standard: 绝技 counts elite operators even without listed members', () => {
  const gd = new GameData(DATA, 'mode_single_funny');
  assert.ok(gd.modeInactiveBonds.has('suntShip'));
  const { banned } = drawDisabledBonds(gd, createRng(3));
  const ids = gd.visibleChess.filter((id) => !banned.includes(id) && DATA.chess[id].goldenId).slice(0, 2);
  assert.equal(ids.length, 2);
  const bonds = computeBonds(gd, state({ board: ids.map((id) => piece(DATA.chess[id].goldenId)) }));
  assert.equal(bonds.suntShip.count, 2);
  assert.equal(bonds.suntShip.active, true);
});

test('standard: 变形同构体 can complete a bond in the fixed exclusion list', () => {
  const gd = new GameData(DATA, 'mode_single_funny');
  const { banned } = drawDisabledBonds(gd, createRng(3));
  const natural = gd.visibleChess.filter((id) => !banned.includes(id) && DATA.chess[id].bonds.includes('lateranoShip')).slice(0, 2);
  const wearer = gd.visibleChess.find((id) => !banned.includes(id) && !DATA.chess[id].bonds.includes('lateranoShip'));
  assert.equal(natural.length, 2);
  assert.ok(wearer);
  const granted = { ...piece(wearer), items: [{ id: 'chess_item_6_09_e_a' }, { id: 'chess_item_4_08_e_a' }] };
  const bonds = computeBonds(gd, state({ board: [...natural.map(piece), granted] }));
  assert.equal(bonds.lateranoShip.count, 3);
  assert.equal(bonds.lateranoShip.active, true);
});
