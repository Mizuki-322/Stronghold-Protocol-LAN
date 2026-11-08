import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';

const seats = [
  { seat: 0, playerId: 'agent', name: 'DeepSeek', isBot: false, isAgent: true, connected: true },
  { seat: 1, playerId: 'human', name: '玩家', isBot: false, connected: true },
];

test('external player is public, chat uses its own length limit and still obeys rate limits', () => {
  const h = makeMatch({ seats, fake: true });
  h.start();
  const agent = h.ps('agent');
  const human = h.ps('human');
  assert.equal(agent.isAgent, true);
  assert.equal(h.m.publicView().players.find((p) => p.playerId === 'agent').isAgent, true);
  assert.equal(h.m.chat(human, 'a'.repeat(21)).error, 'BAD_MSG');
  assert.equal(h.m.chat(agent, 'a'.repeat(80)).ok, true);
  assert.deepEqual(h.bc.at(-1), { t: 'm.chat', playerId: 'agent', text: 'a'.repeat(80) });
  assert.equal(h.m.chat(agent, 'again').error, 'RATE');
  assert.equal(h.m.chat(agent, 'a'.repeat(81)).error, 'BAD_MSG');
  assert.equal(h.m.chat(human, '你好').ok, true);
});

test('external player does not become the battle authority and must finish own battle before watching another', () => {
  const h = makeMatch({ seats, fake: true, clientCombat: true, clients: false });
  h.start();
  const agent = h.ps('agent');
  const own = { fieldId: 'n:agent', kind: 'normal', players: ['agent'], live: true, spec: {} };
  const other = { fieldId: 'n:human', kind: 'normal', players: ['human'], live: true, cc: true, spec: {} };
  h.m.fields = [own, other];
  assert.equal(h.m._authorityFor(own), null);
  assert.equal(h.m._authorityFor(other), 'human');
  assert.equal(h.m.watch(agent, 'n:human').error, 'WRONG_PHASE');
  own.live = false;
  h.m._startMsg = () => ({ t: 'b.start', fieldId: 'n:human', watch: true });
  assert.equal(h.m.watch(agent, 'n:human').ok, true);
  assert.equal(h.sent.at(-1)[1].fieldId, 'n:human');
});

test('battle statistics query reveals only the caller’s own field and returns live damage when the server runs it', () => {
  const h = makeMatch({ seats, fake: true });
  h.start();
  h.m.fields = [
    { fieldId: 'n:agent', players: ['agent'], live: true, battle: { _perPlayer: { agent: { damageDealt: 1234.7, killed: 2 } } } },
    { fieldId: 'n:human', players: ['human'], live: true, battle: { _perPlayer: { human: { damageDealt: 9999, killed: 9 } } } },
  ];
  assert.equal(h.m.battleStats(h.ps('agent')).ok, true);
  const sent = h.sent.at(-1);
  assert.equal(sent[0], 'agent');
  assert.deepEqual(sent[1], { t: 'm.battleStats', round: h.m.round, fieldId: 'n:agent', available: true,
    done: false, damageDealt: 1235, killed: 2 });
  assert.equal(h.m.battleStats(h.ps('agent')).error, 'RATE');
});

test('a mixed human and external AI match starts the AI field on the server', () => {
  const h = makeMatch({ seats, fake: true, clientCombat: true, clients: false, instant: false });
  h.start();
  assert.ok(h.drive(() => h.m.phase === 'COMBAT'));
  const agentField = h.m.fields.find((f) => f.players.includes('agent'));
  assert.ok(agentField);
  assert.equal(agentField.mode, 'server');
  assert.ok(agentField.battle);
  assert.notEqual(agentField.authority, 'agent');
});
