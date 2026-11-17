// 机械师「技术传承」：第 1 回合送一张盟约·重装干员（op-alliance-defender.mjs）。
// 赠卡用官方的 preparation_start_gain_chess_from_round 效果，没有专门的代码。设计：docs/research/technician-strategy.md。
import { BASE_ID } from './op-alliance-defender.mjs';

export default function addTechnician({ addBand }) {
  addBand({
    bandId: 'band_technician', sortId: 99, name: '机械师', iconId: 'icon_technician',
    modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 21,
    effectId: 'aceffect_band_technician', effectName: '技术传承',
    desc: '【技术传承】第1回合获得1名盟约·重装干员，属于坚守、奥术、助力盟约。',
    descRaw: '【技术传承】第1回合获得1名盟约·重装干员，属于坚守、奥术、助力盟约。',
    buffs: [{ key: 'preparation_start_gain_chess_from_round', bb: { round: 1, count: 1 },
      bbStr: { type: 'char', chess: BASE_ID } }],
    params: { round: 1, count: 1, type: 'char', chess: BASE_ID },
    victorCount: 3, rewardModulus: 1, unlockDesc: null,
    bondIds: ['steadShip', 'arcaneShip', 'deputShip'],
  });
}
