import { describe, expect, it } from 'vitest';
import { parseNumbers, splitConsecutive } from './hebrewNumbers';

describe('parseNumbers', () => {
  it('reads digits', () => {
    expect(parseNumbers('1 2 3')).toEqual([1, 2, 3]);
    expect(parseNumbers('1, 2, 3.')).toEqual([1, 2, 3]);
    expect(parseNumbers('99 100 101')).toEqual([99, 100, 101]);
  });

  it('splits glued digit runs when they count up', () => {
    expect(parseNumbers('123')).toEqual([1, 2, 3]);
    expect(parseNumbers('91011', 8)).toEqual([9, 10, 11]);
    // A real number that is also the next count stays whole.
    expect(parseNumbers('12', 11)).toEqual([12]);
    expect(parseNumbers('123', 122)).toEqual([123]);
    expect(parseNumbers('123 124', 122)).toEqual([123, 124]);
  });

  it('reads feminine and masculine units', () => {
    expect(parseNumbers('אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(parseNumbers('אחד שניים שלושה ארבעה חמישה שישה שבעה שמונה תשעה עשרה')).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('reads teens', () => {
    expect(parseNumbers('אחת עשרה', 10)).toEqual([11]);
    expect(parseNumbers('שתים עשרה שלוש עשרה', 11)).toEqual([12, 13]);
    expect(parseNumbers('חמישה עשר', 14)).toEqual([15]);
    expect(parseNumbers('תשע עשרה', 18)).toEqual([19]);
  });

  it('resolves "תשע עשר" from context', () => {
    expect(parseNumbers('שמונה תשע עשר', 7)).toEqual([8, 9, 10]);
    expect(parseNumbers('שמונה עשרה תשע עשרה', 17)).toEqual([18, 19]);
    expect(parseNumbers('תשע עשר אחת עשרה', 8)).toEqual([9, 10, 11]);
  });

  it('reads tens with "and"', () => {
    expect(parseNumbers('עשרים', 19)).toEqual([20]);
    expect(parseNumbers('עשרים ואחת', 20)).toEqual([21]);
    expect(parseNumbers('עשרים עשרים ואחת עשרים ושתיים', 19)).toEqual([20, 21, 22]);
    expect(parseNumbers('תשעים ותשע', 98)).toEqual([99]);
    expect(parseNumbers('עשרים ו-3', 22)).toEqual([23]);
    expect(parseNumbers('20 ו-1', 20)).toEqual([21]);
  });

  it('keeps a wrong decade as written', () => {
    // After 29 a child says "עשרים ועשר": that is 20 and 10, not 30.
    expect(parseNumbers('עשרים ותשע עשרים ועשר', 28)).toEqual([29, 20, 10]);
  });

  it('reads a skipped number as the number said', () => {
    expect(parseNumbers('עשרים ואחת', 19)).toEqual([21]);
    expect(parseNumbers('אחת עשרה שתים עשרה ארבע עשרה', 10)).toEqual([11, 12, 14]);
  });

  it('reads hundreds and thousands', () => {
    expect(parseNumbers('מאה', 99)).toEqual([100]);
    expect(parseNumbers('מאה ואחת', 100)).toEqual([101]);
    expect(parseNumbers('מאה ועשר', 109)).toEqual([110]);
    expect(parseNumbers('מאה ושתים עשרה', 111)).toEqual([112]);
    expect(parseNumbers('מאה עשרים ושלוש', 122)).toEqual([123]);
    expect(parseNumbers('מאתיים', 199)).toEqual([200]);
    expect(parseNumbers('שלוש מאות חמישים וחמש', 354)).toEqual([355]);
    expect(parseNumbers('אלף', 999)).toEqual([1000]);
    expect(parseNumbers('אלף ואחת', 1000)).toEqual([1001]);
    expect(parseNumbers('שלושת אלפים מאתיים', 3199)).toEqual([3200]);
  });

  it('ignores other words and niqqud', () => {
    expect(parseNumbers('אממ אחת, שתיים... שָׁלוֹשׁ!')).toEqual([1, 2, 3]);
    expect(parseNumbers('שלום מה נשמע')).toEqual([]);
  });

  it('handles cumulative (repeated) transcripts', () => {
    expect(parseNumbers('אחת אחת שתיים אחת שתיים שלוש')).toEqual([1, 1, 2, 1, 2, 3]);
  });
});

describe('splitConsecutive', () => {
  it('splits only counting runs', () => {
    expect(splitConsecutive('1234')).toEqual([1, 2, 3, 4]);
    expect(splitConsecutive('99100')).toEqual([99, 100]);
    expect(splitConsecutive('15')).toBeNull();
    expect(splitConsecutive('7')).toBeNull();
  });
});
