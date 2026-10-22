import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, DATA, give, chessOfTier, legalTileFor } from './harness.js';
import { GameData } from '../../server/match/gamedata.js';
import { bossPoolHp } from '../../server/match/finalAssault.js';
import { buildUniteWave } from '../../server/match/waves.js';
import { uniteTimeLimit } from '../../server/match/match/unitePhase.js';
import { Battle } from '../../server/sim/Battle.js';
import { extendedUniteStage, EXTENDED_UNITE_RECT } from '../../shared/extendedUnite.js';
import { makeBattle, chessRec, enemyRec } from '../helpers/battleHarness.js';
import { Room } from '../../server/lobby.js';
import { generateDraft, cardView, shopDraftCards } from '../../server/match/choices.js';
import { createRng } from '../../server/sim/rng.js';
import { validateC2S } from '../../shared/protocol.js';
import { normalizeSp } from '../../public/js/ui/gameLogic/draft.js';

test('large alliances receive twelve selectable cards at every existing special round', () => {
  const schedules = { FUNNY: [3, 9], NORMAL: [3, 6, 9], HARD: [3, 9, 11], ABYSS: [3, 9, 11] };
  for (const [difficulty, rounds] of Object.entries(schedules)) {
    const modeId = `mode_multi_${difficulty.toLowerCase()}`;
    const normal = new GameData(DATA, modeId);
    const extended = new GameData(DATA, modeId, { extendedSeats: 8 });
    for (const round of rounds) {
      const options = { stageId: 'act2autochess_m01', bondAvailable: () => true, itemAvailable: () => true };
      const original = generateDraft(normal, createRng(round + 40), round, options);
      const draft = generateDraft(extended, createRng(round + 40), round, options);
      assert.equal(original.cards.length, 6, `${difficulty} round ${round} retains six original choices`);
      assert.equal(draft.cards.length, 12, `${difficulty} round ${round} has twelve choices`);
      assert.deepEqual(draft.cards.map((c) => c.idx), Array.from({ length: 12 }, (_, i) => i));
      const client = normalizeSp({ extended: true, family: draft.family, cards: draft.cards.map(cardView),
        order: ['p1'], turn: 'p1', picks: {} }, [{ playerId: 'p1' }]);
      assert.equal(client.cards.length, 12);
      assert.equal(client.cards[11].idx, 11);
    }
  }
  const shop = shopDraftCards(new GameData(DATA, 'mode_multi_hard', { extendedSeats: 8 }), createRng(3), 12, 11);
  assert.equal(shop.length, 12, 'the six-slot secret shop distribution can fill twelve cards');
  assert.equal(validateC2S({ t: 'g.choice', idx: 11 }), null);
  assert.notEqual(validateC2S({ t: 'g.choice', idx: 12 }), null);
});

test('extended rooms scale shared and DIY operator copies from the original four-player stock', () => {
  const original = new GameData(DATA, 'mode_multi_normal');
  const five = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  const eight = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 8 });
  const ordinary = original.visibleChess[0];
  for (const id of [ordinary, 'chess_char_5_diy1_a', 'chess_char_6_diy1_a']) {
    assert.equal(five.poolCopies(id), Math.round(original.poolCopies(id) * 1.4));
    assert.equal(eight.poolCopies(id), Math.round(original.poolCopies(id) * 1.8));
  }
  assert.equal(original.unite.maxHelpers, 2);
  assert.equal(five.unite.maxHelpers, 3);
});

test('boss HP counts up to eight living seats in the separate mode', () => {
  const original = new GameData(DATA, 'mode_multi_normal');
  const eight = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 8 });
  const bossId = Object.keys(DATA.bosses)[0];
  assert.equal(bossPoolHp(eight, bossId, 8), bossPoolHp(original, bossId, 4) * 2);
  assert.equal(bossPoolHp(eight, bossId, 5), Math.round(bossPoolHp(original, bossId, 4) * 1.25));
});

test('three defenders get a third stage section, entry route and extended time', () => {
  const gd = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  const normal = DATA.stages.act1autochess_m01;
  const stage = extendedUniteStage(normal);
  assert.equal(normal.rows[9].length, 21);
  assert.equal(stage.rows[9].length, 29);
  assert.equal(stage.rows[9].slice(19, 27), normal.rows[9].slice(11, 19));
  assert.equal(stage.devices.filter((d) => d.pos?.[1] >= 21).length > 0, true);
  const enemyKey = Object.keys(DATA.enemies)[0];
  const wave = buildUniteWave(gd, [{ enemyKey, sourcePlayerId: 'p1' }], 3, 100);
  assert.equal(wave.routes[0].start[1], 26);
  assert.equal(wave.routes[0].end[1], 2);
  const battle = new Battle({ kind: 'unite', stageId: normal.id, data: DATA, rect: EXTENDED_UNITE_RECT,
    flags: { extendedUnite: true, uniteAntiStall: true }, routes: wave.routes, spawns: wave.spawns, players: [], content: 'none' });
  assert.equal(battle.rect.c1, 28);
  assert.equal(battle.grid.tile(9, 26).pass, battle.grid.tile(9, 18).pass);
  assert.ok(battle.stage.devices.some((device) => device.col >= 21 && device.raw?.alias?.endsWith(':third')));
  assert.ok(battle.stage.raw.mapChars.some((entry) => entry.pos?.[1] === 18 && entry.alias.endsWith(':third')));
  assert.equal(uniteTimeLimit({ mode: 'coop8', wave: { timeLimit: 100 } }, { helpers: [{}, {}] }), 130);
  assert.equal(uniteTimeLimit({ mode: 'coop8', wave: { timeLimit: 100 } }, { helpers: [{}, {}, {}] }), 175);
  assert.equal(uniteTimeLimit({ mode: 'coop', wave: { timeLimit: 100 } }, { helpers: [{}, {}] }), 100);
});

