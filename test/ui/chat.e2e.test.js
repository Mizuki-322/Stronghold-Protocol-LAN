import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('in-match chat input clamps to 20 characters and displays the sent line', { skip: process.env.SP_E2E !== '1' || !existsSync(CHROME) }, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, assetIndex: false, studio: false });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`http://127.0.0.1:${srv.port}/dev/game-mock.html?shot=1&render=fallback&phase=PREP`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ewheel__btn');
    await page.click('.ewheel__btn');
    await page.waitForSelector('.ewheel__textrow input');
    await page.type('.ewheel__textrow input', '你好，我是来测试文字聊天是否正常工作的。');
    const value = await page.$eval('.ewheel__textrow input', (x) => x.value);
    assert.equal([...value].length, 20);
    await page.click('.ewheel__textrow button');
    await page.waitForFunction(() => document.querySelector('.ewheel__chatline')?.textContent.includes('你好'));
    assert.match(await page.$eval('.ewheel__chatline', (x) => x.textContent), /你好/);
    const out = path.join(ROOT, 'test/e2e/out');
    mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, 'chat-match.png') });
  } finally {
    await browser.close();
    await srv.close();
  }
});
