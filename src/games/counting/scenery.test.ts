import { describe, expect, it } from 'vitest';
import { MILESTONES, decorations, milestoneAt, rng, skyColors, starsOpacity } from './scenery';
import { ART } from './skyArt';

// The same cases are in ios/CountingCore/Tests (DecorationsTests, SkyColorsTests).
describe('rng', () => {
  it('gives the same sequence for a seed', () => {
    const r = rng(1);
    expect([r(), r(), r()].map((v) => v.toFixed(12))).toEqual(['0.546456075739', '0.459556290414', '0.247041697381']);
  });
});

describe('milestones', () => {
  it('has a friend every ten numbers up to 300, each one different and drawn', () => {
    expect(MILESTONES.map((m) => m.count)).toEqual(Array.from({ length: 30 }, (_, i) => 10 * (i + 1)));
    expect(new Set(MILESTONES.map((m) => m.art)).size).toBe(30);
    for (const m of MILESTONES) expect(ART).toHaveProperty(m.art);
  });

  it('starts with the ones Ehud asked for', () => {
    expect(MILESTONES.slice(0, 9).map((m) => m.art)).toEqual([
      'redBalloon', 'kite', 'songbird', 'rcPlane', 'eagle', 'hotAir', 'cessna', 'helicopter', 'dragon',
    ]);
    expect(milestoneAt(90)?.art).toBe('dragon');
    expect(milestoneAt(95)).toBeUndefined();
    expect(milestoneAt(310)).toBeUndefined();
  });
});

describe('decorations', () => {
  const cases: [number, string, number, number, number, number, number, number][] = [
    // n, art, size, width, left, height, drift, duration
    [5, 'cloud', 3, 0, 3.002464, 5.117124, -29.892502, 7.920195],
    [7, 'bird', 0, 0, 75.00568, 7.851375, -27.827253, 6.117855],
    [10, 'redBalloon', 0, 56, 81.641881, 10.89521, -4.095564, 7.951394],
    [90, 'dragon', 0, 180, 79.156703, 91.085213, -5.595521, 6.944731],
    [169, 'comet', 0, 0, 21.584544, 169.80121, 21.208634, 10.72742],
    [183, 'planet3', 0, 0, 72.284889, 183.34251, 27.378021, 10.540636],
    [300, 'sun', 0, 170, 77.636212, 301.128624, -7.101167, 6.76509],
  ];
  it.each(cases)('places the same scenery as iOS at %i', (n, art, size, width, left, height, drift, duration) => {
    const [d, ...rest] = decorations(n);
    expect(rest).toEqual([]);
    expect(d).toMatchObject({ art, size, width });
    expect(d.left).toBeCloseTo(left, 5);
    expect(d.height).toBeCloseTo(height, 5);
    expect(d.drift).toBeCloseTo(drift, 5);
    expect(d.duration).toBeCloseTo(duration, 5);
  });

  it('leaves some bands empty', () => {
    expect(decorations(9)).toEqual([]);
    expect(decorations(47)).toEqual([]);
    expect(decorations(301)).toEqual([]);
  });

  it('puts friends on the right, clear of the rocket and of the scenery beside them', () => {
    for (const m of MILESTONES) {
      expect(decorations(m.count)[0].left).toBeGreaterThanOrEqual(77);
      for (const d of [...decorations(m.count - 1), ...decorations(m.count + 1)]) expect(d.left).toBeLessThan(25);
    }
  });
});

describe('sky', () => {
  it('stays a day sky until 150, then darkens into space by 300', () => {
    expect(skyColors(0)).toEqual(['rgb(79,195,255)', 'rgb(214,243,255)']);
    expect(skyColors(150)).toEqual(['rgb(42,134,224)', 'rgb(168,220,255)']);
    expect(skyColors(167.5)).toEqual(['rgb(53,115,216)', 'rgb(212,206,232)']);
    expect(skyColors(202.5)).toEqual(['rgb(51,70,173)', 'rgb(205,143,202)']);
    expect(skyColors(300)).toEqual(['rgb(6,9,34)', 'rgb(26,20,80)']);
    expect(skyColors(500)).toEqual(['#060922', '#1a1450']);
  });

  it('brings out the stars from 150', () => {
    expect([starsOpacity(100), starsOpacity(150), starsOpacity(190), starsOpacity(230), starsOpacity(300)]).toEqual([0, 0, 0.5, 1, 1]);
  });
});
