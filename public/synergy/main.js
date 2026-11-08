import { t, N_, getLang, onLangChange } from '../../shared/i18n.js';
import { data, loadData } from '../js/data.js';
import { initLang, dataChain } from '../js/ui/lang.js';
import { avatarUrl, portraitUrl, bondIconUrl } from '../js/assets.js';
import { MECHANISMS, buildExplorer, filterExplorer, garrisonsForForm } from './model.js';

const app = document.getElementById('app');
const dialog = document.getElementById('detail');
const state = {
  query: '', core: new Set(), addon: new Set(), mechanisms: new Set(), matchAll: false,
  filtersOpen: matchMedia('(min-width: 951px)').matches, detail: null, previous: null,
};
let explorer = null;
let assets = null;

const BATTLE_GROUPS = Object.freeze([
  { role: 'direct', label: N_('自身特质可触发魔王加层'), note: N_('站在魔王身前一格，满足各自的战斗叠层条件时，魔王可追加层数。') },
  { role: 'granter', label: N_('赋予队友叠层特质'), note: N_('受赠干员触发叠层；受赠者站在魔王身前时才可能被放大。') },
  { role: 'amplifier', label: N_('魔王自身'), note: N_('魔王放大身前干员因特质获得的战斗层数。') },
]);

function node(tag, className = '', text = '') {
  const out = document.createElement(tag);
  if (className) out.className = className;
  if (text != null) out.textContent = text;
  return out;
}

function image(src, className, alt = '') {
  const img = node('img', className);
  img.alt = alt;
  img.loading = 'lazy';
  if (src) img.src = src;
  else img.classList.add('is-missing');
  return img;
}

function heading(label, count) {
  const h = node('h2', 'section-title');
  h.append(node('span', '', t(label)), node('span', 'section-count', String(count)));
  return h;
}

function toggle(set, id) {
  if (set.has(id)) set.delete(id);
  else set.add(id);
  render();
}

function bondFacet(bond, set, count) {
  const item = node('div', 'facet-item');
  const active = set.has(bond.bondId);
  const choose = node('button', `facet ${active ? 'is-selected' : ''}`);
  choose.type = 'button';
  choose.setAttribute('aria-pressed', String(active));
  choose.append(image(bondIconUrl(assets, bond.bondId), 'bond-icon'), node('span', 'facet-name', bond.name), node('span', 'facet-count', String(count)));
  choose.addEventListener('click', () => toggle(set, bond.bondId));
  const info = node('button', 'facet-info', 'i');
  info.type = 'button';
  info.title = t('查看盟约详情');
  info.setAttribute('aria-label', `${t('查看盟约详情')}：${bond.name}`);
  info.addEventListener('click', () => openDetail({ type: 'bond', bondId: bond.bondId }));
  item.append(choose, info);
  return item;
}

function mechanismFacet(mechanism, count) {
  const active = state.mechanisms.has(mechanism.id);
  const choose = node('button', `mechanism ${active ? 'is-selected' : ''}`);
  choose.type = 'button';
  choose.setAttribute('aria-pressed', String(active));
  const source = explorer.rows.find((row) => row.chessId === mechanism.sourceChessId)?.normal;
  const avatar = avatarUrl(assets, source?.assets?.avatar || source?.charId);
  choose.append(avatar ? image(avatar, 'mechanism-avatar', source?.name || '') : node('span', 'mechanism-mark', mechanism.mark || '◆'));
  choose.append(node('span', 'mechanism-label', t(mechanism.label)), node('span', 'facet-count', String(count)));
  choose.addEventListener('click', () => toggle(state.mechanisms, mechanism.id));
  return choose;
}