test('every available normal battlefield can be extended without changing its source record', () => {
  const stages = Object.values(DATA.stages).filter((stage) => /autochess_m\d+$/.test(stage.id));
  assert.ok(stages.length >= 8);
  const gd = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  const wave = buildUniteWave(gd, [], 3, 100);
  for (const original of stages) {
    const stage = extendedUniteStage(original);
    assert.ok(stage.rows.every((row) => row.length === 29), original.id);
    assert.ok(original.rows.every((row) => row.length === 21), `${original.id} source remains intact`);
    assert.equal(stage.rows[9].slice(19, 27), original.rows[9].slice(11, 19), original.id);
    const battle = new Battle({ kind: 'unite', stageId: original.id, data: DATA, rect: EXTENDED_UNITE_RECT,
      flags: { extendedUnite: true }, routes: wave.routes, players: [], content: 'none' });
    for (const route of wave.routes.filter((entry) => entry.motion === 'WALK')) {
      const points = [route.start, ...(route.checkpoints || []), route.end];
      for (let i = 1; i < points.length; i++) assert.ok(battle.grid.waypoints(...points[i - 1], ...points[i]),
        `${original.id}: route ${i} connects ${points[i - 1]} to ${points[i]}`);
    }
  }
});

test('five players can occupy a match without changing four-player room data', () => {
  assert.equal(new Room('AAAA', 'coop8', 'FUNNY', 0).seats.length, 8);
  assert.equal(new Room('BBBB', 'coop', 'FUNNY', 0).seats.length, 4);
  const h = makeMatch({ mode: 'coop8', humans: 5, fake: true });
  assert.equal(h.m.players.size, 5);
  assert.equal(h.m.gd.extendedSeats, 5);
  h.m.dispose();
});

test('three helper boards and their devices enter the same extended 联防 battle', () => {
  const h = makeMatch({ mode: 'coop8', humans: 5, fake: true }).start();
  h.toPrep(1);
  h.setStage('act1autochess_m01');
  const m = h.m;
  const id = chessOfTier(1, (c) => c.position === 'RANGED').find((x) => m.pool.has(x));
  assert.ok(id);
  const helpers = [1, 2, 3].map((i) => h.ps(`p_${i}`));
  const pieces = helpers.map((ps) => give(m, ps, id, 'board', legalTileFor(m, ps, id)));
  const plan = { helpers, leakers: [h.ps('p_0')], leaked: [{ enemyKey: 'enemy_1007_slime', sourcePlayerId: 'p_0' }], notReentered: new Map() };
  const opts = m._uniteOpts(plan, 90);
  assert.deepEqual(opts.players.map((p) => p.colOffset), [16, 8, 0]);
  const battle = new Battle({ ...opts, data: m.ds, autoFinish: false, content: 'none', logger: { warn() {}, error() {}, info() {} } });
  battle.step();
  helpers.forEach((ps, i) => {
    const [row, col] = [...ps.board.entries()].find(([, piece]) => piece === pieces[i])[0].split(',').map(Number);
    const unit = battle.allyUnits.find((u) => u.uid === pieces[i].uid && u.ownerId === ps.playerId);
    assert.deepEqual([unit.tileR, unit.tileC], [row, col + opts.players[i].colOffset]);
  });
  assert.ok(battle.allyUnits.some((u) => u.kind === 'device' && u.tileC >= 21), 'third section devices are active');
  assert.ok(battle.grid.waypoints(9, 26, 9, 2)?.length > 1, 'enemy can reach the common goal');
  assert.equal(battle.errors.length, 0);
  m.dispose();
});

test('a blocked enemy with no incoming damage is released for four seconds in extended 联防', () => {
  const h = makeBattle({
    kind: 'unite', flags: { uniteAntiStall: true }, content: 'none', autoFinish: false, timeLimit: 60,
    defs: { chess: { guard: chessRec({ id: 'guard', stats: { atk: 0, blockCnt: 3 } }) },
      enemies: { stuck: enemyRec({ key: 'stuck', hp: 1000000, speed: 0, atk: 0 }) } },
    units: [{ chessId: 'guard', row: 9, col: 5 }],
  });
  h.step();
  const enemy = h.spawn('stuck', { pos: [9, 5] });
  h.step();
  assert.ok(enemy.blockedBy, 'enemy is initially blocked');
  h.b.addBuff(enemy, { key: 'test:stealth', persist: true, flags: { stealth: true } });
  h.run(20.1);
  assert.equal(enemy.blockedBy, null);
  assert.ok(enemy._uniteUnblockUntil - h.b.time > 3.8);
  assert.equal(enemy.s.flags.reveal, true, 'stealth is suppressed for five seconds');
  h.run(3.5);
  assert.equal(enemy.blockedBy, null, 'cannot be blocked during the four-second window');
  h.run(0.6);
  assert.ok(enemy.blockedBy, 'can be blocked again after the window');
});
