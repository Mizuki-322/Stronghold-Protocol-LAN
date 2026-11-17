// 「墓碑」（enemy_2008_flking）：本地去掉了它的全场效果（我方攻击力、防御力减半，部署费用回复减半，再部署时间加倍），
// 只保留攻击和周期性护盾（server/sim/content/enemies/leaders.js，测试 test/content/enemies_bosses.test.js）。
// 原因：官方关卡里这个效果来自一个隐藏的场地装置，不是墓碑本身；卫戍协议里没有这个装置，官方游玩时也就不生效。
// 这里把图鉴描述改成相符的文字，删掉全场效果那一条能力说明，各语言的覆盖层（data/i18n）同样处理。
// 可以重复运行：已经改过的数据再跑一次不会变。

import { buildRecordOverlay, getPath, walkOverlay } from '../../shared/i18nData.js';

const ID = 'enemy_2008_flking';
const DESC = '会周期性地为自己添加抵御伤害的';
/** 全场效果那条能力说明里一定有的字（各语言） */
const FIELD_EFFECT = ['再部署时间加倍', 'Redeployment Time', '再配置時間', '재배치 시간', '再部署時間加倍'];
/** 各语言的新描述：取官方译文里讲护盾的那一半 */
const DESC_I18N = {
  en: 'Periodically gains a <@eb.key>Shield</> to absorb damage.',
  ja: '被ダメージを吸収可能な<@eb.key>バリア</>を周期的に展開する',
  ko: '주기적으로 자신에게 대미지를 줄여주는 <@eb.key>실드</>를 생성한다.',
  'zh-TW': '會周期性地為自己添加抵禦傷害的<@eb.key>護盾</>',
};

const plain = (raw) => raw.replace(/<[@$][^<>]*>|<\/>/g, '');
const dropFieldEffect = (abilities) => abilities.filter((a) => !FIELD_EFFECT.some((w) => a?.text?.includes(w)));

export default function addTombstoneText({ enemies, i18n }) {
  const e = enemies[ID];
  if (!Array.isArray(e?.abilities)) throw new Error(`${ID} (墓碑) missing`);
  e.desc = `${DESC}护盾`;
  e.descRaw = `${DESC}<@eb.key>护盾</>`;
  e.abilities = dropFieldEffect(e.abilities);

  for (const [lang, overlay] of Object.entries(i18n)) {
    const rov = overlay.files?.enemies?.[ID];
    if (!rov) continue;
    if (DESC_I18N[lang]) {
      rov.descRaw = DESC_I18N[lang];
      rov.desc = plain(DESC_I18N[lang]);
    } else {
      delete rov.descRaw;
      delete rov.desc;
    }
    if (Array.isArray(rov.abilities)) rov.abilities = dropFieldEffect(rov.abilities);
    // 重新计算 _h（每条译文对应的中文的校验）：中文改了，旧的 _h 会让译文被当成过期而不显示
    const leaves = [];
    walkOverlay(rov, (p, text) => leaves.push({ path: p, en: text, zh: getPath(e, p) ?? '' }));
    overlay.files.enemies[ID] = buildRecordOverlay(leaves);
  }
}
