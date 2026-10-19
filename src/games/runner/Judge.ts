import type { BodyState } from '../../core/input/BodyState';
import { RUNNER } from './config';
import type { ActionKind, Beat } from './Course';

export type Verdict = 'perfect' | 'good' | 'miss';

export type Windows = Record<ActionKind, { before: number; after: number }>;

interface Pending {
  ok: boolean;
  okAtHit: boolean;
  seenHit: boolean;
}

/** Whether the body is doing what a beat asks for, right now. */
export function satisfies(beat: Beat, body: BodyState): boolean {
  switch (beat.kind) {
    case 'jump':
      return body.jumping;
    case 'duck':
      return body.ducking;
    case 'reach':
      return body.handsUp;
    case 'lane':
      return body.lane === beat.lane;
  }
}

/**
 * Decides whether the player performed each beat's action in time. A beat
 * passes if the action is seen at any frame inside its window, and is
 * "perfect" if it is also happening at the exact moment the obstacle arrives.
 */
export class Judge {
  /** Index of the first beat not yet resolved. */
  next = 0;
  private pending = new Map<number, Pending>();

  constructor(
    private beats: Beat[],
    private windows: Windows = RUNNER.window,
  ) {}

  reset(): void {
    this.next = 0;
    this.pending.clear();
  }

  /** Call every frame with the game time; returns the beats resolved now. */
  update(time: number, body: BodyState): { beat: Beat; verdict: Verdict }[] {
    const resolved: { beat: Beat; verdict: Verdict }[] = [];
    for (let i = this.next; i < this.beats.length; i++) {
      const b = this.beats[i];
      const w = this.windows[b.kind];
      if (time < b.time - w.before) break;
      let p = this.pending.get(b.id);
      if (!p) this.pending.set(b.id, (p = { ok: false, okAtHit: false, seenHit: false }));
      const sat = satisfies(b, body);
      p.ok ||= sat;
      if (!p.seenHit && time >= b.time) {
        p.seenHit = true;
        p.okAtHit = sat;
      }
      if (time > b.time + w.after && i === this.next) {
        resolved.push({ beat: b, verdict: p.ok ? (p.okAtHit ? 'perfect' : 'good') : 'miss' });
        this.pending.delete(b.id);
        this.next++;
      }
    }
    return resolved;
  }
}
