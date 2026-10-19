import { describe, expect, it } from 'vitest';
import { LOOP, LOOP_BEHIND, wrapZ } from './fx';

describe('wrapZ', () => {
  it('keeps looping scenery between LOOP ahead and LOOP_BEHIND behind the player', () => {
    for (const z of [-500, -LOOP, -100, 0, 19.9, 20, 75, 1234.5]) {
      const w = wrapZ(z);
      expect(w).toBeGreaterThanOrEqual(LOOP_BEHIND - LOOP);
      expect(w).toBeLessThan(LOOP_BEHIND);
      // Wrapping only ever moves by whole loops.
      expect(Math.abs(Math.round((w - z) / LOOP) * LOOP - (w - z))).toBeLessThan(1e-9);
    }
  });

  it('moves objects toward the player as distance grows, then wraps them to the far end', () => {
    expect(wrapZ(-50 + 30)).toBe(-20);
    expect(wrapZ(-50 + 75)).toBeCloseTo(25 - LOOP);
  });
});
