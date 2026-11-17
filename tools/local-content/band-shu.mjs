// 黍「百谷长青」：场上一块不可摧毁的“田块”，治疗它给盟约加层；田块生命比例越高增益越强。
// 逻辑：shared/shuStrategy.js、server/sim/content/bands/shu.js、battle.js，以及 server/match 里的
// fields.js / placement.js / round.js / combat.js / unite.js / invariants.js，server/sim/battle/deploy.js、lifecycle.js。
// 设计：docs/research/shu-strategy.md。图标 public/assets/band/band_shu.png 是本地素材。
import { SHU_HEAL_THRESHOLD } from '../../shared/shuStrategy.js';

export default function addShu({ addBand, tokens, assets }) {
  addBand({
    bandId: 'band_shu', sortId: 104, name: '黍', iconId: 'icon_shu',
    modeTypeList: ['MULTI'], extendedOnly: true, totalHp: 24,
    effectId: 'aceffect_band_shu', effectName: '百谷长青',
    desc: '【百谷长青】田块从40%生命值开始。每累计治疗其100%最大生命值，第1至7回合使已激活的<助力>层数+1；第7回合起还使除<助力>外符合条件且层数最高的已激活盟约+1层（排除远见、奇迹、投资人及不可叠层盟约），第8回合起不再增加<助力>层数。第7回合<助力>计数永久+1。田块生命比例越高，我方攻击速度等增益越强。',
    descRaw: '【百谷长青】田块从40%生命值开始。每累计治疗其100%最大生命值，第1至7回合使已激活的<助力>层数+1；第7回合起还使除<助力>外符合条件且层数最高的已激活盟约+1层（排除远见、奇迹、投资人及不可叠层盟约），第8回合起不再增加<助力>层数。第7回合<助力>计数永久+1。田块生命比例越高，我方攻击速度等增益越强。',
    buffs: [{ key: 'band_shu_field', bb: { max_hp: 5000, max_hp_loss: 0.04, current_hp_loss: 0.06, starting_hp_ratio: 0.4, heal_threshold: SHU_HEAL_THRESHOLD }, bbStr: { key: 'band_shu_field' } }],
    params: {}, victorCount: 3, rewardModulus: 1, unlockDesc: null, bondIds: [],
  });
  // 田块：特殊召唤物，头像沿用策略图标
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
}
