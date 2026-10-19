import { describe, expect, it } from 'vitest';
import { AdaptiveResolution, FrameStats } from './FrameStats';

describe('FrameStats', () => {
  it('reports fps and the worst frame once per second', () => {
    const s = new FrameStats();
    let now = 1000;
    let refreshed = false;
    s.tick(1 / 60, now);
    for (let i = 0; i < 60; i++) {
      now += i === 30 ? 50 : 1000 / 60;
      refreshed = s.tick(i === 30 ? 0.05 : 1 / 60, now) || refreshed;
    }
    expect(refreshed).toBe(true);
    expect(s.fps).toBeGreaterThan(50);
    expect(s.worstMs).toBeCloseTo(50);
  });
});

describe('AdaptiveResolution', () => {
  it('steps down only after sustained low fps, never below the minimum', () => {
    const a = new AdaptiveResolution(1.5, 0.75, 50);
    expect(a.update(30)).toBeNull();
    expect(a.update(60)).toBeNull(); // a single slow second is ignored
    expect(a.update(30)).toBeNull();
    expect(a.update(30)).toBe(1.25);
    for (let i = 0; i < 20; i++) a.update(20);
    expect(a.pixelRatio).toBe(0.75);
  });
});
