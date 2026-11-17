// 盟约·重装干员（chess_char_1_21_a / _b）：机械师策略第 1 回合赠送的自创卡。
// 模板是泥岩的棋子（chess_char_1_15_a），模型用预备干员-重装（char_602_cdfend）。
// 战斗逻辑：server/sim/content/kits/ops/chess_char_1_21-cdfend.js。设计：docs/research/technician-strategy.md。

export const BASE_ID = 'chess_char_1_21_a';
export const ELITE_ID = 'chess_char_1_21_b';
const SKILL_ID = 'sktech_defender_1';

const stats = (elite) => ({
  maxHp: elite ? 2702 : 2010, atk: elite ? 519 : 416, def: elite ? 496 : 390,
  res: 15, cost: 21, blockCnt: 3, bat: 1.6, aspd: 100, respawnTime: 70,
  spRecovery: 1, hpRecoveryPerSec: 0, moveSpeed: 1, tauntLevel: 0,
  massLevel: 0, deployLimit: 1, deckStack: 0,
});
const skill = (elite) => ({
  skillId: SKILL_ID, iconId: 'skchr_hsgma2_1', name: '技术庇护', level: elite ? 7 : 4,
  desc: `技能开启期间获得${elite ? 18 : 12}%庇护，同时攻击自身阻挡的所有敌人，攻击改为法术伤害`,
  descRaw: `技能开启期间获得${elite ? 18 : 12}%庇护，同时攻击自身阻挡的所有敌人，攻击改为法术伤害`,
  skillType: 'MANUAL', durationType: 'NONE', duration: 25, spType: 'INCREASE_WITH_TIME',
  spCost: elite ? 34 : 38, initSp: elite ? 17 : 15, maxChargeTime: 1, increment: 1,
  bb: { protection: elite ? 0.18 : 0.12 }, bbStr: {}, rangeId: null, rangeGrid: null,
  prefabId: SKILL_ID, trigger: { rule: 'DEFAULT', rawRule: 'DEFAULT', customRangeGrid: null },
  index: 0, overrideTokenKey: null,
});

export default function addAllianceDefender({ chess, garrisons, backups, copy, stripElite, joinBonds }) {
  const pith = chess.chess_char_1_15_a;
  if (!pith || !backups.char_602_cdfend) throw new Error('Pith or reserve defender data missing');
  for (const elite of [false, true]) {
    const id = elite ? ELITE_ID : BASE_ID;
    const record = copy(pith);
    Object.assign(record, {
      chessId: id, baseId: BASE_ID, goldenId: ELITE_ID, isGolden: elite, identifier: elite ? 267 : 134,
      shopSortId: 21, charId: 'char_602_cdfend', name: '盟约·重装干员',
      appellation: 'Alliance/Defender Operator', profession: 'TANK',
      subProfessionId: 'artsprotector', subProfessionName: '驭法铁卫', position: 'MELEE',
      bonds: ['steadShip', 'arcaneShip', 'deputShip'], garrisonIds: [elite ? 'garrison_technician_b' : 'garrison_technician_a'],
      upgradeNum: elite ? 0 : 3, upgradeChessId: elite ? null : ELITE_ID,
      backup: { charId: 'char_602_cdfend', tmplId: null, skillIndex: 0, uniEquipId: null, potRank: 0 },
      status: { phase: 2, level: elite ? 60 : 1, skillLevel: elite ? 7 : 4, equipLevel: elite ? 1 : 0 },
      stats: stats(elite), rangeId: '1-1', rangeGrid: [[0, 0], [0, 1]],
      dmgType: 'phys', attackKind: 'melee', projectile: 'none', canHitFly: false,
      trait: {
        desc: `技能开启时普通攻击造成法术伤害${elite ? '；攻击和受到攻击时对目标额外造成攻击力10%的法术伤害' : ''}`,
        bb: elite ? { atk_scale: 0.1 } : {},
        bbStr: {}, rangeGrid: null,
      },
      skill: skill(elite), skills: [{ ...skill(elite), isDefault: true }],
      talents: [{ index: 0, name: '技术支援', desc: '自身法术抗性+10，周围八格友方单位法术抗性+5',
        bb: { self_res: 10, ally_res: 5 }, bbStr: {}, rangeGrid: null, tokenKey: null, hidden: false, fromModule: false }],
      tokens: [], module: { id: 'uniequip_999_technician', name: '技术传承', type: 'AST-X', level: elite ? 1 : 0, active: elite },
      assets: { avatar: 'char_602_cdfend', portrait: 'char_602_cdfend_1', spine: 'char_602_cdfend',
        skillIcon: 'skchr_hsgma2_1', subProfIcon: 'sub_artsprotector_icon' },
    });
    record.trait.descRaw = record.trait.desc;
    if (elite) {
      record.statsBase = copy(record.stats);
      record.traitBase = copy(record.trait);
      record.talentsBase = copy(record.talents);
      record.modules = [{ uniEquipId: 'uniequip_999_technician', name: '技术传承', typeName: 'AST-X',
        typeIcon: 'ast-x', icon: 'uniequip_002_hsgma2', isDefault: true, level: 1,
        attr: {}, traitOverride: copy(record.trait), talentChanges: [] }];
    } else {
      stripElite(record);
    }
    chess[id] = record;
    // 作战特质：坚守 / 奥术 / 助力每 5 层，防御力 +1%（进阶 +2%）
    const garrisonId = record.garrisonIds[0];
    const desc = `<战斗中>【坚守】【奥术】【助力】每叠加5层，本干员防御力+${elite ? 2 : 1}%`;
    garrisons[garrisonId] = {
      garrisonId, desc, descRaw: desc.replace(/\+(\d+)%$/, '<@ba.vup>+$1%</>'),
      eventType: 'IN_BATTLE', eventTypeDesc: '作战能力', eventTypeIcon: 'icon_battle',
      effectType: 'GAIN_BUFF', effectKey: 'act1autochess_gar_eff_attrByBond',
      battleRuneKey: 'env_gbuff_new_with_verify', charLevel: 0,
      bb: { divide_num: 5, def: elite ? 0.02 : 0.01 },
      bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: 'steadShip,arcaneShip,deputShip' },
      owners: [id],
    };
  }
  joinBonds(BASE_ID);
}
