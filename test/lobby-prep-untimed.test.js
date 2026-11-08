import { describe, test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.js';
import { StubMatch } from '../server/match/StubMatch.js';
import { TestClient } from './helpers/wsClient.js';
import { ERR } from '../shared/constants.js';
import { validateC2S } from '../shared/protocol.js';

const started = [];
class RecordingMatch extends StubMatch {
  constructor(opts) { super(opts); started.push(opts); }
}
const ok = async (c, msg) => {
  const reply = await c.request(msg);
  assert.equal(reply.t, 'ok', JSON.stringify(reply));
};
const err = async (c, msg, code) => {
  const reply = await c.request(msg);
  assert.equal(reply.code, code, JSON.stringify(reply));
};

test('room.setPrepUntimed requires a boolean', () => {
  assert.equal(validateC2S({ t: 'room.setPrepUntimed', on: true }), null);
  assert.equal(validateC2S({ t: 'room.setPrepUntimed', on: false }), null);
  for (const on of [undefined, null, 1, 'true', {}, []]) {
    assert.notEqual(validateC2S({ t: 'room.setPrepUntimed', on }), null);
  }
});

test('room.confirmPrepUntimed requires a vote ID and a boolean answer', () => {
  assert.equal(validateC2S({ t: 'room.confirmPrepUntimed', voteId: 1, accept: true }), null);
  assert.equal(validateC2S({ t: 'room.confirmPrepUntimed', voteId: 1, accept: false }), null);
  for (const voteId of [undefined, 0, -1, '1']) {
    assert.notEqual(validateC2S({ t: 'room.confirmPrepUntimed', voteId, accept: true }), null);
  }
  assert.notEqual(validateC2S({ t: 'room.confirmPrepUntimed', voteId: 1, accept: 'true' }), null);
});

describe('co-op rest timer option', () => {
  let server;
  const clients = new Set();
  before(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', MatchClass: RecordingMatch,
      log: { info() {}, warn() {}, debug() {}, error() {} } });
  });
  afterEach(async () => {
    await Promise.all([...clients].map((c) => c.terminate().catch(() => {})));
    clients.clear();
  });
  after(async () => { await server?.close(); });
  const player = async (name) => {
    const c = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    clients.add(c);
    const welcome = await c.hello(name);
    c.id = welcome.playerId;
    return c;
  };

  test('host sets it before a co-op match; guests confirm again; it resets for the next match', async () => {
    const host = await player('Host');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const room = await host.waitFor('room.state', (s) => s.hostId === host.id);
    assert.equal(room.prepUntimed, false);
    const guest = await player('Guest');
    await ok(guest, { t: 'room.join', code: room.code });
    await guest.waitFor('room.state', (s) => s.code === room.code);
    await err(guest, { t: 'room.setPrepUntimed', on: true }, ERR.NOT_HOST);
    await ok(guest, { t: 'room.ready', ready: true });
    await host.waitFor('room.state', (s) => s.seats.some((seat) => seat?.playerId === guest.id && seat.ready));
    await ok(host, { t: 'room.setPrepUntimed', on: true });
    const changed = await guest.waitFor('room.state', (s) => s.prepUntimed === true);
    assert.equal(changed.seats.find((seat) => seat?.playerId === guest.id).ready, false);
    await ok(guest, { t: 'room.ready', ready: true });
    await host.waitFor('room.state', (s) => s.prepUntimed && s.seats.some((seat) => seat?.playerId === guest.id && seat.ready));
    const n = started.length;
    await ok(host, { t: 'room.start' });
    const vote = await guest.waitFor('room.state', (s) => s.prepUntimedVote && !s.inMatch);
    assert.equal(started.length, n, 'the match waits for every human');
    assert.deepEqual(vote.prepUntimedVote.accepted, []);
    await err(host, { t: 'room.start' }, ERR.WRONG_PHASE);
    await ok(host, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: true });
    const partial = await guest.waitFor('room.state', (s) => s.prepUntimedVote?.accepted.includes(host.id));
    assert.equal(partial.inMatch, false);
    await ok(guest, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: true });
    await guest.waitFor('room.state', (s) => s.inMatch && s.prepUntimed);
    assert.equal(started[n].prepUntimed, true);
    await err(host, { t: 'room.setPrepUntimed', on: false }, ERR.ROOM_STARTED);
    await ok(host, { t: 'g.infoReady' });
    await ok(guest, { t: 'g.infoReady' });
    const back = await guest.waitFor('room.state', (s) => !s.inMatch);
    assert.equal(back.prepUntimed, false);
  });

  test('a decline closes the option and clears every human Ready state', async () => {
    const host = await player('Host');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const room = await host.waitFor('room.state', (s) => s.hostId === host.id);
    const guest = await player('Guest');
    await ok(guest, { t: 'room.join', code: room.code });
    await ok(host, { t: 'room.setPrepUntimed', on: true });
    await ok(guest, { t: 'room.ready', ready: true });
    const n = started.length;
    await ok(host, { t: 'room.start' });
    const vote = await guest.waitFor('room.state', (s) => s.prepUntimedVote);
    const before = host.log.length;
    await ok(guest, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: false });
    const back = host.log.slice(before).find((s) => s.t === 'room.state' && !s.prepUntimed && !s.prepUntimedVote);
    assert.ok(back, 'the host receives the cancellation state');
    assert.equal(started.length, n);
    assert.equal(back.inMatch, false);
    assert.ok(back.seats.filter((seat) => seat && !seat.isBot).every((seat) => !seat.ready));
    await err(host, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: true }, ERR.WRONG_PHASE);
    await err(host, { t: 'room.start' }, ERR.NOT_READY);
  });

  test('an unanswered confirmation expires and returns everyone to the ready room', async () => {
    const host = await player('Host');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const room = await host.waitFor('room.state', (s) => s.hostId === host.id);
    const guest = await player('Guest');
    await ok(guest, { t: 'room.join', code: room.code });
    await ok(host, { t: 'room.setPrepUntimed', on: true });
    await ok(guest, { t: 'room.ready', ready: true });
    const original = server.lobby.opts.prepUntimedConfirmMs;
    server.lobby.opts.prepUntimedConfirmMs = 80;
    try {
      await ok(host, { t: 'room.start' });
      await guest.waitFor('room.state', (s) => s.prepUntimedVote);
      await new Promise((resolve) => setTimeout(resolve, 130));
      const back = server.lobby.rooms.get(room.code).toState();
      assert.equal(back.prepUntimed, false);
      assert.equal(back.prepUntimedVote, undefined);
      assert.ok(back.seats.filter((seat) => seat && !seat.isBot).every((seat) => !seat.ready));
    } finally { server.lobby.opts.prepUntimedConfirmMs = original; }
  });

  test('disconnecting a player cancels the confirmation', async () => {
    const host = await player('Host');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const room = await host.waitFor('room.state', (s) => s.hostId === host.id);
    const guest = await player('Guest');
    await ok(guest, { t: 'room.join', code: room.code });
    await ok(host, { t: 'room.setPrepUntimed', on: true });
    await ok(guest, { t: 'room.ready', ready: true });
    await ok(host, { t: 'room.start' });
    await guest.waitFor('room.state', (s) => s.prepUntimedVote);
    await guest.terminate();
    const back = await host.waitFor('room.state', (s) => s.seats.some((seat) => seat?.playerId === guest.id && !seat.connected) && !s.prepUntimedVote);
    assert.equal(back.prepUntimed, false);
    assert.ok(back.seats.filter((seat) => seat && !seat.isBot).every((seat) => !seat.ready));
  });

  test('external AI seats are not asked to confirm', async () => {
    const host = await player('Host');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    const room = await host.waitFor('room.state', (s) => s.hostId === host.id);
    const agent = await TestClient.connect(`ws://127.0.0.1:${server.port}/ws`);
    clients.add(agent);
    agent.id = (await agent.hello('External AI', undefined, { agent: true })).playerId;
    await ok(agent, { t: 'room.join', code: room.code });
    await ok(host, { t: 'room.setPrepUntimed', on: true });
    await ok(agent, { t: 'room.ready', ready: true });
    const n = started.length;
    await ok(host, { t: 'room.start' });
    const vote = await host.waitFor('room.state', (s) => s.prepUntimedVote);
    assert.equal(started.length, n);
    await err(agent, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: true }, ERR.BAD_TARGET);
    await ok(host, { t: 'room.confirmPrepUntimed', voteId: vote.prepUntimedVote.id, accept: true });
    await host.waitFor('room.state', (s) => s.inMatch);
    assert.equal(started[n].prepUntimed, true);
  });

  test('solo rooms cannot toggle it and normal co-op matches remain timed', async () => {
    const solo = await player('Solo');
    await ok(solo, { t: 'room.create', mode: 'solo', difficulty: 'NORMAL' });
    await solo.waitFor('room.state', (s) => s.hostId === solo.id);
    await err(solo, { t: 'room.setPrepUntimed', on: true }, ERR.BAD_TARGET);

    const host = await player('Coop');
    await ok(host, { t: 'room.create', mode: 'coop', difficulty: 'NORMAL' });
    await host.waitFor('room.state', (s) => s.hostId === host.id);
    const n = started.length;
    await ok(host, { t: 'room.start' });
    assert.equal(started[n].prepUntimed, false);
  });
});
