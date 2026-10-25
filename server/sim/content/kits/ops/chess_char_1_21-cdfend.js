// 机械师「技术传承」的隐藏一阶盟约·重装干员。仅 5–8 人模式的策略可赠送。
import { num, talentBb, traitBb, holdProtect, byEnemyAttack, up, statBuff } from '../shared/tier1.js';
import { hasHp } from '../../../damage.js';

const ASTX = 'technician:astx';

function technician(bb, chess) {
  const talent = talentBb(chess, 0);
  const trait = traitBb(chess);
  const shelter = num(bb.protection);
  const moduleScale = num(trait.atk_scale);
  return {
    trait: { dmgType: 'phys' },
    skill: {
      kind: 'duration',
      attack: { dmgType: 'arts', hitAllBlocked: true },
      onStart({ battle, unit }) { holdProtect(battle, unit, shelter, 0.2, unit); },
      onTick({ battle, unit }) { holdProtect(battle, unit, shelter, 0.2, unit); },
    },
    talents: [{ install(battle, unit) {
      statBuff(battle, unit, 'technician:selfRes', { resFlat: num(talent.self_res) });
      const allyRes = num(talent.ally_res);
      if (allyRes <= 0) return;
      battle.every(0.1, () => {
        if (!up(unit)) return;
        for (const ally of battle.allyUnits) {
          if (ally === unit || !up(ally) || ally.kind === 'device') continue;
          if (Math.max(Math.abs(ally.tileR - unit.tileR), Math.abs(ally.tileC - unit.tileC)) > 1) continue;
          battle.addBuff(ally, { key: `technician:allyRes:${unit.id}`, duration: 0.2,
            mods: { resFlat: allyRes }, source: unit, tags: ['talent'] });
        }
      }, { owner: unit, immediate: true });
    } }],
    install(battle, unit) {
      if (moduleScale > 0) {
        battle.on('damaged', (ctx) => {
          const target = ctx.target;
          if (ctx.source !== unit || !ctx.dmg?.isAttack || ctx.type === 'element' ||
              !target || target.side !== 'enemy' || !hasHp(target) ||
              ctx.dmg?.tags?.includes(ASTX)) return;
          battle.dealDamage(unit, target, { amount: unit.s.atk * moduleScale, type: 'arts',
            canDodge: false, tags: ['module', ASTX] });
        }, { owner: unit, priority: -20 });
        battle.on('damaged', (ctx) => {
          const source = ctx.source;
          if (ctx.target !== unit || !unit.alive || !byEnemyAttack(ctx) || !source.alive) return;
          battle.dealDamage(unit, source, { amount: unit.s.atk * moduleScale, type: 'arts',
            ignoreSelect: true, tags: ['module', ASTX, 'counter'] });
        }, { owner: unit });
      }
    },
  };
}

export default { chess_char_1_21_a: technician };
