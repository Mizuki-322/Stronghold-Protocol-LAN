import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

test('large alliance draft shows twelve cards in a horizontal scroller and can pick the last card',
  { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH', timeout: 60000 }, async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      for (const [width, height, touch] of [[756, 366, true], [1920, 1080, false]]) {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
          await page.goto(`http://127.0.0.1:${srv.port}/dev/game-mock.html?shot=1&phase=SP_DRAFT&variant=supply,extended`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.spov__grid--extended .spcard', { timeout: 20000 });
          const beforeScroll = await page.$eval('.spov__grid--extended', (grid) => ({ cards: grid.querySelectorAll('.spcard').length,
            width: grid.clientWidth, scrollWidth: grid.scrollWidth,
            flow: getComputedStyle(grid).gridAutoFlow,
            columns: getComputedStyle(grid).gridTemplateColumns,
            autoColumns: getComputedStyle(grid).gridAutoColumns,
            overflow: getComputedStyle(grid).overflowX }));
          assert.equal(beforeScroll.cards, 12);
          assert.ok(beforeScroll.scrollWidth > beforeScroll.width, `${width}px: cards scroll horizontally ${JSON.stringify(beforeScroll)}`);
          const afterScroll = await page.$eval('.spov__grid--extended', (grid) => {
            grid.scrollLeft = grid.scrollWidth;
            const last = grid.querySelectorAll('.spcard')[11].getBoundingClientRect();
            const viewport = grid.getBoundingClientRect();
            return { scrollLeft: grid.scrollLeft, visible: last.left >= viewport.left && last.right <= viewport.right + 1 };
          });
          assert.ok(afterScroll.scrollLeft > 0 && afterScroll.visible, `${width}px: the last card becomes visible`);
          const last = (await page.$$('.spov__grid--extended .spcard'))[11];
          if (touch) { await last.tap(); await last.tap(); } else { await last.click(); await last.click(); }
          await page.waitForFunction(() => globalThis.__MOCK__?.S().pub.sp.picks.p1 === 11, { timeout: 5000 });
          assert.equal(await page.evaluate(() => globalThis.__MOCK__.S().pub.sp.picks.p1), 11);
        } finally { await page.close(); }
      }
    } finally {
      await browser.close();
      await srv.close();
    }
  });
