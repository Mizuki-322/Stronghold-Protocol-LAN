// External DeepSeek player for a private LAN room. It uses the same player WebSocket and
// server-validated intents as a browser seat; no server-private match state is read.
import { readFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { Net } from '../public/js/net.js';
import { EMOTES } from '../shared/constants.js';

const here = new URL('../data/', import.meta.url);
const readData = async (name) => JSON.parse(await readFile(new URL(name, here), 'utf8'));
const [stages, chess, enemies, bands] = await Promise.all(['stages.json', 'chess.json', 'enemies.json', 'bands.json'].map(readData));
const key = process.env.DEEPSEEK_API_KEY;
const roomCode = String(process.env.SP_AI_ROOM || '').trim().toUpperCase();
if (!key || !roomCode) {
  console.error('Set DEEPSEEK_API_KEY and SP_AI_ROOM (the co-op room code).');
  process.exit(2);
}
const wsUrl = process.env.SP_AI_SERVER || 'ws://127.0.0.1:17878/ws';
const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const name = process.env.SP_AI_NAME || 'DeepSeek队友';
const thinkEveryMs = Math.max(1200, Number(process.env.SP_AI_THINK_MS) || 3000);
const maxActions = Math.max(5, Number(process.env.SP_AI_ACTIONS_PER_ROUND) || 35);
const allowed = new Set(['g.infoReady', 'g.band', 'g.bandSkip', 'g.choice', 'g.buy', 'g.refresh', 'g.freeze',
  'g.levelUp', 'g.sell', 'g.move', 'g.equip', 'g.art', 'g.destroy', 'g.unequip', 'g.reward', 'g.ready',
  'g.watch', 'g.chat', 'g.emote']);
let token = null;
const net = new Net({ url: wsUrl, WebSocket, agent: true, getToken: () => token });
const state = { room: null, pub: null, priv: null, field: null, battle: null, chats: [], emotes: [],
  lastError: null, lastAction: null, lastDamage: null, battleStats: null, lastStatsQueryAt: 0,
  round: 0, actions: 0, lastChatAt: 0 };
let deciding = false;
let timer = null;
let lastDecisionAt = 0;
let lastFingerprint = '';
let imageRequested = false;
let looksThisRound = 0;
let apiFailures = 0;
let fallbackAutoplay = false;

const trim = (value, max = 12000) => { const s = JSON.stringify(value); return s && s.length > max ? s.slice(0, max) + '…' : s; };
const visibleChessIds = (p) => {
  const ids = new Set();
  for (const group of [p?.shop?.slots, p?.shop?.rewardOffer?.slots, p?.hand, p?.temp, p?.board])
    for (const x of group || []) if (x?.kind === 'chess' && x.id) ids.add(x.id);
  return [...ids];
};

export function observation(s, myId) {
  const pub = s.pub || {};
  const p = s.priv || {};
  const stage = stages[pub.stageId];
  const mine = pub.players?.find((x) => x.playerId === myId);
  const enemyIds = new Set((p.nextEnemies || []).flatMap((x) => [x?.enemyKey, x?.id, x?.key, x?.enemyId]).filter(Boolean));
  const ownField = pub.fields?.find((x) => x.players?.includes(myId));
  return {
    role: { playerId: myId, name, seat: mine?.seat, status: mine?.status },
    phase: pub.phase, round: pub.round, deadline: pub.deadline,
    public: { modeId: pub.modeId, difficulty: pub.difficulty, stageId: pub.stageId, setupRevision: pub.setupRevision, factions: pub.factions,
      disabledBonds: pub.disabledBonds, bannedChess: pub.bannedChess, players: pub.players, fields: pub.fields,
      draft: pub.draft, sp: pub.sp, offers: pub.offers, teamLp: pub.teamLp, bossHp: pub.bossHp },
    private: { alive: p.alive, lp: p.lp, funds: p.funds, bandId: p.bandId, ready: p.ready,
      canReady: p.canReady, shop: p.shop, hand: p.hand, temp: p.temp, board: p.board,
      deployCap: p.deployCap, deployCount: p.deployCount, bonds: p.bonds,
      effects: p.effects, nextEnemies: p.nextEnemies, personalChoice: p.personalChoice, stats: p.stats },
    map: stage ? { name: stage.name, size: stage.size, rows: stage.rows,
      tileLegend: Object.fromEntries(Object.entries(stage.tiles || {}).map(([symbol, tile]) => [symbol,
        { height: tile.height, buildable: tile.buildable, passable: tile.passable }])),
      deployTiles: stage.deployTiles,
      groundPaths: stage.groundPaths, airPaths: stage.airPaths } : null,
    operators: Object.fromEntries(visibleChessIds(p).map((id) => { const x = chess[id]; return [id, x ? {
      name: x.name, tier: x.tier, stats: x.stats, bonds: x.bonds, trait: x.trait?.desc,
      profession: x.profession, subProfession: x.subProfessionName, position: x.position,
      damageType: x.dmgType, attackKind: x.attackKind, canHitFly: x.canHitFly,
      rangeGrid: x.rangeGrid, selectedSkill: x.skill?.desc,
      skills: x.skills?.map((skill) => ({ index: skill.index, name: skill.name, desc: skill.desc,
        spCost: skill.spCost, duration: skill.duration })),
      talents: x.talents?.map((talent) => ({ name: talent.name, desc: talent.desc })),
    } : null]; })),
    enemies: Object.fromEntries([...enemyIds].map((id) => { const x = enemies[id]; return [id, x ? {
      name: x.name, desc: x.descRaw, stats: x.stats, tags: x.tags,
    } : null]; })),
    strategies: pub.phase === 'BAND_DRAFT' ? Object.values(bands).filter((x) => !x.isHidden).map((x) => ({
      id: x.bandId, name: x.name, desc: x.desc,
    })) : undefined,
    ownField: ownField ? { fieldId: ownField.fieldId, progress: ownField.progress, live: ownField.live } : null,
    observedField: s.field ? { fieldId: s.field.fieldId, state: s.field } : null,
    battle: s.battle ? { fieldId: s.battle.fieldId, kind: s.battle.kind, spec: s.battle.spec } : null,
    recentChat: s.chats.slice(-8), recentEmotes: s.emotes.slice(-4),
    lastAction: s.lastAction, lastError: s.lastError, lastSettledDamage: s.lastDamage,
    ownBattleStats: s.battleStats,
    limits: { humanChatCharacters: 20, yourChatCharacters: 80, chatCooldownSeconds: 3 },
  };
}

const systemPrompt = `你是《卫戍协议：盟约》局域网房间里的一个真实队友。你通过玩家协议行动，必须像正常玩家一样只利用观察数据。
只输出一个 JSON 对象，每次至多一步：{"type":"act","name":"g.buy","args":{"slot":0}}、{"type":"chat","text":"..."}、{"type":"emote","id":"..."}、{"type":"look"} 或 {"type":"wait"}。
所有操作由服务器校验。若上一动作失败，读 lastError.code/detail，调整方案；不要反复做同一错误动作。
动作参数例子：g.infoReady {"setupRevision":public.setupRevision}；g.band {"bandId":"..."}（只在 draft.turn 等于自己时）；g.choice {"idx":0}；g.buy {"slot":0}；g.refresh {}；g.levelUp {}；g.move {"uid":123,"to":{"area":"board","row":9,"col":2},"dir":"RIGHT"}，返回手牌则 to 为 {"area":"hand","idx":0}；g.equip {"itemUid":123,"targetUid":456}；g.art {"itemUid":123,"row":9,"col":2}；g.reward {"idx":0}；g.ready {"ready":true}；g.watch {"fieldId":"n:..."}。
休整期可以买牌、摆放、升级、刷新，再准备。地面/高台等部署限制以地图及服务器报错为准。商店 slot、手牌 uid、阵地 row/col 不要混淆。
战斗中不能改变战局，可看统计/信息。仅当自己的阵地已经结束后才可用 g.watch 观看尚未完成的其他阵地；观看只读。
聊天不用逐条回复。适时用简短、自然的中文分享决策、惊喜或鼓励；不要刷屏，也别假装知道未显示的内容。聊天最多 80 个 Unicode 字符，表情 id 必须来自允许列表。
look 会把自己的阵地渲染为 2D 图片供你下次观察；每回合最多两次。图片仅显示你本就可见的数据。
如果看不到合法动作或暂时不需行动，输出 wait。不要包含 Markdown。`;

async function decide(obs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const prompt = `当前观察：${trim(obs, 60000)}\n可用表情ID：${EMOTES.join(', ')}`;
    const takeImage = imageRequested;
    imageRequested = false;
    const screenshot = takeImage ? await renderBoardPng(state.priv, state.pub) : null;
    const content = screenshot ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot.toString('base64')}` } }] : prompt;
    const response = await fetch(apiUrl, { method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.7, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content }] }) });
    if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('DeepSeek returned an empty decision');
    return JSON.parse(raw);
  } finally { clearTimeout(timeout); }
}

export function normalizeDecision(d) {
  if (!d || typeof d !== 'object') return { type: 'wait' };
  if (d.type === 'act' && allowed.has(d.name) && d.args && typeof d.args === 'object' && !Array.isArray(d.args))
    return { type: 'act', name: d.name, args: d.args };
  if (d.type === 'chat' && typeof d.text === 'string') return { type: 'act', name: 'g.chat', args: { text: [...d.text.trim()].slice(0, 80).join('') } };
  if (d.type === 'emote' && EMOTES.includes(d.id)) return { type: 'act', name: 'g.emote', args: { id: d.id } };
  if (d.type === 'look') return { type: 'look' };
  return { type: 'wait' };
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function renderBoardPng(priv, pub) {
  const stage = stages[pub?.stageId];
  if (!stage || !priv) return null;
  const rows = stage.rows || [];
  const pieces = new Map((priv.board || []).map((p) => [`${p.row}:${p.col}`, p]));
  const cells = rows.map((row, r) => ({ row, r })).reverse().map(({ row, r }) => [...row].map((kind, c) => {
    const p = pieces.get(`${r}:${c}`);
    const label = p ? chess[p.id]?.name || p.id : '';
    const own = r >= 9 && r <= 12 && c >= 2 && c <= 10;
    return `<div class="tile ${own ? 'own' : ''} ${p ? 'unit' : ''}" title="${esc(label)}">${p ? esc(label.slice(0, 2)) : esc(kind === '#' || kind === 'a' ? '' : kind)}</div>`;
  }).join('')).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0d1716;color:#dcf5eb;font:16px sans-serif;padding:20px}h2{margin:0 0 12px}.map{display:grid;grid-template-columns:repeat(21,34px);grid-auto-rows:34px;gap:2px}.tile{box-sizing:border-box;background:#26312f;border:1px solid #34413d;display:grid;place-items:center;font-size:11px;overflow:hidden}.own{background:#345248}.unit{background:#d4a33f;color:#111;font-weight:bold;border:2px solid #f6d783}.legend{margin:12px 0;font-size:13px;color:#a9c1b7}</style><h2>${esc(stage.name)} · 第 ${esc(pub.round)} 回合 · 自己的阵地</h2><div class="map">${cells}</div><div class="legend">亮绿色：己方部署区；金色：已部署干员。地图行号从底部算起。</div>`;
  const puppeteer = (await import('puppeteer-core')).default;
  const executablePath = process.env.SP_AI_CHROME || (process.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/chromium');
  const browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 860, deviceScaleFactor: 1 });
    await page.setContent(html);
    return await page.screenshot({ type: 'png' });
  } finally { await browser.close(); }
}

