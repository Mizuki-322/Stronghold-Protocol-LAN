// Local 5–8 player strategy content. Run after tools/build-data.mjs when regenerating data/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Their battle trait is 深巡's tier-matched anti-seamonster trait; neither has a skill, talent or module.
for (const spec of [
  {
    slot: 22, name: '见习海巡队-术师', charId: 'char_604_ccast', bonds: ['egirShip', 'arcaneShip'],
    normal: { maxHp: 1111, atk: 457, def: 96, res: 15, cost: 18, bat: 1.6, blockCnt: 1 },
    elite: { maxHp: 1322, atk: 535, def: 107, res: 20, cost: 18, bat: 1.6, blockCnt: 1 },
  },
  {
    slot: 23, name: '见习海巡队-重装', charId: 'char_602_cdfend', bonds: ['egirShip', 'steadShip'],
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
    garrisons[record.garrisonIds[0]] = { ...copy(source), garrisonId: record.garrisonIds[0], owners: [id] };
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
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 28,
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
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 24,
  effectId: 'aceffect_band_yela', effectName: '圣山护佑',
  desc: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。进入第4回合时获得耶拉；进入第7回合时获得一名不超过当前调度中心等级的谢拉格干员，优先未持有的干员。第8回合起，若本回合自身未损失目标生命值，下个休整期开始时再获得一名符合相同条件的谢拉格干员。',
  descRaw: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。进入第4回合时获得耶拉；进入第7回合时获得一名不超过当前调度中心等级的谢拉格干员，优先未持有的干员。第8回合起，若本回合自身未损失目标生命值，下个休整期开始时再获得一名符合相同条件的谢拉格干员。',
  buffs: [
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 4, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_3_20_a' } },
    { key: 'band_yela_kjerag_grant', bb: { round: 7, reward_from_round: 8, count: 1 }, bbStr: { bond: 'kjeragShip' } },
  ],
  params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: ['kjeragShip'],
};
bands.band_udflow = {
  bandId: 'band_udflow', sortId: 102, name: '深巡', iconId: 'icon_udflow',
  modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 24,
  effectId: 'aceffect_band_udflow', effectName: '巡海小队',
  desc: '【巡海小队】第3、5、7回合开始时，分别获得深巡、见习海巡队-术师、见习海巡队-重装。两名见习干员属于阿戈尔盟约，并分别属于奥术、坚守盟约；他们攻击海怪时的攻击力提升比例与同形态深巡相同。',
  descRaw: '【巡海小队】第3、5、7回合开始时，分别获得深巡、见习海巡队-术师、见习海巡队-重装。两名见习干员属于阿戈尔盟约，并分别属于奥术、坚守盟约；他们攻击海怪时的攻击力提升比例与同形态深巡相同。',
  buffs: [
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 3, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_04_a' } },
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 5, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_22_a' } },
    { key: 'preparation_start_gain_chess_from_round', bb: { round: 7, count: 1 }, bbStr: { type: 'char', chess: 'chess_char_1_23_a' } },
  ],
  params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null,
  bondIds: ['egirShip', 'arcaneShip', 'steadShip'],
};
assets.bands.band_technician = '/assets/band/band_technician.png';
assets.bands.band_eunectes = '/assets/band/band_eunectes.png';
assets.bands.band_yela = '/assets/band/band_yela.png';
assets.bands.band_udflow = '/assets/band/band_udflow.png';
delete assets.devices?.eunectesIdle;
delete assets.devices?.eunectesAttack;
if (assets.devices && !Object.keys(assets.devices).length) delete assets.devices;
write('chess', chess);
write('bonds', bonds);
write('garrisons', garrisons);
write('bands', bands);
write('assets', assets);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) injectTechnicianData();
