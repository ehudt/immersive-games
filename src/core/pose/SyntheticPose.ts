import { LM, LANDMARK_COUNT, type Vec3 } from './landmarks';

export interface SyntheticPoseParams {
  /** Running cycle phase in radians. */
  phase: number;
  /** 0..1 running intensity (0 = standing). */
  run: number;
  /** 0..1 crouch amount. */
  duck: number;
  /** 0..1 arms raised. */
  handsUp: number;
  /** 0..1 knee tuck while airborne. */
  tuck: number;
}

/**
 * Procedurally generates a 33-point skeleton in avatar space (meters, hip
 * centered, y up, facing −z). Used when there is no camera (keyboard play) and
 * for non-player characters, so every body is rendered by the same code path.
 */
export function syntheticPose(p: SyntheticPoseParams): Vec3[] {
  const pts: Vec3[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i: number, v: Vec3) => (pts[i] = v);

  const lean = 0.12 * p.run + 0.7 * p.duck;
  const torsoLen = 0.5;
  const sc: Vec3 = { x: 0, y: torsoLen * Math.cos(lean), z: -torsoLen * Math.sin(lean) };

  // Legs.
  for (const side of [-1, 1] as const) {
    const hip = { x: 0.1 * side, y: 0, z: 0 };
    const phi = p.phase + (side === -1 ? 0 : Math.PI);
    const thigh = 0.55 * p.run * Math.sin(phi) + 1.0 * p.duck + 0.7 * p.tuck;
    const bend = 0.15 + p.run * 1.1 * Math.max(0, Math.cos(phi)) + 1.9 * p.duck + 1.2 * p.tuck;
    const knee = add(hip, dir(thigh, 0.44));
    const ankle = add(knee, dir(thigh - bend, 0.43));
    set(side === -1 ? LM.LEFT_HIP : LM.RIGHT_HIP, hip);
    set(side === -1 ? LM.LEFT_KNEE : LM.RIGHT_KNEE, knee);
    set(side === -1 ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE, ankle);
    set(side === -1 ? LM.LEFT_HEEL : LM.RIGHT_HEEL, add(ankle, { x: 0, y: -0.05, z: 0.05 }));
    set(side === -1 ? LM.LEFT_FOOT_INDEX : LM.RIGHT_FOOT_INDEX, add(ankle, { x: 0, y: -0.07, z: -0.15 }));
  }

  // Arms (swing opposite to legs; blend to raised).
  for (const side of [-1, 1] as const) {
    const shoulder = add(sc, { x: 0.19 * side, y: 0, z: 0 });
    const phi = p.phase + (side === -1 ? Math.PI : 0);
    const swing = 0.7 * p.run * Math.sin(phi) + 0.5 * p.duck;
    const runElbow = add(shoulder, add(dir(swing, 0.28), { x: 0.04 * side, y: 0, z: 0 }));
    const runWrist = add(runElbow, dir(swing + 1.3 * Math.max(p.run, 0.3), 0.26));
    const upElbow = add(shoulder, { x: 0.08 * side, y: 0.26, z: 0 });
    const upWrist = add(upElbow, { x: 0.05 * side, y: 0.26, z: 0 });
    const elbow = lerp3(runElbow, upElbow, p.handsUp);
    const wrist = lerp3(runWrist, upWrist, p.handsUp);
    const L = side === -1;
    set(L ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER, shoulder);
    set(L ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW, elbow);
    set(L ? LM.LEFT_WRIST : LM.RIGHT_WRIST, wrist);
    for (const i of L ? [LM.LEFT_PINKY, LM.LEFT_INDEX, LM.LEFT_THUMB] : [LM.RIGHT_PINKY, LM.RIGHT_INDEX, LM.RIGHT_THUMB]) {
      set(i, wrist);
    }
  }

  // Head.
  const headUp = { x: 0, y: 0.2 * Math.cos(lean), z: -0.2 * Math.sin(lean) };
  const neck = add(sc, headUp);
  set(LM.NOSE, add(neck, { x: 0, y: 0, z: -0.1 }));
  set(LM.LEFT_EAR, add(neck, { x: -0.07, y: 0.01, z: 0 }));
  set(LM.RIGHT_EAR, add(neck, { x: 0.07, y: 0.01, z: 0 }));
  for (const i of [LM.LEFT_EYE_INNER, LM.LEFT_EYE, LM.LEFT_EYE_OUTER]) set(i, add(neck, { x: -0.03, y: 0.03, z: -0.08 }));
  for (const i of [LM.RIGHT_EYE_INNER, LM.RIGHT_EYE, LM.RIGHT_EYE_OUTER]) set(i, add(neck, { x: 0.03, y: 0.03, z: -0.08 }));
  set(LM.MOUTH_LEFT, add(neck, { x: -0.02, y: -0.04, z: -0.09 }));
  set(LM.MOUTH_RIGHT, add(neck, { x: 0.02, y: -0.04, z: -0.09 }));
  return pts;
}

/** Unit direction in the y/−z plane rotated `a` radians forward from straight down. */
function dir(a: number, len: number): Vec3 {
  return { x: 0, y: -Math.cos(a) * len, z: -Math.sin(a) * len };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
