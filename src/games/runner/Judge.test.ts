import { describe, expect, it } from 'vitest';
import { emptyBodyState, type BodyState } from '../../core/input/BodyState';
import type { Beat } from './Course';
import { Judge } from './Judge';

const beat = (id: number, time: number, kind: Beat['kind'], lane: Beat['lane'] = 0): Beat => ({ id, time, distance: time * 10, kind, lane });

/** Runs the judge at 60 fps from 0 to `until`, with the body given by `body(t)`. */
function play(j: Judge, until: number, body: (t: number) => Partial<BodyState>) {
  const out = [];
  for (let t = 0; t <= until; t += 1 / 60) out.push(...j.update(t, { ...emptyBodyState(), tracked: true, ...body(t) }));
  return out.map((r) => r.verdict);
}

describe('Judge', () => {
  it('is perfect when the action happens as the obstacle arrives', () => {
    const j = new Judge([beat(0, 2, 'jump')]);
    expect(play(j, 3, (t) => ({ jumping: t > 1.8 && t < 2.3 }))).toEqual(['perfect']);
  });

  it('is good when the action is early but inside the window', () => {
    const j = new Judge([beat(0, 2, 'duck')]);
    expect(play(j, 3, (t) => ({ ducking: t > 1.6 && t < 1.9 }))).toEqual(['good']);
  });

  it('misses when the action is too early, too late, or wrong', () => {
    expect(play(new Judge([beat(0, 2, 'jump')]), 3, (t) => ({ jumping: t > 1 && t < 1.4 }))).toEqual(['miss']);
    expect(play(new Judge([beat(0, 2, 'jump')]), 3, (t) => ({ jumping: t > 2.4 }))).toEqual(['miss']);
    expect(play(new Judge([beat(0, 2, 'jump')]), 3, () => ({ ducking: true }))).toEqual(['miss']);
  });

  it('checks the lane for side-step beats', () => {
    const beats = [beat(0, 2, 'lane', -1), beat(1, 4, 'lane', 1)];
    expect(play(new Judge(beats), 5, (t) => ({ lane: t < 3 ? -1 : 0 }))).toEqual(['perfect', 'miss']);
  });

  it('resolves beats in order', () => {
    const j = new Judge([beat(0, 1, 'reach'), beat(1, 2.5, 'jump'), beat(2, 4, 'duck')]);
    expect(play(j, 5, (t) => ({ handsUp: Math.abs(t - 1) < 0.2, ducking: Math.abs(t - 4) < 0.2 }))).toEqual(['perfect', 'miss', 'perfect']);
    expect(j.next).toBe(3);
  });
});
