import * as THREE from 'three';
import { Sfx } from '../../core/audio/Sfx';
import { AdaptiveResolution, FrameStats } from '../../core/perf/FrameStats';
import type { BodySource, BodyState } from '../../core/input/BodyState';
import type { CameraBody } from '../../core/input/CameraBody';
import { CameraPreview } from '../../core/ui/CameraPreview';
import { Avatar } from './Avatar';
import { Coach } from './Coach';
import { RUNNER } from './config';
import { buildCourse, distanceAt, speedAt, type Beat, type Course } from './Course';
import { Hud } from './Hud';
import { Judge, type Verdict } from './Judge';
import { Obstacles } from './Obstacles';
import { MeadowWorld } from './World';

export interface RunnerOptions {
  body: BodySource;
  /** Present when playing with the camera: enables calibration, preview and auto-pause. */
  camera?: CameraBody;
  seed?: number;
  debug?: boolean;
  onExit: () => void;
}

type Phase = 'calibrating' | 'countdown' | 'playing' | 'paused' | 'finished';

/**
 * "Warm-up Run": an endless-runner style warm-up. Obstacles arrive on a
 * choreographed schedule; the player jumps, ducks, side-steps and reaches with
 * their real body to get past them.
 */
export class RunnerGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera3d = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  private world = new MeadowWorld();
  private avatar = new Avatar();
  private coach = new Coach();
  private obstacles!: Obstacles;
  private hud: Hud;
  private preview: CameraPreview | null = null;
  private course: Course;

  private phase: Phase = 'countdown';
  private time = 0;
  private distance = 0;
  private scenery = 0;
  private countdown = 0;
  private judge!: Judge;
  private sectionIdx = 0;
  private score = 0;
  private combo = 0;
  private stats = { perfect: 0, good: 0, miss: 0, bestCombo: 0 };
  private lostFor = 0;
  private foundFor = 0;
  private lowEnergyFor = 0;
  private shake = 0;
  private avatarX = 0;
  private energy = 0;
  private debug: boolean;
  private frameStats = new FrameStats();
  private resolution: AdaptiveResolution;
  private drawnPoseFrame: unknown = null;
  private resumeAfterCountdown = false;
  private disposed = false;
  private clock = new THREE.Timer();
  private sfx = new Sfx();
  private lastCueId = -1;

  constructor(
    private container: HTMLElement,
    private opts: RunnerOptions,
  ) {
    this.debug = !!opts.debug;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Sharp enough on high-DPI screens without paying for 4× the pixels; lowered
    // further automatically if the frame rate drops.
    this.resolution = new AdaptiveResolution(Math.min(devicePixelRatio, 1.5));
    this.renderer.setPixelRatio(this.resolution.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'game-canvas';
    container.append(this.renderer.domElement);

    this.scene.background = this.world.horizon;
    this.scene.fog = new THREE.Fog(this.world.horizon, 60, 190);
    this.scene.add(this.world.root, this.avatar.root, this.coach.root);

    this.course = buildCourse(opts.seed ?? 1);
    this.resetRun();

    this.hud = new Hud(container);
    this.hud.debug.hidden = !this.debug;
    if (opts.camera) {
      this.preview = new CameraPreview(opts.camera.tracker.video);
      this.hud.cameraSlot.append(this.preview.el);
    }

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    this.onResize();
  }

  start(): void {
    if (this.opts.camera) this.beginCalibration();
    else this.beginCountdown();
    this.clock.connect(document);
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.clock.dispose();
    this.sfx.dispose();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.world.dispose();
    this.avatar.dispose();
    this.coach.dispose();
    this.obstacles.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------- flow

  private resetRun(): void {
    if (this.obstacles) {
      this.scene.remove(this.obstacles.root);
      this.obstacles.dispose();
    }
    this.obstacles = new Obstacles(this.course.beats);
    this.scene.add(this.obstacles.root);
    this.time = 0;
    this.distance = 0;
    this.judge = new Judge(this.course.beats);
    this.lastCueId = -1;
    this.sectionIdx = 0;
    this.score = 0;
    this.combo = 0;
    this.stats = { perfect: 0, good: 0, miss: 0, bestCombo: 0 };
  }

  private beginCalibration(): void {
    this.phase = 'calibrating';
    this.opts.camera!.analyzer.startCalibration();
    this.hud.showPanel(`
      <h2>Get ready</h2>
      <p>Stand back so the camera sees your <b>whole body</b>. Arms down, stand still for a moment.</p>
      <div class="calib-camera"></div>
      <div class="calib-bar"><div class="fill"></div></div>
      <p class="calib-hint"></p>
      <div class="buttons"><button data-action="menu" class="secondary">Back</button></div>
    `, { menu: () => this.opts.onExit() });
    // Show the camera view large, inside the panel, while calibrating.
    if (this.preview) this.container.querySelector('.calib-camera')?.append(this.preview.el);
  }

  private beginCountdown(resume = false): void {
    this.phase = 'countdown';
    this.countdown = 3;
    this.resumeAfterCountdown = resume;
    if (this.preview) this.hud.cameraSlot.append(this.preview.el);
    this.hud.showPanel('<div class="countdown">3</div>');
    this.sfx.countdown();
  }

  private pause(message: string, auto: boolean): void {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return;
    this.phase = 'paused';
    this.hud.setCue(null);
    this.hud.showPanel(`
      <h2>Paused</h2><p>${message}</p>
      <div class="buttons">
        ${auto ? '' : '<button data-action="resume">Resume</button>'}
        <button data-action="recal" class="secondary" ${this.opts.camera ? '' : 'hidden'}>Recalibrate</button>
        <button data-action="menu" class="secondary">Quit</button>
      </div>`, {
      resume: () => this.beginCountdown(true),
      recal: () => this.beginCalibration(),
      menu: () => this.opts.onExit(),
    });
    this.pausedAuto = auto;
  }
  private pausedAuto = false;

  private finish(): void {
    this.phase = 'finished';
    this.sfx.fanfare();
    this.hud.setCue(null);
    const total = this.stats.perfect + this.stats.good + this.stats.miss;
    const acc = total ? Math.round(((this.stats.perfect + this.stats.good) / total) * 100) : 0;
    this.hud.showPanel(`
      <h2>Warm-up complete!</h2>
      <div class="results">
        <div><span>Score</span><b>${Math.round(this.score).toLocaleString()}</b></div>
        <div><span>Accuracy</span><b>${acc}%</b></div>
        <div><span>Perfect</span><b>${this.stats.perfect}</b></div>
        <div><span>Good</span><b>${this.stats.good}</b></div>
        <div><span>Missed</span><b>${this.stats.miss}</b></div>
        <div><span>Best combo</span><b>${this.stats.bestCombo}</b></div>
      </div>
      <div class="buttons">
        <button data-action="again">Play again</button>
        <button data-action="menu" class="secondary">Menu</button>
      </div>`, {
      again: () => {
        this.resetRun();
        this.beginCountdown();
      },
      menu: () => this.opts.onExit(),
    });
  }

  // ---------------------------------------------------------------- loop

  private frame(timestamp: number): void {
    this.clock.update(timestamp);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.frameStats.tick(dt) && this.phase === 'playing') {
      const pr = this.resolution.update(this.frameStats.fps);
      if (pr !== null) {
        this.renderer.setPixelRatio(pr);
        this.onResize();
      }
    }
    const body = this.opts.body;
    body.update(dt);
    const s = body.state;

    switch (this.phase) {
      case 'calibrating':
        this.updateCalibration();
        break;
      case 'countdown':
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.phase = 'playing';
          this.hud.showPanel(null);
          this.sfx.countdown(true);
          if (!this.resumeAfterCountdown && this.time === 0) {
            const sec = this.course.sections[0];
            this.hud.showBanner(sec.title, sec.subtitle);
            this.sectionIdx = 1;
          }
        } else {
          const n = Math.ceil(this.countdown);
          const el = this.container.querySelector('.countdown');
          if (el && el.textContent !== String(n)) {
            el.textContent = String(n);
            this.sfx.countdown();
          }
        }
        break;
      case 'playing':
        this.updatePlaying(dt, s);
        break;
      case 'paused':
        if (this.pausedAuto && s.tracked) {
          this.foundFor += dt;
          if (this.foundFor > 0.8) this.beginCountdown(true);
        } else {
          this.foundFor = 0;
        }
        break;
    }

    // Visuals keep moving in every phase except pause, so the world feels alive.
    const moving = this.phase !== 'paused';
    const speed = speedAt(this.course.speed, this.time);
    if (moving && this.phase !== 'playing') this.scenery += speed * dt * 0.5;
    this.world.update(this.scenery + this.distance, moving ? dt : 0, this.avatar.root.position);
    this.obstacles.update(this.distance, moving ? dt : 0);
    this.coach.update(moving ? dt : 0, this.distance, speed, this.course.beats, this.judge.next);

    // Player avatar.
    this.avatarX += (s.lane * RUNNER.laneWidth - this.avatarX) * Math.min(1, dt * 16);
    this.avatar.root.position.x = this.avatarX;
    const lift = Math.min(1.3, s.jumpHeight * (this.opts.camera ? 3 : 1.6));
    this.avatar.update(s.skeleton, lift, dt);

    this.updateCamera(dt);
    this.updateOverlay(dt, s);
    this.renderer.render(this.scene, this.camera3d);
  }

  private updateCalibration(): void {
    const status = this.opts.camera!.analyzer.calibrationStatus;
    const fill = this.container.querySelector<HTMLElement>('.calib-bar .fill');
    if (fill) fill.style.width = `${Math.round(status.progress * 100)}%`;
    const hint = this.container.querySelector<HTMLElement>('.calib-hint');
    if (hint) {
      hint.textContent = !this.opts.body.state.tracked
        ? "Looking for you…"
        : status.hint ?? (status.phase === 'holding' ? 'Hold still…' : 'Stand still');
    }
    if (status.phase === 'done') this.beginCountdown();
  }

  private updatePlaying(dt: number, s: BodyState): void {
    // Auto-pause when the player walks out of view.
    if (this.opts.camera) {
      this.lostFor = s.tracked ? 0 : this.lostFor + dt;
      if (this.lostFor > RUNNER.lostPauseDelay) {
        this.pause("Can't see you — step back into the camera view.", true);
        return;
      }
    }

    this.time += dt;
    this.distance = distanceAt(this.course.speed, this.time);

    // Section banners.
    const sec = this.course.sections[this.sectionIdx];
    if (sec && this.time >= sec.time) {
      this.hud.showBanner(sec.title, sec.subtitle);
      this.sectionIdx++;
    }

    for (const { beat, verdict } of this.judge.update(this.time, s)) this.resolve(beat, verdict, s);

    // Running in place earns a trickle of points.
    this.energy += (s.activity - this.energy) * Math.min(1, dt * 3);
    this.score += RUNNER.score.runPerSecond * this.energy * dt;
    if (this.opts.camera) {
      this.lowEnergyFor = this.energy < 0.1 ? this.lowEnergyFor + dt : 0;
      if (this.lowEnergyFor > 6) {
        this.hud.popup('Keep running!', 'bonus');
        this.lowEnergyFor = 0;
      }
    }

    // Instruction for the next upcoming beat.
    const beats = this.course.beats;
    let cue: Beat | null = null;
    for (let i = this.judge.next; i < beats.length; i++) {
      const b = beats[i];
      if (b.time + 0.15 < this.time) continue;
      if (b.time - this.time <= RUNNER.cueLead) cue = b;
      break;
    }
    if (cue && cue.id !== this.lastCueId) {
      this.lastCueId = cue.id;
      this.sfx.cue();
    }
    this.hud.setCue(cue && { kind: cue.kind, lane: cue.lane, progress: 1 - (cue.time - this.time) / RUNNER.cueLead });

    if (this.time >= this.course.duration) this.finish();
  }

  private resolve(b: Beat, outcome: Verdict, s: BodyState): void {
    this.obstacles.resolve(b.id, outcome, s.lane);
    const sc = RUNNER.score;
    if (outcome === 'miss') {
      this.sfx.miss();
      this.stats.miss++;
      this.combo = 0;
      if (b.kind === 'reach') {
        this.hud.popup('Missed the stars', 'miss');
      } else {
        this.hud.popup('Oops!', 'miss');
        this.avatar.hit();
        this.shake = 1;
      }
      return;
    }
    this.combo++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const mult = this.multiplier();
    const points = (outcome === 'perfect' ? sc.perfect : sc.good) * mult;
    this.score += points;
    this.stats[outcome]++;
    if (outcome === 'perfect') this.sfx.perfect();
    else this.sfx.good();
    this.hud.popup(`${outcome === 'perfect' ? 'Perfect!' : 'Good'} +${points}`, outcome);
    if (this.combo % 5 === 0) this.coach.cheer();
  }

  private multiplier(): number {
    const sc = RUNNER.score;
    return Math.min(sc.maxMultiplier, 1 + Math.floor(this.combo / sc.comboStep));
  }

  private updateCamera(dt: number): void {
    const x = this.avatarX * 0.55;
    this.shake = Math.max(0, this.shake - dt * 3);
    const sh = this.shake * 0.15;
    this.camera3d.position.set(x + (Math.random() - 0.5) * sh, 3.1 + (Math.random() - 0.5) * sh, 5.6);
    this.camera3d.lookAt(this.avatarX * 0.3, 1.3, -9);
  }

  private updateOverlay(dt: number, s: BodyState): void {
    this.hud.update(dt, this.score, this.combo, this.multiplier(), this.time / this.course.duration);
    if (this.opts.camera) {
      // Redraw the skeleton overlay only when a new pose arrives.
      const frame = this.opts.camera.lastFrame;
      if (frame !== this.drawnPoseFrame) {
        this.drawnPoseFrame = frame;
        this.preview?.draw(frame, s.tracked ? '#4ef0a0' : '#ff5470');
      }
      this.hud.setEnergy(this.phase === 'playing' ? this.energy : null);
    }
    if (this.debug) {
      const lines = [
        `phase ${this.phase}  t=${this.time.toFixed(1)}  beat ${this.judge.next}/${this.course.beats.length}`,
        `tracked ${s.tracked}  lane ${s.lane}  lateral ${s.lateral.toFixed(2)}`,
        `jump ${s.jumping} (${s.jumpHeight.toFixed(2)}m)  duck ${s.ducking} (${s.duckDepth.toFixed(2)})  hands ${s.handsUp}`,
        `activity ${s.activity.toFixed(2)}`,
        `render ${this.frameStats.fps.toFixed(0)} fps  worst ${this.frameStats.worstMs.toFixed(0)} ms  px ${this.resolution.pixelRatio}`,
      ];
      if (this.opts.camera) {
        const a = this.opts.camera.analyzer;
        const tr = this.opts.camera.tracker;
        lines.push(`pose ${tr.fps.toFixed(0)} fps  infer ${tr.inferenceMs.toFixed(0)} ms  ${tr.backend}`);
        for (const [k, v] of Object.entries(a.debug)) lines.push(`${k} ${v.toFixed(3)}`);
      }
      this.hud.debug.textContent = lines.join('\n');
    }
  }

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera3d.aspect = w / h;
    // Keep the three lanes in view on portrait screens.
    this.camera3d.fov = w / h < 1 ? 80 : 62;
    this.camera3d.updateProjectionMatrix();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Backquote') {
      this.debug = !this.debug;
      this.hud.debug.hidden = !this.debug;
    }
    if (e.code === 'KeyM') this.sfx.muted = !this.sfx.muted;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') this.pause('Take a breather.', false);
      else if (this.phase === 'paused' && !this.pausedAuto) this.beginCountdown(true);
    }
  };
}
