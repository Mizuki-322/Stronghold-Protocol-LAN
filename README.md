# 卫戍协议：盟约 · 局域网扩展版

这是基于 [sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol) **v0.3.1** 修改的非官方同人项目，供个人学习与非商业联机体验。它与鹰角网络、Yostar 及《明日方舟》官方无关。

## 版本

- **当前游玩版（2026-10-25）**：[lan-source-2026-10-25](https://github.com/Mizuki-322/Stronghold-Protocol-LAN/tree/lan-source-2026-10-25)。`main` 指向这份源码。
- **此前发布版（2026-10-22）**：[lan-source-2026-10-22](https://github.com/Mizuki-322/Stronghold-Protocol-LAN/tree/lan-source-2026-10-22)。

两个标签均只包含源码、文档和数据文件。当前版本对应 2026-10-25 在本地 17877 端口运行的源码快照；每位真人玩家仍由自己的浏览器计算其战斗，默认 `SP_COMBAT=client`。

## 这份源码增加了什么

- 独立的 5–8 人「大型同盟」模式：共享牌堆、按人数扩充卡池与领袖生命、最多三人联防、十二项机变阶段选项。
- 房间可选择「休整期不限时」；启用时须所有真人玩家在开局前确认。
- 盟约与干员追踪、特质联动查询和独立的网页筛选界面。
- 局域网文字聊天及可由外部进程控制的 AI 队友示例（`scripts/deepseek-agent.mjs`；需要自行配置 DeepSeek API 密钥）。
- 大型同盟的机械师「技术传承」、森蚺「机械援助」、耶拉「圣山护佑」和深巡「巡海小队」策略，以及相关界面和战斗规则调整。

具体规则与实现进度见 [局域网修改记录](docs/local-lan-2026-10-20.md)、[大型同盟设计](docs/design/extended-coop.md)和[相关实现记录](docs/history/local-extended-coop.md)。这是独立修改版；上述新增内容并非原仓库官方版本的功能。

## 源码与素材

**这个 GitHub 仓库仅发布源码、文档及数据文件**，不包含从游戏提取或下载的角色美术、Spine 模型、3D 场景、音频、字体或游戏截图，也没有附带完整素材包。`public/assets/`、`public/fonts/` 和本地素材清单由 `.gitignore` 排除。仓库中的 `public/icons/` 是原项目自行绘制的应用图标；测试目录中的极小图片和音频是占位夹具。

`data/*.json`、`data/i18n/*.json` 等游戏数据来自原项目的官方数据处理流程，**不属于 GPL 授权范围**。代码的 GPL 许可不等于取得游戏素材或数据的使用授权；请阅读 [NOTICE.md](NOTICE.md)。原仓库曾提供的完整素材包和截图不随本分支发布。

## 本地运行

需要 Node.js 22 或更新版本。克隆源码后：

```bash
npm install
npm run setup
npm start
```

浏览器打开终端显示的本机地址；同一局域网的朋友使用终端显示的局域网地址。`npm run setup` 会按原项目的流程在本机获取运行所需的素材，这些文件不会进入 Git 仓库。若不准备获取素材，先阅读[原项目的安装与素材说明](https://github.com/sganggs/Stronghold-Protocol#readme)。外部 AI 队友的配置见[局域网修改记录](docs/local-lan-2026-10-20.md)。

## 当前验证状态

当前游玩版的定向测试与战斗黄金基准验证见[2026-10-25 发布记录](docs/local-publish-2026-10-25.md)。完整 CI 尚未认定为全部通过；此前发布版的验证状态见[2026-10-22 发布记录](docs/history/local-publish-2026-10-22.md)。此仓库作为供朋友测试的源码版本。

## 来源与许可

原项目：[sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)，基准版本 [v0.3.1（b3deebd）](https://github.com/sganggs/Stronghold-Protocol/commit/b3deebdae4a92642c007d217a1a4573e5d3612c5)。感谢原作者和贡献者公开源码。

本项目自行编写的代码沿用 **GPL-3.0-or-later**，保留原项目的 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md) 和 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。原项目在 `NOTICE.md` 中提供了与 pixi-spine 的 Spine Runtimes 组合分发相关的 GPL 第 7 条附加许可。第三方代码、游戏名称、美术、音频及数据各自受其权利人的条款约束。
