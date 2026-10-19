import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame } from '../landmarks';
import { createLandmarker, packResult, unpackFrame, type Delegate, type LandmarkerConfig } from './landmarker';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** Runs pose inference on one video frame at a time. */
export interface PoseDetector {
  readonly kind: 'worker' | 'main';
  readonly delegate: Delegate;
  /** Duration of the last inference, in ms. */
  readonly inferenceMs: number;
  detect(video: HTMLVideoElement, time: number): Promise<PoseFrame | null>;
  close(): void;
}

/** Inference in a Web Worker: the main thread only grabs frames and renders. */
export class WorkerDetector implements PoseDetector {
  readonly kind = 'worker';
  inferenceMs = 0;
  private pending: { resolve: (f: PoseFrame | null) => void; reject: (e: Error) => void } | null = null;

  private constructor(
    private worker: Worker,
    readonly delegate: Delegate,
  ) {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending;
      this.pending = null;
      if (msg.type === 'result') {
        this.inferenceMs = msg.ms;
        p?.resolve(msg.data ? unpackFrame(msg.data, msg.time) : null);
      } else if (msg.type === 'error') {
        p?.reject(new Error(msg.message));
      }
    };
    // A crashed worker must not leave a detection pending forever.
    worker.onerror = (e) => {
      this.pending?.reject(new Error(e.message || 'Pose worker crashed'));
      this.pending = null;
    };
  }

  static create(config: LandmarkerConfig): Promise<WorkerDetector> {
    const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail(new Error('Pose worker timed out')), 60000);
      const fail = (e: Error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(e);
      };
      worker.onerror = (e) => fail(new Error(e.message || 'Pose worker failed to load'));
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        clearTimeout(timeout);
        worker.onerror = null;
        if (e.data.type === 'ready') resolve(new WorkerDetector(worker, e.data.delegate));
        else fail(new Error(e.data.type === 'error' ? e.data.message : 'Unexpected worker message'));
      };
      worker.postMessage({ type: 'init', config } satisfies WorkerRequest);
    });
  }

  async detect(video: HTMLVideoElement, time: number): Promise<PoseFrame | null> {
    const bitmap = await createImageBitmap(video);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker.postMessage({ type: 'detect', bitmap, time } satisfies WorkerRequest, [bitmap]);
    });
  }

  close(): void {
    this.worker.postMessage({ type: 'close' } satisfies WorkerRequest);
    this.worker.terminate();
  }
}

/** Fallback: inference on the main thread (blocks rendering while it runs). */
export class MainThreadDetector implements PoseDetector {
  readonly kind = 'main';
  inferenceMs = 0;

  private constructor(
    private landmarker: PoseLandmarker,
    readonly delegate: Delegate,
  ) {}

  static async create(config: LandmarkerConfig): Promise<MainThreadDetector> {
    const r = await createLandmarker(config, false);
    return new MainThreadDetector(r.landmarker, r.delegate);
  }

  async detect(video: HTMLVideoElement, time: number): Promise<PoseFrame | null> {
    const t0 = performance.now();
    const data = packResult(this.landmarker.detectForVideo(video, time));
    this.inferenceMs = performance.now() - t0;
    return data ? unpackFrame(data, time) : null;
  }

  close(): void {
    this.landmarker.close();
  }
}