function schedule(delay = 450) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(tick, delay);
}

async function tick() {
  timer = null;
  if (deciding || net.status !== 'online' || !state.pub || !state.priv || !state.room?.inMatch) return;
  const now = Date.now();
  if (['COMBAT', 'FINAL_ASSAULT', 'HIDDEN_CORE', 'UNITE'].includes(state.pub.phase) && now - state.lastStatsQueryAt > 2500) {
    state.lastStatsQueryAt = now;
    net.request('g.battleStats').catch(() => {});
  }
  if (now - lastDecisionAt < thinkEveryMs) { schedule(thinkEveryMs - (now - lastDecisionAt)); return; }
  if (state.actions >= maxActions && state.pub.phase === 'PREP') {
    if (state.priv.canReady && !state.priv.ready) await net.request('g.ready', { ready: true }).catch((e) => console.error('ready:', e.code, e.detail));
    return;
  }
  const fingerprint = JSON.stringify([state.pub.phase, state.pub.round, state.priv, state.pub.draft, state.pub.sp, state.chats.at(-1)?.seq, state.lastError]);
  if (fingerprint === lastFingerprint && now - lastDecisionAt < 10000) { schedule(10000); return; }
  lastFingerprint = fingerprint;
  lastDecisionAt = now;
  deciding = true;
  try {
    const choice = normalizeDecision(await decide(observation(state, net.playerId)));
    apiFailures = 0;
    if (fallbackAutoplay) {
      await net.request('g.autoplay', { on: false });
      fallbackAutoplay = false;
      state.lastAction = { name: 'g.autoplay', args: { on: false }, ok: true };
    }
    if (choice.type === 'look') {
      if (looksThisRound < 2) { looksThisRound += 1; imageRequested = true; lastFingerprint = ''; }
    } else if (choice.type === 'act') {
      if (choice.name === 'g.chat' && now - state.lastChatAt < 15000) return;
      if (choice.name === 'g.chat' && !choice.args.text) return;
      try {
        await net.request(choice.name, choice.args);
        state.lastAction = { name: choice.name, args: choice.args, ok: true };
        state.lastError = null;
        if (choice.name === 'g.chat') state.lastChatAt = now;
        if (state.pub.phase === 'PREP') state.actions += 1;
        console.log('action', choice.name, JSON.stringify(choice.args));
      } catch (e) {
        state.lastAction = { name: choice.name, args: choice.args, ok: false };
        state.lastError = { code: e.code || 'ERROR', detail: e.detail || e.message };
        console.warn('rejected', choice.name, state.lastError);
        state.actions += 1;
      }
    }
  } catch (e) {
    console.error('DeepSeek decision failed:', e.message);
    apiFailures++;
    if (apiFailures >= 3 && !fallbackAutoplay) {
      try {
        await net.request('g.autoplay', { on: true });
        fallbackAutoplay = true;
        console.warn('DeepSeek unavailable; built-in AI temporarily controls this seat.');
      } catch (fallbackError) { console.error('autoplay fallback failed:', fallbackError.code || fallbackError.message); }
    }
  }
  finally { deciding = false; schedule(choiceDelay()); }
}

