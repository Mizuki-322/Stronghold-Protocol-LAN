// 见习海巡队-术师（chess_char_1_22_a / _b）和 见习海巡队-重装（chess_char_1_23_a / _b）：深巡策略第 2、3 回合赠送的一阶卡。
// 用预备干员的模型和普通攻击，没有技能、天赋、模组；作战特质随已激活的阿戈尔层数变强。
// 不进商店和共享牌堆。规则：docs/design/extended-coop.md（深巡「巡海小队」）。

const SPECS = [
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
];

export default function addPatrolTrainees({ chess, garrisons, backups, copy, stripElite, joinBonds }) {
  const pith = chess.chess_char_1_15_a;
  for (const spec of SPECS) {
    const model = backups[spec.charId];
    if (!model) throw new Error(`reserve model missing: ${spec.charId}`);
    const baseId = `chess_char_1_${spec.slot}_a`;
    const goldenId = `chess_char_1_${spec.slot}_b`;
    for (const elite of [false, true]) {
      const id = elite ? goldenId : baseId;
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
      stripElite(record);
      chess[id] = record;
      // 作战特质：以深巡的特质（garrison_18）为模板，改成每 5 层阿戈尔加一项属性
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
    joinBonds(baseId);
  }
}