function renderFilters(sidebar) {
  const intro = node('div', 'filter-intro');
  intro.append(node('div', 'eyebrow', t('筛选条件')), node('p', '', t('不同类别之间取交集；同类多选可切换为任一或全部。')));
  sidebar.append(intro);
  const counts = new Map(explorer.bonds.map((bond) => [bond.bondId, explorer.rows.filter((row) => row.bondIds.includes(bond.bondId)).length]));
  for (const [core, key, label] of [[true, 'core', '核心盟约'], [false, 'addon', '附加盟约']]) {
    const bonds = explorer.bonds.filter((bond) => !!bond.isCore === core);
    const section = node('section', 'filter-section');
    section.append(heading(label, bonds.length));
    const grid = node('div', 'facet-grid');
    for (const bond of bonds) grid.append(bondFacet(bond, state[key], counts.get(bond.bondId)));
    section.append(grid);
    sidebar.append(section);
  }
  const section = node('section', 'filter-section');
  section.append(heading('特质机制', MECHANISMS.length));
  const grid = node('div', 'mechanism-grid');
  for (const mechanism of MECHANISMS) grid.append(mechanismFacet(mechanism, explorer.rows.filter((row) => row.mechanismIds.includes(mechanism.id)).length));
  section.append(grid);
  const note = node('p', 'filter-note', t('铃兰会在进入休整期时再次触发前方干员的「获得时」效果。此处按干员自身特质的触发时机或效果筛选。'));
  section.append(note);
  sidebar.append(section);
  const options = node('div', 'filter-options');
  options.append(node('span', '', t('同类多选')));
  const any = node('button', `option ${!state.matchAll ? 'is-selected' : ''}`, t('任一符合'));
  any.type = 'button';
  any.setAttribute('aria-pressed', String(!state.matchAll));
  any.addEventListener('click', () => { state.matchAll = false; render(); });
  const all = node('button', `option ${state.matchAll ? 'is-selected' : ''}`, t('全部符合'));
  all.type = 'button';
  all.setAttribute('aria-pressed', String(state.matchAll));
  all.addEventListener('click', () => { state.matchAll = true; render(); });
  options.append(any, all);
  sidebar.append(options);
  const reset = node('button', 'reset', t('重置筛选'));
  reset.type = 'button';
  reset.addEventListener('click', () => {
    state.core.clear(); state.addon.clear(); state.mechanisms.clear(); state.query = ''; state.matchAll = false;
    render();
  });
  sidebar.append(reset);
}

function tinyBond(bondId) {
  const bond = explorer.bondMap.get(bondId);
  const tag = node('span', 'tiny-bond');
  tag.append(image(bondIconUrl(assets, bondId), 'tiny-icon'), node('span', '', bond?.name || bondId));
  return tag;
}

function operatorCard(row) {
  const card = node('button', 'operator-card');
  card.type = 'button';
  const art = node('div', 'operator-art');
  art.append(image(avatarUrl(assets, row.normal.assets?.avatar || row.normal.charId), 'operator-avatar', row.normal.name));
  art.append(node('span', 'tier', `${'ⅠⅡⅢⅣⅤⅥ'[row.normal.tier - 1] || row.normal.tier}`));
  const body = node('div', 'operator-body');
  body.append(node('strong', 'operator-name', row.normal.name), node('span', 'operator-role', row.normal.subProfessionName || ''));
  const bonds = node('div', 'operator-bonds');
  for (const id of row.bondIds) bonds.append(tinyBond(id));
  body.append(bonds);
  const mechanisms = node('div', 'operator-mechanisms');
  for (const id of row.mechanismIds) {
    const preset = MECHANISMS.find((mechanism) => mechanism.id === id);
    mechanisms.append(node('span', 'tiny-mechanism', t(preset.label)));
  }
  if (!row.mechanismIds.length) mechanisms.append(node('span', 'no-mechanism', t('暂无对应特质分类')));
  body.append(mechanisms);
  card.append(art, body);
  card.addEventListener('click', () => openDetail({ type: 'operator', chessId: row.chessId }));
  return card;
}

