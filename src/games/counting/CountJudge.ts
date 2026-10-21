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

  /** `alternatives`: the recognizer's guesses for one result, best first. */
  hear(alternatives: string[], final: boolean): Heard {
    let best: Heard | null = null;
    for (const text of alternatives) {
      const h = this.simulate(text, final);
      if (!best || score(h) > score(best)) best = h;
    }
    best ??= { counted: [], wrong: null };
    if (best.counted.length) this.count = best.counted[best.counted.length - 1];
    return best;
  }

  private simulate(text: string, final: boolean): Heard {
    const counted: number[] = [];
    let c = this.count;
    for (const x of parseNumbers(text, c)) {
      if (x === c + 1) {
        counted.push(++c);
      } else if (x === 2 && c === 0) {
        // The recognizer often clips the very first word while it warms up.
        counted.push(1, 2);
        c = 2;
      } else if (x > c + 1) {
        return { counted, wrong: final ? x : null };
      }
    }
    return { counted, wrong: null };
  }
}

/** A guess without a mistake beats one with; then the one counting further. */
function score(h: Heard): number {
  return (h.wrong === null ? 1e6 : 0) + h.counted.length;
}

/**
 * How long the child may stay quiet before we decide they don't know the next
 * number. Generous at the start, and longer for long numbers ("מאה עשרים ושלוש").
 */
export function patienceMs(count: number): number {
  if (count === 0) return 12000;
  return count < 20 ? 6000 : count < 100 ? 7000 : 8500;
}
