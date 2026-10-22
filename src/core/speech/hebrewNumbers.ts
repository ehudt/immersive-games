/**
 * Turns Hebrew speech-recognition transcripts into numbers.
 *
 * Recognizers return counting either as digits ("1 2 3", sometimes glued as
 * "123") or as words ("אחת שתיים שלוש", "עשרים ואחת"), in feminine or
 * masculine forms, with or without the "ו" (and) prefix. Word sequences are
 * often ambiguous: "תשע עשר" is 19, or 9 followed by 10. So the parser lists
 * every reading of each span and picks the segmentation that best looks like
 * counting (most consecutive steps), optionally continuing from a known last
 * number.
 */

type Kind =
  | 'unit' // 1..9 (also the "שתים"/"שנים" teen forms)
  | 'ten' // 10 alone, or the "עשרה" of a teen
  | 'tens' // 20..90
  | 'hundred' // 100, 200
  | 'hundreds' // the "מאות" of 300..900
  | 'thousand' // 1000, 2000
  | 'thousands' // the "אלפים" of 3000..9000
  | 'construct' // "שלושת", "ארבעת"... before "אלפים"
  | 'digits'
  | 'near'; // one sound away from some number words: `options`

interface Item {
  kind: Kind;
  value: number;
  /** Written with the "ו" (and) prefix. */
  vav: boolean;
  /** Not a number word, only sounds like one ("אשר" for "עשר"). */
  fuzzy?: boolean;
  /** For 'near' items: the numbers it might be. */
  options?: number[];
}

const WORDS: Record<string, [Kind, number]> = {};
function words(kind: Kind, value: number, ...forms: string[]): void {
  for (const f of forms) WORDS[f] = [kind, value];
}
words('unit', 1, 'אחת', 'אחד');
words('unit', 2, 'שתיים', 'שתים', 'שניים', 'שנים', 'שתי', 'שני');
words('unit', 3, 'שלוש', 'שלושה', 'שלש', 'שלשה');
words('unit', 4, 'ארבע', 'ארבעה');
words('unit', 5, 'חמש', 'חמישה', 'חמשה');
words('unit', 6, 'שש', 'שישה', 'ששה');
words('unit', 7, 'שבע', 'שבעה');
words('unit', 8, 'שמונה');
words('unit', 9, 'תשע', 'תשעה');
words('ten', 10, 'עשר', 'עשרה');
words('tens', 20, 'עשרים');
words('tens', 30, 'שלושים', 'שלשים');
words('tens', 40, 'ארבעים');
words('tens', 50, 'חמישים', 'חמשים');
words('tens', 60, 'שישים', 'ששים');
words('tens', 70, 'שבעים');
words('tens', 80, 'שמונים');
words('tens', 90, 'תשעים');
words('hundred', 100, 'מאה');
words('hundred', 200, 'מאתיים', 'מאתים');
words('hundreds', 100, 'מאות');
words('thousand', 1000, 'אלף');
words('thousand', 2000, 'אלפיים');
words('thousands', 1000, 'אלפים');
words('construct', 3, 'שלושת', 'שלשת');
words('construct', 4, 'ארבעת');
words('construct', 5, 'חמשת', 'חמישת');
words('construct', 6, 'ששת', 'שישת');
words('construct', 7, 'שבעת');
words('construct', 8, 'שמונת');
words('construct', 9, 'תשעת');
words('construct', 10, 'עשרת');

/**
 * A rough sound key for a Hebrew word, so misheard or mispronounced number
 * words still match: final letters → regular, letters that sound alike merge
 * (ח/כ/ק, ט/ת, ס/ש — the last also covers a child's lisp), and the silent or
 * vowel letters א ה ע ו י are dropped. "עשר", "אשר" and "אסר" all become "שר".
 */
