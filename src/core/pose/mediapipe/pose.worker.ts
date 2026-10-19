import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { createLandmarker, packResult } from './landmarker';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Runs pose inference off the main thread so rendering never waits for it.
const scope = self as unknown as {
  postMessage(msg: WorkerResponse, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};
let landmarker: PoseLandmarker | null = null;

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(msg, transfer);

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const r = await createLandmarker(msg.config, true);
      landmarker = r.landmarker;
      post({ type: 'ready', delegate: r.delegate });
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  } else if (msg.type === 'detect') {
    if (!landmarker) {
      msg.bitmap.close();
      return;
    }
    const t0 = performance.now();
    try {
      const data = packResult(landmarker.detectForVideo(msg.bitmap, msg.time));
      post({ type: 'result', time: msg.time, ms: performance.now() - t0, data }, data ? [data.buffer] : []);
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      msg.bitmap.close();
    }
  } else if (msg.type === 'close') {
    landmarker?.close();
    landmarker = null;
  }
};
