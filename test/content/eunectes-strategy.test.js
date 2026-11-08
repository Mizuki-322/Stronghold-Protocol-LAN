import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { Battle } from '../../server/sim/Battle.js';
import { COLS } from '../../server/sim/constants.js';
import { makeMatch, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';
import { eunectesRangeTiles } from '../../shared/eunectesRange.js';

test('森蚺 turret points its widened shape into the combat field when map data points outward', () => {
  const tiles = eunectesRangeTiles(8, 9, [[8, 9], [7, 9], [6, 9]], {
    inBounds: (r, c) => r >= 0 && r < 19 && c >= 0 && c < 21,
    inField: (r, c) => r >= 9 && r <= 12 && c >= 0 && c <= 10,
  });
  assert.equal(tiles.length, 21);
  assert.ok(tiles.some(([r, c]) => r === 12 && c === 9));
  assert.ok(!tiles.some(([r]) => r < 8));
});

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

test('森蚺 turret widens its range, attacks leaders first and splashes physical damage', () => {
  const hits = [];
  const h = makeBattle({
    stageId: 'act2autochess_m01', flags: { eunectesTurrets: true }, autoFinish: false, timeLimit: 20,
    players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: {
      a: { active: true, layers: 30 }, b: { active: true, layers: 25 },
      excluded: { active: false, layers: 200 },
    } }],
    defs: { enemies: {
      leader: enemyRec({ key: 'leader', rank: 'BOSS', hp: 100000, speed: 0, def: 0, res: 0 }),
      weak: enemyRec({ key: 'weak', hp: 10000, speed: 0, def: 0, res: 0 }),
      other: enemyRec({ key: 'other', hp: 20000, speed: 0, def: 0, res: 0 }),
    } },
    setup: (b) => b.on('damaged', (e) => { if (e.source?.kind === 'device') hits.push(e); }),
  });
  h.step();
  const turret = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
  assert.ok(turret?.alive);
  assert.deepEqual([turret.tileR, turret.tileC], [8, 9], 'the turret stands on the authored tile below the combat rect');
  assert.deepEqual(new Set(turret.mem.turret.keys), new Set(
    Array.from({ length: 5 }, (_, dr) => Array.from({ length: dr < 3 ? 5 : 3 }, (_, dc) => (8 + dr) * COLS + (dr < 3 ? 7 : 8) + dc)).flat()
  ), 'the three rows nearest the turret each gain one tile on both sides');
  assert.equal(turret.base.atk, 500);
  assert.equal(turret.ownerId, 'p1');
  const leader = h.spawn('leader', { pos: [10, 9] });
  const weak = h.spawn('weak', { pos: [11, 9] });
  const other = h.spawn('other', { pos: [10, 10] });
  assert.ok(h.runUntil(() => hits.length >= 3, 8));
  assert.equal(hits[0].target.id, leader.id, 'leader is the opening target despite its higher HP');
  assert.deepEqual(new Set(hits.slice(0, 3).map((e) => e.target.id)), new Set([leader.id, weak.id, other.id]));
  for (const hit of hits.slice(0, 3)) assert.equal(hit.amount, 500);
  assert.equal(turret.s.aspd, 105, '55 active layers leave five effective layers');
  assert.equal(h.eventsOf('atk').filter((e) => e[3] === 'chain').length, 0);
  for (const target of [leader, weak, other]) assert.ok(target.findBuff('fragile'), 'every splash hit applies fragile');
  assert.deepEqual(h.b.errors, []);
});

test('森蚺 turret prioritizes the highest current HP without a leader', () => {
  const h = makeBattle({ stageId: 'act2autochess_m01', flags: { eunectesTurrets: true }, autoFinish: false,
    players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: {} }],
    defs: { enemies: { weak: enemyRec({ key: 'weak', hp: 1000, speed: 0 }), strong: enemyRec({ key: 'strong', hp: 2000, speed: 0 }) } } });
  h.step();
  const t = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
  const weak = h.spawn('weak', { pos: [10, 8] });
  const strong = h.spawn('strong', { pos: [10, 10] });
  assert.ok(h.runUntil(() => t.stats.attacks > 0, 8));
  assert.equal(h.eventsOf('atk').find((e) => e[1] === t.id)?.[2], strong.id);
  assert.notEqual(weak.id, strong.id);
});

test('森蚺 turret cuts both defenses every 30 effective layers and fires twice at 350 total', () => {
  const hits = [];
  const h = makeBattle({ stageId: 'act2autochess_m01', flags: { eunectesTurrets: true }, autoFinish: false,
    players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: { a: { active: true, layers: 350 } } }],
    defs: { enemies: {
      high: enemyRec({ key: 'high', hp: 100000, def: 1000, res: 50, speed: 0 }),
      low: enemyRec({ key: 'low', hp: 10000, def: 1000, res: 50, speed: 0 }),
    } }, setup: (b) => b.on('damaged', (e) => { if (e.source?.kind === 'device') hits.push(e); }) });
  h.step();
  const t = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
  const high = h.spawn('high', { pos: [10, 8] });
  const low = h.spawn('low', { pos: [10, 10] });
  assert.ok(h.runUntil(() => t.stats.attacks > 0, 8));
  const shots = h.eventsOf('atk').filter((e) => e[1] === t.id);
  assert.deepEqual(shots.slice(0, 2).map((e) => e[2]), [high.id, low.id]);
  assert.ok(h.runUntil(() => hits.length >= 2, 8));
  for (const e of [high, low]) {
    const cut = e.findBuff('eunectes:dualResistDown');
    assert.equal(cut?.mods.defMul, 0.8);
    assert.equal(cut?.mods.resMul, 0.8);
    assert.ok(cut.timeLeft <= 2 && cut.timeLeft > 0);
    assert.ok(e.findBuff('fragile'));
  }
  assert.deepEqual(h.b.errors, []);
});

test('森蚺 turret gains its first 2% dual-defense cut at 80 total layers', () => {
  for (const [layers, expected] of [[79, null], [80, 0.98]]) {
    const h = makeBattle({ stageId: 'act2autochess_m01', flags: { eunectesTurrets: true }, autoFinish: false,
      players: [{ playerId: 'p1', seat: 0, side: 'L', colOffset: 0, units: [], bonds: { a: { active: true, layers } } }],
      defs: { enemies: { test: enemyRec({ key: 'test', hp: 100000, speed: 0 }) } } });
    h.step();
    const t = h.b.allyUnits.find((u) => u.defId === 'trap_1104_aclasert');
    const e = h.spawn('test', { pos: [10, 9] });
    assert.ok(h.runUntil(() => t.stats.attacks > 0, 8));
    h.run(1); // projectile impact follows the attack event
    const cut = e.findBuff('eunectes:dualResistDown');
    assert.equal(cut?.mods.defMul ?? null, expected, `${layers} total layers`);
    assert.equal(cut?.mods.resMul ?? null, expected, `${layers} total layers`);
  }
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
  assert.equal(e.findBuff('eunectes:dualResistDown'), null);
});
