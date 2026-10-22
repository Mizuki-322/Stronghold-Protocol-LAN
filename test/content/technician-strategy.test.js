import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameData } from '../../server/match/gamedata.js';
import { makeMatch, give, giveItem, DATA } from '../match/harness.js';
import { makeBattle, enemyRec } from '../helpers/battleHarness.js';

const BASE = 'chess_char_1_21_a';
const ELITE = 'chess_char_1_21_b';

test('技术传承 is offered only in 5–8 player rooms; its opening unit remains outside the shared pool', () => {
  const ordinary = new GameData(DATA, 'mode_multi_normal');
  const extended = new GameData(DATA, 'mode_multi_normal', { extendedSeats: 5 });
  assert.equal(ordinary.bandAllowed('band_technician'), false);
  assert.equal(extended.bandAllowed('band_technician'), true);
  assert.equal(new GameData(DATA, 'mode_single_normal').bandAllowed('band_technician'), false);
  assert.ok(!extended.visibleChess.includes(BASE));
  assert.equal(extended.startLp('band_technician'), 28);

  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_technician' });
    const ps = h.ps('p_0');
    const piece = [...ps.hand, ...ps.temp, ...ps.board.values()].find((p) => p?.id === BASE);
    assert.ok(piece, 'round one grants the special defender');
    assert.equal(ps.lp, 28);
    assert.deepEqual(DATA.chess[BASE].bonds, ['steadShip', 'arcaneShip', 'deputShip']);
    assert.equal(DATA.chess[BASE].status.phase, 2);
    assert.equal(DATA.chess[BASE].status.level, 1);
    assert.equal(ps.promote(piece), true, '博士投影 path upgrades the hidden unit');
    assert.equal(piece.id, ELITE);
    assert.equal(DATA.chess[ELITE].status.level, 60);
  } finally { h.m.dispose(); }
});

test('three bond layer totals are combined before each five-layer defence step', () => {
  for (const [id, step] of [[BASE, 0.01], [ELITE, 0.02]]) {
    const garrisonId = DATA.chess[id].garrisonIds[0];
    const garrison = DATA.garrisons[garrisonId];
    assert.equal(garrison.eventTypeDesc, '作战能力');
    assert.equal(garrison.desc, `<战斗中>【坚守】【奥术】【助力】每叠加5层，本干员防御力+${step * 100}%`);
    assert.equal(garrison.bbStr.bond_id, 'steadShip,arcaneShip,deputShip');
    const h = makeBattle({ units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false,
      bonds: { steadShip: { layers: 2, active: true }, arcaneShip: { layers: 2, active: true },
        deputShip: { layers: 1, active: true } } });
    h.step(4);
    const unit = h.unit(id);
    assert.equal(unit.findBuff(`gar:${garrisonId}`)?.mods.defPct, step);
    assert.equal(unit.s.res, 25, 'self RES includes the +10 talent');
    assert.equal(unit.skill.duration, 25);
    assert.equal(unit.skill.activate('test', { free: true }), true);
    assert.ok(Math.abs(unit.s.artsTakenMul - (1 - (id === ELITE ? 0.18 : 0.12))) < 1e-9);
    assert.deepEqual(h.b.errors, []);
  }
});

test('the promoted defender module adds one Arts hit without recursively triggering itself', () => {
  const h = makeBattle({ units: [{ chessId: ELITE, row: 10, col: 5 }], autoFinish: false, captureNoisy: true,
    defs: { enemies: { technician_dummy: enemyRec({ key: 'technician_dummy', hp: 100000, speed: 0, def: 0, res: 0 }) } } });
  h.step();
  const unit = h.unit(ELITE);
  const foe = h.spawn('technician_dummy', { pos: [10, 6] });
  h.b.dealDamage(unit, foe, { amount: 100, type: 'phys', isAttack: true });
  const hits = h.hooksOf('damaged').filter((c) => c.source === unit && c.target === foe);
  assert.equal(hits.length, 2);
  assert.ok(hits.some((c) => Math.abs(c.amount - unit.s.atk * 0.1) < 1e-9));
  assert.deepEqual(h.b.errors, []);
});

test('the eight surrounding tiles receive the talent RES bonus', () => {
  const h = makeBattle({ units: [{ chessId: BASE, row: 10, col: 5 },
    { chessId: 'chess_char_1_01_a', row: 10, col: 6 }], autoFinish: false });
  h.step(4);
  assert.equal(h.unit('chess_char_1_01_a').s.res, 5);
  assert.deepEqual(h.b.errors, []);
});

test('拟态物质 does not create a third copy of the hidden strategy defender', () => {
  const h = makeMatch({ mode: 'coop8', humans: 1, bots: 4, fake: true }).start();
  try {
    h.toPrep(1, { band: 'band_technician' });
    const ps = h.ps('p_0');
    const first = [...ps.hand, ...ps.temp].find((piece) => piece?.id === BASE);
    assert.ok(first);
    give(h.m, ps, BASE);
    const item = giveItem(h.m, ps, 'chess_item_5_05_e_a');
    assert.deepEqual(h.m.handle(ps.playerId, { t: 'g.equip', itemUid: item.uid, targetUid: first.uid }), { ok: true });
    const own = [...ps.hand, ...ps.temp, ...ps.board.values()].filter((piece) => piece?.id === BASE);
    assert.equal(own.length, 2);
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});