export function soundKey(word: string): string {
  const map: Record<string, string> = { ם: 'מ', ן: 'נ', ץ: 'צ', ף: 'פ', ך: 'כ', ח: 'כ', ק: 'כ', ט: 'ת', ס: 'ש' };
  return [...word]
    .map((c) => map[c] ?? c)
    .filter((c) => !'אהעוי'.includes(c))
    .join('');
}

/** Sound key → number word, for units and tens only (short keys and clashes left out). */
const SOUNDS: Record<string, [Kind, number]> = {};
{
  const clash = new Set<string>();
  for (const [word, [kind, value]] of Object.entries(WORDS)) {
    if (kind !== 'unit' && kind !== 'ten' && kind !== 'tens') continue;
    const key = soundKey(word);
    if (key.length < 2) continue;
    const prev = SOUNDS[key];
    if (prev && prev[1] !== value) clash.add(key);
    SOUNDS[key] = [kind, value];
  }
  for (const key of clash) delete SOUNDS[key];
}

/** Mishearings too short for a sound key. */
const ALIASES: Record<string, [Kind, number]> = { את: ['unit', 1] };

/** Niqqud, cantillation and the geresh/gershayim marks. */
const MARKS = /[֑-ׇ׳״]/g;

function lookup(word: string, vav: boolean): Item | null {
  if (/^\d+$/.test(word)) return { kind: 'digits', value: Number(word), vav };
  const w = WORDS[word];
  return w ? { kind: w[0], value: w[1], vav } : null;
}

function soundsLike(word: string, vav: boolean): Item | null {
  const key = soundKey(word);
  const w = ALIASES[word] ?? SOUNDS[key];
  if (w) return { kind: w[0], value: w[1], vav, fuzzy: true };
  // One sound off ("שלום" or "שלו" for שלוש): any number it is close to.
  if (key.length < 2) return null;
  const options = new Set<number>();
  for (const [target, [, value]] of Object.entries(SOUNDS))
    if (target.length >= 3 && oneEditApart(key, target)) options.add(value);
  return options.size ? { kind: 'near', value: 0, vav, fuzzy: true, options: [...options] } : null;
}

/** Levenshtein distance ≤ 1 (one letter added, dropped or changed). */
export function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x: string, y: string) => x.slice(i + 1) === y;
  if (a.length === b.length) return rest(a, b.slice(i + 1));
  return a.length > b.length ? rest(a, b.slice(i)) : rest(b, a.slice(i));
}

/** Splits a transcript into number items; anything else becomes null (a gap). */
export function tokenize(text: string): (Item | null)[] {
  const raw = text
    .replace(MARKS, '')
    .replace(/(\d),(?=\d{3}\b)/g, '$1') // "1,000"
    .split(/[^א-ת\d]+/)
    .filter(Boolean);
  const out: (Item | null)[] = [];
  let pendingVav = false;
  for (const tok of raw) {
    if (tok === 'ו') {
      // A detached "ו" ("ו-3", "ו 3") belongs to the next word.
      pendingVav = true;
      continue;
    }
    // Digits can be glued to letters ("ו3").
    const parts = tok.match(/\d+|[^\d]+/g) ?? [];
    for (const part of parts) {
      if (part === 'ו') {
        pendingVav = true;
        continue;
      }
      const vav = part.startsWith('ו') && part.length > 1;
      const item =
        lookup(part, pendingVav) ??
        (vav ? lookup(part.slice(1), true) : null) ??
        (vav ? soundsLike(part.slice(1), true) : null) ??
        soundsLike(part, pendingVav);
      out.push(item);
      pendingVav = false;
    }
  }
  return out;
}

interface Span {
  end: number;
  values: number[];
  /** Reading starts with a dangling "ו" ("ואחת" on its own) — unlikely. */
  odd: boolean;
  /** A word that only sounds like a number: taken only when it continues the count. */
  guess?: boolean;
  /**
   * A glued digit run split into several numbers ("123" → 1, 2, 3). Browsers
   * resend the whole utterance, so it may start with numbers already counted;
   * taken only when it starts at or before the next number.
   */
  split?: boolean;
}

