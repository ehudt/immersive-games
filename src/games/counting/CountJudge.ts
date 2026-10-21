import { parseNumbers } from '../../core/speech/hebrewNumbers';

export interface Heard {
  /** Numbers newly counted, in order. */
  counted: number[];
  /** A number said out of order (only reported from final results). */
  wrong: number | null;
}

/**
 * Follows a child counting out loud: 1, 2, 3, …
 *
 * Fed with every speech result. Interim results only ever move the count
 * forward (quick feedback); a wrong number is judged only once the recognizer
 * has finalized the words, because interim guesses change. Numbers at or
 * below the current count are ignored: they are echoes of text already heard
 * (recognizers resend whole transcripts) or a repeat, not a new mistake.
 */
export class CountJudge {
  count = 0;
  /** A new recognition session started and nothing was counted in it yet. */
  private freshSession = true;

  /**
   * The recognizer (re)started listening. It often misses the first word of
   * a session (while it warms up, or said in the gap of a restart), so the
   * first number heard may skip one.
   */
  newSession(): void {
    this.freshSession = true;
  }

  /**
   * `alternatives`: the recognizer's guesses for one result, best first.
   * `confidence` (0..1, 0 = unknown): a low-confidence wrong number is
   * treated as misheard, not as a mistake.
   */
  hear(alternatives: string[], final: boolean, confidence = 0): Heard {
    let best: Guess | null = null;
    for (const text of alternatives) {
      const h = this.simulate(text, final && !(confidence > 0 && confidence < MIN_CONFIDENCE));
      if (!best || score(h) > score(best)) best = h;
    }
    if (!best) return { counted: [], wrong: null };
    if (best.counted.length) {
      this.count = best.counted[best.counted.length - 1];
      this.freshSession = false;
    }
    return { counted: best.counted, wrong: best.wrong };
  }

  private simulate(text: string, judge: boolean): Guess {
    const counted: number[] = [];
    let forgave = false;
    let c = this.count;
    for (const x of parseNumbers(text, c)) {
      if (x === c + 1) {
        counted.push(++c);
      } else if (x === c + 2 && this.freshSession && !counted.length) {
        counted.push(c + 1, c + 2);
        c += 2;
        forgave = true;
      } else if (x > c + 1 && !farOff(x, c)) {
        return { counted, wrong: judge ? x : null, forgave };
      }
    }
    return { counted, wrong: null, forgave };
  }
}

/**
 * A "wrong" number far beyond the count (1233 when at 2) is a transcript
 * artifact — digits glued together — not a child's mistake; ignore it.
 * Real slips stay close: a skipped number, or the wrong ten (29 → 40).
 */
function farOff(x: number, count: number): boolean {
  return x > 2 * (count + 1) + 20;
}

/** Below this recognizer confidence a wrong number is ignored. */
const MIN_CONFIDENCE = 0.5;

type Guess = Heard & { forgave: boolean };

/**
 * A guess without a mistake beats one with; then the one counting further,
 * where a forgiven missing number counts less than one actually heard.
 */
function score(h: Guess): number {
  return (h.wrong === null ? 1e6 : 0) + h.counted.length - (h.forgave ? 1.5 : 0);
}

export type Patience = 'normal' | 'long' | 'xlong';

/** Seconds to think: [before the first number, between numbers]. */
const PATIENCE: Record<Patience, [number, number]> = {
  normal: [15, 8],
  long: [20, 12],
  xlong: [30, 20],
};

/**
 * How long the child may stay quiet before we decide they don't know the next
 * number. Generous at the start, and longer for long numbers ("מאה עשרים ושלוש").
 */
export function patienceMs(count: number, level: Patience = 'long'): number {
  const [first, between] = PATIENCE[level];
  if (count === 0) return first * 1000;
  return (between + (count >= 100 ? 2 : 0)) * 1000;
}
