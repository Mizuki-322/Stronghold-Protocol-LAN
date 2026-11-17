// 森蚺「机械援助」：每名玩家场地上一台“双眼皮”装置。
// 逻辑：server/sim/content/devices.js、server/match/match/infra.js、shared/eunectesRange.js；
// 客户端 public/js/ui/gameLogic/terrain.js。规则：docs/design/extended-coop.md。

export default function addEunectes({ addBand, assets }) {
  addBand({
    bandId: 'band_eunectes', sortId: 100, name: '森蚺', iconId: 'icon_eunectes',
    modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 33,
    effectId: 'aceffect_band_eunectes', effectName: '机械援助',
    desc: '【机械援助】所有玩家场地上出现1个“双眼皮”。攻击力500，造成物理范围伤害；优先攻击领袖，否则攻击当前生命值最高的敌人。已激活盟约总层数超过50后，每层攻击速度+1、命中附加0.1%脆弱（最多300有效层）；每30有效层使命中敌人的防御力和法术抗性降低2%，持续2秒、不叠加，最多降低20%；总层数达到350时额外发射1颗射弹，优先攻击当前生命值最低的敌人。',
    descRaw: '【机械援助】所有玩家场地上出现1个“双眼皮”。攻击力500，造成物理范围伤害；优先攻击领袖，否则攻击当前生命值最高的敌人。已激活盟约总层数超过50后，每层攻击速度+1、命中附加0.1%脆弱（最多300有效层）；每30有效层使命中敌人的防御力和法术抗性降低2%，持续2秒、不叠加，最多降低20%；总层数达到350时额外发射1颗射弹，优先攻击当前生命值最低的敌人。',
    buffs: [], params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: [],
  });
  // 早期版本给装置单独登记过动作素材，现在不用了
  delete assets.devices?.eunectesIdle;
  delete assets.devices?.eunectesAttack;
  if (assets.devices && !Object.keys(assets.devices).length) delete assets.devices;
}
