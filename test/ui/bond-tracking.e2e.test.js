import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.SP_E2E === '1' && existsSync(chrome);
const bonds = JSON.parse(readFileSync(path.join(root, 'data/bonds.json'), 'utf8'));

describe('in-match bond tracking in the browser', { skip: !enabled && 'set SP_E2E=1 and CHROME_PATH' }, () => {
  let server;
  let browser;
  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
  });
  after(async () => { await browser?.close(); await server?.close(); });

  test('available bonds open details, multiple tracking marks the shop, and a reload clears it', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${server.url}/dev/game-mock.html?shot=1&render=fallback&phase=PREP`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ff-piece');
      await page.click('[data-testid="check-player"]');
      await page.waitForSelector('.ibond--available');
      const available = await page.$$eval('.ibond--available', (nodes) => nodes.map((n) => n.dataset.bond));
      const alreadyShown = await page.$$eval('.bslot', (nodes) => nodes.map((n) => n.dataset.bond));
      const first = available.find((id) => !alreadyShown.includes(id)) || available[0];
      const second = available.find((id) => id !== first);
      assert.ok(first && second);
      for (const id of [first, second]) {
        await page.click(`.ibond--available[data-bond="${id}"]`);
        await page.waitForSelector('.bpop.is-from-info .bpop__track');
        await page.click('.bpop__track');
        assert.equal(await page.$eval('.bpop__track', (el) => el.getAttribute('aria-pressed')), 'true');
        await page.click('.bpop__close');
      }
      assert.equal(await page.$$('.bslot.is-tracked').then((a) => a.length), 2);
      assert.equal(await page.$$('.ibond--available.is-tracked').then((a) => a.length), 2);
      const member = bonds[first].visibleMembers[0];
      await page.evaluate((id) => {
        globalThis.__MOCK__.mutate((s) => {
          s.priv.shop.slots[1] = { kind: 'chess', id, price: 1, basePrice: 1, sold: false };
        });
      }, member);
      await page.waitForSelector('.scard.is-tracked .scard__track');
      assert.match(await page.$eval('.scard.is-tracked .scard__track', (el) => el.textContent), /追踪/);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ff-piece');
      assert.equal(await page.$$('.bslot.is-tracked').then((a) => a.length), 0);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test('an operator can be tracked before appearing; its elite card and Theresa synergy are visible', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${server.url}/dev/game-mock.html?shot=1&render=fallback&phase=PREP`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ff-piece');
      await page.click('[data-testid="check-player"]');
      await page.click('.itrack-open');
      await page.waitForSelector('.operator-tracking-dialog__search');
      await page.type('.operator-tracking-dialog__search', '铃兰');
      assert.equal(await page.$$('.operator-tracking-dialog__operator').then((a) => a.length), 1);
      await page.click('.operator-tracking-dialog__operator');
      assert.equal(await page.$eval('.operator-tracking-dialog__operator', (el) => el.getAttribute('aria-pressed')), 'true');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.operator-tracking-dialog'));
      await page.evaluate(() => {
        globalThis.__MOCK__.mutate((s) => {
          s.priv.shop.slots[1] = { kind: 'chess', id: 'chess_char_5_10_b', price: 1, basePrice: 1, sold: false };
        });
      });
      await page.waitForSelector('.scard.is-operator-tracked');
      assert.match(await page.$eval('.scard.is-operator-tracked .scard__track', (el) => el.textContent), /追踪干员/);
      await page.waitForFunction(() => [...document.querySelectorAll('.toast__text')]
        .some((el) => el.textContent.includes('追踪干员已出现：铃兰')));
      await page.click('.edrawer__close');
      await page.click('.scard.is-operator-tracked', { button: 'right' });
      await page.waitForSelector('.dhead__track.is-tracked');
      await page.click('.dhead__track');
      await page.waitForFunction(() => !document.querySelector('.scard.is-operator-tracked'));
      await page.click('.dpanel__close');
      await page.evaluate(() => {
        globalThis.__MOCK__.mutate((s) => {
          s.priv.shop.slots[1] = { kind: 'chess', id: 'chess_char_4_25_a', price: 1, basePrice: 1, sold: false };
        });
      });
      await page.click('.scard[data-shop-slot="1"]', { button: 'right' });
      await page.waitForSelector('.dgarrison__synergy');
      await page.click('.dgarrison__synergy');
      await page.waitForSelector('.trait-synergy-dialog__group');
      assert.equal(await page.$$eval('.trait-synergy-dialog__group .trait-synergy-dialog__operator',
        (nodes) => nodes.length), 28);
      assert.deepEqual(await page.$$eval('.trait-synergy-dialog__group h3 small', (nodes) => nodes.map((el) => el.textContent)), ['24', '4']);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ff-piece');
      await page.click('[data-testid="check-player"]');
      await page.click('.itrack-open');
      assert.match(await page.$eval('.operator-tracking-dialog__count', (el) => el.textContent), /0/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test('the match HUD dims partial and mode-off bonds without a red cross', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${server.url}/dev/game-mock.html?shot=1&render=fallback&phase=PREP`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.ff-piece');
      await page.evaluate((bannedId) => {
        const store = globalThis.__MOCK__.store;
        const match = store.get().match;
        store.patch('match', {
          public: { ...match.public, bannedChess: [bannedId] },
          private: { ...match.private, bonds: [
            { bondId: 'sargonShip', count: 3, tier: 1, active: true, layers: 2, thresholds: [3, 6, 9] },
            { bondId: 'arcaneShip', count: 2, tier: 0, active: false, off: true, layers: 0, thresholds: [2, 4] },
          ] },
        });
      }, bonds.sargonShip.visibleMembers[0]);
      await page.waitForSelector('.bslot.is-muted[data-bond="sargonShip"]');
      await page.waitForSelector('.bslot.is-muted[data-bond="arcaneShip"]');
      assert.equal(await page.$$('.gm__bonds .bond__ban, .gm__bonds .bslot__off').then((a) => a.length), 0);
      await page.click('.bslot[data-bond="arcaneShip"] .bond');
      await page.waitForSelector('.bpop__facts');
      const facts = await page.$eval('.bpop__facts', (el) => el.textContent);
      assert.match(facts, /在场\s*2\/4/);
      assert.match(facts, /未激活/);
      assert.doesNotMatch(await page.$eval('.bpop', (el) => el.textContent), /本局禁用|本模式下该盟约不会激活/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});
