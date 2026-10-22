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
const garrisons = read('garrisons');
const bands = read('bands');
const assets = read('assets');
const pith = chess.chess_char_1_15_a;
const reserve = read('backups').units.char_602_cdfend;
if (!pith || !reserve) throw new Error('Pith or reserve defender data missing');

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
  index: 0, overrideTokenKey: null, isDefault: true,
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
    skill: skill(elite), skills: [skill(elite)],
    talents: [{ index: 0, name: '技术支援', desc: '自身法术抗性+10，周围八格友方单位法术抗性+5',
      bb: { self_res: 10, ally_res: 5 }, bbStr: {}, rangeGrid: null, tokenKey: null, hidden: false, fromModule: false }],
    tokens: [], module: { id: 'tech_artsprotector_x', name: '技术传承', type: 'AST-X', level: elite ? 1 : 0, active: elite },
    assets: { avatar: 'char_602_cdfend', portrait: 'char_602_cdfend_1', spine: 'char_602_cdfend',
      skillIcon: 'skchr_hsgma2_1', subProfIcon: 'sub_artsprotector_icon' },
  });
  record.trait.descRaw = record.trait.desc;
  if (elite) {
    record.modules = [{ uniEquipId: 'tech_artsprotector_x', name: '技术传承', typeName: 'AST-X',
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
  desc: '【机械援助】所有玩家场地上出现1个“双眼皮”。“双眼皮”造成法术伤害，优先攻击领袖，攻击可弹射两次；已激活盟约总层数超过50后，每层使其攻击速度+1、命中附加0.1%脆弱（至多300层）。',
  descRaw: '【机械援助】所有玩家场地上出现1个“双眼皮”。“双眼皮”造成法术伤害，优先攻击领袖，攻击可弹射两次；已激活盟约总层数超过50后，每层使其攻击速度+1、命中附加0.1%脆弱（至多300层）。',
  buffs: [], params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: [],
};
assets.bands.band_technician = '/assets/band/band_technician.png';
assets.bands.band_eunectes = '/assets/band/band_eunectes.png';
delete assets.devices?.eunectesIdle;
delete assets.devices?.eunectesAttack;
if (assets.devices && !Object.keys(assets.devices).length) delete assets.devices;
write('chess', chess);
write('garrisons', garrisons);
write('bands', bands);
write('assets', assets);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) injectTechnicianData();
