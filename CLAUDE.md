# Immersive Games — notes for contributors

Camera-driven browser games (Vite + TypeScript + Three.js + MediaPipe Pose).

- `npm run dev` / `npm test` / `npm run build` (build runs `tsc` first).
- Architecture: `PoseTracker` (MediaPipe only lives here) → `PoseFrame` →
  `MotionAnalyzer` → `BodyState` → game. Games depend only on `BodyState`
  (`src/core/input/BodyState.ts`); `KeyboardBody` implements the same contract.
- Shared code goes in `src/core/`, each game in `src/games/<name>/`.
- Keep detection and gameplay logic pure and unit-tested (`*.test.ts` next to
  the code; see `MotionAnalyzer.test.ts`, `Judge.test.ts`, `Course.test.ts`).
- Avatar space: meters, hip-centered, y up, body facing −z, player's left = −x.
- `?debug` shows live detection values and exposes `window.game`.
- Visuals are procedural (no asset files) for now.
