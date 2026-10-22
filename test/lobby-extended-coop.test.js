import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.js';
import { StubMatch } from '../server/match/StubMatch.js';
import { TestClient } from './helpers/wsClient.js';
import { ERR } from '../shared/constants.js';

test('extended room has eight seats and needs five occupied seats to start, including AI', async () => {
  const server = await startServer({ port: 0, host: '127.0.0.1', MatchClass: StubMatch,
    log: { info() {}, warn() {}, debug() {}, error() {} } });
  let client;
  try {
    client = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    const welcome = await client.hello('Host');
    assert.ok(welcome.playerId);
    assert.equal((await client.request({ t: 'room.create', mode: 'coop8', difficulty: 'NORMAL' })).t, 'ok');
    const room = await client.waitFor('room.state', (state) => state.mode === 'coop8');
    assert.equal(room.seats.length, 8);
    for (let i = 0; i < 3; i++) assert.equal((await client.request({ t: 'room.addBot' })).t, 'ok');
    assert.equal((await client.request({ t: 'room.start' })).code, ERR.NOT_READY);
    assert.equal((await client.request({ t: 'room.addBot' })).t, 'ok');
    assert.equal((await client.request({ t: 'room.start' })).t, 'ok');
    await client.waitFor('room.state', (state) => state.inMatch === true);
  } finally {
    await client?.terminate().catch(() => {});
    await server.close();
  }
});
