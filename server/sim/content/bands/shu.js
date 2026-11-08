// 黍「百谷长青」: the placed field is the sole source of its HP-node bonuses and healing progress.
import { SHU_BAND, SHU_DEPUTY, SHU_HEAL_THRESHOLD, shuStackable } from '../../../../shared/shuStrategy.js';
import { gameData, bondActive, bondLayers, bondRecord, gainLayers, passiveBuff } from '../support/index.js';
import { holdProtect } from '../kits/shared/tier1.js';
import { powi } from '../../detmath.js';

export const SHU_FIELD_TOKEN = 'token_shu_field';
const thresholds = [0.3, 0.5, 0.7, 0.9];
const tierOf = (ratio) => thresholds.reduce((n, x) => n + (ratio + 1e-9 >= x ? 1 : 0), 0);
const mine = (battle, pid) => battle.allyUnits.filter((u) => u.ownerId === pid && u.defId !== SHU_FIELD_TOKEN);
// Number of 1.2 factors in the pictured co-op HP table, by round. Only the field replaces them with 1.1;
// the table's 0.8 and 1.08 factors, and every enemy's original multiplier, stay as they are.
const fieldHpPowers = Object.freeze({
  mode_multi_funny: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  mode_multi_normal: [0, 1, 1, 2, 2, 2, 2, 3, 4, 4, 5, 6, 7, 7, 7],
  mode_multi_hard: [1, 2, 2, 3, 3, 3, 3, 3, 4, 5, 6, 6, 7, 8, 8],
  mode_multi_abyss: [1, 2, 2, 3, 4, 4, 7, 8, 8, 8, 9, 10, 10, 10, 10],
});

function hpScale(battle) {
  const supplied = Number(battle.flags?.enemyScale?.hpMul);
  const mode = gameData().config?.modes?.[battle.modeId];
  const official = Number.isFinite(supplied) && supplied > 0 ? supplied
    : Math.max(0.01, Number(mode?.enemyScale?.[String(battle.round)]?.hp) || 1);
  const power = fieldHpPowers[battle.modeId]?.[battle.round - 1] ?? 0;
  return official * powi(11 / 12, power);
}

function deputyHealBonus(battle, pid) {
  if (!bondActive(battle, pid, SHU_DEPUTY)) return 0;
  const bb = bondRecord(SHU_DEPUTY)?.buffs?.find((x) => x.bbStr?.key === 'act1autochess_bond_eff_deput')?.bb;
  const def = (Number(bb?.base_def) || 0) + (Number(bb?.def_per_stack) || 0) * bondLayers(battle, pid, SHU_DEPUTY);
  return Math.max(0, Math.floor(def * 50 + 1e-9)) / 100;
}

