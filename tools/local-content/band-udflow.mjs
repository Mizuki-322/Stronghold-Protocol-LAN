// 深巡「巡海小队」：第 1、2、3 回合分别送深巡、见习海巡队-术师、见习海巡队-重装（op-patrol-trainees.mjs）。
// 赠卡用官方的 preparation_start_gain_chess_from_round 效果。规则：docs/design/extended-coop.md。

export default function addUdflow({ addBand }) {
  addBand({
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
  });
}
