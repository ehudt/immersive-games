# Immersive Games — notes for contributors

Camera-driven browser games (Vite + TypeScript + Three.js + MediaPipe Pose).

- `npm run dev` / `npm test` / `npm run build` (build runs `tsc` first).
- Architecture: `PoseTracker` (MediaPipe only lives in `src/core/pose/mediapipe/`,
  inference runs in a Web Worker) → `PoseFrame` →
  `MotionAnalyzer` → `BodyState` → game. Games depend only on `BodyState`
  (`src/core/input/BodyState.ts`); `KeyboardBody` implements the same contract.
- Voice games use `SpeechListener` (`src/core/speech/`, browser Web Speech
  API, free) instead of `BodyState`; `hebrewNumbers.ts` parses Hebrew numbers.
- Shared code goes in `src/core/`, each game in `src/games/<name>/`; `main.ts`
  has the game picker (`?game=runner|counting`).
- Keep detection and gameplay logic pure and unit-tested (`*.test.ts` next to
  the code; see `MotionAnalyzer.test.ts`, `Judge.test.ts`, `Course.test.ts`,
  `hebrewNumbers.test.ts`, `CountJudge.test.ts`).
- Avatar space: meters, hip-centered, y up, body facing −z, player's left = −x.
- `?debug` shows live detection values, render/pose fps and inference time, and
  exposes `window.game`.
- Visuals are procedural (no asset files) for now.
- `ios/` is a native SwiftUI port of the counting game (see `ios/README.md`).
  `ios/CountingCore/` ports `hebrewNumbers.ts`, `CountJudge.ts` and
  `skyColors` line by line, with the same tests: change one side, port the
  change to the other. Swift is built and tested by `.github/workflows/ios.yml`
  (macOS); there is no Swift toolchain in the cloud container.
