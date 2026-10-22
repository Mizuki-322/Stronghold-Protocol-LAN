import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
globalThis.fetch = async (url) => {
  const name = String(url).split('/').pop();
  try { const body = readFileSync(path.join(ROOT, 'data', name), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
  catch { return { ok: false, status: 404, json: async () => ({}) }; }
};

const { modeOffBonds } = await import('../../public/js/ui/gameLogic.js');
const { BondChips } = await import('../../public/js/ui/detailPanel.js');
const { ChessCard } = await import('../../public/js/ui/shopBar.js');
const { BondPopup, BondStrip } = await import('../../public/js/ui/bondStrip.js');
const { data, getMode } = await import('../../public/js/data.js');
const { DATA, makeMatch, give, legalTileFor } = await import('../match/harness.js');
const { tileKey } = await import('../../server/match/board.js');

await data.loadAll('chess', 'bonds', 'assets', 'config');

function* walk(v) {
  if (Array.isArray(v)) { for (const x of v) yield* walk(x); return; }
  if (!v || typeof v !== 'object') return;
  yield v;
  if (typeof v.type === 'function' && !v.props?.children) return;
  yield* walk(v.props?.children);
}
const hasClass = (v, c) => typeof v?.props?.class === 'string' && v.props.class.split(/\s+/).includes(c);
const textOf = (v) => [...walk(v)].flatMap((n) => (Array.isArray(n.props?.children) ? n.props.children : [n.props?.children])).filter((x) => typeof x === 'string' || typeof x === 'number').join('');
const chipOf = (vnode, bondId) => [...walk(vnode)].find((v) => v.props?.['data-bond'] === bondId);

test('the fixed standard exclusion does not turn off bond effects in either solo or coop', () => {
  for (const id of ['mode_single_funny', 'mode_multi_funny']) {
    assert.ok(getMode(id).inactiveBondIds.includes('arcaneShip'));
    assert.equal(modeOffBonds(getMode(id)).size, 0);
  }
  for (const id of ['mode_single_normal', 'mode_multi_hard', 'mode_single_abyss']) assert.equal(modeOffBonds(getMode(id)).size, 0);
});

test('standard match: three surviving 奥术 operators activate the bond and the card shows its tier', () => {
  const h = makeMatch({ mode: 'solo', difficulty: 'FUNNY', humans: 1, seed: 3 }).start();
  h.toPrep(1);
  const m = h.m, ps = h.ps('p_0');
  const members = DATA.bonds.arcaneShip.visibleMembers.filter((id) => m.pool.has(id));
  assert.ok(members.length >= 3);
  ps.board.clear();
  const used = new Set();
  for (const id of members.slice(0, 3)) { const t = legalTileFor(m, ps, id, used); used.add(tileKey(t[0], t[1])); give(m, ps, id, 'board', t); }
  ps.recompute();
  assert.equal(ps.bonds.arcaneShip.count, 3);
  assert.equal(ps.bonds.arcaneShip.active, true);
  const priv = ps.privateView();
  const arc = priv.bonds.find((b) => b.bondId === 'arcaneShip');
  assert.ok(arc && arc.active && !arc.off);
  const chip = chipOf(BondChips({ bondIds: DATA.chess[members[0]].bonds, bonds: priv.bonds, off: modeOffBonds(getMode(m.modeId)) }), 'arcaneShip');
  assert.ok(hasClass(chip, 'is-active') && !hasClass(chip, 'is-off'));
  assert.doesNotMatch(chip.props.title, /本局禁用/);
  m.dispose();
});

test('the shop card does not mark surviving operators as having an unusable bond', () => {
  const slot = { kind: 'chess', id: 'chess_char_1_17_a', price: 1, basePrice: 1 }; // 深靛: 奥术 / 精准
  const card = ChessCard({ slot, idx: 0, priv: { funds: 9, hand: [], board: [], temp: [] }, onBuy() {}, onDetail() {}, offBonds: modeOffBonds(getMode('mode_single_funny')) });
  const tags = [...walk(card)].filter((v) => hasClass(v, 'scard__bond'));
  assert.equal(tags.length, 2);
  assert.ok(tags.every((v) => !hasClass(v, 'is-off')));
});

test('bond popup displays the current effect for an active formerly excluded bond', () => {
  const pop = BondPopup({ bondId: 'arcaneShip', entry: { count: 3, tier: 1, active: true, layers: 2 }, priv: { board: [], hand: [] }, onClose() {} });
  assert.match(textOf(pop), /已激活 · 1 阶/);
  assert.match(textOf(pop), /当前效果/);
  assert.doesNotMatch(textOf(pop), /本局禁用/);
});

test('the game screen passes the calculated bond state to shop, detail and popup', () => {
  const src = read('public/js/screens/game.js');
  assert.match(src, /const offBonds = modeOffBonds\(getMode\(pub\?\.modeId\)\)/);
  assert.match(src, /<\$\{ShopBar\}[\s\S]*?offBonds=\$\{offBonds\}/);
  assert.match(src, /<\$\{DetailPanel\}[\s\S]*?offBonds=\$\{offBonds\}/);
  assert.match(src, /<\$\{BondPopup\}[\s\S]*?off=\$\{offBonds\.has\(bondPop\.bondId\)\}/);
});

test('hidden-layer bonds show activation and tiers without a stack badge or layer count', () => {
  for (const bondId of ['maniShip', 'emptyShip', 'soloShip', 'suntShip']) {
    const entry = { bondId, active: true, count: 2, tier: 1, layers: 99 };
    const pop = BondPopup({ bondId, entry, priv: { board: [], hand: [] }, onClose() {} });
    assert.match(textOf(pop), /层数不显示/);
    assert.doesNotMatch(textOf(pop), /99|99 层/);
    const disc = [...walk(BondStrip({ bonds: [entry], onOpen() {} }))].find((v) => v.props?.name === DATA.bonds[bondId].name);
    assert.ok(disc);
    assert.equal(disc.props.layers, undefined);
    assert.equal(disc.props.active, true);
    assert.equal(disc.props.tier, 1);
  }
});
