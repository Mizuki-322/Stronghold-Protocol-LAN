import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { makeMatch, give, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';
import { COLS } from '../../server/sim/constants.js';

const YELA = 'chess_char_3_20_a';
const owned = (ps) => [...ps.board.values(), ...ps.hand, ...ps.temp].filter((p) => p?.kind === 'chess');

test('圣山护佑 is limited to extended alliance and grants Yela in round four', () => {
  assert.equal(new GameData(DATA, 'mode_multi_normal').bandAllowed('band_yela'), false);
  const gd = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  assert.equal(gd.bandAllowed('band_yela'), true);
  assert.equal(gd.startLp('band_yela'), 24);
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_yela' });
    const ps = h.ps('p_0');
    assert.equal(ps.lp, 24);
    assert.equal(owned(ps).some((p) => p.id === YELA), false);
    h.m.round = 4;
    h.m.dispatch(ps, 'onRoundStart', { round: 4 });
    assert.equal(owned(ps).filter((p) => p.id === YELA).length, 1);
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});

test('谢拉格 reward prefers unowned affordable operators and follows a lossless round eight battle', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_yela' });
    const ps = h.ps('p_0');
    ps.shop.level = 2;
    give(h.m, ps, 'chess_char_1_02_a');
    const before = owned(ps).map((p) => p.uid);
    h.m.round = 7;
    h.m.dispatch(ps, 'onRoundStart', { round: 7 });
    const seventh = owned(ps).find((p) => !before.includes(p.uid));
    assert.equal(seventh?.id, 'chess_char_2_05_a', 'owned 角峰 is passed over for unowned 哈洛德');

    h.m.round = 8;
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    const n = owned(ps).length;
    h.m.round = 9;
    h.m.dispatch(ps, 'onRoundStart', { round: 9 });
    assert.equal(owned(ps).length, n + 1);
    assert.ok(owned(ps).every((p) => p.id === 'chess_char_1_02_a' || p.id === 'chess_char_2_05_a'));
    h.m.dispatch(ps, 'onRoundStart', { round: 9 });
    assert.equal(owned(ps).length, n + 1, 'same rest period never grants twice');

    h.m.round = 10;
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 1 });
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 11;
    h.m.dispatch(ps, 'onRoundStart', { round: 11 });
    assert.equal(owned(ps).length, n + 1, 'any own LP loss cancels that round’s reward');
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});

test('圣山护佑 adds distant frozen targets while preserving ordinary target preference', () => {
  const defs = { enemies: {
    near: enemyRec({ key: 'near', hp: 100000, speed: 0 }),
    far: enemyRec({ key: 'far', hp: 100000, speed: 0 }),
  } };
  const h = makeBattle({ bandId: 'band_yela', units: [{ chessId: YELA, row: 10, col: 5 }], defs, autoFinish: false });
  h.step();
  const u = h.unit(YELA);
  const near = h.spawn('near', { pos: [10, 7] });
  const far = h.spawn('far', { pos: [9, 2] });
  h.b.applyStatus(far, 'freeze', { duration: 10 });
  h.step(2);
  assert.ok(u.rangeKeys.includes(far.tileR * COLS + far.tileC), 'distant frozen enemy enters range');
  assert.ok(h.runUntil(() => u.stats.attacks > 0, 5));
  assert.equal(h.eventsOf('atk').find((e) => e[1] === u.id)?.[2], near.id,
    'extra eligibility does not replace normal targeting priority');
  assert.deepEqual(h.b.errors, []);

  const ordinary = makeBattle({ units: [{ chessId: YELA, row: 10, col: 5 }], defs, autoFinish: false });
  ordinary.step();
  const target = ordinary.spawn('far', { pos: [9, 2] });
  ordinary.b.applyStatus(target, 'freeze', { duration: 10 });
  ordinary.run(3);
  assert.equal(ordinary.unit(YELA).stats.attacks, 0, 'other strategies retain Yela’s normal range');
});

test('耶拉 and her released drones hit distant frozen enemies but exclude unfrozen enemies sharing their tile', () => {
  const defs = { enemies: {
    plain: enemyRec({ key: 'plain', hp: 100000, speed: 0 }),
    frozen: enemyRec({ key: 'frozen', hp: 100000, speed: 0 }),
  } };
  const h = makeBattle({ bandId: 'band_yela', units: [{ chessId: YELA, row: 10, col: 5 }], defs,
    autoFinish: false, captureNoisy: true });
  h.step();
  const u = h.unit(YELA);
  const plain = h.spawn('plain', { pos: [9, 2] });
  const frozen = h.spawn('frozen', { pos: [9, 2] });
  h.b.applyStatus(frozen, 'freeze', { duration: 15 });
  assert.ok(h.runUntil(() => u.stats.attacks > 0, 5));
  assert.equal(h.eventsOf('atk').find((e) => e[1] === u.id)?.[2], frozen.id);
  assert.equal(plain.hp, plain.s.maxHp);
  assert.equal(u.skill.activate('test', { free: true }), true);
  assert.ok(h.runUntil(() => h.hooksOf('damaged').some((c) => c.dmg?.tags?.includes('kjera:drone')), 5));
  assert.equal(plain.hp, plain.s.maxHp);
  assert.ok(frozen.hp < frozen.s.maxHp);
  assert.deepEqual(h.b.errors, []);
});
