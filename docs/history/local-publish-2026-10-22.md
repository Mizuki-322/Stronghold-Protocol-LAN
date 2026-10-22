# 2026-10-22 源码发布检查点

此仓库是基于上游 v0.3.1 的独立源码快照。局域网扩展与此前累积的干员、敌人、盟约和战斗规则改动均属于本地修改，不代表上游规则。`docs/img/` 的游戏截图和 `public/assets/` 等本地素材未进入本仓库。

## Golden 场景

本地功能修改会改变战斗输出，因而使用 `npm run golden:update` 按当前模拟器结果更新以下 34 个场景。更新后的 `npm run golden` 应与当前实现一致。这些基准只检查结果是否变化，并不单独证明规则正确。

- `roster`：干员实现、技能、伤害、治疗和状态处理的累积修改影响 `roster-003, roster-005, roster-011, roster-017, roster-019, roster-023, roster-027, roster-028, roster-029, roster-035, roster-036, roster-041, roster-042, roster-043, roster-044, roster-046, roster-047, roster-048`。
- `fields`：阵地战斗中的干员及领袖处理变动影响 `boss-boss_2-solo, boss-boss_3-pair, boss-boss_5-pair, boss-boss_5-solo, hidden-boss_8-pair, hidden-boss_8-solo, hidden-boss_9-pair, hidden-boss_9-solo, hidden-boss_10-pair`。
- `matches`：房间、禁选、牌堆和战斗结算的累积修改影响 `solo-FUNNY-1, solo-FUNNY-2, coop4-FUNNY-6`。
- `standins`：预备干员和战斗规则的累积修改影响 `standin-03, standin-06, standin-07, standin-09`。

`bonds` 与 `diy` 两组场景输出未变化。上述原因按子系统归类；同一场景可能同时受多个规则影响。

## 发布前验证

- 新增功能的 26 项定向测试通过。
- `npm run lint`：退出码 0，有 150 条 warning；`npm run typecheck`：通过。
- `npm run ci`：完整测试阶段失败，后续 smoke、lint、imports 和 typecheck 步骤未由该命令执行。失败中包含旧预期与新增策略列表或盟约顺序不一致的断言，也有并发测试失败。尚未将整套测试认定为通过。
