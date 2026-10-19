import type { Vec3 } from '../pose/landmarks';

export type Lane = -1 | 0 | 1;

/**
 * The game-facing description of what the player's body is doing right now.
 *
 * This is the contract between input sources (camera pose analysis, keyboard
 * fallback, ...) and games. Games should only depend on this, never on the
 * pose library directly, so detection can be swapped or improved freely.
 */
export interface BodyState {
  /** A body is currently detected (always true for keyboard input). */
  tracked: boolean;
  /** Discrete side-step position: -1 left, 0 center, 1 right (screen space). */
  lane: Lane;
  /** Continuous side offset in lane units (≈ -1.5..1.5). */
  lateral: number;
  /** Feet off the ground. */
  jumping: boolean;
  /** Current rise above standing height, in meters (≥ 0). */
  jumpHeight: number;
  /** Squatting / bending down. */
  ducking: boolean;
  /** 0..1 how deep the duck is. */
  duckDepth: number;
  /** At least one hand raised above the head. */
  handsUp: boolean;
  /** 0..1 how energetically the player moves (running in place). */
  activity: number;
  /**
   * Full-body joints for rendering an avatar, or null if unknown. 33 points in
   * MediaPipe order, in "avatar space": meters, hip-centered, y up, and the
   * body facing −z (away from a viewer behind it), so the player's left side
   * is on screen-left.
   */
  skeleton: Vec3[] | null;
}

export function emptyBodyState(): BodyState {
  return {
    tracked: false,
    lane: 0,
    lateral: 0,
    jumping: false,
    jumpHeight: 0,
    ducking: false,
    duckDepth: 0,
    handsUp: false,
    activity: 0,
    skeleton: null,
  };
}

/** Anything that can tell a game what the body is doing. */
export interface BodySource {
  readonly state: BodyState;
  /** Called once per rendered frame. `dt` in seconds. */
  update(dt: number): void;
  dispose(): void;
}