type Part = { end: number; value: number };

const isUnit = (it: Item | null | undefined): it is Item =>
  !!it && (it.kind === 'unit' || (it.kind === 'digits' && it.value >= 1 && it.value <= 9));

/** Readings of 1..99 starting at i (the first item may carry a "ו"). */
function belowHundred(items: (Item | null)[], i: number): Part[] {
  const it = items[i];
  if (!it) return [];
  const out: Part[] = [];
  if (it.kind === 'unit') {
    out.push({ end: i + 1, value: it.value });
    const next = items[i + 1];
    if (next && next.kind === 'ten' && !next.vav) out.push({ end: i + 2, value: 10 + it.value });
  } else if (it.kind === 'ten') {
    out.push({ end: i + 1, value: 10 });
  } else if (it.kind === 'tens') {
    out.push({ end: i + 1, value: it.value });
    const next = items[i + 1];
    if (isUnit(next)) out.push({ end: i + 2, value: it.value + next.value });
  } else if (it.kind === 'digits' && it.value >= 1 && it.value <= 99) {
    out.push({ end: i + 1, value: it.value });
  }
  return out;
}

function hundreds(items: (Item | null)[], i: number): Part[] {
  const it = items[i];
  if (!it) return [];
  if (it.kind === 'hundred') return [{ end: i + 1, value: it.value }];
  const next = items[i + 1];
  if (it.kind === 'unit' && it.value >= 3 && next?.kind === 'hundreds' && !next.vav)
    return [{ end: i + 2, value: it.value * 100 }];
  return [];
}

function thousands(items: (Item | null)[], i: number): Part[] {
  const it = items[i];
  if (!it) return [];
  if (it.kind === 'thousand') return [{ end: i + 1, value: it.value }];
  const next = items[i + 1];
  if ((it.kind === 'construct' || (it.kind === 'unit' && it.value >= 3)) && next?.kind === 'thousands' && !next.vav)
    return [{ end: i + 2, value: it.value * 1000 }];
  return [];
}

/** Every reading of one spoken number (1..9999) that starts at item i. */
function wordNumbers(items: (Item | null)[], i: number): Part[] {
  const out: Part[] = [];
  const add = (start: Part[], rest: (i: number) => Part[]) => {
    for (const s of start) {
      out.push(s);
      for (const r of rest(s.end)) out.push({ end: r.end, value: s.value + r.value });
    }
  };
  const afterHundreds = (j: number) => belowHundred(items, j);
  const afterThousands = (j: number) => {
    const res: Part[] = [...belowHundred(items, j)];
    for (const h of hundreds(items, j)) {
      res.push(h);
      for (const r of belowHundred(items, h.end)) res.push({ end: r.end, value: h.value + r.value });
    }
    return res;
  };
  add(thousands(items, i), afterThousands);
  add(hundreds(items, i), afterHundreds);
  out.push(...belowHundred(items, i));
  return out;
}

/**
 * Splits a glued digit run ("123", "91011") into a counting run, if it is
 * one. A number may repeat ("1233" → 1, 2, 3, 3): children (and transcripts)
 * sometimes say one twice. A run may also break off and go on from another
 * number ("1234568" → 1…6, 8): that is a child skipping one, which must still
 * be heard as a skip.
 */
export function splitConsecutive(digits: string): number[] | null {
  if (!digits || digits[0] === '0') return null;
  // Longest counting run from the start, for each length of its first number.
  const runs: { seq: number[]; pos: number }[] = [];
  for (let len = 1; len <= Math.min(4, digits.length); len++) {
    let n = Number(digits.slice(0, len));
    const seq = [n];
    let pos = len;
    while (pos < digits.length) {
      if (digits.startsWith(String(n + 1), pos)) n++;
      else if (!digits.startsWith(String(n), pos)) break;
      seq.push(n);
      pos += String(n).length;
    }
    if (seq.length > 1 && pos === digits.length) return seq;
    runs.push({ seq, pos });
  }
  // A run of at least two, then the rest: another run, or one short number.
  for (const { seq, pos } of runs) {
    if (seq.length < 2) continue;
    const rest = digits.slice(pos);
    if (rest[0] === '0') continue;
    const tail = splitConsecutive(rest) ?? (rest.length <= 3 ? [Number(rest)] : null);
    if (tail) return [...seq, ...tail];
  }
  return null;
}

