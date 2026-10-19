/** World and gameplay constants for the runner. Units: meters and seconds. */
export const RUNNER = {
  laneWidth: 1.8,
  trackWidth: 1.8 * 3 + 1.2,
  /** How far ahead obstacles are spawned / visible. */
  viewAhead: 140,
  /** How far the coach runs ahead of the player. */
  coachAhead: 7,
  /** Seconds before an obstacle arrives that its instruction appears. */
  cueLead: 2.4,
  /**
   * Judging window around the moment an obstacle reaches the player: the
   * action counts if performed at any time inside it. Generous on purpose —
   * camera tracking adds latency and this is a warm-up, not a rhythm test.
   */
  window: {
    jump: { before: 0.45, after: 0.25 },
    duck: { before: 0.45, after: 0.25 },
    lane: { before: 0.35, after: 0.1 },
    reach: { before: 0.5, after: 0.3 },
  },
  /** Seconds without a tracked body before the game auto-pauses. */
  lostPauseDelay: 1.2,
  score: { good: 100, perfect: 150, comboStep: 5, maxMultiplier: 4, runPerSecond: 20 },
} as const;