function choiceDelay() { return state.pub?.phase === 'PREP' ? thinkEveryMs : 7000; }

net.on('status', (s) => { console.log('connection', s.status); if (s.status === 'online') schedule(800); });
net.on('welcome', async (m) => {
  token = m.token;
  try { await net.request('room.join', { code: roomCode }); }
  catch (e) { console.error('join room:', e.code, e.detail || e.message); }
});
net.on('room.state', (m) => {
  state.room = m;
  const seat = m.seats?.find((x) => x?.playerId === net.playerId);
  if (seat && !seat.ready && !m.inMatch) net.request('room.ready', { ready: true }).catch((e) => console.warn('room ready:', e.code));
  schedule();
});
net.on('m.public', (m) => {
  if (m.round !== state.round) { state.round = m.round; state.actions = 0; looksThisRound = 0; state.battleStats = null; }
  state.pub = m;
  schedule();
});
net.on('m.private', (m) => {
  const before = state.priv?.stats?.dmgDealt;
  if (Number.isFinite(before) && Number.isFinite(m.stats?.dmgDealt) && m.stats.dmgDealt > before)
    state.lastDamage = { round: state.pub?.round, damage: m.stats.dmgDealt - before };
  state.priv = m;
  schedule();
});
net.on('m.field', (m) => { state.field = m; schedule(1000); });
net.on('m.battleStats', (m) => { state.battleStats = m; schedule(1000); });
net.on('b.start', (m) => { state.battle = m; schedule(1200); });
net.on('b.end', () => { state.battle = null; schedule(1000); });
net.on('m.chat', (m) => { state.chats.push({ seq: Date.now(), playerId: m.playerId, text: m.text }); state.chats = state.chats.slice(-20); schedule(1500); });
net.on('m.emote', (m) => { state.emotes.push({ playerId: m.playerId, id: m.id }); state.emotes = state.emotes.slice(-10); });
net.on('room.closed', () => { state.room = null; state.pub = null; state.priv = null; });
setInterval(() => {
  if (net.status !== 'online' || !state.pub || !['COMBAT', 'FINAL_ASSAULT', 'HIDDEN_CORE', 'UNITE'].includes(state.pub.phase)) return;
  if (Date.now() - state.lastStatsQueryAt < 2500) return;
  state.lastStatsQueryAt = Date.now();
  net.request('g.battleStats').catch(() => {});
}, 2500);
net.setName(name);
console.log(`DeepSeek agent connecting to ${wsUrl}; room ${roomCode}; model ${model}`);
