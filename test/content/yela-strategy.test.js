import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { makeMatch, give, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';
import { COLS } from '../../server/sim/constants.js';

const YELA = 'chess_char_3_20_a';
const owned = (ps) => [...ps.board.values(), ...ps.hand, ...ps.temp].filter((p) => p?.kind === 'chess');

test('圣山护佑 is limited to extended alliance and first grants a 谢拉格 operator in round five', () => {
  assert.equal(new GameData(DATA, 'mode_multi_normal').bandAllowed('band_yela'), false);
  const gd = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  assert.equal(gd.bandAllowed('band_yela'), true);
  assert.equal(gd.startLp('band_yela'), 26);
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_yela' });
    const ps = h.ps('p_0');
    assert.equal(ps.lp, 26);
    assert.equal(owned(ps).some((p) => p.id === YELA), false);
    h.m.round = 4;
    h.m.dispatch(ps, 'onRoundStart', { round: 4 });
    assert.equal(owned(ps).some((p) => p.id === YELA), false);
    const count = owned(ps).length;
    h.m.round = 5;
    h.m.dispatch(ps, 'onRoundStart', { round: 5 });
    assert.equal(owned(ps).length, count + 1);
    assert.ok(owned(ps).every((p) => DATA.chess[p.id].bonds.includes('kjeragShip')));
    h.m.dispatch(ps, 'onRoundStart', { round: 5 });
    assert.equal(owned(ps).length, count + 1, 'round five grant happens only once');
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});

test('谢拉格 reward is granted every two cumulative lossless rounds from round five', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_yela' });
    const ps = h.ps('p_0');
    ps.shop.level = 2;
    give(h.m, ps, 'chess_char_1_02_a');
    h.m.round = 3;
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 4;
    h.m.dispatch(ps, 'onRoundStart', { round: 4 });
    assert.equal(owned(ps).length, 1, 'round three is before counting begins');
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 5;
    h.m.dispatch(ps, 'onRoundStart', { round: 5 });
    assert.equal(ps.counters['band:yela:cleanRounds'] || 0, 0, 'round four is before counting begins');
    assert.equal(owned(ps).length, 2, 'round five grants the initial card');

    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 1 });
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 6;
    h.m.dispatch(ps, 'onRoundStart', { round: 6 });
    assert.equal(ps.counters['band:yela:cleanRounds'] || 0, 0, 'one LP loss invalidates the whole round');
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 7;
    h.m.dispatch(ps, 'onRoundStart', { round: 7 });
    assert.equal(ps.counters['band:yela:cleanRounds'], 1);
    assert.equal(owned(ps).length, 2);
    h.m.dispatch(ps, 'onRoundStart', { round: 7 });
    assert.equal(owned(ps).length, 2, 'same rest period never grants twice');

    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 8;
    h.m.dispatch(ps, 'onRoundStart', { round: 8 });
    assert.equal(ps.counters['band:yela:cleanRounds'], 2, 'lossless rounds need not be consecutive');
    assert.equal(owned(ps).length, 3);
    assert.ok(owned(ps).slice(1).every((p) => DATA.chess[p.id].bonds.includes('kjeragShip')));
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 9;
    h.m.dispatch(ps, 'onRoundStart', { round: 9 });
    assert.equal(ps.counters['band:yela:cleanRounds'], 3);
    assert.equal(owned(ps).length, 3, 'odd cumulative counts do not grant a card');
    h.m.dispatch(ps, 'onBattleResult', { lpLoss: 0 });
    h.m.round = 10;
    h.m.dispatch(ps, 'onRoundStart', { round: 10 });
    assert.equal(ps.counters['band:yela:cleanRounds'], 4);
    assert.equal(owned(ps).length, 4, 'fourth cumulative lossless round grants another card');
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
