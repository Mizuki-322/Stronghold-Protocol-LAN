import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);

describe('co-op rest timer room switch in the browser', { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH' }, () => {
  let server;
  let browser;
  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
  });
  after(async () => { await browser?.close(); await server?.close(); });

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 844, height: 390, isMobile: true, hasTouch: true }]) {
    test(`host can switch the option at ${viewport.width}×${viewport.height}`, async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.setViewport(viewport);
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem('sp.name', '房主');
          sessionStorage.setItem('sp.entered', '1');
        });
        await page.goto(server.url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => globalThis.__SP__?.store.get().connection.status === 'online');
        await page.evaluate(() => globalThis.__SP__.net.request('room.create', { mode: 'coop', difficulty: 'NORMAL' }));
        await page.waitForSelector('.room-screen .ailast__opt');
        const selector = '.room-screen .ailast__opt';
        const options = await page.$$eval(selector, (nodes) => nodes.map((n) => n.textContent));
        assert.ok(options.some((text) => text.includes('休整期不限时')));
        const button = await page.$(`${selector}:last-of-type`);
        assert.ok(button);
        const target = await page.evaluate(() => [...document.querySelectorAll('.room-screen .ailast__opt')]
          .find((n) => n.textContent.includes('休整期不限时'))?.outerHTML);
        assert.match(target, /aria-checked="false"/);
        await page.evaluate(() => [...document.querySelectorAll('.room-screen .ailast__opt')]
          .find((n) => n.textContent.includes('休整期不限时'))?.click());
        await page.waitForFunction(() => globalThis.__SP__.store.get().room?.prepUntimed === true);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.room-screen .ailast__opt')]
          .find((n) => n.textContent.includes('休整期不限时'))?.getAttribute('aria-checked')), 'true');
        await page.evaluate(() => [...document.querySelectorAll('.room-screen .room-bar__right button')]
          .find((n) => n.textContent.includes('开始模拟'))?.click());
        await page.waitForSelector('[data-testid="prep-untimed-accept"]');
        assert.match(await page.$eval('[data-testid="prep-untimed-count"]', (n) => n.textContent), /0\/1/);
        assert.equal(await page.evaluate(() => globalThis.__SP__.store.get().room?.inMatch), false);
        await page.click('[data-testid="prep-untimed-decline"]');
        await page.waitForFunction(() => {
          const room = globalThis.__SP__.store.get().room;
          return room && !room.prepUntimed && !room.prepUntimedVote && !room.inMatch;
        });
        assert.equal(await page.$('[data-testid="prep-untimed-accept"]'), null);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  }

  test('host and guest both see the confirmation; one refusal resets the room', async () => {
    const hostContext = await browser.createBrowserContext();
    const guestContext = await browser.createBrowserContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    try {
      for (const [page, name] of [[host, '房主'], [guest, '队友']]) {
        await page.evaluateOnNewDocument((value) => {
          localStorage.setItem('sp.name', value);
          sessionStorage.setItem('sp.entered', '1');
        }, name);
        await page.goto(server.url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => globalThis.__SP__?.store.get().connection.status === 'online');
      }
      await host.evaluate(() => globalThis.__SP__.net.request('room.create', { mode: 'coop', difficulty: 'NORMAL' }));
      await host.waitForFunction(() => globalThis.__SP__.store.get().room?.code);
      const code = await host.evaluate(() => globalThis.__SP__.store.get().room.code);
      await guest.evaluate((roomCode) => globalThis.__SP__.net.request('room.join', { code: roomCode }), code);
      await host.evaluate(() => globalThis.__SP__.net.request('room.setPrepUntimed', { on: true }));
      await guest.evaluate(() => globalThis.__SP__.net.request('room.ready', { ready: true }));
      await host.waitForFunction(() => globalThis.__SP__.store.get().room?.seats.some((seat) => seat?.name === '队友' && seat.ready));
      await host.evaluate(() => globalThis.__SP__.net.request('room.start', {}));
      await Promise.all([host.waitForSelector('[data-testid="prep-untimed-accept"]'), guest.waitForSelector('[data-testid="prep-untimed-accept"]')]);
      await guest.click('[data-testid="prep-untimed-accept"]');
      await host.waitForFunction(() => globalThis.__SP__.store.get().room?.prepUntimedVote?.accepted.length === 1);
      assert.match(await host.$eval('[data-testid="prep-untimed-count"]', (n) => n.textContent), /1\/2/);
      await host.click('[data-testid="prep-untimed-decline"]');
      await Promise.all([host, guest].map((page) => page.waitForFunction(() => {
        const room = globalThis.__SP__.store.get().room;
        return room && !room.inMatch && !room.prepUntimed && !room.prepUntimedVote
          && room.seats.filter((seat) => seat && !seat.isBot).every((seat) => !seat.ready);
      })));
    } finally { await Promise.all([hostContext.close(), guestContext.close()]); }
  });
});
