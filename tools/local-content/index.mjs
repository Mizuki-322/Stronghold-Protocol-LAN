// tools/local-content — 本地自创内容（大型同盟的开局策略和它们用到的自创卡）写进生成数据。
//
// tools/build-data.mjs 生成官方数据后自动调用；单独重跑：node tools/local-content/index.mjs（改 data/ 里的文件）。
// 每个策略 / 每张卡一个文件，清单见 docs/custom-content.md。加新内容：在这个文件夹里新建一个文件，
// 导出 `export default function add(ctx)`，再按顺序加进下面的 CONTENT。
//
// 顺序有意义：JSON 按插入顺序写出键，调换顺序会让 data/*.json 的字节变化（内容不变）。新内容加在最后。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import allianceDefender from './op-alliance-defender.mjs';
import patrolTrainees from './op-patrol-trainees.mjs';
import technician from './band-technician.mjs';
import eunectes from './band-eunectes.mjs';
import yela from './band-yela.mjs';
import udflow from './band-udflow.mjs';
import lumen from './band-lumen.mjs';
import shu from './band-shu.mjs';

/** 按顺序执行的内容：先卡（策略要送它们），再策略。 */
export const CONTENT = [allianceDefender, patrolTrainees, technician, eunectes, yela, udflow, lumen, shu];

const TABLES = ['chess', 'bonds', 'garrisons', 'bands', 'assets', 'tokens', 'effects'];
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

/**
 * 读 dir 里的数据表，依次加入 CONTENT，写回。
 * @param {string} [dir] 数据目录（默认仓库的 data/）
 */
export function injectLocalContent(dir = defaultDir) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  const write = (name, value) => fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(value)}\n`);
  const tables = Object.fromEntries(TABLES.map((name) => [name, read(name)]));
  const addedBands = [];
  const ctx = {
    ...tables,
    /** 只读：预备干员等「备用模型」 */
    backups: read('backups').units,
    copy: (value) => structuredClone(value),
    /** 去掉进阶形态才有的字段（复制官方卡当模板时用） */
    stripElite(record) {
      delete record.statsBase;
      delete record.traitBase;
      delete record.talentsBase;
      delete record.modules;
    },
    /** 把卡加进它 bonds 列出的每个盟约的成员表 */
    joinBonds(chessId) {
      for (const bondId of tables.chess[chessId].bonds) {
        const members = tables.bonds[bondId]?.members;
        if (!Array.isArray(members)) throw new Error(`bond missing for local operator: ${bondId}`);
        if (!members.includes(chessId)) members.push(chessId);
      }
    },
    /** 加一个开局策略（图标在 public/assets/band/<bandId>.png，本地素材，不进 git） */
    addBand(band) {
      tables.bands[band.bandId] = band;
      addedBands.push(band.bandId);
    },
  };
  for (const add of CONTENT) add(ctx);
  for (const id of addedBands) tables.assets.bands[id] = `/assets/band/${id}.png`;
  // 策略的效果记录（data/effects.json，和官方策略一样）：只是游戏里显示的文字。
  // 策略的整备和战斗逻辑在代码里（server/sim/content/bands、server/match），读的是 bands.json，不读这里。
  // 没有这些记录，插件数据检查（shared/plugins/validate.js）会以「band …: effect missing」拒绝所有数据插件。
  for (const id of addedBands) {
    const b = tables.bands[id];
    tables.effects[b.effectId] = {
      effectId: b.effectId, effectType: 'BAND_INITIAL', name: b.effectName, desc: b.desc, descRaw: b.descRaw,
      counterType: 'NONE', continuedRound: -1, decoIconId: null, enemyPrice: 0, buffs: ctx.copy(b.buffs), params: ctx.copy(b.params),
    };
  }
  for (const name of ['effects', 'chess', 'bonds', 'garrisons', 'bands', 'assets', 'tokens']) write(name, tables[name]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) injectLocalContent();
