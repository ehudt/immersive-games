import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame } from './landmarks';

export type PoseModel = 'lite' | 'full' | 'heavy';

const MODEL_URL = (m: PoseModel) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/latest/pose_landmarker_${m}.task`;

export interface PoseTrackerOptions {
  model?: PoseModel;
  /** Override the model URL (e.g. a self-hosted copy). */
  modelUrl?: string;
  /** Inference backend; GPU falls back to CPU automatically if unavailable. */
  delegate?: 'GPU' | 'CPU';
  width?: number;
  height?: number;
}

/**
 * Owns the webcam and the MediaPipe PoseLandmarker. Runs detection on every
 * new video frame and hands each result to the listener.
 *
 * This is the only module that knows about MediaPipe — swap it out to try a
 * different pose library; everything downstream consumes PoseFrame.
 */
export class PoseTracker {
  readonly video: HTMLVideoElement;
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private running = false;
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
    const wasmBase = new URL('mediapipe/wasm', document.baseURI).href.replace(/\/$/, '');
    const fileset = await FilesetResolver.forVisionTasks(wasmBase);
    const modelAssetPath = this.options.modelUrl ?? MODEL_URL(this.options.model ?? 'full');
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    if (this.options.delegate === 'CPU') {
      this.landmarker = await create('CPU');
      return;
    }
    try {
      this.landmarker = await create('GPU');
    } catch (e) {
      console.warn('GPU pose delegate failed, falling back to CPU', e);
      this.landmarker = await create('CPU');
    }
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
    if (!this.landmarker || v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();
    const res = this.landmarker.detectForVideo(v, now);

    this.fpsCount++;
    if (now - this.fpsStart > 1000) {
      this.fps = (this.fpsCount * 1000) / (now - this.fpsStart);
      this.fpsCount = 0;
      this.fpsStart = now;
    }

    const image = res.landmarks[0];
    const world = res.worldLandmarks[0];
    this.listener?.(
      image && world
        ? {
            time: now,
            image: image.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 })),
            world: world.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 })),
          }
        : null,
    );
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
