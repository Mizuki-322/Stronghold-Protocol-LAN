import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from '../helpers/battleHarness.js';
import { makeMatch, DATA } from '../match/harness.js';
import { legalTiles, tileKey } from '../../server/match/board.js';
import { COLS } from '../../server/sim/constants.js';
import { buildBattleSpec } from '../../server/sim/spec.js';
import { SHU_HEAL_THRESHOLD, shuStackable } from '../../shared/shuStrategy.js';

const fieldInput = { kind: 'token', tokenId: 'token_shu_field', row: 10, col: 5, uid: 101 };
const state = (hpRatio = 0.4, progress = 0) =>
  [{ id: 'shu:state', key: 'shu:state', params: { hpRatio, progress } }];
const active = (id) => ({ [id]: { active: true, count: 3, tier: 1, layers: 0 } });

test('黍 second healing target excludes specified and nonstacking bonds', () => {
  for (const id of ['visiShip', 'miraShip', 'investShip', 'soloShip', 'suntShip', 'emptyShip', 'maniShip']) {
    assert.equal(shuStackable(DATA.bonds[id]), false, `${DATA.bonds[id].name} must be excluded`);
  }
  assert.equal(shuStackable(DATA.bonds.sargonShip), true);
});

test('黍 field: difficulty HP, chosen position, minimum 1 HP, effective healing layers and node changes', () => {
  const h = makeBattle({ bandId: 'band_shu', modeId: 'mode_multi_normal', round: 1,
    units: [fieldInput, { chessId: 'chess_char_1_15_a', row: 10, col: 6 }],
    bonds: active('deputShip'), playerEffects: state(), timeLimit: 5 });
  h.step(1);
  const field = h.unit('token_shu_field');
  const op = h.unit('chess_char_1_15_a');
  assert.equal(field.s.maxHp, 4000);
  assert.equal(field.s.taunt, -1);
  assert.ok(Math.abs(field.hp - (1600 - (0.04 * 4000 + 0.06 * 1600) * h.TICK)) < 1e-6,
    'each tick loses 4% maximum HP plus 6% current HP per second');
  assert.equal(DATA.bands.band_shu.buffs[0].bb.max_hp_loss, 0.04);
  assert.equal(op.s.aspd, op.base.aspd + 10);
  h.b.addBuff(field, { key: 'test:hp', mods: { hpPct: 1 } });
  assert.equal(field.s.maxHp, 4000);
  const before = field.hp;
  assert.equal(h.b.heal(null, field, 10000), 4000 - before);
  assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 0, 'healing below 100% does not grant a layer');
  assert.equal(h.b.dealDamage(null, field, { amount: 1000, type: 'true', canDodge: false }), 1000);
  assert.equal(h.b.heal(null, field, 10000), 1000);
  assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 0);
  h.b.dealDamage(null, field, { amount: 1000, type: 'true', canDodge: false });
  h.b.heal(null, field, 1000);
  assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 1, 'only effective healing contributes progress');
  assert.equal(op.s.aspd, op.base.aspd + 30);
  assert.equal(h.b.applyStatus(op, 'stun', { duration: 2 }), true, '90% HP no longer grants negative status immunity');
  h.b.dealDamage(null, field, { amount: 1e8, type: 'true', canDodge: false });
  assert.equal(field.hp, 1);
  assert.equal(field.alive, true);
  assert.equal(op.s.aspd, op.base.aspd);
  h.runToEnd();
  assert.ok(h.result().perPlayer.p1.shuProgress > 0);
  assert.deepEqual(h.b.errors, []);
});

