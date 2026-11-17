// 「墓碑」（enemy_2008_flking）：本地去掉了它「全场我方攻击力、防御力减半」的效果，只保留部署费用回复减半、再部署时间加倍和护盾
// （server/sim/content/enemies/leaders.js，测试 test/content/enemies_bosses.test.js、test/sim/playtest6-enemies.test.js）。
// 这里把图鉴描述改成相符的文字。

const DESC = '延长我方单位的再部署时间并减缓部署费用回复，会周期性地为自己添加抵御伤害的';
const ABILITY = '使全战场我方单位的部署费用回复速度减半，再部署时间加倍';

export default function addTombstoneText({ enemies }) {
  const e = enemies.enemy_2008_flking;
  if (!e?.abilities?.[0]) throw new Error('enemy_2008_flking (墓碑) missing');
  e.desc = `${DESC}护盾`;
  e.descRaw = `${DESC}<@eb.key>护盾</>`;
  e.abilities[0].text = ABILITY;
  e.abilities[0].textRaw = ABILITY;
}
