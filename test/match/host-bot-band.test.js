import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
import { validateC2S } from '../../shared/protocol.js';

const FREE = (m) => m.gd.bandIds().find((id) => !m.bandTaken(id, 'ai_0'));

function botTurn({ mode = 'coop', humans = 2 } = {}) {
  const h = makeMatch({ mode, humans, bots: 1, hostId: 'p_0', seed: 21, fake: true }).start();
  h.runToPhase('BAND_DRAFT');
  const m = h.m;
  while (m.phase === 'BAND_DRAFT' && !m.players.get(m.draftTurn())?.isBot) {
    const pid = m.draftTurn();
    assert.equal(m.handle(pid, { t: 'g.band', bandId: FREE(m) }).ok, true);
  }
  assert.equal(m.draftTurn(), 'ai_0');
  h.sched.advance(0);
  assert.equal(m.draftTurn(), 'ai_0', 'room AI waits for the connected host');
  return h;
}

test('host can choose an available strategy for the current room AI; other players cannot', () => {
  const h = botTurn();
  const m = h.m;
  try {
    assert.equal(validateC2S({ t: 'g.botBand', bandId: FREE(m) }), null);
    assert.notEqual(m.handle('p_1', { t: 'g.botBand', bandId: FREE(m) }).ok, true);
    const taken = Object.values(m.draft.picks)[0];
    assert.notEqual(m.handle('p_0', { t: 'g.botBand', bandId: taken }).ok, true);
    const selected = FREE(m);
    assert.equal(m.handle('p_0', { t: 'g.botBand', bandId: selected }).ok, true);
    assert.equal(m.players.get('ai_0').bandId, selected);
  } finally { m.dispose(); }
});

test('large-alliance host can assign the opening strategies 机械师 or 森蚺 to a room AI', () => {
  for (const bandId of ['band_technician', 'band_eunectes']) {
    const h = botTurn({ mode: 'coop8', humans: 4 });
    try {
      const m = h.m;
      assert.equal(m.gd.bandAllowed(bandId), true, `${bandId} is an opening strategy in large alliances`);
      assert.equal(m.handle('p_0', { t: 'g.botBand', bandId }).ok, true);
      assert.equal(m.players.get('ai_0').bandId, bandId);
    } finally { h.m.dispose(); }
  }
});

test('host random button chooses a free strategy; disconnect falls back to automatic choice', () => {
  const random = botTurn();
  try {
    assert.equal(validateC2S({ t: 'g.botBand', bandId: null }), null);
    const taken = new Set(Object.values(random.m.draft.picks));
    assert.equal(random.m.handle('p_0', { t: 'g.botBand', bandId: null }).ok, true);
    assert.ok(random.m.players.get('ai_0').bandId);
    assert.ok(!taken.has(random.m.players.get('ai_0').bandId));
  } finally { random.m.dispose(); }
  const fallback = botTurn();
  try {
    fallback.m.onDisconnect('p_0');
    fallback.sched.advance(0);
    assert.ok(fallback.m.players.get('ai_0').bandId, 'AI picks after the host disconnects');
  } finally { fallback.m.dispose(); }
});
