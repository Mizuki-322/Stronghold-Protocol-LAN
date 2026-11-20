# 自创内容清单

这个本地分支在原版 0.3.1 之上加的自创内容：大型同盟（`coop8`）的 6 个开局策略、它们送的 3 张卡、一个插件干员，以及对官方内容的本地改动。
规则写在 [大型同盟规则](design/extended-coop.md)；本地改动的总记录见 [本地改动说明](local-lan-2026-10-20.md)。

## 数据从哪来

`data/*.json` 是生成的，不要手改。官方部分由 `tools/build-data.mjs` 从官方客户端数据表
（[Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 的国服数据）生成，它最后调用 `tools/local-content/index.mjs` 把自创内容写进去。

官方数据固定用 2026-10-08 的版本（提交 17759cc8，原版 0.3.1 就是用它生成的）：2026-11-01 起官方数据里已经没有卫戍协议：盟约
（换成了新的「规程」），用最新版本生成会失败。需要的文件约 71 MB，缓存在 `.cache/gamedata/`（不进 git）；
有缓存时 `node tools/build-data.mjs --offline` 不联网也能重新生成，结果和现在的 `data/` 逐字节一致。
只改了自创内容时，不用重新生成官方数据，直接运行：

```
node tools/local-content/index.mjs
```

（旧命令 `node tools/inject-technician-data.mjs` 仍然可以用，效果相同。）

各语言的游戏文字覆盖层 `data/i18n/*.json` 由 `node tools/build-i18n.mjs` 生成，里面「墓碑」的译文也由这个脚本改写，
所以重新运行 `build-i18n` 之后，也要再运行一次上面的命令。

`tools/local-content/` 里每个策略、每张卡一个文件，`index.mjs` 按固定顺序调用它们。顺序决定 JSON 里键的先后，
所以新内容加在最后，已有的不要调换。

## 开局策略

都只在大型同盟可选（`extendedOnly: true`）。图标在 `public/assets/band/<策略编号>.png`，是本地素材，不进 git。

| 策略 | 编号 | 数据文件 | 逻辑代码 | 测试 |
|---|---|---|---|---|
| 机械师「技术传承」 | `band_technician` | `tools/local-content/band-technician.mjs` | 无专门代码：用官方的回合赠卡效果送盟约·重装干员 | `test/content/technician-strategy.test.js` |
| 森蚺「机械援助」 | `band_eunectes` | `tools/local-content/band-eunectes.mjs` | `server/sim/content/devices.js`、`server/match/match/infra.js`、`shared/eunectesRange.js`、`public/js/ui/gameLogic/terrain.js` | `test/content/eunectes-strategy.test.js` |
| 耶拉「圣山护佑」 | `band_yela` | `tools/local-content/band-yela.mjs` | `server/sim/content/bands/meta.js`、`server/sim/content/kits/ops/chess_char_3_20-kjera.js` | `test/content/yela-strategy.test.js` |
| 深巡「巡海小队」 | `band_udflow` | `tools/local-content/band-udflow.mjs` | 无专门代码：用官方的回合赠卡效果送深巡和两张见习卡 | `test/content/udflow-strategy.test.js` |
| 流明「凡人之愿」 | `band_lumen` | `tools/local-content/band-lumen.mjs` | `server/sim/content/bands/meta.js` | `test/content/lumen-strategy.test.js` |
| 黍「百谷长青」 | `band_shu` | `tools/local-content/band-shu.mjs`（含召唤物「田块」`token_shu_field`） | `shared/shuStrategy.js`、`server/sim/content/bands/shu.js`、`server/sim/content/bands/battle.js`；整备侧 `server/match/fields.js`、`server/match/player/placement.js`、`server/match/player/round.js`、`server/match/match/combat.js`、`server/match/unite.js`、`server/match/invariants.js`；战斗侧 `server/sim/battle/deploy.js`、`server/sim/battle/lifecycle.js` | `test/content/shu-strategy.test.js` |

策略选择阶段（所有策略共用）：`server/match/match/phases.js`、`server/match/match/intents.js`、`public/js/screens/bandDraft.js`，
测试 `test/ui/bandDraft.test.js`、`test/match/host-bot-band.test.js`。

设计记录：[机械师](research/technician-strategy.md)、[黍](research/shu-strategy.md)。

## 自创卡

| 卡 | 编号 | 谁送 | 数据文件 | 逻辑代码 |
|---|---|---|---|---|
| 盟约·重装干员 | `chess_char_1_21_a` / `_b` | 机械师第 1 回合 | `tools/local-content/op-alliance-defender.mjs` | `server/sim/content/kits/ops/chess_char_1_21-cdfend.js` |
| 见习海巡队-术师 | `chess_char_1_22_a` / `_b` | 深巡第 2 回合 | `tools/local-content/op-patrol-trainees.mjs` | 无技能；作战特质用官方的「按盟约层数加属性」效果 |
| 见习海巡队-重装 | `chess_char_1_23_a` / `_b` | 深巡第 3 回合 | 同上 | 同上 |

三张卡都以泥岩的棋子为模板，模型用预备干员（`char_602_cdfend` 重装、`char_604_ccast` 术师），不进商店和共享牌堆。

## 插件干员

| 干员 | 插件 | 说明 |
|---|---|---|
| 巨大的丑东西 `char_x_ugly_mech_one` | `plugins/ugly-mech/`（脚本插件，服务器要开 `SP_PLUGIN_SCRIPTS=sandbox`） | 技能和天赋取自第三季的“暴躁铁皮”：技能「大丑的愤怒」（期间改为远程攻击——不生成射弹，在目标处直接命中，引擎为此加了射弹种类 `'instant'`；免疫异常状态，我方单位也可成为目标），天赋「荒蛮之心」（被击倒时自爆）和「酋长之威」（阻挡数 +1、攻击距离 +1 / +2）。攻击范围同泥岩，同时攻击阻挡数个目标。装备栏 4 / 6（棋子记录的 `equipSlots`，本体为此加了按棋子的装备栏数，见[本地改动说明](local-lan-2026-10-20.md)）。新的特殊干员（测试美术时借用过灰毫的面板）：5 阶，隶属协防干员，不进商店，只由开局策略「大祭司」（`band_x_ugly_mech_priest`，以 Pith 为底）发放——【驾驶“员”】开局生命值 24，第 1 回合获得这名干员。数值同暴躁铁皮（普通 = 精二 1 级，精锐 = 精二 60 级 + 模组 UNY-X 1 级，分支不屈者），特质为战斗中攻击力和生命上限 +60% / +120%。含官方美术，`plugins/` 不进 git，只备份在私有仓库 |

新干员优先做成插件（插件工作台 `/studio/` 可以起草、试一场）。插件做不到的（比如新的开局策略、整备规则）才改本体，
数据加进 `tools/local-content/`，并在本文件登记。

## 对官方内容的改动

| 内容 | 数据文件 | 逻辑代码 | 测试 |
|---|---|---|---|
| 「墓碑」`enemy_2008_flking` 去掉全场效果（我方攻击力、防御力减半，部署费用回复减半，再部署时间加倍），只保留攻击和周期性护盾；图鉴描述相应改写，删掉全场效果那条能力说明（英、日、韩、繁中的覆盖层 `data/i18n/*.json` 同样处理）。原因：官方关卡里这个效果来自隐藏的场地装置，卫戍协议里没有这个装置，官方游玩时并不生效 | `tools/local-content/enemy-tombstone.mjs` | `server/sim/content/enemies/leaders.js` | `test/content/enemies_bosses.test.js`；对局录像 `test/golden/roster.json` 的 roster-003、roster-027 |

## 和原版测试的冲突

下面这些原版测试因为自创内容而失败，记在 `test/baseline-failures.json`（见 `tools/test-baseline.mjs`），不是 bug：

- 「田块」可以放置，但没有对应的召唤物逻辑和显示：`test/content/feedback5-we2-summon-hand.test.js`、`test/content/tokens_devices.test.js`。
- 新增的策略选择阶段让旧测试的对局停在选策略，到不了整备：`test/match/rehearsal-delegate.test.js`（3 条）、`test/match/content-diy.test.js`。
- 自创卡用了预备干员的模型，改变了自选干员池和重装技能的统计：`test/diy.test.js`、`test/sim/feedback1-tank-triggers.test.js`。
- 机械师策略关联的盟约在部分模式下被关闭：`test/match/feedback1-gaps.test.js`、`test/ui/feedback1-gaps.test.js`。

改到对应策略时，顺手把测试改成认得自创内容，再用 `node tools/test-baseline.mjs update` 更新基准。

## 加新内容的步骤

1. 在 `tools/local-content/` 新建 `band-<名字>.mjs` 或 `op-<名字>.mjs`，导出 `export default function add(ctx)`；
   `ctx` 提供数据表（`chess`、`bonds`、`garrisons`、`bands`、`assets`、`tokens`、`effects`、`enemies`）、各语言覆盖层 `i18n`、只读的 `backups`，
   以及 `copy`、`stripElite`、`joinBonds`、`addBand` 几个小工具（见 `index.mjs`）。
2. 把它加到 `index.mjs` 的 `CONTENT` 末尾，运行 `node tools/local-content/index.mjs`。
3. 逻辑写进对应代码，加一个 `test/content/<名字>-strategy.test.js`。
4. 在本文件的表里登记，规则写进 [大型同盟规则](design/extended-coop.md)。
5. 跑 `node tools/test-baseline.mjs run`，确认没有新失败。
