# Immersive Games

Browser games where **your body is the controller**. A webcam tracks your
pose, and you play by actually moving: jumping, ducking, stepping, reaching.

## Game 1 — Warm-up Run

Inspired by "immersive interactive warm-up" videos: you run through a 3D
world while on-screen signs tell you to jump, duck or step aside — except
here you really have to do it, on time.

- A third-person avatar copies your movements live from the camera.
- **Bolt**, the coach-bot, floats ahead of you and demonstrates each move a
  moment before you need to do it.
- Obstacles arrive on a choreographed schedule (~2.5 min): side steps, jumps,
  ducks, reaching for stars, then mixed and speed rounds, then a cool-down.
- Running in place fills the RUN meter and earns bonus points; combos raise
  the score multiplier.
- The game pauses automatically if you walk out of view.

| Move        | What to do                              | Obstacle                 |
| ----------- | --------------------------------------- | ------------------------ |
| Jump        | Jump with both feet                     | Red/white hurdle         |
| Duck        | Squat / bend down                       | Yellow/black beam        |
| Step L/R    | Step sideways (≈ one shoulder width)    | Crates; green arrow lane |
| Reach up    | Raise a hand above your head            | Golden stars             |

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 (camera needs localhost or https)
npm test           # unit tests (motion detection, course, judging)
npm run build      # static site in dist/
```

Play with the camera, or with the keyboard for development: ←/→ step,
Space jump, ↓ duck (hold), E reach (hold), Esc pause, M mute.

URL options: `?debug` shows live detection values plus render fps, pose fps
and inference time (toggle in game with <kbd>`</kbd>); `?delegate=cpu` forces
CPU inference if GPU tracking misbehaves; `?worker=0` runs inference on the
main thread (for comparison).

### Performance

Pose inference runs in a Web Worker, so a slow model lowers the *tracking*
rate but never stalls rendering. Rendering uses at most 1.5× pixel ratio and
steps the resolution down automatically if the frame rate stays below 50 fps.
If tracking feels slow, try the *Fast (lite)* model in Settings.

To test on a phone/TV on your network, `npm run dev` listens on all
interfaces — but browsers only allow the camera on `https` or `localhost`, so
use the GitHub Pages deployment (or a tunnel) for other devices.

### Deployment

`.github/workflows/deploy.yml` runs tests and publishes `dist/` to GitHub
Pages on every push to `main`. Enable it once under *Settings → Pages →
Source: GitHub Actions*.

## How it works

```
webcam ─▶ PoseTracker ─▶ PoseFrame ─▶ MotionAnalyzer ─▶ BodyState ─▶ game
          (MediaPipe)    33 landmarks  calibrate + detect   jump/duck/lane/
                                                            hands/skeleton
                                       KeyboardBody ───────▶ (same contract)
```

- **`src/core/pose/PoseTracker.ts`** — camera + detection loop. MediaPipe
  ([Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker))
  is isolated in `src/core/pose/mediapipe/` (worker + main-thread fallback);
  swap it to try another detector. The WASM runtime is served from
  `node_modules` (no CDN); the model is fetched from Google's model storage.
- **`src/core/pose/MotionAnalyzer.ts`** — turns landmarks into actions.
  Calibrates your standing pose, then measures movement in *body-relative*
  units (torso lengths, shoulder widths), so it works at any distance.
  All thresholds live in `DEFAULT_MOTION_CONFIG`.
- **`src/core/input/BodyState.ts`** — the contract games consume. Games never
  touch the pose library directly.
- **`src/games/runner/`** — the Warm-up Run game:
  - `Course.ts` — the choreography (sections, beats, speed curve). Obstacles
    are placed by *distance*, so they arrive exactly on their beat.
  - `Judge.ts` — decides perfect / good / miss within generous time windows.
  - `World.ts` — the "Sunny Meadow" scenery (a `Scenery` implementation;
    add new themes alongside it).
  - `Avatar.ts`, `Coach.ts`, `Obstacles.ts`, `Hud.ts`, `RunnerGame.ts`.

Everything visual is procedural (no asset files yet), which keeps it easy to
iterate on; real models/characters can replace pieces later.

## Tuning detection

Play with `?debug` and watch `rise`, `drop` and `lateral` while you move.
Jumps trigger when hips **and** shoulders rise more than `jumpEnter` torso
lengths; ducks when shoulders or head drop more than `duckEnter`; lanes switch
at `laneEnter` lane-steps. Adjust in `DEFAULT_MOTION_CONFIG`, and the timing
windows in `src/games/runner/config.ts`.

## Ideas / next steps

- More scenes (beach, space, city) and courses; music with beats synced to the
  choreography.
- Character selection / custom avatar colors; proper rigged 3D models.
- More moves: jumping jacks, high knees, punches, lean-to-steer.
- Per-player calibration profiles and difficulty levels.
