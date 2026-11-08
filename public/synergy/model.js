// Read-only operator and alliance facets for the standalone attribute explorer.
// Timing categories use actual garrison.eventType; battle effects are split by simulation keys.
import { N_ } from '../../shared/i18n.js';

export const MECHANISMS = Object.freeze([
  { id: 'gain', eventType: 'SERVER_GAIN', label: N_('获得时'), sourceChessId: 'chess_char_5_10_a' },
  { id: 'prep-start', eventType: 'SERVER_PREP_START', label: N_('进入休整期时'), sourceChessId: 'chess_char_4_21_a' },
  { id: 'prep-end', eventType: 'SERVER_PREP_FIN', label: N_('休整期结束时'), sourceChessId: 'chess_char_5_11_a' },
  { id: 'battle', label: N_('战斗中'), sourceChessId: 'chess_char_4_25_a' },
  { id: 'battle-benefit', label: N_('战斗中增益'), mark: '✦' },
  { id: 'other', label: N_('其他'), mark: '…' },
]);

// Battle trait roles relative to 魔王 (Theresa). A normal/elite operator is classified by the union of their own
// garrisons. These are actual simulation effect keys in server/sim/content/garrisons/battle.js, not text matches.
const BATTLE_LAYER_GAIN_KEYS = new Set([
  'act1autochess_gar_event_useskill', 'act1autochess_gar_event_selfkillenemy',
  'act1autochess_gar_event_selfdead', 'act1autochess_gar_event_consume_ammo',
  'act1autochess_gar_event_enemy_abflag_inrange', 'act2autochess_gar_event_onstart',
  'act2autochess_gar_event_allyenemy_sleepstun_inrange',
]);
const BATTLE_BENEFIT_KEYS = new Set([
  'act1autochess_gar_eff_attrByBond', 'act1autochess_gar_eff_respawnTimeByBond',
  'act2autochess_gar_eff_attrByBond_add_onstart', 'act2autochess_gar_eff_ab_damageScaleByBond',
  'act1autochess_gar_eff_attack_enemy', 'attr_common_global_buff',
  'act1autochess_gar_eff_chaos', 'GAIN_BUFF',
]);

const values = (records) => Array.isArray(records) ? records : Object.values(records || {});
const byId = (records, id, field) => typeof records === 'function' ? records(id) : Array.isArray(records)
  ? records.find((record) => record?.[field] === id)
  : records?.[id];

/** A granted layer-gain trait is later fired with the recipient as its source, so it can also be amplified. */
export function battleRelation(forms, garrisonRecords) {
  const records = forms.flatMap((form) => (form?.garrisonIds || [])
    .map((id) => byId(garrisonRecords, id, 'garrisonId'))).filter((garrison) => garrison?.eventType === 'IN_BATTLE');
  if (!records.length) return null;
  const grantsLayers = records.some((garrison) => garrison.effectKey === 'ADD_BOND'
    && BATTLE_LAYER_GAIN_KEYS.has(byId(garrisonRecords, garrison.bbStr?.give_garrison_id, 'garrisonId')?.effectKey));
  let role = 'other';
  if (records.some((garrison) => BATTLE_LAYER_GAIN_KEYS.has(garrison.effectKey))) role = 'direct';
  else if (grantsLayers) role = 'granter';
  else if (records.some((garrison) => garrison.effectKey === 'act1autochess_gar_event_addition_cnt')) role = 'amplifier';
  else if (records.some((garrison) => BATTLE_BENEFIT_KEYS.has(garrison.effectKey))) role = 'benefit';
  return { role, grantsLayers };
}

export function buildExplorer(chessRecords, bondRecords, garrisonRecords) {
  const chess = values(chessRecords);
  const bonds = values(bondRecords).filter((bond) => bond?.bondId);
  const bondMap = new Map(bonds.map((bond) => [bond.bondId, bond]));
  const rows = [];
  for (const normal of chess) {
    if (!normal?.visible || normal.isGolden || normal.isHidden || normal.isDiy) continue;
    const elite = normal.goldenId ? byId(chessRecords, normal.goldenId, 'chessId') : null;
    const forms = [normal, elite].filter(Boolean);
    const bondIds = [...new Set(forms.flatMap((form) => form.bonds || []))].filter((id) => bondMap.has(id));
    const garrisons = forms.flatMap((form) => (form.garrisonIds || [])
      .map((id) => byId(garrisonRecords, id, 'garrisonId'))).filter(Boolean);
    const relation = battleRelation(forms, garrisonRecords);
    const mechanismIds = MECHANISMS.filter((mechanism) => {
      if (mechanism.eventType) return garrisons.some((garrison) => garrison.eventType === mechanism.eventType);
      if (mechanism.id === 'battle') return ['direct', 'granter', 'amplifier'].includes(relation?.role);
      if (mechanism.id === 'battle-benefit') return relation?.role === 'benefit';
      return relation?.role === 'other' || garrisons.some((garrison) =>
        !['SERVER_GAIN', 'SERVER_PREP_START', 'SERVER_PREP_FIN', 'IN_BATTLE'].includes(garrison.eventType));
    }).map((mechanism) => mechanism.id);
    rows.push({ chessId: normal.chessId, normal, elite, bondIds, mechanismIds, battleRelation: relation });
  }
  rows.sort((a, b) => a.normal.tier - b.normal.tier || a.normal.shopSortId - b.normal.shopSortId || a.normal.name.localeCompare(b.normal.name));
  const ordered = bonds.slice().sort((a, b) => Number(b.isCore) - Number(a.isCore) || a.identifier - b.identifier || a.name.localeCompare(b.name));
  return { rows, bonds: ordered, bondMap, garrisons: garrisonRecords };
}

function groupMatches(have, selected, matchAll) {
  if (!selected.size) return true;
  return matchAll ? [...selected].every((id) => have.includes(id)) : [...selected].some((id) => have.includes(id));
}

/** Different groups combine with AND; within each group, the visitor chooses any or all. */
export function filterExplorer(rows, { query = '', core = new Set(), addon = new Set(), mechanisms = new Set(), matchAll = false } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (needle && ![row.normal.name, row.normal.appellation, row.normal.subProfessionName]
      .some((value) => String(value || '').toLocaleLowerCase().includes(needle))) return false;
    return groupMatches(row.bondIds, core, matchAll)
      && groupMatches(row.bondIds, addon, matchAll)
      && groupMatches(row.mechanismIds, mechanisms, matchAll);
  });
}

export function garrisonsForForm(form, garrisons) {
  return (form?.garrisonIds || []).map((id) => byId(garrisons, id, 'garrisonId')).filter(Boolean);
}