test('黍 field replaces only its own 1.2 HP factors with 1.1, independent of 坚守 layers', () => {
  const cases = [
    ['mode_multi_funny', 1, 0.8, 4000], ['mode_multi_funny', 12, 0.96, 4400],
    ['mode_multi_normal', 2, 0.96, 4400], ['mode_multi_normal', 4, 1.152, 4840],
    ['mode_multi_normal', 8, 1.3824, 5324], ['mode_multi_normal', 14, 2.866545, 7795],
    ['mode_multi_hard', 1, 1.2, 5500], ['mode_multi_hard', 14, 4.299817, 10718],
    ['mode_multi_abyss', 6, 2.239488, 7906], ['mode_multi_abyss', 7, 3.583181, 9744],
    ['mode_multi_abyss', 14, 6.687075, 14006],
  ];
  for (const [modeId, round, hpMul, expectedHp] of cases) {
    const h = makeBattle({ bandId: 'band_shu', modeId, round,
      flags: { enemyScale: { hpMul } }, units: [fieldInput],
      bonds: { steadShip: { active: true, count: 3, tier: 1, layers: 100 } },
      playerEffects: state(), timeLimit: 1 });
    h.step(1);
    const field = h.unit('token_shu_field');
    assert.equal(field.s.maxHp, expectedHp, `${modeId} round ${round}`);
    h.b.addBuff(field, { key: 'test:stead-hp', mods: { hpPct: 10 } });
    assert.equal(field.s.maxHp, expectedHp, 'stackable HP effects do not change the field');
  }
  const browser = makeBattle({ bandId: 'band_shu', modeId: 'mode_multi_normal', round: 8,
    flags: { enemyScale: { hpMul: 2 } }, units: [fieldInput], playerEffects: state(), timeLimit: 1 });
  browser.step(1);
  assert.equal(browser.unit('token_shu_field').s.maxHp, Math.round(5000 * 2 * (11 / 12) ** 3),
    'the browser uses the BattleSpec multiplier, without loading config.json');
});

test('normal match sends the round HP multiplier in the client BattleSpec', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true, seed: 23 }).start().toPrep(1, { band: 'band_shu' });
  const { m } = h;
  m.round = 8;
  const opts = m._normalOpts(h.ps('p_0'));
  const spec = buildBattleSpec(opts);
  assert.equal(spec.flags.enemyScale.hpMul, m.gd.enemyScale(8).hpMul);
  assert.ok(spec.flags.enemyScale.hpMul > m.gd.enemyScale(1).hpMul);
});

test('黍 field grants layers only after 100% of maximum HP is actually healed', () => {
  const h = makeBattle({ bandId: 'band_shu', modeId: 'mode_multi_normal', round: 1,
    units: [fieldInput], bonds: active('deputShip'), playerEffects: state(), timeLimit: 1 });
  h.step(1);
  const field = h.unit('token_shu_field');
  field.hp = 1;
  assert.equal(h.b.heal(null, field, field.s.maxHp * (SHU_HEAL_THRESHOLD - 0.01)), 3960);
  assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 0);
  field.hp = 1;
  assert.equal(h.b.heal(null, field, field.s.maxHp * 0.01), 40);
  assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 1);
});

test('黍 field in 联防 inherits HP and cannot lose or recover HP', () => {
  const h = makeBattle({ kind: 'unite', bandId: 'band_shu', modeId: 'mode_multi_normal', round: 1,
    units: [{ ...fieldInput, carryState: { hpPct: 0.6 } }, { chessId: 'chess_char_1_15_a', row: 10, col: 6 }],
    playerEffects: state(), timeLimit: 4 });
  h.step(1);
  const field = h.unit('token_shu_field');
  const op = h.unit('chess_char_1_15_a');
  assert.ok(Math.abs(field.hp - 2400) < 1e-6);
  assert.equal(op.s.aspd, op.base.aspd + 15, 'the current HP tier remains active');
  assert.deepEqual(h.b.injuredAlliesInKeys(new Set([field.tileR * COLS + field.tileC]), op), [],
    'healers do not waste attacks on an HP-locked field');
  h.run(2);
  assert.ok(Math.abs(field.hp - 2400) < 1e-6);
  assert.equal(op.s.aspd, op.base.aspd + 15);
  assert.equal(h.b.heal(null, field, 500), 0);
  assert.equal(h.b.dealDamage(null, field, { amount: 1000, type: 'true', canDodge: false }), 0);
  assert.ok(Math.abs(field.hp - 2400) < 1e-6);
  assert.deepEqual(h.b.errors, []);
});

