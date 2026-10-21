import './style.css';
import type { BodySource } from './core/input/BodyState';
import { CameraBody } from './core/input/CameraBody';
import { KeyboardBody } from './core/input/KeyboardBody';
import type { PoseModel } from './core/pose/PoseTracker';
import type { QualityPreset } from './core/perf/FrameStats';
import { RunnerGame, type WorldName } from './games/runner/RunnerGame';
import { CountingGame } from './games/counting/CountingGame';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const initialWorld: WorldName = params.get('world') === 'meadow' ? 'meadow' : 'glade';
const initialQuality = (['auto', 'high', 'low'] as const).find((q) => q === params.get('quality')) ?? 'auto';

let cleanup: (() => void) | null = null;

function showHome(): void {
  cleanup?.();
  cleanup = null;
  history.replaceState(null, '', gameUrl(null));
  app.innerHTML = `
    <div class="menu">
      <div class="menu-card">
        <div class="eyebrow">Immersive Games</div>
        <h1>Pick a game</h1>
        <div class="game-list">
          <button class="game-tile" id="pick-runner">
            <span class="tile-icon">🏃</span>
            <span class="tile-name">Warm-up Run</span>
            <span class="tile-text">Run, jump and duck with your whole body (camera).</span>
          </button>
          <button class="game-tile" id="pick-counting" dir="rtl" lang="he">
            <span class="tile-icon">🚀</span>
            <span class="tile-name">סופרים עד השמיים</span>
            <span class="tile-text">משחק ספירה בקול לילדים (מיקרופון).</span>
          </button>
        </div>
      </div>
    </div>`;
  document.getElementById('pick-runner')!.onclick = () => showMenu();
  document.getElementById('pick-counting')!.onclick = () => startCounting();
}

/** The page URL with `?game=` set (or removed), keeping other options. */
function gameUrl(game: string | null): string {
  const p = new URLSearchParams(location.search);
  if (game) p.set('game', game);
  else p.delete('game');
  const q = p.toString();
  return location.pathname + (q ? `?${q}` : '') + location.hash;
}

function startCounting(): void {
  cleanup?.();
  history.replaceState(null, '', gameUrl('counting'));
  app.innerHTML = '';
  const game = new CountingGame(app, { debug, onExit: () => showHome() });
  cleanup = () => game.dispose();
  game.start();
  if (debug) (window as unknown as { game: CountingGame }).game = game;
}

function showMenu(error?: string): void {
  cleanup?.();
  cleanup = null;
  history.replaceState(null, '', gameUrl('runner'));
  app.innerHTML = `
    <div class="menu">
      <div class="menu-card">
        <button class="back-link" id="home">← All games</button>
        <div class="eyebrow">Immersive Games</div>
        <h1>Warm-up Run</h1>
        <p class="lead">Run, jump, duck and step along a moonlit path — with your whole body.
        Follow Bolt the coach-bot and the glowing signs.</p>
        <ol class="howto">
          <li>Place your device so the camera sees you from head to toe (about 2–3 m away).</li>
          <li>Clear some space around you.</li>
          <li>Run in place, and <b>jump</b>, <b>duck</b>, <b>step left/right</b> or <b>reach up</b> on cue.</li>
        </ol>
        ${error ? `<p class="error">${error}</p>` : ''}
        <div class="buttons">
          <button id="play-camera">Play with camera</button>
          <button id="play-keys" class="secondary">Play with keyboard</button>
        </div>
        <details class="settings">
          <summary>Settings</summary>
          <label>Tracking model
            <select id="model">
              <option value="lite">Fast (lite)</option>
              <option value="full" selected>Balanced (full)</option>
              <option value="heavy">Accurate (heavy, slow)</option>
            </select>
          </label>
          <label>World
            <select id="world">
              <option value="glade" ${initialWorld === 'glade' ? 'selected' : ''}>Moonlit Glade</option>
              <option value="meadow" ${initialWorld === 'meadow' ? 'selected' : ''}>Sunny Meadow</option>
            </select>
          </label>
          <label>Graphics
            <select id="quality">
              <option value="auto" ${initialQuality === 'auto' ? 'selected' : ''}>Auto (adapts to your device)</option>
              <option value="high" ${initialQuality === 'high' ? 'selected' : ''}>High (always glow)</option>
              <option value="low" ${initialQuality === 'low' ? 'selected' : ''}>Low (no glow or shadows)</option>
            </select>
          </label>
          <label><input type="checkbox" id="debug" ${debug ? 'checked' : ''}/> Show debug info (toggle in game with \` )</label>
        </details>
        <p class="privacy">The camera video is processed on your device and never uploaded.</p>
      </div>
    </div>`;
  const opt = () => ({
    model: (document.getElementById('model') as HTMLSelectElement).value as PoseModel,
    debug: (document.getElementById('debug') as HTMLInputElement).checked,
    world: (document.getElementById('world') as HTMLSelectElement).value as WorldName,
    quality: (document.getElementById('quality') as HTMLSelectElement).value as QualityPreset,
  });
  document.getElementById('home')!.onclick = () => showHome();
  document.getElementById('play-camera')!.onclick = () => void startCamera(opt());
  document.getElementById('play-keys')!.onclick = () => startGame(new KeyboardBody(), undefined, opt());
}

interface Options {
  model: PoseModel;
  debug: boolean;
  world: WorldName;
  quality: QualityPreset;
}

async function startCamera(o: Options): Promise<void> {
  app.innerHTML = `<div class="menu"><div class="menu-card loading"><div class="spinner"></div><p id="status">Starting…</p></div></div>`;
  const status = document.getElementById('status')!;
  const delegate = params.get('delegate')?.toUpperCase() === 'CPU' ? 'CPU' : 'GPU';
  const worker = params.get('worker') !== '0';
  const camera = new CameraBody({ model: o.model, delegate, worker });
  try {
    await camera.init((msg) => (status.textContent = msg));
  } catch (e) {
    camera.dispose();
    console.error(e);
    const name = (e as Error).name;
    showMenu(
      name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser and try again.'
        : name === 'NotFoundError'
          ? 'No camera found. You can still play with the keyboard.'
          : `Could not start body tracking: ${(e as Error).message}`,
    );
    return;
  }
  startGame(camera, camera, o);
}

function startGame(body: BodySource, camera: CameraBody | undefined, { debug, world, quality }: Options): void {
  app.innerHTML = '<div class="stage"></div>';
  const stage = app.querySelector<HTMLElement>('.stage')!;
  const game = new RunnerGame(stage, { body, camera, debug, world, quality, onExit: () => showMenu() });
  cleanup = () => {
    game.dispose();
    body.dispose();
  };
  game.start();
  // Handy for poking at the game from the console / automated tests.
  if (debug) (window as unknown as { game: RunnerGame }).game = game;
}

const initialGame = params.get('game');
if (initialGame === 'counting') startCounting();
else if (initialGame === 'runner') showMenu();
else showHome();
