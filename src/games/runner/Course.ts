import type { Lane } from '../../core/input/BodyState';

export type ActionKind = 'jump' | 'duck' | 'lane' | 'reach';

/** One timed obstacle/action the player must perform. */
export interface Beat {
  id: number;
  /** Seconds from start when the obstacle reaches the player. */
  time: number;
  /** Track distance (m) where the obstacle stands. */
  distance: number;
  kind: ActionKind;
  /** For 'lane' beats: the lane the player must be in (others are blocked). */
  lane: Lane;
}

export interface Section {
  time: number;
  title: string;
  subtitle: string;
}

export interface SpeedProfile {
  /** Start speed (m/s). */
  v0: number;
  /** Final speed (m/s). */
  v1: number;
  /** Seconds to ramp from v0 to v1. */
  ramp: number;
}

export interface Course {
  beats: Beat[];
  sections: Section[];
  /** Total length in seconds. */
  duration: number;
  speed: SpeedProfile;
}

export function speedAt(p: SpeedProfile, t: number): number {
  return p.v0 + (p.v1 - p.v0) * Math.min(1, Math.max(0, t) / p.ramp);
}

/** Track distance covered after t seconds (closed form of ∫ speedAt). */
export function distanceAt(p: SpeedProfile, t: number): number {
  if (t <= 0) return p.v0 * t;
  if (t <= p.ramp) return p.v0 * t + ((p.v1 - p.v0) * t * t) / (2 * p.ramp);
  return p.v0 * p.ramp + ((p.v1 - p.v0) * p.ramp) / 2 + p.v1 * (t - p.ramp);
}

/** Small deterministic PRNG so a seed always produces the same course. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Block {
  title: string;
  subtitle: string;
  /** Pause before the first beat of the block, so the banner can be read. */
  lead: number;
  spacing: number;
  /** Explicit beats, or a count of random mixed beats. */
  beats: (ActionKind | `lane:${Lane}`)[] | number;
}

/**
 * The first course: a ~2.5 minute warm-up in the style of "immersive
 * interactive warm-up" videos — introduce each move on its own, then mix them
 * up and speed up, then cool down.
 */
export const WARMUP_BLOCKS: Block[] = [
  { title: 'Side steps', subtitle: 'Step left and right, around the crystals', lead: 6, spacing: 3, beats: ['lane:-1', 'lane:0', 'lane:1', 'lane:0', 'lane:-1', 'lane:1', 'lane:0'] },
  { title: 'Jump!', subtitle: 'Jump over the hurdles', lead: 3.5, spacing: 2.6, beats: ['jump', 'jump', 'jump', 'jump', 'jump', 'jump'] },
  { title: 'Duck!', subtitle: 'Squat down under the beams', lead: 3.5, spacing: 2.8, beats: ['duck', 'duck', 'duck', 'duck', 'duck'] },
  { title: 'Reach up!', subtitle: 'Raise your hands to grab the stars', lead: 3.5, spacing: 2.6, beats: ['reach', 'reach', 'reach', 'reach', 'reach'] },
  { title: 'Mix it up', subtitle: 'Watch the signs!', lead: 3.5, spacing: 2.3, beats: 12 },
  { title: 'Speed round', subtitle: 'Faster, faster!', lead: 3.5, spacing: 1.8, beats: 14 },
];

export function buildCourse(seed = 1, blocks: Block[] = WARMUP_BLOCKS): Course {
  const rand = mulberry32(seed);
  const speed: SpeedProfile = { v0: 9, v1: 13, ramp: 120 };
  const beats: Beat[] = [];
  const sections: Section[] = [{ time: 0, title: 'Warm-up run', subtitle: 'Run in place to get moving!' }];
  // A few seconds of free running before the first section starts.
  let t = 4;
  let lane: Lane = 0;
  let prev: ActionKind | null = null;

  const push = (kind: ActionKind, beatLane: Lane) => {
    beats.push({ id: beats.length, time: t, distance: distanceAt(speed, t), kind, lane: kind === 'lane' ? beatLane : 0 });
    prev = kind;
  };

  for (const block of blocks) {
    sections.push({ time: t + 1, title: block.title, subtitle: block.subtitle });
    t += block.lead;
    if (typeof block.beats === 'number') {
      for (let i = 0; i < block.beats; i++) {
        const kinds: ActionKind[] = ['jump', 'duck', 'lane', 'reach', 'lane'];
        let kind = kinds[Math.floor(rand() * kinds.length)];
        // Avoid three of the same in a row; it gets boring.
        if (kind === prev && beats.length > 1 && beats[beats.length - 2].kind === kind) {
          kind = kind === 'lane' ? 'jump' : 'lane';
        }
        if (kind === 'lane') {
          const options = ([-1, 0, 1] as Lane[]).filter((l) => l !== lane);
          lane = options[Math.floor(rand() * options.length)];
        }
        push(kind, lane);
        if (i < block.beats - 1) t += block.spacing;
      }
    } else {
      block.beats.forEach((b, i) => {
        if (b.startsWith('lane:')) {
          lane = Number(b.slice(5)) as Lane;
          push('lane', lane);
        } else {
          push(b as ActionKind, lane);
        }
        if (i < (block.beats as unknown[]).length - 1) t += block.spacing;
      });
    }
  }
  // Return to center for the finish.
  if (lane !== 0) {
    t += 2.5;
    lane = 0;
    push('lane', 0);
  }
  sections.push({ time: t + 1.5, title: 'Cool down', subtitle: 'Great work! Slow it down…' });
  return { beats, sections, duration: t + 6, speed };
}
