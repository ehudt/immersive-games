import { Sfx } from '../../core/audio/Sfx';

/** C-major pentatonic, two octaves: every count climbs a step, wrapping each ten. */
const SCALE = [523, 587, 659, 784, 880, 1046, 1175, 1318, 1568, 1760];

export class CountingSfx extends Sfx {
  /** A bright "bloop" that climbs with the count. */
  count(n: number): void {
    const f = SCALE[(n - 1) % SCALE.length];
    this.tone(f * 0.75, 0.12, 'sine', 0.5, 0, f);
    this.tone(f * 2, 0.18, 'triangle', 0.18, 0.04);
  }

  /** Every ten: a quick sparkly arpeggio. */
  milestone(): void {
    [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.4, 0.12 + i * 0.07));
    this.sparkle(0.12, 0.6);
  }

  /** The end of a game: a little victory fanfare with cheering. */
  victory(): void {
    const notes: [number, number, number][] = [
      // [freq, start, length]
      [392, 0, 0.16],
      [523, 0.16, 0.16],
      [659, 0.32, 0.16],
      [784, 0.48, 0.32],
      [659, 0.8, 0.16],
      [784, 0.96, 0.7],
    ];
    for (const [f, t, d] of notes) {
      this.tone(f, d + 0.1, 'triangle', 0.55, t);
      this.tone(f / 2, d + 0.1, 'sine', 0.3, t);
    }
    // Final chord.
    [523, 659, 784, 1046].forEach((f) => this.tone(f, 1.2, 'triangle', 0.25, 0.96));
    this.cheer(0.9, 2.2);
    this.sparkle(1.0, 1.4);
  }

  /** Gentle "hmm?" when nothing was heard at all. */
  nothing(): void {
    this.tone(440, 0.25, 'sine', 0.4, 0, 330);
    this.tone(392, 0.3, 'sine', 0.4, 0.28, 300);
  }

  /** Random high pings, like glitter. */
  private sparkle(delay: number, dur: number): void {
    for (let i = 0; i < 10; i++) {
      this.tone(1800 + Math.random() * 1800, 0.08, 'sine', 0.12, delay + (dur * i) / 10);
    }
  }

  /** Filtered noise swelling and fading: a crowd cheering far away. */
  private cheer(delay: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Clapping: bursts of noise at random moments.
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
    for (let c = 0; c < dur * 40; c++) {
      const at = Math.floor(Math.random() * (len - 800));
      for (let k = 0; k < 800; k++) data[at + k] += (Math.random() * 2 - 1) * (1 - k / 800);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 0.6;
    const gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.25, t + dur * 0.6);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(band).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }
}
