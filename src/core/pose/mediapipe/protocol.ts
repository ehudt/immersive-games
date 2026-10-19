import type { Delegate, LandmarkerConfig } from './landmarker';

export type WorkerRequest =
  | { type: 'init'; config: LandmarkerConfig }
  | { type: 'detect'; bitmap: ImageBitmap; time: number }
  | { type: 'close' };

export type WorkerResponse =
  | { type: 'ready'; delegate: Delegate }
  | { type: 'result'; time: number; ms: number; data: Float32Array | null }
  | { type: 'error'; message: string };