function render() {
  if (!explorer) return;
  app.replaceChildren();
  const shell = node('div', 'shell');
  const header = node('header', 'topbar');
  const brand = node('div', 'brand');
  brand.append(node('span', 'brand-mark', '◇'), node('div', 'brand-text'));
  brand.lastChild.append(node('small', '', 'STRONGHOLD PROTOCOL / REFERENCE'), node('h1', '', t('特质联动查询')));
  const back = node('a', 'back-link', t('返回游戏'));
  back.href = '/';
  header.append(brand, back);
  const layout = node('div', 'layout');
  const sidebar = node('details', 'sidebar');
  sidebar.open = state.filtersOpen;
  const summary = node('summary', 'mobile-filter-summary');
  summary.append(node('span', '', t('筛选条件')));
  const selectedCount = state.core.size + state.addon.size + state.mechanisms.size;
  if (selectedCount) summary.append(node('span', 'selected-count', t('已选 {n} 项', { n: selectedCount })));
  sidebar.append(summary);
  const filterBody = node('div', 'filter-body');
  renderFilters(filterBody);
  sidebar.append(filterBody);
  sidebar.addEventListener('toggle', () => { state.filtersOpen = sidebar.open; });
  const main = node('main', 'results');
  const top = node('div', 'results-top');
  const title = node('div', 'results-title');
  const found = filterExplorer(explorer.rows, state);
  title.append(node('span', 'eyebrow', t('干员')), node('h2', '', t('符合条件：{n} 名', { n: found.length })));
  const search = node('input', 'search');
  search.type = 'search';
  search.placeholder = t('搜索干员姓名或职业');
  search.setAttribute('aria-label', t('搜索干员姓名或职业'));
  search.value = state.query;
  search.addEventListener('input', (event) => {
    const cursor = event.target.selectionStart;
    state.query = event.target.value;
    render();
    const next = document.querySelector('.search');
    next.focus();
    if (cursor != null) next.setSelectionRange(cursor, cursor);
  });
  top.append(title, search);
  main.append(top);
  if (state.mechanisms.size === 1 && state.mechanisms.has('battle-benefit'))
    main.append(node('p', 'group-note', t('这些特质提升战斗能力或利用已有盟约层数，但本身不会触发魔王加层。')));
  if (state.mechanisms.size === 1 && state.mechanisms.has('other'))
    main.append(node('p', 'group-note', t('包括售出时、刷新时、购买价格及暂未归入前五类的特质。')));
  if (!found.length) main.append(node('div', 'empty', t('没有符合条件的干员，请调整筛选。')));
  else if (state.mechanisms.size === 1 && state.mechanisms.has('battle')) {
    for (const group of BATTLE_GROUPS) {
      const members = found.filter((row) => row.battleRelation?.role === group.role);
      if (!members.length) continue;
      const section = node('section', 'result-group');
      const head = node('div', 'group-head');
      head.append(node('h3', '', t(group.label)), node('span', 'group-count', String(members.length)));
      section.append(head, node('p', 'group-note', t(group.note)));
      const grid = node('div', 'operator-grid');
      for (const row of members) grid.append(operatorCard(row));
      section.append(grid);
      main.append(section);
    }
  } else {
    const grid = node('div', 'operator-grid');
    for (const row of found) grid.append(operatorCard(row));
    main.append(grid);
  }
  layout.append(sidebar, main);
  shell.append(header, layout);
  app.append(shell);
  document.title = `${t('特质联动查询')} · ${t('卫戍协议')}`;
}

function modalShell(title) {
  const wrap = node('div', 'modal-content');
  const bar = node('div', 'modal-bar');
  if (state.previous) {
    const previous = node('button', 'modal-back', t('返回干员'));
    previous.type = 'button';
    previous.addEventListener('click', () => { state.detail = state.previous; state.previous = null; renderDetail(); });
    bar.append(previous);
  }
  bar.append(node('span', 'modal-overline', title));
  const close = node('button', 'modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', t('关闭'));
  close.addEventListener('click', () => dialog.close());
  bar.append(close);
  wrap.append(bar);
  return wrap;
}

function garrisonSection(form, label) {
  if (!form) return null;
  const section = node('section', 'form-section');
  section.append(node('h3', '', label));
  const list = garrisonsForForm(form, explorer.garrisons);
  if (!list.length) section.append(node('p', 'muted', t('没有特质数据')));
  for (const garrison of list) {
    const entry = node('div', 'garrison-entry');
    const mechanism = MECHANISMS.find((item) => item.eventType === garrison.eventType);
    entry.append(node('span', 'garrison-type', mechanism ? t(mechanism.label) : (garrison.eventTypeDesc || t('其他'))));
    entry.append(node('p', '', garrison.desc || ''));
    section.append(entry);
  }
  return section;
}