/** Install one player's field. No field on the board means no effects. */
export function installShu(battle, ps, p) {
  if (ps.bandId !== SHU_BAND) return;
  const field = ps.units.find((u) => u.defId === SHU_FIELD_TOKEN);
  if (!field) return;
  const state = ps.playerEffects.find((e) => e.key === 'shu:state')?.params || {};
  const pid = ps.playerId;
  const maxHp = Math.max(1, Math.round((Number(p.max_hp) || 5000) * hpScale(battle)));
  field.base.maxHp = maxHp;
  field.base.tauntLevel = -1;
  field.mem.lockMaxHp = true;
  field.mem.minHp = 1;
  if (battle.kind === 'unite') { field.mem.noHealing = true; field.mem.lockHp = true; }
  field.markDirty();
  const healThreshold = Number(p.heal_threshold) > 0 ? Number(p.heal_threshold) : SHU_HEAL_THRESHOLD;
  let progress = Math.max(0, Math.min(healThreshold - 1e-6, Number(state.progress) || 0));
  let oldTier = -1;
  const fieldUp = () => field.alive && field.deployed;
  const tier = () => fieldUp() ? tierOf(field.hp / field.s.maxHp) : 0;
  const highestOtherBond = () => {
    if (battle.round < 7) return null;
    const bonds = battle.getPlayer(pid)?.bonds;
    let best = null;
    let highest = -1;
    for (const id of Object.keys(bonds || {}).sort()) {
      if (id === SHU_DEPUTY || !bondActive(battle, pid, id) || !shuStackable(bondRecord(id))) continue;
      const layers = bondLayers(battle, pid, id);
      if (layers > highest) { best = id; highest = layers; }
    }
    return best;
  };
  const sync = () => {
    const n = tier();
    if (n === oldTier) return;
    oldTier = n;
    const aspd = [0, 10, 15, 20, 30][n];
    for (const u of mine(battle, pid)) {
      const key = 'band:shu:nodes';
      battle.removeBuff(u, key);
      const mods = {};
      if (n >= 1) { mods.hpRegenRatio = 0.02; mods.aspd = aspd; }
      if (Object.keys(mods).length) passiveBuff(battle, u, key, mods);
      if (n >= 3) battle.addBuff(u, { key: 'band:shu:resist', status: 'resist', data: { value: 0.5 }, visible: true, persist: true, allowDead: true });
      else battle.removeBuff(u, 'band:shu:resist');
    }
  };
  battle.on('battleStart', () => {
    if (!fieldUp()) return;
    const ratio = Number(field.carry?.hpPct ?? state.hpRatio ?? p.starting_hp_ratio);
    field.hp = Math.max(1, Math.min(maxHp, maxHp * (Number.isFinite(ratio) ? ratio : 0.4)));
    sync();
  });
  battle.on('deploy', (c) => { if (c.unit.ownerId === pid) { oldTier = -1; sync(); } });
  battle.on('damaged', (c) => { if (c.target === field) sync(); });
  battle.on('healed', (c) => {
    if (c.target !== field || !(c.amount > 0)) return;
    if (battle.flags.layerGainsEnabled) {
      progress += c.amount / field.s.maxHp;
      while (progress + 1e-9 >= healThreshold) {
        progress -= healThreshold;
        const other = highestOtherBond();
        if (battle.round <= 7) gainLayers(battle, { playerId: pid, bonds: SHU_DEPUTY, n: 1, requireActive: true, source: field, reason: 'band' });
        if (other) gainLayers(battle, { playerId: pid, bonds: other, n: 1, requireActive: true, source: field, reason: 'band' });
      }
    }
    sync();
  });
  battle.on('layerGain', (c) => {
    if (c.playerId !== pid || c.bondId !== SHU_DEPUTY) return;
    battle.after(0, () => {
      const bonus = deputyHealBonus(battle, pid);
      for (const u of mine(battle, pid)) {
        battle.removeBuff(u, 'band:shu:deputy-heal');
        if (bonus > 0) passiveBuff(battle, u, 'band:shu:deputy-heal', { healingDealtMul: 1 + bonus });
      }
    });
  });
  battle.on('battleStart', () => {
    const bonus = deputyHealBonus(battle, pid);
    if (bonus > 0) for (const u of mine(battle, pid)) passiveBuff(battle, u, 'band:shu:deputy-heal', { healingDealtMul: 1 + bonus });
  });
  battle.on('tick', ({ dt }) => {
    if (!fieldUp()) return;
    if (battle.kind !== 'unite') {
      const loss = ((Number(p.max_hp_loss) || 0.04) * maxHp + (Number(p.current_hp_loss) || 0.06) * field.hp) * dt;
      field.hp = Math.max(1, field.hp - loss);
    }
    sync();
    if (tier() >= 2) for (const u of mine(battle, pid)) if (u.alive && u.deployed) holdProtect(battle, u, 0.15, dt * 2, field);
  });
  // The result serialises the unspent progress for the next battle/round. It is validated by the match server.
  battle.on('battleEnd', () => { const pp = battle._pp(pid); if (pp) pp.shuProgress = progress; });
}
