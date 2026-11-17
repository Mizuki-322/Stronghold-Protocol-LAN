// 旧入口：本地自创内容已按策略 / 卡拆到 tools/local-content/（清单见 docs/custom-content.md）。
// 保留这个文件只为旧命令 `node tools/inject-technician-data.mjs` 还能用。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectLocalContent } from './local-content/index.mjs';

export { injectLocalContent as injectTechnicianData };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) injectLocalContent();
