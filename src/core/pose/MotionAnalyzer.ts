import { emptyBodyState, type BodyState, type Lane } from '../input/BodyState';
import { LM, LANDMARK_COUNT, type Landmark, type PoseFrame, type Vec3 } from './landmarks';
import { OneEuroFilter } from './OneEuroFilter';

/**
 * Tunables for turning raw landmarks into game actions. Vertical thresholds
 * are in "torso lengths" (shoulder-center to hip-center distance in the
 * image), lateral ones in "shoulder widths", so they are independent of how
 * far the player stands from the camera.
 */
export interface MotionConfig {
  /** Hips AND shoulders must rise this much above standing to count as a jump. */
  jumpEnter: number;
  jumpExit: number;
  /** Shoulders or head must drop this much below standing to count as a duck. */
  duckEnter: number;
  duckExit: number;
  /** Lateral offset (in lane steps) to enter a side lane / return to center. */
  laneEnter: number;
  laneExit: number;
  /** How many shoulder widths one lane step is. */
  laneStepShoulders: number;
  /** A wrist this far above the nose counts as "hand up". */
  handsUpMargin: number;
  /** Assumed real torso length, used to convert rises into meters. */
  torsoMeters: number;
  /** Seconds the player must stand still to calibrate. */
  calibrationSeconds: number;
  /** Time constant (s) for slowly re-centering the standing baseline. */
  baselineTau: number;
  /** Minimum landmark visibility for core joints (shoulders, hips). */
  minVisibility: number;
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  jumpEnter: 0.14,
  jumpExit: 0.07,
  duckEnter: 0.3,
  duckExit: 0.2,
  laneEnter: 0.7,
  laneExit: 0.45,
  laneStepShoulders: 1.1,
  handsUpMargin: 0.15,
  torsoMeters: 0.5,
  calibrationSeconds: 1.5,
  baselineTau: 4,
  minVisibility: 0.5,
};

/** The player's neutral standing pose, measured in image space (mirrored x). */
export interface Calibration {
  hipY: number;
  shoulderY: number;
  noseY: number;
  centerX: number;
  torso: number;
  shoulderWidth: number;
}

export type CalibrationPhase = 'idle' | 'searching' | 'holding' | 'done';

export interface CalibrationStatus {
  phase: CalibrationPhase;
  /** 0..1 progress of the "hold still" phase. */
  progress: number;
  /** Optional hint for the player (e.g. feet not visible). */
  hint: string | null;
}

interface Measures {
  hipX: number;
  hipY: number;
  shoulderX: number;
  shoulderY: number;
  noseY: number;
  torso: number;
  shoulderWidth: number;
}

/**
 * Converts a stream of PoseFrames into a BodyState: calibrates the player's
 * standing pose, then detects jumps, ducks, side steps, raised hands and
 * overall activity relative to it.
 */
export class MotionAnalyzer {
  readonly state: BodyState = emptyBodyState();
  readonly config: MotionConfig;
  calibration: Calibration | null = null;
  /** Live internal values for the debug overlay / tuning. */
  readonly debug: Record<string, number> = {};

  private phase: CalibrationPhase = 'idle';
  private samples: { t: number; m: Measures }[] = [];
  private holdStart = 0;
  private hint: string | null = null;

  private lastTime = 0;
  private filters = {
    hipX: new OneEuroFilter(1.5, 0.05),
    hipY: new OneEuroFilter(1.5, 0.05),
    shoulderX: new OneEuroFilter(1.5, 0.05),
    shoulderY: new OneEuroFilter(1.5, 0.05),
    noseY: new OneEuroFilter(1.5, 0.05),
    torso: new OneEuroFilter(0.5, 0.0),
  };
  private skeletonFilters = Array.from({ length: LANDMARK_COUNT * 3 }, () => new OneEuroFilter(1.8, 0.3));
  private prevKneeY: [number, number] | null = null;
  private activityEma = 0;
  private jumpStart = 0;
  private duckStart = 0;

  constructor(config: Partial<MotionConfig> = {}) {
    this.config = { ...DEFAULT_MOTION_CONFIG, ...config };
  }

  /** Begin (or redo) calibration. Detection is paused until it completes. */
  startCalibration(): void {
    this.phase = 'searching';
    this.samples = [];
    this.calibration = null;
    this.hint = null;
  }

  /** Skip calibration with a known baseline (tests, saved profiles). */
  setCalibration(c: Calibration): void {
    this.calibration = { ...c };
    this.phase = 'done';
  }

