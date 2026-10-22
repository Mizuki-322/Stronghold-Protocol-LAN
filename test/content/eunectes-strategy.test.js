import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { Battle } from '../../server/sim/Battle.js';
import { COLS } from '../../server/sim/constants.js';
import { makeMatch, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';

test('森蚺 is an extended-only strategy and gives every alliance field a turret', () => {
  const ordinary = new GameData(DATA, 'mode_multi_normal');
  const extended = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  assert.equal(ordinary.bandAllowed('band_eunectes'), false);
  assert.equal(extended.bandAllowed('band_eunectes'), true);
  assert.equal(extended.startLp('band_eunectes'), 33);

  const h = makeMatch({ mode: 'coop8', humans: 5, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_eunectes' });
    h.setStage('act2autochess_m01');
    assert.equal(h.m.teamTurretGranted(), true);
    for (const ps of h.m.order) {
      const opts = h.m._normalOpts(ps);
      assert.equal(opts.flags.eunectesTurrets, true);
      assert.equal(opts.players[0].deviceOverrides['trap_1104_aclasert#1'], true);
      assert.equal(h.m.effectiveDeviceOverrides(ps)['trap_1104_aclasert#1:third'], true);
    }
    const helpers = [1, 2, 3].map((i) => h.ps(`p_${i}`));
    const opts = h.m._uniteOpts({ helpers, leakers: [h.ps('p_0')], leaked: [], notReentered: new Map() }, 90);
    assert.equal(opts.flags.eunectesTurrets, true);
    const battle = new Battle({ ...opts, data: h.m.ds, autoFinish: false, content: 'full',
      logger: { warn() {}, error() {}, info() {} } });
    battle.step();
    assert.equal(battle.allyUnits.filter((u) => u.defId === 'trap_1104_aclasert').length, 3,
      'each of the three defending sections has its own turret');
  } finally { h.m.dispose(); }
});

test('森蚺 turret uses active total layers beyond 50, attacks leaders first and chains twice', () => {
  const hits = [];
  const h = makeBattle({
    stageId: 'act2autochess_m01', flags: { eunectesTurrets: true }, autoFinish: false, timeLimit: 20,
    players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: {
      a: { active: true, layers: 30 }, b: { active: true, layers: 25 },
      excluded: { active: false, layers: 200 },
    } }],
    defs: { enemies: {
      leader: enemyRec({ key: 'leader', rank: 'BOSS', hp: 100000, speed: 0, res: 0 }),
      weak: enemyRec({ key: 'weak', hp: 10000, speed: 0, res: 0 }),
      other: enemyRec({ key: 'other', hp: 20000, speed: 0, res: 0 }),
    } },
    setup: (b) => b.on('damaged', (e) => { if (e.source?.kind === 'device') hits.push(e); }),
  });
  h.step();
  const turret = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
  assert.ok(turret?.alive);
  assert.deepEqual([turret.tileR, turret.tileC], [8, 9], 'the turret stands on the authored tile below the combat rect');
  assert.deepEqual(new Set(turret.mem.turret.keys), new Set(
    Array.from({ length: 5 }, (_, dr) => Array.from({ length: 3 }, (_, dc) => (8 + dr) * COLS + 8 + dc)).flat()
  ), 'the complete 3×5 range includes the turret row');
  assert.equal(turret.base.atk, 1000);
  assert.equal(turret.ownerId, 'p1');
  const leader = h.spawn('leader', { pos: [10, 8] });
  const weak = h.spawn('weak', { pos: [10, 9] });
  const other = h.spawn('other', { pos: [10, 10] });
  assert.ok(h.runUntil(() => hits.length >= 3, 8));
  assert.equal(hits[0].target.id, leader.id, 'leader is the opening target despite its higher HP');
  assert.deepEqual(new Set(hits.slice(0, 3).map((e) => e.target.id)), new Set([leader.id, weak.id, other.id]));
  for (const [i, expected] of [1000, 850, 722.5].entries()) {
    assert.ok(Math.abs(hits[i].amount - expected) < 1e-9, `bounce ${i} damage`);
  }
  assert.equal(turret.s.aspd, 105, '55 active layers leave five effective layers');
  assert.ok(h.eventsOf('atk').filter((e) => e[3] === 'chain').length >= 2);
  for (const target of [leader, weak, other]) assert.ok(target.findBuff('fragile'), 'every chain hit applies fragile');
  assert.deepEqual(h.b.errors, []);
});

test('森蚺 turret has no extra attack speed or fragile in its first 50 active layers', () => {
  const h = makeBattle({ stageId: 'act2autochess_m01', flags: { eunectesTurrets: true },
    players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: { a: { active: true, layers: 50 } } }],
    defs: { enemies: { test: enemyRec({ key: 'test', hp: 100000, speed: 0 }) } },
    autoFinish: false, timeLimit: 10 });
  h.step();
  const t = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
  const e = h.spawn('test', { pos: [10, 9] });
  assert.ok(h.runUntil(() => t.stats.attacks > 0, 8));
  assert.equal(t.s.aspd, 100);
  assert.equal(e.findBuff('fragile'), null);
});
