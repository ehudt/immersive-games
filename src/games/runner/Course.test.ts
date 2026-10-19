import { describe, expect, it } from 'vitest';
import { buildCourse, distanceAt, speedAt } from './Course';

describe('Course', () => {
  const course = buildCourse(1);

  it('is deterministic for a seed', () => {
    expect(buildCourse(1)).toEqual(course);
    expect(buildCourse(2).beats.map((b) => b.kind)).not.toEqual(course.beats.map((b) => b.kind));
  });

  it('has sorted, well-spaced beats that fit in the course', () => {
    for (let i = 1; i < course.beats.length; i++) {
      expect(course.beats[i].time - course.beats[i - 1].time).toBeGreaterThanOrEqual(1.5);
    }
    expect(course.beats[0].time).toBeGreaterThan(5);
    expect(course.beats.at(-1)!.time).toBeLessThan(course.duration);
    expect(course.duration).toBeGreaterThan(90);
  });

  it('places each obstacle where the player will be at its beat time', () => {
    for (const b of course.beats) expect(b.distance).toBeCloseTo(distanceAt(course.speed, b.time), 6);
  });

  it('distance is the integral of speed', () => {
    const p = course.speed;
    let d = 0;
    const dt = 0.001;
    for (let t = 0; t < 150; t += dt) d += speedAt(p, t + dt / 2) * dt;
    expect(distanceAt(p, 150)).toBeCloseTo(d, 1);
  });

  it('never asks to stay in the same lane twice in a row', () => {
    const lanes = course.beats.filter((b) => b.kind === 'lane');
    for (let i = 1; i < lanes.length; i++) expect(lanes[i].lane).not.toBe(lanes[i - 1].lane);
  });

  it('ends back in the center lane', () => {
    const lanes = course.beats.filter((b) => b.kind === 'lane');
    expect(lanes.at(-1)!.lane).toBe(0);
  });
});
