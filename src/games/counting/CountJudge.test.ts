import { describe, expect, it } from 'vitest';
import { CountJudge, patienceMs } from './CountJudge';

describe('CountJudge', () => {
  it('counts along interim and final results', () => {
    const j = new CountJudge();
    expect(j.hear(['אחת'], false).counted).toEqual([1]);
    expect(j.hear(['אחת שתיים'], false).counted).toEqual([2]);
    expect(j.hear(['אחת שתיים שלוש'], true).counted).toEqual([3]);
    expect(j.count).toBe(3);
  });

  it('ignores echoes of cumulative transcripts', () => {
    const j = new CountJudge();
    for (const t of ['1', '1 2', '1 2 3', '1 2 3 4']) expect(j.hear([t], true).wrong).toBeNull();
    expect(j.count).toBe(4);
  });

  it('reports a skipped number only when final', () => {
    const j = new CountJudge();
    j.hear(['אחת שתיים שלוש'], true);
    expect(j.hear(['חמש'], false)).toEqual({ counted: [], wrong: null });
    expect(j.hear(['חמש'], true)).toEqual({ counted: [], wrong: 5 });
    expect(j.count).toBe(3);
  });

  it('catches a wrong decade', () => {
    const j = new CountJudge();
    j.count = 28;
    expect(j.hear(['עשרים ותשע'], true).counted).toEqual([29]);
    // "עשרים ועשר" is 20 then 10 — already said, so ignored; the timer ends it.
    expect(j.hear(['עשרים ועשר'], true)).toEqual({ counted: [], wrong: null });
    expect(j.hear(['ארבעים'], true).wrong).toBe(40);
  });

  it('counts through the 9 → 10 → 11 and 19 → 20 ambiguities', () => {
    const j = new CountJudge();
    j.hear(['אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר אחת עשרה'], true);
    expect(j.count).toBe(11);
    j.hear(['שתים עשרה שלוש עשרה ארבע עשרה חמש עשרה שש עשרה שבע עשרה שמונה עשרה תשע עשרה עשרים'], true);
    expect(j.count).toBe(20);
  });

  it('forgives a clipped first word', () => {
    const j = new CountJudge();
    expect(j.hear(['שתיים שלוש'], true).counted).toEqual([1, 2, 3]);
  });

  it('forgives one number lost when the recognizer restarts', () => {
    const j = new CountJudge();
    j.hear(['1 2 3 4 5'], true);
    // Same session: a skip is a mistake.
    expect(new CountJudge().hear(['1 2 3 5'], true).wrong).toBe(5);
    j.newSession();
    expect(j.hear(['שבע שמונה'], true)).toEqual({ counted: [6, 7, 8], wrong: null });
    // Only the first number of the session, and only one.
    expect(j.hear(['עשר'], true).wrong).toBe(10);
    j.newSession();
    expect(j.hear(['אחת עשרה'], true).wrong).toBe(11);
  });

  it('treats a low-confidence wrong number as misheard', () => {
    const j = new CountJudge();
    j.hear(['1 2 3'], true, 0.9);
    expect(j.hear(['שבע'], true, 0.3)).toEqual({ counted: [], wrong: null });
    expect(j.hear(['שבע'], true, 0.8).wrong).toBe(7);
    // 0 means the browser didn't say: judge normally.
    expect(j.hear(['שבע'], true, 0).wrong).toBe(7);
  });

  it('picks the alternative that fits the count', () => {
    const j = new CountJudge();
    j.count = 5;
    expect(j.hear(['שבע', 'שש'], true)).toEqual({ counted: [6], wrong: null });
  });

  it('gives more time for the first and for long numbers', () => {
    expect(patienceMs(0)).toBeGreaterThan(patienceMs(5));
    expect(patienceMs(150)).toBeGreaterThan(patienceMs(5));
    expect(patienceMs(5, 'xlong')).toBeGreaterThan(patienceMs(5, 'normal'));
    expect(patienceMs(5)).toBe(12000);
  });
});
