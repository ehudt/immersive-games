import { describe, expect, it } from 'vitest';
import { LM, LANDMARK_COUNT, type Landmark, type PoseFrame } from './landmarks';
import { MotionAnalyzer } from './MotionAnalyzer';

interface Pose {
  dx?: number;
  dy?: number;
  /** Extra downward shift of the upper body (shoulders + head). */
  upperDy?: number;
  handsUp?: boolean;
}

/** A front-facing standing person in normalized image coordinates. */
function frame(timeMs: number, p: Pose = {}): PoseFrame {
  const dx = p.dx ?? 0;
  const dy = p.dy ?? 0;
  const up = p.upperDy ?? 0;
  const image: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  const set = (i: number, x: number, y: number) => (image[i] = { x: x + dx, y: y + dy, z: 0, visibility: 0.99 });
  set(LM.NOSE, 0.5, 0.28 + up);
  set(LM.LEFT_EAR, 0.53, 0.27 + up);
  set(LM.RIGHT_EAR, 0.47, 0.27 + up);
  // Person faces the camera: their left side is on image right.
  set(LM.LEFT_SHOULDER, 0.55, 0.38 + up);
  set(LM.RIGHT_SHOULDER, 0.45, 0.38 + up);
  set(LM.LEFT_ELBOW, 0.57, 0.48 + up);
  set(LM.RIGHT_ELBOW, 0.43, 0.48 + up);
  set(LM.LEFT_WRIST, 0.57, p.handsUp ? 0.18 : 0.58);
  set(LM.RIGHT_WRIST, 0.43, p.handsUp ? 0.18 : 0.58);
  set(LM.LEFT_HIP, 0.53, 0.58);
  set(LM.RIGHT_HIP, 0.47, 0.58);
  set(LM.LEFT_KNEE, 0.53, 0.72);
  set(LM.RIGHT_KNEE, 0.47, 0.72);
  set(LM.LEFT_ANKLE, 0.53, 0.86);
  set(LM.RIGHT_ANKLE, 0.47, 0.86);
  const world = image.map((l) => ({ ...l, x: l.x - 0.5, y: l.y - 0.58 }));
  return { time: timeMs, image, world };
}

const FPS = 30;

/** Feeds `seconds` of frames produced by `pose(t)`; returns the end time. */
function run(a: MotionAnalyzer, start: number, seconds: number, pose: (t: number) => Pose = () => ({})): number {
  const n = Math.round(seconds * FPS);
  let t = start;
  for (let i = 0; i < n; i++) {
    t = start + (i * 1000) / FPS;
    a.process(frame(t, pose(t)));
  }
  return t + 1000 / FPS;
}

function calibrated(): { a: MotionAnalyzer; t: number } {
  const a = new MotionAnalyzer();
  a.startCalibration();
  const t = run(a, 0, 2);
  expect(a.calibrationStatus.phase).toBe('done');
  return { a, t };
}