  get calibrationStatus(): CalibrationStatus {
    let progress = 0;
    if (this.phase === 'done') progress = 1;
    else if (this.phase === 'holding' && this.samples.length) {
      const last = this.samples[this.samples.length - 1].t;
      progress = Math.min(1, (last - this.holdStart) / this.config.calibrationSeconds);
    }
    return { phase: this.phase, progress, hint: this.hint };
  }

  /** Feed the latest frame, or null when no person is detected. */
  process(frame: PoseFrame | null): void {
    const m = frame ? this.measure(frame.image) : null;
    if (!frame || !m) {
      this.state.tracked = false;
      if (this.phase === 'holding') this.phase = 'searching';
      this.samples = [];
      return;
    }
    const t = frame.time / 1000;
    this.state.tracked = true;

    if (this.phase === 'searching' || this.phase === 'holding') {
      this.calibrate(t, m, frame.image);
    }
    if (this.phase === 'done' && this.calibration) {
      this.detect(t, m, frame.image);
    }
    this.state.skeleton = this.toAvatarSpace(frame.world, t);
    this.lastTime = t;
  }

  private measure(lm: Landmark[]): Measures | null {
    const v = this.config.minVisibility;
    const ls = lm[LM.LEFT_SHOULDER];
    const rs = lm[LM.RIGHT_SHOULDER];
    const lh = lm[LM.LEFT_HIP];
    const rh = lm[LM.RIGHT_HIP];
    if (!ls || !rs || !lh || !rh) return null;
    if (Math.min(ls.visibility, rs.visibility, lh.visibility, rh.visibility) < v) return null;
    // Mirror x so that "left" means the player's screen-left, like a mirror.
    const shoulderX = 1 - (ls.x + rs.x) / 2;
    const shoulderY = (ls.y + rs.y) / 2;
    const hipX = 1 - (lh.x + rh.x) / 2;
    const hipY = (lh.y + rh.y) / 2;
    const torso = Math.hypot(shoulderX - hipX, shoulderY - hipY);
    if (torso < 0.02) return null;
    const nose = lm[LM.NOSE];
    const noseY = nose && nose.visibility > v ? nose.y : shoulderY - torso * 0.45;
    return {
      hipX,
      hipY,
      shoulderX,
      shoulderY,
      noseY,
      torso,
      shoulderWidth: Math.hypot(ls.x - rs.x, ls.y - rs.y),
    };
  }

  private calibrate(t: number, m: Measures, lm: Landmark[]): void {
    const feetVisible =
      (lm[LM.LEFT_ANKLE]?.visibility ?? 0) > 0.5 || (lm[LM.RIGHT_ANKLE]?.visibility ?? 0) > 0.5;
    this.hint = feetVisible ? null : 'Step back so your whole body is visible';

    // The player must hold a steady pose; any big change restarts the hold.
    const ref = this.samples[0]?.m;
    if (ref && !closeTo(ref, m)) this.samples = [];
    if (!this.samples.length) this.holdStart = t;
    this.samples.push({ t, m });
    this.phase = this.samples.length >= 3 ? 'holding' : 'searching';

    if (t - this.holdStart >= this.config.calibrationSeconds && this.samples.length >= 8) {
      const ms = this.samples.map((s) => s.m);
      const avg = (k: keyof Measures) => ms.reduce((a, b) => a + b[k], 0) / ms.length;
      this.calibration = {
        hipY: avg('hipY'),
        shoulderY: avg('shoulderY'),
        noseY: avg('noseY'),
        centerX: (avg('hipX') + avg('shoulderX')) / 2,
        torso: avg('torso'),
        shoulderWidth: avg('shoulderWidth'),
      };
      this.phase = 'done';
      for (const f of Object.values(this.filters)) f.reset();
    }
  }

