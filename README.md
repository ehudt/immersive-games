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
| Jump        | Jump with both feet                     | Low glowing red hurdle   |
| Duck        | Squat / bend down                       | High amber/indigo beam   |
| Step L/R    | Step sideways (≈ one shoulder width)    | Violet crystals; mint arrow marks the safe lane |
| Reach up    | Raise a hand above your head            | Golden stars             |

### Worlds and look

The default world is **Moonlit Glade**: twilight, slightly mysterious but
friendly. The original **Sunny Meadow** is still there (Settings → World, or
`?world=meadow`).

- *Palette:* deep indigo sky fading to a rose-peach horizon, blue-green
  forest, pale lavender flagstones. Accents: mint (runes, "go this way"),
  lantern gold (fireflies, buttons), violet (crystals).
- *Light:* cool sky fill plus soft light from behind the camera, so the
  player and obstacles are always lit from the front; the warm moon ahead
  shows up as a rim light on the avatar and Bolt.
- *Signature elements:* a big low moon over layered ridges with a faint
  aurora; ancient stone arches with glowing runes over the path; fireflies,
  glowing mushrooms and lanterns along the way.
- *Obstacles* keep one meaning per color and height (see the table above), and
  each pools a soft glow on the path so it reads from far away. The HUD cue
  colors match.

Everything is procedural: no texture, model or font files are added (the
font is still Baloo 2 from Google Fonts).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 (camera needs localhost or https)
npm test           # unit tests (motion detection, course, judging)
npm run build      # static site in dist/
```

Play with the camera, or with the keyboard for development: ←/→ step,
Space jump, ↓ duck (hold), E reach (hold), Esc pause, M mute.

URL options: `?debug` shows live detection values plus render fps, pose fps,
inference time, the current quality level and draw calls (toggle in game with
<kbd>`</kbd>); `?delegate=cpu` forces CPU inference if GPU tracking
misbehaves; `?worker=0` runs inference on the main thread (for comparison);
`?world=meadow` picks the daylight world; `?quality=high|low` fixes the
graphics level (default `auto`). World and graphics are also in Settings.

### Performance

Pose inference runs in a Web Worker, so a slow model lowers the *tracking*
rate but never stalls rendering. Rendering uses at most 1.5× pixel ratio.
With *Graphics: Auto*, if the frame rate stays below 50 fps the game steps
down a quality ladder (`qualityLevels` in `src/core/perf/FrameStats.ts`):
first resolution down to 1×, then bloom off and fewer fireflies, then 0.75×.
*Low* starts without bloom and shadows. If tracking feels slow, try the
*Fast (lite)* model in Settings.

The glade is cheap by construction: all looping props are instanced meshes
that scroll on the GPU (one uniform per frame, no matrix uploads), all glows
and fireflies are two `Points` draw calls animated in the vertex shader, the
avatar is two instanced draw calls, only one light casts shadows (from the
avatar, Bolt and obstacles only), bloom runs at quarter resolution, and the
vignette is CSS.

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
  - `World.ts` — the `Scenery` interface and the "Sunny Meadow" world.
  - `Glade.ts` — the "Moonlit Glade" world (the default). Add new themes as
    other `Scenery` implementations; each sets its own fog, exposure, rim
    light and bloom through `look`.
  - `fx.ts` — shared shader helpers: GPU scrolling for instanced props, rim
    light, glow point clouds.
  - `Avatar.ts`, `Coach.ts`, `Obstacles.ts`, `Hud.ts`, `RunnerGame.ts`.

Everything visual is procedural (no asset files yet), which keeps it easy to
iterate on; real models/characters can replace pieces later. If CC0 assets are
added later, list them and their license here.

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
