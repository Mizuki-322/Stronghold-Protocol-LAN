// 耶拉「圣山护佑」：可以打冻结的敌人；第 5 回合起按无损回合送谢拉格干员。
// 逻辑：server/sim/content/bands/meta.js（band_yela_kjerag_grant）、server/sim/content/kits/ops/chess_char_3_20-kjera.js。
// 规则：docs/design/extended-coop.md。

export default function addYela({ addBand }) {
  addBand({
    bandId: 'band_yela', sortId: 101, name: '耶拉', iconId: 'icon_yela',
    modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 26,
    effectId: 'aceffect_band_yela', effectName: '圣山护佑',
    desc: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。第5回合开始时获得一名谢拉格干员；从第5回合起，每累计2个自身未损失目标生命值的回合，就在下一休整期开始时随机获得一名不超过当前调度中心等级的谢拉格干员；掉血回合不计数，也不清零。',
    descRaw: '【圣山护佑】耶拉可以攻击战场上处于冻结状态的敌人。第5回合开始时获得一名谢拉格干员；从第5回合起，每累计2个自身未损失目标生命值的回合，就在下一休整期开始时随机获得一名不超过当前调度中心等级的谢拉格干员；掉血回合不计数，也不清零。',
    buffs: [
      { key: 'band_yela_kjerag_grant', bb: { first_grant_round: 5, count_from_round: 5, count: 1 }, bbStr: { bond: 'kjeragShip' } },
    ],
    params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: ['kjeragShip'],
  });
}