  private detect(t: number, raw: Measures, lm: Landmark[]): void {
    const c = this.calibration!;
    const cfg = this.config;
    const s = this.state;
    const dt = this.lastTime ? Math.min(Math.max(t - this.lastTime, 1e-3), 0.25) : 1 / 30;
    const f = this.filters;

    const hipX = f.hipX.filter(raw.hipX, t);
    const hipY = f.hipY.filter(raw.hipY, t);
    const shoulderX = f.shoulderX.filter(raw.shoulderX, t);
    const shoulderY = f.shoulderY.filter(raw.shoulderY, t);
    const noseY = f.noseY.filter(raw.noseY, t);

    const torso = c.torso;
    const rise = (c.hipY - hipY) / torso;
    const shoulderRise = (c.shoulderY - shoulderY) / torso;
    const drop = Math.max((shoulderY - c.shoulderY) / torso, (noseY - c.noseY) / torso);

    // Jump: both hips and shoulders go up (leaning back or tip-toeing doesn't).
    const jumpSignal = Math.min(rise, shoulderRise);
    if (!s.jumping && jumpSignal > cfg.jumpEnter) {
      s.jumping = true;
      this.jumpStart = t;
    } else if (s.jumping && jumpSignal < cfg.jumpExit) {
      s.jumping = false;
    } else if (s.jumping && t - this.jumpStart > 1.5) {
      // Nobody stays airborne this long: the player moved. Re-base on the new stance.
      s.jumping = false;
      Object.assign(c, { hipY, shoulderY, noseY });
    }
    s.jumpHeight = Math.max(0, jumpSignal) * cfg.torsoMeters;

    // Duck: shoulders or head go down.
    if (!s.ducking && !s.jumping && drop > cfg.duckEnter) {
      s.ducking = true;
      this.duckStart = t;
    } else if (s.ducking && drop < cfg.duckExit) {
      s.ducking = false;
    } else if (s.ducking && t - this.duckStart > 6) {
      s.ducking = false;
      Object.assign(c, { hipY, shoulderY, noseY });
    }
    s.duckDepth = clamp01(drop / 0.8);

    // Side steps, in lane units (relative to body size, so distance-independent).
    const laneStep = c.shoulderWidth * cfg.laneStepShoulders;
    const lateral = ((hipX + shoulderX) / 2 - c.centerX) / laneStep;
    s.lateral = lateral;
    s.lane = nextLane(s.lane, lateral, cfg.laneEnter, cfg.laneExit);

    // Hands up: any visible wrist clearly above the nose.
    const handLine = noseY - cfg.handsUpMargin * torso;
    s.handsUp = [LM.LEFT_WRIST, LM.RIGHT_WRIST].some((i) => {
      const w = lm[i];
      return w && w.visibility > 0.5 && w.y < handLine;
    });

    // Activity: how fast the knees move vertically (running in place).
    const lk = lm[LM.LEFT_KNEE];
    const rk = lm[LM.RIGHT_KNEE];
    let speed = 0;
    if (lk && rk && lk.visibility > 0.3 && rk.visibility > 0.3) {
      if (this.prevKneeY) {
        speed = (Math.abs(lk.y - this.prevKneeY[0]) + Math.abs(rk.y - this.prevKneeY[1])) / dt / torso;
      }
      this.prevKneeY = [lk.y, rk.y];
    } else {
      this.prevKneeY = null;
    }
    const k = 1 - Math.exp(-dt / 0.5);
    this.activityEma += (speed - this.activityEma) * k;
    s.activity = clamp01(this.activityEma / 4);

    // Slowly follow the player's standing height (they may shift closer/farther).
    if (!s.jumping && !s.ducking) {
      const a = 1 - Math.exp(-dt / cfg.baselineTau);
      c.hipY += (hipY - c.hipY) * a;
      c.shoulderY += (shoulderY - c.shoulderY) * a;
      c.noseY += (noseY - c.noseY) * a;
      c.torso += (f.torso.filter(raw.torso, t) - c.torso) * a;
      c.shoulderWidth += (raw.shoulderWidth - c.shoulderWidth) * a;
    }

    Object.assign(this.debug, {
      rise,
      shoulderRise,
      drop,
      lateral,
      activity: s.activity,
      torso,
    });
  }

  /** MediaPipe world space (x right, y down, z away from camera) → avatar space. */
  private toAvatarSpace(world: Landmark[], t: number): Vec3[] | null {
    if (!world || world.length < LANDMARK_COUNT) return null;
    const out: Vec3[] = new Array(LANDMARK_COUNT);
    const fs = this.skeletonFilters;
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const p = world[i];
      // Rotating the camera-facing body 180° about y: (x, y, z) → (−x, −y, z).
      out[i] = {
        x: fs[i * 3].filter(-p.x, t),
        y: fs[i * 3 + 1].filter(-p.y, t),
        z: fs[i * 3 + 2].filter(p.z, t),
      };
    }
    return out;
  }
}

export function nextLane(lane: Lane, lateral: number, enter: number, exit: number): Lane {
  if (lane === 0) {
    if (lateral > enter) return 1;
    if (lateral < -enter) return -1;
    return 0;
  }
  if (lane === 1) {
    if (lateral < -enter) return -1;
    return lateral < exit ? 0 : 1;
  }
  if (lateral > enter) return 1;
  return lateral > -exit ? 0 : -1;
}

function closeTo(a: Measures, b: Measures): boolean {
  const tol = a.torso;
  return (
    Math.abs(a.hipY - b.hipY) < 0.08 * tol &&
    Math.abs(a.shoulderY - b.shoulderY) < 0.08 * tol &&
    Math.abs(a.hipX - b.hipX) < 0.15 * tol &&
    Math.abs(b.torso / a.torso - 1) < 0.12
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
