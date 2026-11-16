// Local 5–8 player strategy content. Run after tools/build-data.mjs when regenerating data/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHU_HEAL_THRESHOLD } from '../shared/shuStrategy.js';

const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
export function injectTechnicianData(dir = defaultDir) {
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(value)}\n`);
const copy = (value) => structuredClone(value);

const chess = read('chess');
const bonds = read('bonds');
const garrisons = read('garrisons');
const bands = read('bands');
const assets = read('assets');
const tokens = read('tokens');
const pith = chess.chess_char_1_15_a;
const reserve = read('backups').units.char_602_cdfend;
if (!pith || !reserve) throw new Error('Pith or reserve defender data missing');
const backups = read('backups').units;

const baseId = 'chess_char_1_21_a';
const eliteId = 'chess_char_1_21_b';
const skillId = 'sktech_defender_1';
const stats = (elite) => ({
  maxHp: elite ? 2702 : 2010, atk: elite ? 519 : 416, def: elite ? 496 : 390,
  res: 15, cost: 21, blockCnt: 3, bat: 1.6, aspd: 100, respawnTime: 70,
  spRecovery: 1, hpRecoveryPerSec: 0, moveSpeed: 1, tauntLevel: 0,
  massLevel: 0, deployLimit: 1, deckStack: 0,
});
const skill = (elite) => ({
  skillId, iconId: 'skchr_hsgma2_1', name: '技术庇护', level: elite ? 7 : 4,
  desc: `技能开启期间获得${elite ? 18 : 12}%庇护，同时攻击自身阻挡的所有敌人，攻击改为法术伤害`,
  descRaw: `技能开启期间获得${elite ? 18 : 12}%庇护，同时攻击自身阻挡的所有敌人，攻击改为法术伤害`,
  skillType: 'MANUAL', durationType: 'NONE', duration: 25, spType: 'INCREASE_WITH_TIME',
  spCost: elite ? 34 : 38, initSp: elite ? 17 : 15, maxChargeTime: 1, increment: 1,
  bb: { protection: elite ? 0.18 : 0.12 }, bbStr: {}, rangeId: null, rangeGrid: null,
  prefabId: skillId, trigger: { rule: 'DEFAULT', rawRule: 'DEFAULT', customRangeGrid: null },
  index: 0, overrideTokenKey: null,
});
for (const elite of [false, true]) {
  const id = elite ? eliteId : baseId;
  const record = copy(pith);
  Object.assign(record, {
    chessId: id, baseId, goldenId: eliteId, isGolden: elite, identifier: elite ? 267 : 134,
    shopSortId: 21, charId: 'char_602_cdfend', name: '盟约·重装干员',
    appellation: 'Alliance/Defender Operator', profession: 'TANK',
    subProfessionId: 'artsprotector', subProfessionName: '驭法铁卫', position: 'MELEE',
    bonds: ['steadShip', 'arcaneShip', 'deputShip'], garrisonIds: [elite ? 'garrison_technician_b' : 'garrison_technician_a'],
    upgradeNum: elite ? 0 : 3, upgradeChessId: elite ? null : eliteId,
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
    delete record.statsBase;
    delete record.traitBase;
    delete record.talentsBase;
    delete record.modules;
  }
  chess[id] = record;
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

// 巡海小队's two reward-only tier-I operators use the reserve models and ordinary attacks.
// Their battle traits scale with active 阿戈尔 layers; neither has a skill, talent or module.
for (const spec of [
  {
    slot: 22, name: '见习海巡队-术师', charId: 'char_604_ccast', bonds: ['egirShip', 'arcaneShip'],
    traitStat: 'attack_speed', traitText: '攻击速度+1',
    normal: { maxHp: 1111, atk: 457, def: 96, res: 15, cost: 18, bat: 1.6, blockCnt: 1 },
    elite: { maxHp: 1322, atk: 535, def: 107, res: 20, cost: 18, bat: 1.6, blockCnt: 1 },
  },
  {
    slot: 23, name: '见习海巡队-重装', charId: 'char_602_cdfend', bonds: ['egirShip', 'steadShip'],
    traitStat: 'def', traitText: '防御力+1%',
    normal: { maxHp: 2083, atk: 271, def: 399, res: 0, cost: 18, bat: 1.2, blockCnt: 3 },
    elite: { maxHp: 2776, atk: 311, def: 515, res: 0, cost: 20, bat: 1.2, blockCnt: 3 },
  },
]) {
  const model = backups[spec.charId];
  if (!model) throw new Error(`reserve model missing: ${spec.charId}`);
  for (const elite of [false, true]) {
    const id = `chess_char_1_${spec.slot}_${elite ? 'b' : 'a'}`;
    const baseId = `chess_char_1_${spec.slot}_a`;
    const goldenId = `chess_char_1_${spec.slot}_b`;
    const form = model.forms[elite ? '2/60/7/1' : '2/1/4/0'];
    if (!form) throw new Error(`reserve form missing: ${spec.charId}`);
    const record = copy(pith);
    Object.assign(record, {
      chessId: id, baseId, goldenId, isGolden: elite, identifier: 268 + 2 * (spec.slot - 22) + Number(elite),
      shopSortId: spec.slot, charId: spec.charId, name: spec.name, appellation: spec.name,
      rarity: 4, profession: model.profession, subProfessionId: model.subProfessionId,
      subProfessionName: model.subProfessionName, position: model.position,
      nationId: model.nationId, bonds: spec.bonds,
      garrisonIds: [`garrison_patrol_${spec.slot}_${elite ? 'b' : 'a'}`],
      backup: { charId: spec.charId, tmplId: null, skillIndex: 0, uniEquipId: null, potRank: 0 },
      upgradeNum: elite ? 0 : 3, upgradeChessId: elite ? null : goldenId,
      status: { phase: elite ? 2 : 1, level: elite ? 50 : 55, skillLevel: 0, equipLevel: 0 },
      stats: { ...copy(form.stats), ...(elite ? spec.elite : spec.normal), respawnTime: 70 },
      immunities: copy(form.immunities), rangeId: form.rangeId, rangeGrid: copy(form.rangeGrid),
      dmgType: form.dmgType, attackKind: form.attackKind, projectile: form.projectile,
      canHitFly: form.canHitFly, targetPriority: form.targetPriority,
      trait: copy(form.trait), skill: null, skills: [], talents: [], tokens: [], module: null,
      assets: { avatar: elite ? model.assets.avatarGolden : model.assets.avatar,
        portrait: elite ? model.assets.portraitGolden : model.assets.portrait,
        spine: model.assets.spine, subProfIcon: model.assets.subProfIcon },
    });
    delete record.statsBase;
    delete record.traitBase;
    delete record.talentsBase;
    delete record.modules;
    chess[id] = record;
    const source = garrisons[elite ? 'garrison_18_b' : 'garrison_18_a'];
    if (!source) throw new Error('Deep Patrol battle trait missing');
    const desc = `<战斗中>【阿戈尔】每叠加5层，本干员${spec.traitText}`;
    garrisons[record.garrisonIds[0]] = {
      ...copy(source), garrisonId: record.garrisonIds[0], owners: [id], desc,
      descRaw: desc.replace(/\+(\d+)%?$/, (match) => `<@ba.vup>${match}</>`),
      effectType: 'GAIN_BUFF', effectKey: 'act1autochess_gar_eff_attrByBond',
      bb: { divide_num: 5, [spec.traitStat]: spec.traitStat === 'def' ? 0.01 : 1 },
      bbStr: { key: 'act1autochess_gar_eff_attrByBond', bond_id: 'egirShip' },
    };
  }
}
for (const id of [baseId, 'chess_char_1_22_a', 'chess_char_1_23_a']) {
  for (const bondId of chess[id].bonds) {
    const members = bonds[bondId]?.members;
    if (!Array.isArray(members)) throw new Error(`bond missing for local operator: ${bondId}`);
    if (!members.includes(id)) members.push(id);
  }
}

bands.band_technician = {
  bandId: 'band_technician', sortId: 99, name: '机械师', iconId: 'icon_technician',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 21,
  effectId: 'aceffect_band_technician', effectName: '技术传承',
  desc: '【技术传承】第1回合获得1名盟约·重装干员，属于坚守、奥术、助力盟约。',
  descRaw: '【技术传承】第1回合获得1名盟约·重装干员，属于坚守、奥术、助力盟约。',
  buffs: [{ key: 'preparation_start_gain_chess_from_round', bb: { round: 1, count: 1 },
    bbStr: { type: 'char', chess: baseId } }],
  params: { round: 1, count: 1, type: 'char', chess: baseId },
  victorCount: 3, rewardModulus: 1, unlockDesc: null,
  bondIds: ['steadShip', 'arcaneShip', 'deputShip'],
};
bands.band_eunectes = {
  bandId: 'band_eunectes', sortId: 100, name: '森蚺', iconId: 'icon_eunectes',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 33,
  effectId: 'aceffect_band_eunectes', effectName: '机械援助',
  desc: '【机械援助】所有玩家场地上出现1个“双眼皮”。攻击力500，造成物理范围伤害；优先攻击领袖，否则攻击当前生命值最高的敌人。已激活盟约总层数超过50后，每层攻击速度+1、命中附加0.1%脆弱（最多300有效层）；每30有效层使命中敌人的防御力和法术抗性降低2%，持续2秒、不叠加，最多降低20%；总层数达到350时额外发射1颗射弹，优先攻击当前生命值最低的敌人。',
  descRaw: '【机械援助】所有玩家场地上出现1个“双眼皮”。攻击力500，造成物理范围伤害；优先攻击领袖，否则攻击当前生命值最高的敌人。已激活盟约总层数超过50后，每层攻击速度+1、命中附加0.1%脆弱（最多300有效层）；每30有效层使命中敌人的防御力和法术抗性降低2%，持续2秒、不叠加，最多降低20%；总层数达到350时额外发射1颗射弹，优先攻击当前生命值最低的敌人。',
  buffs: [], params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: [],
};
bands.band_yela = {
  bandId: 'band_yela', sortId: 101, name: '耶拉', iconId: 'icon_yela',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 26,
  effectId: 'aceffect_band_yela', effectName: '圣山护佑',
  desc: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。第5回合开始时获得一名谢拉格干员；从第5回合起，每累计2个自身未损失目标生命值的回合，就在下一休整期开始时随机获得一名不超过当前调度中心等级的谢拉格干员；掉血回合不计数，也不清零。',
  descRaw: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。第5回合开始时获得一名谢拉格干员；从第5回合起，每累计2个自身未损失目标生命值的回合，就在下一休整期开始时随机获得一名不超过当前调度中心等级的谢拉格干员；掉血回合不计数，也不清零。',
  buffs: [
    { key: 'band_yela_kjerag_grant', bb: { first_grant_round: 5, count_from_round: 5, count: 1 }, bbStr: { bond: 'kjeragShip' } },
  ],
  params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: ['kjeragShip'],
};
bands.band_udflow = {
  bandId: 'band_udflow', sortId: 102, name: '深巡', iconId: 'icon_udflow',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 24,
  effectId: 'aceffect_band_udflow', effectName: '巡海小队',
  desc: '【巡海小队】第1、2、3回合开始时，分别获得深巡、见习海巡队-术师、见习海巡队-重装。两名见习干员属于阿戈尔盟约，并分别属于奥术、坚守盟约；术师每叠加5层阿戈尔攻击速度+1，重装每叠加5层阿戈尔防御力+1%。',
  descRaw: '【巡海小队】第1、2、3回合开始时，分别获得深巡、见习海巡队-术师、见习海巡队-重装。两名见习干员属于阿戈尔盟约，并分别属于奥术、坚守盟约；术师每叠加5层阿戈尔攻击速度+1，重装每叠加5层阿戈尔防御力+1%。',
  buffs: [
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 1, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_04_a' } },
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 2, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_22_a' } },
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 3, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_23_a' } },
  ],
  params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null,
  bondIds: ['egirShip', 'arcaneShip', 'steadShip'],
};
bands.band_lumen = {
  bandId: 'band_lumen', sortId: 103, name: '流明', iconId: 'icon_lumen',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 27,
  effectId: 'aceffect_band_lumen', effectName: '凡人之愿',
  desc: '【凡人之愿】休整期结束时，整备区中每名干员所属的已激活盟约分别增加2层；此效果使同一盟约每回合最多增加6层。',
  descRaw: '【凡人之愿】休整期结束时，整备区中每名干员所属的已激活盟约分别增加2层；此效果使同一盟约每回合最多增加6层。',
  buffs: [{ key: 'band_lumen_board_bond_layers', bb: { layer: 2, max_count: 6 }, bbStr: {} }],
  params: { layer: 2, max_count: 6 }, victorCount: 3, rewardModulus: 1, unlockDesc: null,
  bondIds: [],
};
bands.band_shu = {
  bandId: 'band_shu', sortId: 104, name: '黍', iconId: 'icon_shu',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 24,
  effectId: 'aceffect_band_shu', effectName: '百谷长青',
  desc: '【百谷长青】田块从40%生命值开始。每累计治疗其100%最大生命值，第1至7回合使已激活的<助力>层数+1；第7回合起还使除<助力>外符合条件且层数最高的已激活盟约+1层（排除远见、奇迹、投资人及不可叠层盟约），第8回合起不再增加<助力>层数。第7回合<助力>计数永久+1。田块生命比例越高，我方攻击速度等增益越强。',
  descRaw: '【百谷长青】田块从40%生命值开始。每累计治疗其100%最大生命值，第1至7回合使已激活的<助力>层数+1；第7回合起还使除<助力>外符合条件且层数最高的已激活盟约+1层（排除远见、奇迹、投资人及不可叠层盟约），第8回合起不再增加<助力>层数。第7回合<助力>计数永久+1。田块生命比例越高，我方攻击速度等增益越强。',
  buffs: [{ key: 'band_shu_field', bb: { max_hp: 5000, max_hp_loss: 0.04, current_hp_loss: 0.06, starting_hp_ratio: 0.4, heal_threshold: SHU_HEAL_THRESHOLD }, bbStr: { key: 'band_shu_field' } }],
  params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: [],
};
assets.bands.band_technician = '/assets/band/band_technician.png';
assets.bands.band_eunectes = '/assets/band/band_eunectes.png';
assets.bands.band_yela = '/assets/band/band_yela.png';
assets.bands.band_udflow = '/assets/band/band_udflow.png';
assets.bands.band_lumen = '/assets/band/band_lumen.png';
// User-provided 黍 strategy avatar in the local assets directory; choice cards reuse the bounty presentation.
assets.bands.band_shu = '/assets/band/band_shu.png';
tokens.token_shu_field = {
  tokenId: 'token_shu_field', kind: 'summon', name: '田块', appellation: 'Field',
  desc: '黍策略的特殊召唤物。不可被摧毁；治疗会使所选已激活盟约增加层数。',
  descRaw: '黍策略的特殊召唤物。不可被摧毁；治疗会使所选已激活盟约增加层数。',
  profession: 'TOKEN', subProfessionId: 'notchar1', position: 'ALL', displayType: 'DEFAULT',
  placeable: true, ownerRange: false, owners: [],
  stats: { maxHp: 5000, atk: 0, def: 0, res: 0, cost: 0, blockCnt: 0, bat: 1, aspd: 100,
    respawnTime: 0, spRecovery: 0, hpRecoveryPerSec: 0, moveSpeed: 0, tauntLevel: -1,
    massLevel: 0, deployLimit: 1, deckStack: 0 },
  rangeGrid: [], dmgType: 'phys', attackKind: 'none', canHitFly: false,
  skill: null, deployLimit: 1, count: 1, abnormal: [], variants: {},
};
assets.tokens.token_shu_field = { avatar: '/assets/band/band_shu.png' };
delete assets.devices?.eunectesIdle;
delete assets.devices?.eunectesAttack;
if (assets.devices && !Object.keys(assets.devices).length) delete assets.devices;
// The strategies' effect records (data/effects.json, like every official band's): the text the game shows for the band —
// their battle and prep logic is in code (server/sim/content/bands, server/match), which reads bands.json, not these.
// Without them the plugin data check (shared/plugins/validate.js) refuses every data plugin: "band …: effect missing".
const effects = read('effects');
for (const id of ['band_technician', 'band_eunectes', 'band_yela', 'band_udflow', 'band_lumen', 'band_shu']) {
  const b = bands[id];
  effects[b.effectId] = {
    effectId: b.effectId, effectType: 'BAND_INITIAL', name: b.effectName, desc: b.desc, descRaw: b.descRaw,
    counterType: 'NONE', continuedRound: -1, decoIconId: null, enemyPrice: 0, buffs: copy(b.buffs), params: copy(b.params),
  };
}
write('effects', effects);
write('chess', chess);
write('bonds', bonds);
write('garrisons', garrisons);
write('bands', bands);
write('assets', assets);
write('tokens', tokens);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) injectTechnicianData();