describe('MotionAnalyzer', () => {
  it('calibrates only after the player holds still long enough', () => {
    const a = new MotionAnalyzer();
    a.startCalibration();
    let t = run(a, 0, 1);
    expect(a.calibrationStatus.phase).toBe('holding');
    expect(a.calibrationStatus.progress).toBeGreaterThan(0.5);
    // Moving restarts the hold.
    t = run(a, t, 0.1, () => ({ dx: 0.1 }));
    expect(a.calibrationStatus.progress).toBeLessThan(0.2);
    t = run(a, t, 1.7, () => ({ dx: 0.1 }));
    expect(a.calibrationStatus.phase).toBe('done');
    expect(a.calibration!.torso).toBeCloseTo(0.2, 2);
  });

  it('does not calibrate while nobody is visible', () => {
    const a = new MotionAnalyzer();
    a.startCalibration();
    for (let i = 0; i < 90; i++) a.process(null);
    expect(a.state.tracked).toBe(false);
    expect(a.calibrationStatus.phase).toBe('searching');
  });

  it('detects a jump when the whole body rises, and lands again', () => {
    let { a, t } = calibrated();
    t = run(a, t, 0.3, () => ({ dy: -0.06 }));
    expect(a.state.jumping).toBe(true);
    expect(a.state.jumpHeight).toBeGreaterThan(0.1);
    t = run(a, t, 0.4);
    expect(a.state.jumping).toBe(false);
  });

  it('detects a jump quickly as the player takes off', () => {
    const { a, t } = calibrated();
    // Realistic take-off: the body rises 0.06 (0.3 torso) over 150 ms.
    let detectedAt = Infinity;
    for (let ms = 0; ms < 500 && detectedAt === Infinity; ms += 1000 / FPS) {
      a.process(frame(t + ms, { dy: -0.06 * Math.min(1, ms / 150) }));
      if (a.state.jumping) detectedAt = ms;
    }
    // The raw signal first exceeds the threshold in the 100 ms frame: smoothing adds no lag.
    expect(detectedAt).toBeLessThanOrEqual(101);
  });

  it('ignores landmark jitter while standing still', () => {
    let { a, t } = calibrated();
    // Seeded noise of a few pixels on every coordinate, like a real detector.
    let seed = 42;
    const noise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.012;
    };
    let falseActions = 0;
    for (let i = 0; i < 30 * 20; i++) {
      t += 1000 / FPS;
      const f = frame(t);
      for (const l of f.image) {
        l.x += noise();
        l.y += noise();
      }
      a.process(f);
      if (a.state.jumping || a.state.ducking || a.state.lane !== 0) falseActions++;
    }
    expect(falseActions).toBe(0);
  });

  it('does not treat stretching the upper body as a jump', () => {
    let { a, t } = calibrated();
    t = run(a, t, 0.5, () => ({ upperDy: -0.04 }));
    expect(a.state.jumping).toBe(false);
  });

  it('detects ducking when shoulders and head drop', () => {
    let { a, t } = calibrated();
    t = run(a, t, 0.4, () => ({ dy: 0.06, upperDy: 0.04 }));
    expect(a.state.ducking).toBe(true);
    expect(a.state.jumping).toBe(false);
    t = run(a, t, 0.5);
    expect(a.state.ducking).toBe(false);
  });

  it('maps side steps to mirrored lanes with hysteresis', () => {
    let { a, t } = calibrated();
    // Moving toward image-right is the player's screen-left (mirror view).
    t = run(a, t, 0.5, () => ({ dx: 0.1 }));
    expect(a.state.lane).toBe(-1);
    // A small drift back toward center stays in the lane…
    t = run(a, t, 0.5, () => ({ dx: 0.06 }));
    expect(a.state.lane).toBe(-1);
    // …returning fully goes back to center.
    t = run(a, t, 0.5);
    expect(a.state.lane).toBe(0);
    t = run(a, t, 0.5, () => ({ dx: -0.1 }));
    expect(a.state.lane).toBe(1);
  });

  it('detects raised hands', () => {
    let { a, t } = calibrated();
    t = run(a, t, 0.2, () => ({ handsUp: true }));
    expect(a.state.handsUp).toBe(true);
    t = run(a, t, 0.2);
    expect(a.state.handsUp).toBe(false);
  });

  it('reports lost tracking and produces an avatar skeleton when tracked', () => {
    const { a, t } = calibrated();
    expect(a.state.skeleton).toHaveLength(LANDMARK_COUNT);
    // Avatar space is y-up: the nose is above the hips.
    expect(a.state.skeleton![LM.NOSE].y).toBeGreaterThan(a.state.skeleton![LM.LEFT_HIP].y);
    // …and mirrored so the player's left is on screen-left (−x).
    expect(a.state.skeleton![LM.LEFT_SHOULDER].x).toBeLessThan(0);
    a.process(null);
    expect(a.state.tracked).toBe(false);
    a.process(frame(t));
    expect(a.state.tracked).toBe(true);
  });
});
