import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { LANDMARK_COUNT, type Landmark, type PoseFrame } from '../landmarks';

export type PoseModel = 'lite' | 'full' | 'heavy';
export type Delegate = 'GPU' | 'CPU';

export const MODEL_URL = (m: PoseModel) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/latest/pose_landmarker_${m}.task`;

export interface LandmarkerConfig {
  /** Absolute URL of the MediaPipe WASM folder. */
  wasmBase: string;
  modelAssetPath: string;
  delegate: Delegate;
}

/**
 * Creates a PoseLandmarker; GPU falls back to CPU if unavailable.
 * `useModule` must be true inside module workers (no importScripts there).
 */
export async function createLandmarker(
  cfg: LandmarkerConfig,
  useModule: boolean,
): Promise<{ landmarker: PoseLandmarker; delegate: Delegate }> {
  const fileset = await FilesetResolver.forVisionTasks(cfg.wasmBase, useModule);
  const create = (delegate: Delegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: cfg.modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  if (cfg.delegate === 'GPU') {
    try {
      return { landmarker: await create('GPU'), delegate: 'GPU' };
    } catch (e) {
      console.warn('GPU pose delegate failed, falling back to CPU', e);
    }
  }
  return { landmarker: await create('CPU'), delegate: 'CPU' };
}

const STRIDE = 4; // x, y, z, visibility
export const PACKED_LENGTH = LANDMARK_COUNT * STRIDE * 2;

/** Packs the first pose (image + world landmarks) into a transferable array. */
export function packResult(res: PoseLandmarkerResult): Float32Array | null {
  const image = res.landmarks[0];
  const world = res.worldLandmarks[0];
  if (!image || !world) return null;
  const out = new Float32Array(PACKED_LENGTH);
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const a = image[i];
    const b = world[i];
    out.set([a.x, a.y, a.z, a.visibility ?? 1], i * STRIDE);
    out.set([b.x, b.y, b.z, b.visibility ?? 1], (LANDMARK_COUNT + i) * STRIDE);
  }
  return out;
}

export function unpackFrame(data: Float32Array, time: number): PoseFrame {
  const read = (offset: number): Landmark[] =>
    Array.from({ length: LANDMARK_COUNT }, (_, i) => {
      const k = (offset + i) * STRIDE;
      return { x: data[k], y: data[k + 1], z: data[k + 2], visibility: data[k + 3] };
    });
  return { time, image: read(0), world: read(LANDMARK_COUNT) };
}
