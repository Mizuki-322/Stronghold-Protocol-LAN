import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
globalThis.fetch = async (url) => {
  const name = String(url).split('/').pop();
  const body = readFileSync(path.join(root, 'data', name), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const { data } = await import('../../public/js/data.js');
const { matchInfoModel } = await import('../../public/js/ui/matchInfo.js');
const { addTrackedBonds } = await import('../../public/js/ui/gameLogic/bonds.js');
const { BondPopup, BondStrip } = await import('../../public/js/ui/bondStrip.js');
const { ChessCard } = await import('../../public/js/ui/shopBar.js');
const { operatorTrackId, visibleTrackedOperators } = await import('../../public/js/ui/operatorTracking.js');
await data.loadAll('chess', 'bonds', 'assets', 'config', 'backups', 'items', 'effects');

function* walk(v) {
  if (Array.isArray(v)) { for (const x of v) yield* walk(x); return; }
  if (!v || typeof v !== 'object') return;
  yield v;
  yield* walk(v.props?.children);
}
const hasClass = (v, cls) => typeof v?.props?.class === 'string' && v.props.class.split(/\s+/).includes(cls);
const source = { bonds: data.list('bonds'), chess: (id) => data.lookup('chess', id), mode: { inactiveBondIds: [] } };

test('core list keeps any bond with operators left, including fixed standard exclusions', () => {
  const sargon = data.lookup('bonds', 'sargonShip');
  const ids = sargon.visibleMembers;
  const partial = matchInfoModel({ bannedChess: ids.slice(3) }, source);
  assert.equal(partial.availableCount.get('sargonShip'), 3);
  assert.ok(partial.availableCore.some((b) => b.bondId === 'sargonShip'));
  const empty = matchInfoModel({ bannedChess: ids }, source);
  assert.ok(!empty.availableCore.some((b) => b.bondId === 'sargonShip'));
  const fixed = matchInfoModel({ bannedChess: ids.slice(3) }, { ...source, mode: { inactiveBondIds: ['sargonShip'] } });
  assert.ok(fixed.availableCore.some((b) => b.bondId === 'sargonShip'));
});

test('tracking pins an unowned core bond at zero and marks matching shop cards', () => {
  const tracked = new Set(['sargonShip', 'yanShip']);
  const sargon = data.lookup('bonds', 'sargonShip');
  const list = addTrackedBonds([{ bondId: 'yanShip', count: 2 }], tracked, (id) => data.lookup('bonds', id));
  assert.equal(list.filter((b) => b.bondId === 'yanShip').length, 1);
  assert.equal(list.find((b) => b.bondId === 'sargonShip').count, 0);
  const strip = BondStrip({ bonds: list, trackedIds: tracked, onOpen() {} });
  assert.equal([...walk(strip)].filter((v) => hasClass(v, 'bslot') && hasClass(v, 'is-tracked')).length, 2);

  const card = ChessCard({ slot: { id: sargon.visibleMembers[0], price: 1 }, idx: 0,
    priv: { board: [], hand: [], shop: {} }, trackedBonds: tracked, onBuy() {}, onDetail() {} });
  assert.ok([...walk(card)].some((v) => hasClass(v, 'scard__track')));
  const plain = ChessCard({ slot: { id: sargon.visibleMembers[0], price: 1 }, idx: 0,
    priv: { board: [], hand: [], shop: {} }, trackedBonds: new Set(), onBuy() {}, onDetail() {} });
  assert.ok(![...walk(plain)].some((v) => hasClass(v, 'scard__track')));
});

test('the bond strip dims partially banned and mode-off bonds without red crosses', () => {
  const strip = BondStrip({ bonds: [
    { bondId: 'sargonShip', count: 3, tier: 1, active: true },
    { bondId: 'arcaneShip', count: 2, tier: 0, active: false, off: true },
  ], bannedBonds: new Set(['sargonShip', 'arcaneShip']), onOpen() {} });
  const slots = [...walk(strip)].filter((v) => hasClass(v, 'bslot'));
  assert.equal(slots.length, 2);
  assert.ok(slots.every((v) => hasClass(v, 'is-muted')));
  assert.ok(![...walk(strip)].some((v) => hasClass(v, 'bond__ban')));
  assert.ok(![...walk(strip)].some((v) => hasClass(v, 'bslot__off')));
});

test('the core bond detail toggles its own tracking button', () => {
  let chosen = null;
  const popup = BondPopup({ bondId: 'sargonShip', priv: { board: [], hand: [] },
    banned: [], onClose() {}, onTrack: (id) => { chosen = id; }, tracked: false });
  const button = [...walk(popup)].find((v) => hasClass(v, 'bpop__track'));
  assert.equal(button.props['aria-pressed'], 'false');
  button.props.onClick();
  assert.equal(chosen, 'sargonShip');
  const watched = BondPopup({ bondId: 'sargonShip', priv: { board: [], hand: [] }, owner: '队友',
    banned: [], onClose() {}, onTrack() {} });
  assert.ok(![...walk(watched)].some((v) => hasClass(v, 'bpop__track')));
});

test('operator tracking matches normal and elite shop cards and visible reward offers', () => {
  const normal = data.lookup('chess', 'chess_char_5_10_a');
  const elite = data.lookup('chess', normal.goldenId);
  const tracked = new Set([normal.chessId]);
  assert.equal(operatorTrackId(elite), normal.chessId);
  const card = ChessCard({ slot: { id: elite.chessId, price: 2 }, idx: 0,
    priv: { board: [], hand: [], shop: {} }, trackedOperators: tracked, onBuy() {}, onDetail() {} });
  assert.ok([...walk(card)].some((v) => hasClass(v, 'is-operator-tracked')));
  const getChess = (id) => data.lookup('chess', id);
  const shop = { shop: { slots: [{ kind: 'chess', id: elite.chessId, sold: false }] } };
  assert.deepEqual([...visibleTrackedOperators(shop, tracked, getChess)], [normal.chessId]);
  shop.shop.rewardOffer = { slots: [{ kind: 'chess', id: elite.chessId, sold: true }] };
  assert.deepEqual([...visibleTrackedOperators(shop, tracked, getChess)], []);
  shop.shop.rewardOffer.slots[0].sold = false;
  assert.deepEqual([...visibleTrackedOperators(shop, tracked, getChess)], [normal.chessId]);
});
