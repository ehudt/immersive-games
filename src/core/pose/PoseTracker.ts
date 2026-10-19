import type { PoseFrame } from './landmarks';
import { MainThreadDetector, WorkerDetector, type PoseDetector } from './mediapipe/detectors';
import { MODEL_URL, type Delegate, type PoseModel } from './mediapipe/landmarker';

export type { PoseModel } from './mediapipe/landmarker';

export interface PoseTrackerOptions {
  model?: PoseModel;
  /** Override the model URL (e.g. a self-hosted copy). */
  modelUrl?: string;
  /** Inference backend; GPU falls back to CPU automatically if unavailable. */
  delegate?: Delegate;
  /** Run inference in a Web Worker (default). Falls back to the main thread if it fails. */
  worker?: boolean;
  width?: number;
  height?: number;
}

/**
 * Owns the webcam and the pose detector. Feeds every new video frame to the
 * detector (one in flight at a time, so a slow model drops frames instead of
 * queueing them up) and hands each result to the listener.
 *
 * MediaPipe specifics live in ./mediapipe/ — swap that out to try a different
 * pose library; everything downstream consumes PoseFrame.
 */
export class PoseTracker {
  readonly video: HTMLVideoElement;
  private detector: PoseDetector | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private busy = false;
  private lastVideoTime = -1;
  private rafId = 0;
  private listener: ((frame: PoseFrame | null) => void) | null = null;
  /** Detections per second, for the debug overlay. */
  fps = 0;
  private fpsCount = 0;
  private fpsStart = 0;

  constructor(private options: PoseTrackerOptions = {}) {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
  }

  /** Where inference runs and on which backend, e.g. "worker/GPU". */
  get backend(): string {
    return this.detector ? `${this.detector.kind}/${this.detector.delegate}` : 'none';
  }

  /** Duration of the last inference in ms. */
  get inferenceMs(): number {
    return this.detector?.inferenceMs ?? 0;
  }

  /** Request the camera and load the model. Reports coarse progress via callback. */
  async init(onStatus: (msg: string) => void = () => {}): Promise<void> {
    onStatus('Starting camera…');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: this.options.width ?? 640 },
        height: { ideal: this.options.height ?? 480 },
      },
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    onStatus('Loading body tracking…');
    const config = {
      wasmBase: new URL('mediapipe/wasm', document.baseURI).href.replace(/\/$/, ''),
      modelAssetPath: this.options.modelUrl ?? MODEL_URL(this.options.model ?? 'full'),
      delegate: this.options.delegate ?? 'GPU',
    };
    if (this.options.worker !== false && typeof Worker !== 'undefined') {
      try {
        this.detector = await WorkerDetector.create(config);
      } catch (e) {
        console.warn('Pose worker unavailable, running on the main thread', e);
      }
    }
    this.detector ??= await MainThreadDetector.create(config);
  }

  start(listener: (frame: PoseFrame | null) => void): void {
    this.listener = listener;
    if (this.running) return;
    this.running = true;
    this.fpsStart = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick(): void {
    const v = this.video;
    const detector = this.detector;
    if (!detector || this.busy || v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    this.busy = true;
    detector
      .detect(v, performance.now())
      .then((frame) => {
        if (!this.running) return;
        this.countFps();
        this.listener?.(frame);
      })
      .catch((e) => console.warn('Pose detection failed', e))
      .finally(() => (this.busy = false));
  }

  private countFps(): void {
    this.fpsCount++;
    const now = performance.now();
    if (now - this.fpsStart > 1000) {
      this.fps = (this.fpsCount * 1000) / (now - this.fpsStart);
      this.fpsCount = 0;
      this.fpsStart = now;
    }
  }

  dispose(): void {
    this.stop();
    this.detector?.close();
    this.detector = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