function spansAt(items: (Item | null)[], i: number): Span[] {
  const it = items[i];
  if (!it) return [];
  if (it.kind === 'near') return it.options!.map((v) => ({ end: i + 1, values: [v], odd: false, guess: true }));
  if (it.kind === 'digits') {
    const spans: Span[] = [{ end: i + 1, values: [it.value], odd: false }];
    const split = splitConsecutive(String(it.value));
    if (split) spans.push({ end: i + 1, values: split, odd: false, split: true });
    // "20 ו-1": digits followed by a unit.
    if (it.value % 10 === 0 && it.value >= 20 && it.value < 100 && isUnit(items[i + 1]) && items[i + 1]!.vav)
      spans.push({ end: i + 2, values: [it.value + items[i + 1]!.value], odd: false });
    return spans;
  }
  return wordNumbers(items, i).map((p) => ({
    end: p.end,
    values: [p.value],
    odd: it.vav,
    guess: items.slice(i, p.end).some((x) => x?.fuzzy),
  }));
}

/**
 * Reads the numbers in a transcript. `last` is the number counted just before
 * this text (0 at the start), which helps resolve ambiguous readings.
 *
 * Readings are ranked by consecutive steps (n → n+1), minus one for a reading
 * that starts with a dangling "ו" and 1.5 for each number word left unread;
 * ties go to fewer (so longer) numbers.
 */
export function parseNumbers(text: string, last = 0): number[] {
  const items = tokenize(text);
  const n = items.length;
  type State = { rank: number; steps: number; skipped: number; weight: number; values: number[] };
  const rank = (steps: number, skipped: number, weight: number) => (steps - 1.5 * skipped) * 1e4 - weight;
  // best[i]: best reading of items[0..i), keyed by the last number read.
  const best: Map<number, State>[] = Array.from({ length: n + 1 }, () => new Map());
  best[0].set(last, { rank: 0, steps: 0, skipped: 0, weight: 0, values: [] });
  /** `weight`: how many numbers the reading claims (fewer, longer ones win ties). */
  const offer = (i: number, key: number, steps: number, skipped: number, weight: number, values: number[]) => {
    const r = rank(steps, skipped, weight);
    const cur = best[i].get(key);
    if (!cur || r > cur.rank) best[i].set(key, { rank: r, steps, skipped, weight, values });
  };
  for (let i = 0; i < n; i++) {
    for (const [prev, st] of best[i]) {
      // Leave this item unread (free if it isn't a number word at all).
      offer(i + 1, prev, st.steps, st.skipped + (items[i] ? 1 : 0), st.weight, st.values);
      for (const span of spansAt(items, i)) {
        if (span.guess && span.values.some((v, k) => v !== prev + 1 + k)) continue;
        if (span.split && span.values[0] > prev + 1) continue;
        let steps = st.steps - (span.odd ? 1 : 0);
        let p = prev;
        for (const v of span.values) {
          // A split only earns its new numbers, so "123" after 122 stays 123.
          if (v === p + 1 && (!span.split || v > last)) steps++;
          p = v;
        }
        // A split's resent numbers weigh nothing, and on a tie it beats one
        // huge number ("1234568" is 1…6, 8, not a million).
        const weight = span.split ? span.values.filter((v) => v > last).length - 0.5 : span.values.length;
        offer(span.end, p, steps, st.skipped, st.weight + weight, [...st.values, ...span.values]);
      }
    }
  }
  let result: State | undefined;
  for (const st of best[n].values()) if (!result || st.rank > result.rank) result = st;
  return result?.values ?? [];
}
