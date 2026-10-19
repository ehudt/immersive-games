import { describe, expect, it } from 'vitest';
import { AdaptiveQuality, FrameStats, qualityLevels } from './FrameStats';

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

describe('AdaptiveQuality', () => {
  it('builds a ladder without duplicate rungs', () => {
    const ladder = qualityLevels(1);
    expect(ladder[0]).toEqual({ pixelRatio: 1, bloom: true, detail: 1 });
    expect(ladder.at(-1)).toEqual({ pixelRatio: 0.75, bloom: false, detail: 0.2 });
    expect(ladder).toHaveLength(4);
  });

  it('steps down only after sustained low fps, and stops at the bottom', () => {
    const a = new AdaptiveQuality(qualityLevels(1.5), 'auto', 50);
    expect(a.level.pixelRatio).toBe(1.5);
    expect(a.update(30)).toBeNull();
    expect(a.update(60)).toBeNull(); // a single slow second is ignored
    expect(a.update(30)).toBeNull();
    expect(a.update(30)?.pixelRatio).toBe(1.25);
    for (let i = 0; i < 40; i++) a.update(20);
    expect(a.level).toEqual({ pixelRatio: 0.75, bloom: false, detail: 0.2 });
  });

  it('honors fixed presets', () => {
    const low = new AdaptiveQuality(qualityLevels(1.5), 'low');
    expect(low.level.bloom).toBe(false);
    expect(low.level.pixelRatio).toBe(1);
    const high = new AdaptiveQuality(qualityLevels(1.5), 'high');
    for (let i = 0; i < 10; i++) expect(high.update(10)).toBeNull();
    expect(high.level.bloom).toBe(true);
  });
});
