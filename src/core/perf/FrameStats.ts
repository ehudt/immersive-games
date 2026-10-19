/** Rolling frame-time statistics, updated once per second. */
export class FrameStats {
  fps = 0;
  /** Slowest frame in the last window, ms. */
  worstMs = 0;
  private count = 0;
  private worst = 0;
  private start = 0;

  /** Call once per rendered frame with that frame's delta in seconds. Returns true when the stats refresh. */
  tick(dt: number, now = performance.now()): boolean {
    if (!this.start) this.start = now;
    this.count++;
    this.worst = Math.max(this.worst, dt * 1000);
    if (now - this.start < 1000) return false;
    this.fps = (this.count * 1000) / (now - this.start);
    this.worstMs = this.worst;
    this.count = 0;
    this.worst = 0;
    this.start = now;
    return true;
  }
}

/**
 * Lowers the render resolution step by step while the frame rate stays low,
 * so slower machines trade sharpness for smoothness automatically.
 */
export class AdaptiveResolution {
  private slowSeconds = 0;

  constructor(
    public pixelRatio: number,
    private readonly min = 0.75,
    private readonly targetFps = 50,
  ) {}

  /** Feed the once-per-second fps; returns a new pixel ratio, or null if unchanged. */
  update(fps: number): number | null {
    this.slowSeconds = fps < this.targetFps ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds < 2 || this.pixelRatio <= this.min) return null;
    this.slowSeconds = 0;
    this.pixelRatio = Math.max(this.min, Math.round((this.pixelRatio - 0.25) * 100) / 100);
    return this.pixelRatio;
  }
}
