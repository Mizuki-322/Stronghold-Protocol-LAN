import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { makeMatch, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';

const CASTER = 'chess_char_1_22_a';
const DEFENDER = 'chess_char_1_23_a';
const held = (ps) => [...ps.board.values(), ...ps.hand, ...ps.temp].filter((p) => p?.kind === 'chess');

test('巡海小队 is exclusive to large alliances and grants its three members on rounds 3, 5 and 7', () => {
  assert.equal(new GameData(DATA, 'mode_multi_normal').bandAllowed('band_udflow'), false);
  const gd = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  assert.equal(gd.bandAllowed('band_udflow'), true);
  assert.equal(gd.startLp('band_udflow'), 24);
  assert.equal(gd.visibleChess.includes(CASTER), false);
  assert.equal(gd.visibleChess.includes(DEFENDER), false);

  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_udflow' });
    const ps = h.ps('p_0');
    assert.equal(ps.lp, 24);
    assert.equal(h.m.pool.has(CASTER), false);
    assert.equal(h.m.pool.has(DEFENDER), false);
    for (const [round, id] of [[3, 'chess_char_1_04_a'], [5, CASTER], [7, DEFENDER]]) {
      h.m.round = round;
      const before = held(ps).map((p) => p.uid);
      h.m.dispatch(ps, 'onRoundStart', { round });
      assert.deepEqual(held(ps).filter((p) => !before.includes(p.uid)).map((p) => p.id), [id]);
    }
    const caster = held(ps).find((p) => p.id === CASTER);
    assert.equal(ps.promote(caster), true);
    assert.equal(caster.id, 'chess_char_1_22_b');
    assert.deepEqual([ps.gd.chess(caster.id).status.phase, ps.gd.chess(caster.id).status.level], [2, 50]);
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});

test('巡海小队 reserve forms have the requested stats, level, class, bonds and no skills or talents', () => {
  const specs = [
    [CASTER, 'char_604_ccast', ['egirShip', 'arcaneShip'], [1111, 457, 96, 15, 18, 1.6, 1], [1322, 535, 107, 20, 18, 1.6, 1]],
    [DEFENDER, 'char_602_cdfend', ['egirShip', 'steadShip'], [2083, 271, 399, 0, 18, 1.2, 3], [2776, 311, 515, 0, 20, 1.2, 3]],
  ];
  for (const [base, charId, bonds, normal, elite] of specs) {
    for (const [id, expected, phase, level, mul] of [[base, normal, 1, 55, 1.5], [base.replace(/_a$/, '_b'), elite, 2, 50, 2]]) {
      const c = DATA.chess[id];
      assert.ok(c && !c.visible && c.tier === 1);
      assert.equal(c.charId, charId);
      assert.equal(c.assets.portrait, `${charId}_1`);
      assert.deepEqual(c.bonds, bonds);
      assert.deepEqual([c.stats.maxHp, c.stats.atk, c.stats.def, c.stats.res, c.stats.cost, c.stats.bat, c.stats.blockCnt], expected);
      assert.equal(c.stats.respawnTime, 70);
      assert.deepEqual([c.status.phase, c.status.level], [phase, level]);
      assert.equal(c.skill, null);
      assert.deepEqual(c.skills, []);
      assert.deepEqual(c.talents, []);
      assert.equal(c.module, null);
      const trait = DATA.garrisons[c.garrisonIds[0]];
      assert.equal(trait.bb.atk, mul);
      assert.equal(trait.bbStr.check_tag, 'seamonster');
    }
  }
});

test('见习海巡队 attacks sea monsters with 深巡’s form-matched battle trait', () => {
  for (const id of [CASTER, CASTER.replace(/_a$/, '_b'), DEFENDER, DEFENDER.replace(/_a$/, '_b')]) {
    const h = makeBattle({ units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false,
      defs: { enemies: { sea: { ...enemyRec({ key: 'sea', hp: 100000, speed: 0, def: 0, res: 0 }), tags: ['seamonster'] } } } });
    h.step();
    const unit = h.unit(id);
    const sea = h.spawn('sea', { pos: [10, 6] });
    const damage = unit.def.dmgType;
    const before = sea.hp;
    h.b.dealDamage(unit, sea, { amount: 100, type: damage, isAttack: true });
    assert.equal(before - sea.hp, id.endsWith('_a') ? 150 : 200, id);
    assert.equal(unit.skill?.noSkill, true);
    assert.deepEqual(h.b.errors, []);
  }
});
