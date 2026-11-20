// Per-chess equipment slots (local change, docs/local-lan-2026-10-20.md "Per-chess equipment slots"): a chess record's
// `equipSlots` — official act3autochess `charChessDataDict[*].equipSlotNum`, 2 for every piece but “暴躁铁皮”
// chess_char_5_22_a / _b with 4 / 6 — replaces the mode's equipPerChess for that piece. The pinned season-2 data has no
// such field, so every official piece keeps 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, makeMatch, give, giveItem, checkInvariants } from './harness.js';
import { equipSlotsOf, EQUIP_SLOTS_MAX } from '../../shared/plugins/rules.js';
import { replaceRequest } from '../../public/js/ui/equipReplace.js';
import { equipReplaces } from '../../public/js/ui/gameLogic/placement.js';

const OP = 'chess_char_1_17_a';
const OTHER = 'chess_char_1_02_a';

/** Golden equipment (no auto-merge) that only buffs its carrier (env_* stat buffs: stays equipped, never consumed). */
const KEPT_ITEMS = Object.values(DATA.items)
  .filter((it) => it.itemType === 'EQUIP' && it.isGolden && !it.canGiveBond && (it.buffs || []).length > 0 && it.buffs.every((b) => String(b?.key).startsWith('env_')))
  .map((it) => it.chessId ?? it.id).filter((id) => typeof id === 'string').sort();

function prep(data) {
  const h = makeMatch({ mode: 'solo', difficulty: 'NORMAL', humans: 1, seed: 7, fake: true, data }).start();
  h.toPrep(1);
  const m = h.m, ps = h.ps('p_0');
  for (const p of [...ps.board.values(), ...ps.hand.filter(Boolean)]) if (p.kind === 'chess') ps.returnCopies(p);
  ps.board.clear();
  ps.hand.fill(null);
  ps.temp.fill(null);
  ps.offers.length = 0;
  ps.recompute();
  return { m, ps };
}

const withSlots = (id, n) => ({ ...DATA, chess: { ...DATA.chess, [id]: { ...DATA.chess[id], equipSlots: n } } });

test('equipSlotsOf: the record\'s own 1–6, else the default', () => {
  assert.equal(EQUIP_SLOTS_MAX, 6);
  assert.equal(equipSlotsOf(null, 2), 2);
  assert.equal(equipSlotsOf({}, 2), 2);
  assert.equal(equipSlotsOf({ equipSlots: 4 }, 2), 4);
  assert.equal(equipSlotsOf({ equipSlots: 6 }, 3), 6);
  for (const bad of [0, 7, 2.5, '4', -1, null]) assert.equal(equipSlotsOf({ equipSlots: bad }, 2), 2, String(bad));
});

test('the official data declares no slots: every piece keeps equipPerChess (2)', () => {
  const { m } = prep();
  assert.equal(m.gd.equipPerChess, 2);
  for (const c of Object.values(DATA.chess)) {
    assert.equal(c.equipSlots, undefined, c.chessId);
    assert.equal(m.gd.equipSlotsFor(c.chessId), 2);
  }
  m.dispose();
});

test('a 4-slot piece carries 4 items, a 5th replaces the pick; an ordinary piece still replaces at its 3rd', () => {
  assert.ok(KEPT_ITEMS.length >= 6, `kept items: ${KEPT_ITEMS.length}`);
  const { m, ps } = prep(withSlots(OP, 4));
  assert.equal(m.gd.equipSlotsFor(OP), 4);
  assert.equal(m.gd.equipSlotsFor(OTHER), 2);
  const big = give(m, ps, OP, 'hand');
  const small = give(m, ps, OTHER, 'hand');
  const equip = (target, id, replaceUid = null) => {
    const it = giveItem(m, ps, id, 'hand');
    const res = m.handle('p_0', { t: 'g.equip', itemUid: it.uid, targetUid: target.uid, ...(replaceUid != null ? { replaceUid } : {}) });
    assert.ok(res.ok, `${id}: ${JSON.stringify(res)}`);
    return it;
  };
  const four = KEPT_ITEMS.slice(0, 4).map((id) => equip(big, id));
  assert.deepEqual(big.items.map((x) => x.uid), four.map((x) => x.uid), 'four items, nothing replaced');
  checkInvariants(m);
  // the client opens the replace dialog only now
  const ctx = { pieces: new Map([[big.uid, { piece: big }]]), getChess: (id) => m.gd.chess(id), getItem: (id) => m.gd.item(id), morphMode: 'official' };
  const incoming = giveItem(m, ps, KEPT_ITEMS[4], 'hand');
  ctx.pieces.set(incoming.uid, { piece: incoming });
  assert.equal(equipReplaces(ctx, incoming.uid, big), true, 'full at 4: the drop replaces');
  const req = replaceRequest(ctx, { t: 'g.equip', confirmReplace: true, fields: { targetUid: big.uid, itemUid: incoming.uid } }, (id) => m.gd.chess(id), (id) => m.gd.item(id));
  assert.ok(req, 'replace dialog');
  const res = m.handle('p_0', { t: 'g.equip', itemUid: incoming.uid, targetUid: big.uid, replaceUid: four[2].uid });
  assert.ok(res.ok);
  assert.equal(big.items.length, 4);
  assert.ok(!big.items.some((x) => x.uid === four[2].uid), 'the picked one is replaced');
  assert.ok(big.items.some((x) => x.uid === incoming.uid));
  // three on the ordinary piece: the third replaces
  const two = KEPT_ITEMS.slice(0, 2).map((id) => equip(small, id));
  ctx.pieces.set(small.uid, { piece: small });
  const third = giveItem(m, ps, KEPT_ITEMS[5], 'hand');
  ctx.pieces.set(third.uid, { piece: third });
  assert.equal(equipReplaces(ctx, third.uid, small), true, 'an ordinary piece is full at 2');
  assert.ok(m.handle('p_0', { t: 'g.equip', itemUid: third.uid, targetUid: small.uid }).ok);
  assert.equal(small.items.length, 2);
  assert.ok(!small.items.some((x) => x.uid === two[0].uid), 'the oldest is replaced');
  checkInvariants(m);
  m.dispose();
});

test('a 4-slot piece with 3 items: no replace dialog yet', () => {
  const { m, ps } = prep(withSlots(OP, 4));
  const big = give(m, ps, OP, 'hand');
  for (const id of KEPT_ITEMS.slice(0, 3)) {
    const it = giveItem(m, ps, id, 'hand');
    assert.ok(m.handle('p_0', { t: 'g.equip', itemUid: it.uid, targetUid: big.uid }).ok);
  }
  const incoming = giveItem(m, ps, KEPT_ITEMS[3], 'hand');
  const ctx = { pieces: new Map([[big.uid, { piece: big }], [incoming.uid, { piece: incoming }]]), getChess: (id) => m.gd.chess(id), getItem: (id) => m.gd.item(id), morphMode: 'official' };
  assert.equal(equipReplaces(ctx, incoming.uid, big), false);
  assert.equal(replaceRequest(ctx, { t: 'g.equip', confirmReplace: true, fields: { targetUid: big.uid, itemUid: incoming.uid } }, (id) => m.gd.chess(id), (id) => m.gd.item(id)), null);
  m.dispose();
});
