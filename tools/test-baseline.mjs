// tools/test-baseline.mjs — 本地测试基准：记录这台机器上「本来就失败」的测试，之后每次只报告新出现的失败。
//
// 这份代码在 Windows 本地跑完整测试时有一批失败与改动无关（不能建符号链接、Forge 导入、plugins/ 里有自己的插件、
// 机器忙时超时……）。只看「通过 / 失败」数字分不清是不是自己改坏了，所以把当前失败记成基准
// （test/baseline-failures.json），以后对比：
//
//   node tools/test-baseline.mjs run [测试文件或通配 …]   跑测试（默认全部）并和基准对比；有新失败时退出码 1
//   node tools/test-baseline.mjs compare <结果.tap>        只对比一份已有的 TAP 结果
//   node tools/test-baseline.mjs update <结果.tap> [更多.tap …]
//                                                          用结果重写基准：在任一份里失败的都记入；
//                                                          只在部分结果里失败的标为 flaky（时好时坏）
//
// 选项：--concurrency <n>（默认 8，同时跑的测试文件数；太高会让机器忙、超时类失败变多）
//       --out <文件>（run 时把 TAP 结果另存一份，之后可以拿去 update）
//
// 一条测试用它的完整名字（含上级测试名，用「 > 」连接）识别，不用行号，所以在测试文件里加减代码不会让基准失效。
// node 的 TAP 输出只给失败的测试写文件位置，通过的没有，所以文件只用来显示、不参与识别；不同文件里同名的测试
// 按同一条算，其中一个失败就算失败。只记最底层的失败：「N 个子测试失败」这种上级汇总不单独记。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'test', 'baseline-failures.json');
const DEFAULT_GLOBS = ['test/**/*.test.js', 'plugins/_template/**/*.test.js'];

/**
 * 解析 node --test 的 TAP 输出。
 * @param {string} text
 * @param {string} [root] 测试所在的仓库根（另一个工作区的结果也能按相对路径对上）
 * @returns {{ results: Map<string, { file: string, name: string, ok: boolean, detail: string }>, files: Set<string> }}
 */
export function parseTap(text, root = ROOT) {
  const lines = text.split(/\r?\n/);
  const results = new Map();
  const files = new Set();
  const stack = []; // [{ indent, name }]：当前所在的「# Subtest:」链
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sub = /^(\s*)# Subtest: (.*)$/.exec(line);
    if (sub) {
      const indent = sub[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      stack.push({ indent, name: sub[2] });
      continue;
    }
    const res = /^(\s*)(not ok|ok) \d+ - (.*?)(?: # (?:SKIP|TODO).*)?$/.exec(line);
    if (!res) continue;
    const indent = res[1].length;
    const ok = res[2] === 'ok';
    const name = res[3];
    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
    const parents = stack.filter((s) => s.indent < indent).map((s) => s.name);
    if (stack.length && stack[stack.length - 1].indent === indent) stack.pop();
    // 紧跟的 YAML 块：location / error / failureType
    let location = '', error = '', failureType = '';
    if (lines[i + 1]?.trim() === '---') {
      for (let j = i + 2; j < lines.length && lines[j].trim() !== '...'; j++) {
        const t = lines[j].trim();
        if (t.startsWith('location:')) location = t.slice(9).trim().replace(/^'|'$/g, '');
        else if (t.startsWith('failureType:')) failureType = t.slice(12).trim().replace(/^'|'$/g, '');
        else if (t.startsWith('error:') && !error) {
          error = t.slice(6).trim().replace(/^'|'$/g, '');
          if (error === '|-' || error === '|') error = (lines[j + 1] || '').trim();
        }
      }
    }
    const file = relFile(location, root);
    if (file) files.add(file);
    if (failureType === 'subtestsFailed') continue; // 上级汇总，不单独记
    const key = [...parents, name].join(' > ');
    const prev = results.get(key);
    if (prev && !prev.ok) continue; // 同名测试里已有失败的：保留失败
    results.set(key, { file: file || prev?.file || '?', name: key, ok, detail: error.slice(0, 200) });
  }
  return { results, files };
}

/** location 'E:\\…\\test\\x.test.js:12:3' → 'test/x.test.js'（相对仓库根，正斜杠）。 */
function relFile(location, root = ROOT) {
  if (!location) return '';
  const p = location.replace(/\\\\/g, '\\').replace(/:\d+:\d+$/, '').replace(/:\d+$/, '');
  const rel = path.relative(root, p).split(path.sep).join('/');
  return rel.startsWith('..') ? p : rel;
}

function readBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { return { failures: [] }; }
}

