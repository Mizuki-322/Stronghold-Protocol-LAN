import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { makeMatch, give, DATA } from '../match/harness.js';

test('凡人之愿 is available only to large alliances with 27 starting LP', () => {
  assert.equal(new GameData(DATA, 'mode_multi_normal').bandAllowed('band_lumen'), false);
  assert.equal(new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 }).bandAllowed('band_lumen'), true);
  assert.equal(new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 }).startLp('band_lumen'), 27);
  assert.equal(DATA.bands.band_lumen.effectName, '凡人之愿');
  assert.equal(DATA.assets.bands.band_lumen, '/assets/band/band_lumen.png');
});

test('凡人之愿 adds two layers per board operator to each active bond, capped at six per bond per round', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_lumen' });
    const ps = h.ps('p_0');
    assert.equal(ps.lp, 27);

    // Four Egir, two Arcane, two Stead; other bonds below their activation thresholds.
    const board = [
      'chess_char_1_04_a', 'chess_char_2_07_a', 'chess_char_3_05_a',
      'chess_char_3_09_a', 'chess_char_1_17_a', 'chess_char_1_02_a',
    ];
    board.forEach((id, col) => give(h.m, ps, id, 'board', [10, col + 2]));
    give(h.m, ps, 'chess_char_1_04_a', 'hand');
    assert.equal(ps.bonds.egirShip.active, true);
    assert.equal(ps.bonds.arcaneShip.active, true);
    assert.equal(ps.bonds.steadShip.active, true);
    const before = Object.fromEntries(Object.entries(ps.bonds).map(([id, state]) => [id, state.layers]));

    const endPrep = () => h.m.dispatch(ps, 'onPrepEnd', { round: h.m.round });
    endPrep();
    assert.equal(ps.bonds.egirShip.layers - before.egirShip, 6, 'four board members hit the per-bond cap');
    assert.equal(ps.bonds.arcaneShip.layers - before.arcaneShip, 4);
    assert.equal(ps.bonds.steadShip.layers - before.steadShip, 4);
    for (const [id, state] of Object.entries(ps.bonds)) {
      if (!state.active) assert.equal(state.layers, before[id], `${id}: inactive bonds gain nothing`);
    }

    endPrep();
    assert.equal(ps.bonds.egirShip.layers - before.egirShip, 6);
    assert.equal(ps.bonds.arcaneShip.layers - before.arcaneShip, 6, 'repeat hook cannot exceed six');
    assert.equal(ps.bonds.steadShip.layers - before.steadShip, 6);

    h.m.round = 2;
    endPrep();
    assert.equal(ps.bonds.egirShip.layers - before.egirShip, 12, 'cap resets on a new round');
    assert.equal(ps.bonds.arcaneShip.layers - before.arcaneShip, 10);
    assert.equal(ps.bonds.steadShip.layers - before.steadShip, 10);
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});
