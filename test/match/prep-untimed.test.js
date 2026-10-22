import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE } from '../../shared/constants.js';
import { makeMatch } from './harness.js';

test('private co-op option removes only the rest-phase deadline', () => {
  const timed = makeMatch({ mode: 'coop', humans: 2, seed: 21, fake: true }).start();
  timed.toPrep(1);
  assert.ok(timed.m.deadline > timed.sched.now(), 'normal co-op retains its rest timer');
  timed.m.dispose();

  const h = makeMatch({ mode: 'coop', humans: 2, prepUntimed: true, seed: 21, fake: true }).start();
  const m = h.m;
  assert.ok(m.deadline > h.sched.now(), 'the briefing is still timed');
  h.toPrep(1);
  assert.equal(m.phase, PHASE.PREP);
  assert.equal(m.deadline, 0);
  h.sched.advance(m.gd.prepTime(1) * 1000 * 2);
  assert.equal(m.phase, PHASE.PREP, 'waiting does not auto-ready anyone');
  assert.deepEqual(m.handle('p_0', { t: 'g.ready', ready: true }), { ok: true });
  assert.equal(m.phase, PHASE.PREP, 'one player cannot end the shared rest phase');
  assert.deepEqual(m.handle('p_1', { t: 'g.ready', ready: true }), { ok: true });
  h.sched.runNext();
  assert.notEqual(m.phase, PHASE.PREP, 'all players ready can still advance');
  m.dispose();
});