/** 对比一份结果和基准。返回新失败条数。 */
function compare(text) {
  const { results } = parseTap(text);
  const base = new Map(readBaseline().failures.map((f) => [f.key, f]));
  const failed = [...results.entries()].filter(([, r]) => !r.ok);
  const fresh = failed.filter(([k]) => !base.has(k));
  const known = failed.filter(([k]) => base.has(k));
  // 只看这次跑到、而且通过了的：只跑部分文件时，没跑到的基准条目不算「修好了」
  const fixed = [...base.values()].filter((f) => results.get(f.key)?.ok === true);
  const summary = /^# (tests|pass|fail) (\d+)/gm;
  const counts = Object.fromEntries([...text.matchAll(summary)].map((m) => [m[1], Number(m[2])]));
  console.log(`测试 ${counts.tests ?? results.size} 条：通过 ${counts.pass ?? '?'}，失败 ${counts.fail ?? failed.length}`);
  console.log(`  基准里已知的失败：${known.length}（其中时好时坏 ${known.filter(([k]) => base.get(k).flaky).length}）`);
  if (fixed.length) {
    console.log(`  基准里记着失败、这次通过了：${fixed.length}（稳定后可以用 update 更新基准）`);
    for (const f of fixed.slice(0, 20)) console.log(`    ✓ ${f.file} :: ${f.key}`);
  }
  if (fresh.length) {
    console.log(`\n✖ 新出现的失败：${fresh.length}`);
    for (const [k, r] of fresh) console.log(`  ✖ ${r.file} :: ${k}${r.detail ? `\n      ${r.detail}` : ''}`);
    console.log('\n先确认是不是自己的改动造成的；机器忙导致的超时可以单独重跑那个文件再看。');
  } else console.log('\n✔ 没有新出现的失败');
  return fresh.length;
}

/** 用若干份结果重写基准。 */
function update(texts) {
  const runs = texts.map((t) => parseTap(t).results);
  const all = new Map();
  for (const results of runs) for (const [k, r] of results) if (!r.ok) all.set(k, r);
  const failures = [...all.entries()].sort(([a, x], [b, y]) => `${x.file} ${a}`.localeCompare(`${y.file} ${b}`, 'en')).map(([key, r]) => {
    const failedIn = runs.filter((res) => res.get(key)?.ok === false).length;
    const seenIn = runs.filter((res) => res.has(key)).length;
    return { key, file: r.file, name: r.name, ...(failedIn < seenIn ? { flaky: true } : {}), detail: r.detail };
  });
  const doc = {
    note: '本地完整测试里「本来就失败」的测试（node tools/test-baseline.mjs update 生成，不要手改）。见文件头注释。',
    updated: new Date().toISOString().slice(0, 10),
    platform: `${os.platform()} ${os.release()}, node ${process.version}`,
    runs: texts.length,
    failures,
  };
  fs.writeFileSync(BASELINE, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`基准已写入 ${path.relative(ROOT, BASELINE)}：${failures.length} 条（时好时坏 ${failures.filter((f) => f.flaky).length}）`);
}

/** 跑测试，返回 TAP 文本。 */
function runTests(globs, concurrency) {
  return new Promise((resolve, reject) => {
    const args = ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=tap', ...globs];
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const chunks = [];
    let lastDot = Date.now();
    const onData = (d) => {
      chunks.push(d);
      if (Date.now() - lastDot > 5000) { process.stderr.write('.'); lastDot = Date.now(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', () => { process.stderr.write('\n'); resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = argv.indexOf(name);
    if (i < 0) return fallback;
    const v = argv[i + 1];
    argv.splice(i, 2);
    return v;
  };
  const concurrency = Number(opt('--concurrency', 8)) || 8;
  const out = opt('--out', null);
  const [cmd, ...rest] = argv;
  if (cmd === 'run') {
    const started = Date.now();
    console.error(`正在跑测试（同时 ${concurrency} 个文件）…`);
    const text = await runTests(rest.length ? rest : DEFAULT_GLOBS, concurrency);
    if (out) fs.writeFileSync(out, text);
    console.log(`用时 ${Math.round((Date.now() - started) / 1000)} 秒`);
    process.exitCode = compare(text) ? 1 : 0;
  } else if (cmd === 'compare' && rest.length === 1) {
    process.exitCode = compare(fs.readFileSync(rest[0], 'utf8')) ? 1 : 0;
  } else if (cmd === 'update' && rest.length) {
    update(rest.map((f) => fs.readFileSync(f, 'utf8')));
  } else {
    console.log('用法：node tools/test-baseline.mjs run [测试文件 …] [--concurrency 8] [--out 结果.tap]\n'
      + '      node tools/test-baseline.mjs compare <结果.tap>\n'
      + '      node tools/test-baseline.mjs update <结果.tap> [更多.tap …]');
    process.exitCode = cmd ? 2 : 0;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
