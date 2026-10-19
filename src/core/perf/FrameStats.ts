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

export type QualityPreset = 'auto' | 'high' | 'low';

/** One rung of the quality ladder. */
export interface QualityLevel {
  pixelRatio: number;
  /** Post-processing bloom. */
  bloom: boolean;
  /** 0..1, scales particles and other optional scenery effects. */
  detail: number;
}

/**
 * The ladder from best to cheapest. Bloom and particles go before sharpness
 * drops below 1×, since a blurry picture hurts readability more than a
 * missing glow does.
 */
export function qualityLevels(maxPixelRatio: number): QualityLevel[] {
  const max = Math.max(0.75, maxPixelRatio);
  const one = Math.min(max, 1);
  const levels: QualityLevel[] = [
    { pixelRatio: max, bloom: true, detail: 1 },
    { pixelRatio: Math.min(max, 1.25), bloom: true, detail: 1 },
    { pixelRatio: one, bloom: true, detail: 1 },
    { pixelRatio: one, bloom: false, detail: 0.6 },
    { pixelRatio: one, bloom: false, detail: 0.2 },
    { pixelRatio: 0.75, bloom: false, detail: 0.2 },
  ];
  return levels.filter((l, i) => i === 0 || JSON.stringify(l) !== JSON.stringify(levels[i - 1]));
}

/**
 * Steps down the quality ladder while the frame rate stays low, so slower
 * machines trade effects and then sharpness for smoothness automatically.
 * It never steps back up, which avoids oscillating between two levels.
 */
export class AdaptiveQuality {
  private slowSeconds = 0;
  private index: number;
  private readonly adaptive: boolean;

  constructor(
    private readonly levels: QualityLevel[],
    preset: QualityPreset = 'auto',
    private readonly targetFps = 50,
  ) {
    this.adaptive = preset === 'auto';
    // 'low' starts at the first rung without bloom.
    this.index = preset === 'low' ? Math.max(0, levels.findIndex((l) => !l.bloom)) : 0;
  }

  get level(): QualityLevel {
    return this.levels[this.index];
  }

  /** Feed the once-per-second fps; returns the new level, or null if unchanged. */
  update(fps: number): QualityLevel | null {
    if (!this.adaptive) return null;
    this.slowSeconds = fps < this.targetFps ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds < 2 || this.index >= this.levels.length - 1) return null;
    this.slowSeconds = 0;
    this.index++;
    return this.level;
  }
}
