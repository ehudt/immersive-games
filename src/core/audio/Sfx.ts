/**
 * Tiny synthesized sound effects (WebAudio oscillators, no asset files).
 * Must be constructed after a user gesture so the AudioContext may start.
 */
export class Sfx {
  protected ctx: AudioContext | null;
  protected master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Short tick when an instruction appears. */
  cue(): void {
    this.tone(880, 0.08, 'triangle', 0.5);
  }

  countdown(go = false): void {
    this.tone(go ? 1046 : 523, go ? 0.35 : 0.15, 'square', 0.35);
  }

  good(): void {
    this.tone(660, 0.1, 'triangle', 0.6);
    this.tone(990, 0.16, 'triangle', 0.6, 0.08);
  }

  perfect(): void {
    [784, 988, 1318].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.6, i * 0.07));
  }

  miss(): void {
    this.tone(160, 0.3, 'sawtooth', 0.5, 0, 90);
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.6, i * 0.12));
  }

  protected tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  dispose(): void {
    void this.ctx?.close();
  }
}
