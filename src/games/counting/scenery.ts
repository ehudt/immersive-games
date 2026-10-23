/**
 * What is in the sky at each height: its colors, the friend the rocket meets
 * every ten numbers, and the seeded clouds, birds, comets and planets around
 * them. Pure (no DOM) so the rules are unit-tested and shared with iOS:
 * ios/CountingCore ports skyColors(), rng() and decorations() line by line,
 * and scripts/export-ios-art.ts writes MILESTONES into it.
 */

/** [count, top color, bottom color]: a day sky until 150, then into space by 300. */
const SKY: [number, string, string][] = [
  [0, '#4fc3ff', '#d6f3ff'],
  [70, '#2f9be8', '#bfe6ff'],
  [150, '#2a86e0', '#a8dcff'],
  [185, '#3f5fcf', '#ffbfd0'],
  [220, '#262c8a', '#9a5fc4'],
  [260, '#121845', '#3b2a78'],
  [300, '#060922', '#1a1450'],
];

/** Stars fade in as the sky darkens: none at 150, all of them by 230. */
export const starsOpacity = (count: number): number => Math.min(1, Math.max(0, (count - 150) / 80));

export interface Milestone {
  count: number;
  /** The drawing (ART in skyArt.ts, an image of the same name on iOS). */
  art: string;
  /** Hebrew name, for the greeting ("שלום, דרקון!"). */
  name: string;
  /** Width in pixels (points on iOS), at most a third of the screen. */
  width: number;
}

/** A new friend every ten numbers, from the hills up to the sun. */
export const MILESTONES: Milestone[] = [
  { count: 10, art: 'redBalloon', name: 'בלון', width: 56 },
  { count: 20, art: 'kite', name: 'עפיפון', width: 80 },
  { count: 30, art: 'songbird', name: 'ציפור', width: 76 },
  { count: 40, art: 'rcPlane', name: 'מטוס על שלט', width: 110 },
  { count: 50, art: 'eagle', name: 'נשר', width: 170 },
  { count: 60, art: 'hotAir', name: 'כדור פורח', width: 110 },
  { count: 70, art: 'cessna', name: 'מטוס קטן', width: 160 },
  { count: 80, art: 'helicopter', name: 'מסוק', width: 150 },
  { count: 90, art: 'dragon', name: 'דרקון', width: 180 },
  { count: 100, art: 'plane', name: 'מטוס נוסעים', width: 200 },
  { count: 110, art: 'zeppelin', name: 'ספינת אוויר', width: 200 },
  { count: 120, art: 'jets', name: 'מטוסי סילון', width: 180 },
  { count: 130, art: 'weatherBalloon', name: 'בלון מזג אוויר', width: 84 },
  { count: 140, art: 'carpet', name: 'שטיח מעופף', width: 160 },
  { count: 150, art: 'shuttle', name: 'מעבורת חלל', width: 96 },
  { count: 160, art: 'satellite', name: 'לוויין', width: 140 },
  { count: 170, art: 'station', name: 'תחנת חלל', width: 190 },
  { count: 180, art: 'astronaut', name: 'אסטרונאוט', width: 100 },
  { count: 190, art: 'moon', name: 'ירח', width: 150 },
  { count: 200, art: 'ufo', name: 'צלחת מעופפת', width: 130 },
  { count: 210, art: 'mars', name: 'מאדים', width: 120 },
  { count: 220, art: 'comet', name: 'שביט', width: 180 },
  { count: 230, art: 'saturn', name: 'שבתאי', width: 210 },
  { count: 240, art: 'alien', name: 'חייזר', width: 100 },
  { count: 250, art: 'jupiter', name: 'צדק', width: 150 },
  { count: 260, art: 'spaceWhale', name: 'לוויתן חלל', width: 200 },
  { count: 270, art: 'earth', name: 'כדור הארץ', width: 140 },
  { count: 280, art: 'galaxy', name: 'גלקסיה', width: 200 },
  { count: 290, art: 'shootingStar', name: 'כוכב נופל', width: 180 },
  { count: 300, art: 'sun', name: 'שמש', width: 170 },
];

export const milestoneAt = (count: number): Milestone | undefined => MILESTONES.find((m) => m.count === count);

export function rng(seed: number): () => number {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

export function skyColors(count: number): [string, string] {
  for (let i = 1; i < SKY.length; i++) {
    if (count <= SKY[i][0]) {
      const [c0, t0, b0] = SKY[i - 1];
      const [c1, t1, b1] = SKY[i];
      const t = (count - c0) / (c1 - c0);
      return [mix(t0, t1, t), mix(b0, b1, t)];
    }
  }
  const last = SKY[SKY.length - 1];
  return [last[1], last[2]];
}

/** One piece of scenery. */
export interface Decoration {
  /** The drawing: an ART name, or "planet0"…"planet5" (a planet in COLORS[i]). */
  art: string;
  /** Cloud size, 1…3; 0 for other art. */
  size: number;
  /** Width for a milestone friend; 0 for the rest (sized by CSS). */
  width: number;
  /** Center, in percent of the width. */
  left: number;
  /** Bottom, above the launch line, in counting steps. */
  height: number;
  /** Horizontal drift in pixels, and how long one drift takes in seconds. */
  drift: number;
  duration: number;
}

/** Scenery for the band of sky at count n. */
export function decorations(n: number): Decoration[] {
  const r = rng(n);
  const m = milestoneAt(n);
  if (m) {
    // Beside the rocket's nose when it gets here, on the right (the number
    // star of a multiple of ten is on the left).
    return [{ art: m.art, size: 0, width: m.width, left: 77 + r() * 6, height: n + 0.85 + r() * 0.3, drift: (r() * 2 - 1) * 12, duration: 5 + r() * 3 }];
  }
  let art = '';
  let size = 0;
  if (n >= 2 && n <= 145 && r() < 0.6) {
    art = 'cloud';
    size = 1 + Math.floor(r() * 3);
  } else if (n >= 3 && n <= 60 && r() < 0.3) art = 'bird';
  else if (n > 165 && r() < 0.12) art = 'comet';
  else if (n > 175 && r() < 0.3) art = `planet${Math.floor(r() * 6)}`;
  if (!art) return [];
  // Keep the middle (the rocket's path and number stars) mostly clear.
  const left = r() < 0.5 ? 2 + r() * 22 : 70 + r() * 22;
  return [{ art, size, width: 0, left, height: n + r(), drift: (r() * 2 - 1) * 30, duration: 6 + r() * 6 }];
}
