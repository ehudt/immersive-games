/**
 * The sky the rocket climbs through. Every counted number lifts it one step:
 * past the launch pad and hills, meeting a new friend every ten numbers (a
 * balloon, a kite, a bird… a dragon), and from 150 the sky darkens into space
 * (a shuttle, the moon, Saturn… the sun at 300).
 *
 * Plain DOM + inline SVG (procedural, no asset files). The world is one layer
 * translated down as the rocket climbs; decorations are generated lazily a
 * little above the current height. What goes where is in scenery.ts.
 */
import { decorations, skyColors, starsOpacity } from './scenery.ts';
import { COLORS, FLAME, GROUND, ROCKET, STAR_PATH, artSvg } from './skyArt.ts';

/** Pixels of climb per counted number. */
const STEP = 64;
/** Where the rocket sits, as a share of the viewport height from the bottom. */
const ROCKET_VH = 24;

export class Sky {
  readonly el: HTMLElement;
  private world: HTMLElement;
  private rocket: HTMLElement;
  private stars: HTMLElement;
  private builtUpTo = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'sky';
    this.el.innerHTML = `
      <div class="sky-bg"></div>
      <div class="sky-stars"></div>
      <div class="sky-world"><div class="ground">${GROUND}</div></div>
      <div class="rocket"><div class="rocket-bob"><div class="rocket-kick"><div class="rocket-flame">${FLAME}</div>${ROCKET}</div></div></div>`;
    parent.appendChild(this.el);
    this.world = this.el.querySelector('.sky-world')!;
    this.rocket = this.el.querySelector('.rocket')!;
    this.stars = this.el.querySelector('.sky-stars')!;
    this.el.style.setProperty('--step', `${STEP}px`);
    this.el.style.setProperty('--rocket-vh', `${ROCKET_VH}vh`);
    this.setAltitude(0);
  }

  /** Climb to (or come back down to) the given count. */
  setAltitude(count: number): void {
    this.world.style.transform = `translateY(${count * STEP}px)`;
    const [top, bottom] = skyColors(count);
    this.el.style.setProperty('--sky-top', top);
    this.el.style.setProperty('--sky-bottom', bottom);
    this.stars.style.opacity = String(starsOpacity(count));
    this.build(count + 24);
  }

  /** A star with the number, left behind at the height where it was said. */
  addNumber(n: number): void {
    const star = document.createElement('div');
    star.className = 'num-star';
    const side = n % 2 ? 1 : -1;
    star.style.bottom = `calc(var(--rocket-vh) + ${n * STEP + 40}px)`;
    star.style.left = `calc(50% + ${side * (88 + (n % 3) * 14)}px)`;
    star.style.setProperty('--c', COLORS[n % COLORS.length]);
    star.style.setProperty('--tilt', `${side * (6 + (n % 4) * 3)}deg`);
    if (n >= 100) star.classList.add('long');
    star.innerHTML = `<svg viewBox="0 0 100 96" aria-hidden="true"><path d="${STAR_PATH}"/></svg><span>${n}</span>`;
    this.world.appendChild(star);
  }

  /** 0..1: the flame shrinks as the time to say the next number runs out. */
  setFuel(f: number): void {
    this.rocket.style.setProperty('--fuel', String(0.3 + 0.7 * Math.max(0, Math.min(1, f))));
  }

  boost(): void {
    this.rocket.classList.remove('boost');
    void this.rocket.offsetWidth;
    this.rocket.classList.add('boost');
  }

  setFlying(on: boolean): void {
    this.rocket.classList.toggle('flying', on);
  }

  celebrate(on: boolean): void {
    this.rocket.classList.toggle('party', on);
  }

  /** The rocket's position on screen (for particle bursts). */
  rocketPoint(): { x: number; y: number } {
    const r = this.rocket.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
  }

  /** Back to the launch pad: clears the number stars. */
  reset(): void {
    this.world.querySelectorAll('.num-star').forEach((s) => s.remove());
    this.el.classList.add('landing');
    this.setAltitude(0);
    window.setTimeout(() => this.el.classList.remove('landing'), 1300);
  }

  private build(upTo: number): void {
    for (let n = this.builtUpTo + 1; n <= upTo; n++) this.decorate(n);
    this.builtUpTo = Math.max(this.builtUpTo, upTo);
  }

  /** Scenery for the band of sky at count n. */
  private decorate(n: number): void {
    for (const p of decorations(n)) {
      const d = document.createElement('div');
      d.className = p.width ? 'deco friend' : 'deco';
      d.innerHTML = artSvg(p.art, p.size);
      if (p.width) d.querySelector('svg')!.style.width = `${p.width}px`;
      d.style.left = `${p.left}%`;
      d.style.bottom = `calc(var(--rocket-vh) + ${p.height * STEP}px)`;
      d.style.setProperty('--drift', `${p.drift}px`);
      d.style.setProperty('--dur', `${p.duration}s`);
      this.world.appendChild(d);
    }
  }
}