function operatorDetail(row) {
  const wrap = modalShell(t('干员'));
  const hero = node('div', 'modal-hero');
  hero.append(image(portraitUrl(assets, row.normal.assets?.portrait || row.normal.charId), 'modal-portrait', row.normal.name));
  const intro = node('div', 'modal-intro');
  intro.append(node('small', '', `TIER ${row.normal.tier} · ${row.normal.appellation || ''}`), node('h2', '', row.normal.name), node('p', '', row.normal.subProfessionName || ''));
  const bonds = node('div', 'detail-bonds');
  for (const id of row.bondIds) {
    const bond = explorer.bondMap.get(id);
    const button = node('button', 'detail-bond');
    button.type = 'button';
    button.append(image(bondIconUrl(assets, id), 'bond-icon'), node('span', '', bond?.name || id));
    button.addEventListener('click', () => openDetail({ type: 'bond', bondId: id }, true));
    bonds.append(button);
  }
  intro.append(bonds);
  hero.append(intro);
  wrap.append(hero, garrisonSection(row.normal, t('普通形态')), garrisonSection(row.elite, t('精锐形态')));
  return wrap;
}

function bondDetail(bond) {
  const wrap = modalShell(bond.isCore ? t('核心盟约') : t('附加盟约'));
  const header = node('div', 'bond-hero');
  header.append(image(bondIconUrl(assets, bond.bondId), 'bond-large'), node('h2', '', bond.name));
  const members = explorer.rows.filter((row) => row.bondIds.includes(bond.bondId)).length;
  header.append(node('span', 'member-count', t('可见干员 {n} 名', { n: members })));
  wrap.append(header);
  if (bond.thresholds?.length) wrap.append(node('p', 'thresholds', `${t('激活人数')} ${bond.thresholds.join(' / ')}`));
  if (bond.desc) wrap.append(node('p', 'bond-description', bond.desc));
  if (bond.effectDesc && bond.effectDesc !== bond.desc) {
    wrap.append(node('h3', 'bond-effect-title', t('盟约效果')), node('p', 'bond-description', bond.effectDesc));
  }
  const select = node('button', 'select-bond', t('筛选此盟约'));
  select.type = 'button';
  select.addEventListener('click', () => {
    const group = bond.isCore ? state.core : state.addon;
    group.add(bond.bondId);
    state.previous = null;
    dialog.close();
    render();
  });
  wrap.append(select);
  return wrap;
}

function renderDetail() {
  const detail = state.detail;
  if (!detail) return;
  const row = detail.type === 'operator' ? explorer.rows.find((item) => item.chessId === detail.chessId) : null;
  const bond = detail.type === 'bond' ? explorer.bondMap.get(detail.bondId) : null;
  if (!row && !bond) return;
  dialog.replaceChildren(row ? operatorDetail(row) : bondDetail(bond));
}

function openDetail(detail, fromOperator = false) {
  state.previous = fromOperator ? state.detail : null;
  state.detail = detail;
  renderDetail();
  if (!dialog.open) dialog.showModal();
}

dialog.addEventListener('close', () => { state.detail = null; state.previous = null; });
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

async function boot() {
  app.textContent = t('正在加载干员资料…');
  await initLang();
  await loadData('chess', 'bonds', 'garrisons', 'assets');
  await data.setLocale(getLang(), dataChain(getLang()));
  if (['chess', 'bonds', 'garrisons'].some((name) => data.status(name) !== 'ready')) {
    app.textContent = t('干员资料加载失败，请刷新页面重试。');
    return;
  }
  assets = data.get('assets');
  explorer = buildExplorer(data.get('chess'), data.get('bonds'), data.get('garrisons'));
  onLangChange(() => {
    explorer = buildExplorer(data.get('chess'), data.get('bonds'), data.get('garrisons'));
    render();
    if (dialog.open) renderDetail();
  });
  render();
}

boot().catch((error) => {
  console.error('[synergy]', error);
  app.textContent = t('干员资料加载失败，请刷新页面重试。');
});

matchMedia('(min-width: 951px)').addEventListener('change', (event) => {
  state.filtersOpen = event.matches;
  render();
});