test('黍 field in boss and hidden battles keeps old progress but gains no layers or new progress', () => {
  for (const kind of ['boss', 'hidden']) {
    const effects = state(0.4, 0.25);
    const h = makeBattle({ kind, bandId: 'band_shu', modeId: 'mode_multi_normal', round: 14,
      units: [{ ...fieldInput, row: 2, col: 5 }], bonds: active('deputShip'),
      playerEffects: effects, timeLimit: 2 });
    h.step(1);
    const field = h.unit('token_shu_field');
    assert.ok(field?.deployed, `${kind}: field is deployed`);
    assert.ok(h.b.heal(null, field, 10000) > 0, `${kind}: the field can still be healed`);
    h.runToEnd();
    assert.equal(h.b.getPlayer('p1').bonds.deputShip.layers, 0, `${kind}: no layers`);
    assert.equal(h.result().perPlayer.p1.shuProgress, 0.25, `${kind}: previous progress is unchanged`);
    assert.deepEqual(h.b.errors, []);
  }
});

test('黍 has no round-1 or round-7 choice and grants exactly one 助力 count from round 7', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true, seed: 23 }).start().toPrep(1, { band: 'band_shu' });
  const ps = h.ps('p_0');
  assert.equal(ps.personalChoice, null);
  assert.equal(ps.shu.deputyBonusGranted, false);
  const token = [...ps.hand, ...ps.temp].find((p) => p?.id === 'token_shu_field');
  assert.ok(token);
  const spot = legalTiles(ps.deployMap(), 'all').find(([r, c]) => !ps.board.has(tileKey(r, c)));
  assert.ok(spot);
  assert.equal(ps.move(token.uid, { area: 'board', row: spot[0], col: spot[1] }).ok, true);
  h.invariants();
  ps.startRound(6);
  assert.equal(ps.bondCountBonus.deputShip || 0, 0);
  ps.startRound(7);
  assert.equal(ps.personalChoice, null);
  assert.equal(ps.bondCountBonus.deputShip, 1);
  assert.equal(ps.shu.deputyBonusGranted, true);
  ps.startRound(8);
  assert.equal(ps.bondCountBonus.deputShip, 1, 'the round-7 bonus cannot be repeated');
});

test('黍 healing gives 助力 a layer through round 7 and only the strongest other active bond from round 8', () => {
  const completeHeal = (h, field) => {
    field.hp = 1;
    h.b.heal(null, field, field.s.maxHp);
    field.hp = 1;
    h.b.heal(null, field, 1);
  };
  const bonds = {
    deputShip: { active: true, count: 3, tier: 1, layers: 0 },
    yanShip: { active: true, count: 3, tier: 1, layers: 5 },
    sargonShip: { active: true, count: 3, tier: 1, layers: 10 },
    visiShip: { active: true, count: 3, tier: 1, layers: 100 },
    miraShip: { active: true, count: 3, tier: 1, layers: 101 },
    investShip: { active: true, count: 3, tier: 1, layers: 102 },
    victoriaShip: { active: false, count: 0, tier: 0, layers: 100 },
  };
  const make = (round) => makeBattle({ bandId: 'band_shu', modeId: 'mode_multi_normal', round,
    units: [fieldInput], bonds, playerEffects: state(), timeLimit: 1 });
  const early = make(6);
  early.step(1);
  const earlyField = early.unit('token_shu_field');
  completeHeal(early, earlyField);
  assert.equal(early.b.getPlayer('p1').bonds.deputShip.layers, 1);
  assert.equal(early.b.getPlayer('p1').bonds.sargonShip.layers, 10, 'second target starts in round 7');

  const later = make(7);
  later.step(1);
  const field = later.unit('token_shu_field');
  completeHeal(later, field);
  const live = later.b.getPlayer('p1').bonds;
  assert.equal(live.deputShip.layers, 1);
  assert.equal(live.sargonShip.layers, 11);
  assert.equal(live.victoriaShip.layers, 100, 'inactive bonds never receive the extra layer');
  later.b.addLayers('p1', 'yanShip', 20, 'test');
  completeHeal(later, field);
  assert.equal(live.deputShip.layers, 2);
  assert.equal(live.yanShip.layers, 26, 'the target is recalculated for each completed healing indicator');
  assert.equal(live.sargonShip.layers, 11);

  const after = make(8);
  after.step(1);
  const afterField = after.unit('token_shu_field');
  completeHeal(after, afterField);
  const afterBonds = after.b.getPlayer('p1').bonds;
  assert.equal(afterBonds.deputShip.layers, 0, 'round 8 healing no longer adds 助力 layers');
  assert.equal(afterBonds.sargonShip.layers, 11, 'round 8 healing still adds the strongest other active bond');
});
