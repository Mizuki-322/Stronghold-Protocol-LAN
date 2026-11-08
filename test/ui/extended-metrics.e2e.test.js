import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

test('ordinary and large alliances share the opt-in combat statistics panel',
  { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH', timeout: 60000 }, async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      for (const [variant, mode] of [['', 'coop'], ['extended', 'coop8']]) {
        const page = await browser.newPage();
        try {
          await page.goto(`http://127.0.0.1:${srv.port}/dev/game-mock.html?shot=1&phase=COMBAT&variant=${variant}`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.gm__corner', { timeout: 20000 });
          assert.equal(await page.evaluate(async () => (await import('/js/store.js')).store.get().room.mode), mode);
          await page.evaluate(async () => (await import('/js/ui/settings.js')).updateSettings({ combatMetrics: true }));
          await page.waitForSelector('.gm__metrics', { timeout: 5000 });
          await page.click('.gm__metrics');
          await page.waitForSelector('#combat-metrics-panel', { timeout: 5000 });
          assert.ok(await page.$('#combat-metrics-panel .combat-metrics__scopes'));
        } finally { await page.close(); }
      }
    } finally {
      await browser.close();
      await srv.close();
    }
  });
