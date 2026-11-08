import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startServer } from '../server/index.js';
import { Match } from '../server/match/Match.js';
import { TestClient } from './helpers/wsClient.js';

test('external DeepSeek process joins, learns a rejected action, inspects an own-board image, and chats', { timeout: 35000 }, async () => {
  let apiCalls = 0;
  let sawImage = false;
  let sawError = false;
  const api = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.response_format.type, 'json_object');
    apiCalls++;
    if (apiCalls === 1) assert.match(body.messages[1].content, /"private"/);
    if (apiCalls === 2) sawError = /"lastError":\{"code":"[A-Z_]+"/.test(body.messages[1].content);
    if (apiCalls === 3) sawImage = body.messages[1].content?.[1]?.image_url?.url?.startsWith('data:image/png;base64,') === true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(apiCalls === 1
      ? { type: 'act', name: 'g.move', args: { uid: 999999, to: { area: 'board', row: 9, col: 2 } } } : apiCalls === 2
        ? { type: 'look' } : apiCalls === 3
        ? { type: 'chat', text: '我来看看这一局的路线和盟约，大家一起稳稳推进！' }
      : { type: 'wait' }) } }] }));
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const server = await startServer({ port: 0, host: '127.0.0.1', quiet: true, MatchClass: Match, assetIndex: false, studio: false });
  let host = null;
  let child = null;
  try {
    host = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    const welcome = await host.hello('房主');
    const created = await host.request({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    assert.equal(created.t, 'ok');
    const room = await host.waitFor('room.state', (m) => m.hostId === welcome.playerId);
    child = spawn(process.execPath, ['scripts/deepseek-agent.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DEEPSEEK_API_KEY: 'test-only', SP_AI_ROOM: room.code,
        SP_AI_SERVER: `ws://127.0.0.1:${server.port}/ws`, DEEPSEEK_API_URL: `http://127.0.0.1:${api.address().port}/chat/completions`,
        SP_AI_THINK_MS: '1200' },
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += String(b); });
    const joined = await host.waitFor('room.state', (m) => m.seats.some((s) => s?.isAgent && s.ready), 12000);
    assert.equal(joined.seats.filter((s) => s?.isAgent).length, 1);
    assert.equal((await host.request({ t: 'room.start' })).t, 'ok');
    const spoken = await host.waitFor('m.chat', (m) => m.text.includes('大家一起'), 28000);
    assert.equal(spoken.playerId, joined.seats.find((s) => s?.isAgent).playerId, stderr);
    assert.ok(apiCalls >= 3);
    assert.equal(sawError, true, stderr);
    assert.equal(sawImage, true, stderr);
    assert.equal((await host.request({ t: 'g.chat', text: '字'.repeat(21) })).code, 'BAD_MSG');
    assert.equal((await host.request({ t: 'g.chat', text: '玩家文字消息' })).t, 'ok');
  } finally {
    child?.kill();
    await host?.terminate();
    await server.close();
    api.close();
  }
});
