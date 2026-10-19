import type { Lane } from '../../core/input/BodyState';
import type { ActionKind } from './Course';

export interface CueInfo {
  kind: ActionKind;
  lane: Lane;
  /** 0 → just appeared, 1 → now. */
  progress: number;
}

const CUES: Record<ActionKind, { icon: string; text: string }> = {
  jump: { icon: '⤒', text: 'JUMP!' },
  duck: { icon: '⤓', text: 'DUCK!' },
  reach: { icon: '🙌', text: 'REACH UP!' },
  lane: { icon: '', text: '' },
};

function laneCue(lane: Lane): { icon: string; text: string } {
  if (lane < 0) return { icon: '⬅', text: 'STEP LEFT' };
  if (lane > 0) return { icon: '➡', text: 'STEP RIGHT' };
  return { icon: '⬌', text: 'CENTER' };
}

/** DOM overlay: score, instructions, banners, popups and menus on top of the 3D view. */
export class Hud {
  readonly el: HTMLDivElement;
  private score: HTMLElement;
  private combo: HTMLElement;
  private progress: HTMLElement;
  private banner: HTMLElement;
  private cue: HTMLElement;
  private cueIcon: HTMLElement;
  private cueText: HTMLElement;
  private cueRing: HTMLElement;
  private popups: HTMLElement;
  private energy: HTMLElement;
  private energyFill: HTMLElement;
  private panel: HTMLElement;
  readonly debug: HTMLElement;
  readonly cameraSlot: HTMLElement;
  private bannerTimer = 0;
  private shownScore = 0;
  private lastCueKey = '';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-score"><div class="label">SCORE</div><div class="value">0</div><div class="combo"></div></div>
      <div class="hud-progress"><div class="fill"></div></div>
      <div class="hud-banner"><div class="title"></div><div class="subtitle"></div></div>
      <div class="hud-cue"><div class="ring"></div><div class="icon"></div><div class="text"></div></div>
      <div class="hud-popups"></div>
      <div class="hud-energy" hidden><div class="fill"></div><div class="label">RUN</div></div>
      <div class="hud-camera"></div>
      <pre class="hud-debug" hidden></pre>
      <div class="hud-panel" hidden></div>
    `;
    parent.append(this.el);
    const q = (s: string) => this.el.querySelector(s) as HTMLElement;
    this.score = q('.hud-score .value');
    this.combo = q('.hud-score .combo');
    this.progress = q('.hud-progress .fill');
    this.banner = q('.hud-banner');
    this.cue = q('.hud-cue');
    this.cueIcon = q('.hud-cue .icon');
    this.cueText = q('.hud-cue .text');
    this.cueRing = q('.hud-cue .ring');
    this.popups = q('.hud-popups');
    this.energy = q('.hud-energy');
    this.energyFill = q('.hud-energy .fill');
    this.panel = q('.hud-panel');
    this.debug = q('.hud-debug');
    this.cameraSlot = q('.hud-camera');
  }

  update(dt: number, score: number, combo: number, multiplier: number, progress: number): void {
    // Count the score up smoothly.
    this.shownScore += (score - this.shownScore) * Math.min(1, dt * 8);
    if (Math.abs(score - this.shownScore) < 1) this.shownScore = score;
    this.score.textContent = Math.round(this.shownScore).toLocaleString();
    this.combo.textContent = combo >= 3 ? `${combo} combo · x${multiplier}` : '';
    this.progress.style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }

  showBanner(title: string, subtitle: string, seconds = 3): void {
    (this.banner.querySelector('.title') as HTMLElement).textContent = title;
    (this.banner.querySelector('.subtitle') as HTMLElement).textContent = subtitle;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the CSS animation
    this.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  setCue(cue: CueInfo | null): void {
    if (!cue) {
      this.cue.classList.remove('show', 'now');
      this.lastCueKey = '';
      return;
    }
    const { icon, text } = cue.kind === 'lane' ? laneCue(cue.lane) : CUES[cue.kind];
    const key = `${cue.kind}${cue.lane}${text}`;
    if (key !== this.lastCueKey) {
      this.lastCueKey = key;
      this.cueIcon.textContent = icon;
      this.cueText.textContent = text;
      this.cue.dataset.kind = cue.kind;
      this.cue.classList.remove('show');
      void this.cue.offsetWidth;
    }
    this.cue.classList.add('show');
    this.cue.classList.toggle('now', cue.progress > 0.82);
    this.cueRing.style.setProperty('--p', `${Math.min(1, cue.progress) * 360}deg`);
  }

  popup(text: string, kind: 'perfect' | 'good' | 'miss' | 'bonus'): void {
    const p = document.createElement('div');
    p.className = `popup ${kind}`;
    p.textContent = text;
    this.popups.append(p);
    setTimeout(() => p.remove(), 1100);
  }

  setEnergy(value: number | null): void {
    this.energy.hidden = value === null;
    if (value !== null) {
      this.energyFill.style.height = `${Math.round(value * 100)}%`;
      this.energy.classList.toggle('low', value < 0.15);
    }
  }

  /** Shows a centered panel; pass null to hide. Buttons get click handlers. */
  showPanel(html: string | null, actions: Record<string, () => void> = {}): void {
    if (html === null) {
      this.panel.hidden = true;
      this.panel.innerHTML = '';
      return;
    }
    this.panel.hidden = false;
    this.panel.innerHTML = html;
    for (const [action, fn] of Object.entries(actions)) {
      this.panel.querySelector<HTMLElement>(`[data-action="${action}"]`)?.addEventListener('click', fn);
    }
  }

  get panelVisible(): boolean {
    return !this.panel.hidden;
  }

  dispose(): void {
    this.el.remove();
  }
}
