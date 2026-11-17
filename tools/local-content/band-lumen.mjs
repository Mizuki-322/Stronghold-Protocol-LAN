// 流明「凡人之愿」：休整期结束时，整备区里每名干员给自己的已激活盟约 +2 层（同一盟约每回合最多 +6）。
// 逻辑：server/sim/content/bands/meta.js（band_lumen_board_bond_layers）。规则：docs/design/extended-coop.md。

export default function addLumen({ addBand }) {
  addBand({
    bandId: 'band_lumen', sortId: 103, name: '流明', iconId: 'icon_lumen',
    modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 27,
    effectId: 'aceffect_band_lumen', effectName: '凡人之愿',
    desc: '【凡人之愿】休整期结束时，整备区中每名干员所属的已激活盟约分别增加2层；此效果使同一盟约每回合最多增加6层。',
    descRaw: '【凡人之愿】休整期结束时，整备区中每名干员所属的已激活盟约分别增加2层；此效果使同一盟约每回合最多增加6层。',
    buffs: [{ key: 'band_lumen_board_bond_layers', bb: { layer: 2, max_count: 6 }, bbStr: {} }],
    params: { layer: 2, max_count: 6 }, victorCount: 3, rewardModulus: 1, unlockDesc: null,
    bondIds: [],
  });
}
