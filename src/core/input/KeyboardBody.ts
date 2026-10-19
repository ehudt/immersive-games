import { syntheticPose } from '../pose/SyntheticPose';
import { emptyBodyState, type BodySource, type BodyState, type Lane } from './BodyState';

const JUMP_TIME = 0.65;
const JUMP_HEIGHT = 0.45;

/**
 * Keyboard stand-in for the body, for development and for playing without a
 * camera. ←/→ (A/D) step, Space/↑/W jump, ↓/S duck (hold), E/Shift hands up (hold).
 */
export class KeyboardBody implements BodySource {
  readonly state: BodyState = { ...emptyBodyState(), tracked: true, activity: 1 };
  private held = new Set<string>();
  private jumpT = -1;
  private phase = 0;
  private duck = 0;
  private arms = 0;

  private onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.code;
    this.held.add(k);
    if (k === 'ArrowLeft' || k === 'KeyA') this.state.lane = Math.max(-1, this.state.lane - 1) as Lane;
    if (k === 'ArrowRight' || k === 'KeyD') this.state.lane = Math.min(1, this.state.lane + 1) as Lane;
    if ((k === 'Space' || k === 'ArrowUp' || k === 'KeyW') && this.jumpT < 0) this.jumpT = 0;
    if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => this.held.delete(e.code);

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  update(dt: number): void {
    const s = this.state;
    const ducking = this.held.has('ArrowDown') || this.held.has('KeyS');
    const handsUp = this.held.has('KeyE') || this.held.has('ShiftLeft') || this.held.has('ShiftRight');

    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const u = this.jumpT / JUMP_TIME;
      s.jumpHeight = u < 1 ? 4 * JUMP_HEIGHT * u * (1 - u) : 0;
      if (u >= 1) this.jumpT = -1;
    }
    s.jumping = this.jumpT >= 0 && s.jumpHeight > 0.08;
    s.ducking = ducking && !s.jumping;
    s.handsUp = handsUp;
    s.lateral += (s.lane - s.lateral) * Math.min(1, dt * 12);

    const k = Math.min(1, dt * 12);
    this.duck += ((s.ducking ? 1 : 0) - this.duck) * k;
    this.arms += ((handsUp ? 1 : 0) - this.arms) * k;
    s.duckDepth = this.duck;
    this.phase += dt * 11;
    s.skeleton = syntheticPose({
      phase: this.phase,
      run: s.jumping ? 0.2 : 1 - this.duck * 0.8,
      duck: this.duck,
      handsUp: this.arms,
      tuck: s.jumping ? Math.min(1, s.jumpHeight / JUMP_HEIGHT) : 0,
    });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }
}
