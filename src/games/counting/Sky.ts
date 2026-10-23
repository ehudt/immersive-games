/**
 * The sky the rocket climbs through. Every counted number lifts it one step:
 * past the launch pad and hills, through clouds and balloons, a plane, the
 * sunset, then stars, the moon, Saturn and on into space.
 *
 * Plain DOM + inline SVG (procedural, no asset files). The world is one layer
 * translated down as the rocket climbs; decorations are generated lazily a
 * little above the current height.
 */

/** Pixels of climb per counted number. */
const STEP = 64;
/** Where the rocket sits, as a share of the viewport height from the bottom. */
const ROCKET_VH = 24;

export const COLORS = ['#ff5d8f', '#ffb627', '#2ec4d6', '#7bd35a', '#a374ff', '#ff8a3d'];

/** [count, top color, bottom color] — the sky darkens into space. */
const SKY: [number, string, string][] = [
  [0, '#4fc3ff', '#d6f3ff'],
  [25, '#2f9be8', '#bfe6ff'],
  [42, '#4a6fd8', '#ffc0cf'],
  [58, '#2b2f8f', '#a466c9'],
  [78, '#121845', '#3b2a78'],
  [100, '#060922', '#1a1450'],
];

export function rng(seed: number): () => number {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

export function skyColors(count: number): [string, string] {
  for (let i = 1; i < SKY.length; i++) {
    if (count <= SKY[i][0]) {
      const [c0, t0, b0] = SKY[i - 1];
      const [c1, t1, b1] = SKY[i];
      const t = (count - c0) / (c1 - c0);
      return [mix(t0, t1, t), mix(b0, b1, t)];
    }
  }
  const last = SKY[SKY.length - 1];
  return [last[1], last[2]];
}

// ----------------------------------------------------------------- drawings

const svg = (w: number, h: number, body: string, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;

export const ART = {
  cloud: (s: number) =>
    svg(
      120,
      60,
      `<g fill="#fff"><circle cx="35" cy="35" r="20"/><circle cx="60" cy="25" r="24"/><circle cx="85" cy="36" r="18"/><rect x="20" y="34" width="82" height="22" rx="11"/></g>
       <path d="M24 50 Q60 60 100 50" stroke="#d6ecff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      `deco-cloud s${s}`,
    ),
  bird: () =>
    svg(40, 20, `<path d="M2 12 Q10 2 20 12 Q30 2 38 12" stroke="#2a3550" stroke-width="3" fill="none" stroke-linecap="round"/>`, 'deco-bird'),
  balloon: (c: string) =>
    svg(
      40,
      90,
      `<path d="M20 52 Q16 70 22 88" stroke="#666" stroke-width="1.5" fill="none"/>
       <ellipse cx="20" cy="26" rx="17" ry="22" fill="${c}"/><path d="M17 48 L23 48 L20 53Z" fill="${c}"/>
       <ellipse cx="13" cy="17" rx="4" ry="7" fill="#fff" opacity=".45"/>`,
      'deco-balloon',
    ),
  hotAir: () =>
    svg(
      90,
      120,
      `<path d="M45 4 C10 4 4 40 20 62 L34 84 L56 84 L70 62 C86 40 80 4 45 4Z" fill="#ff5d8f"/>
       <path d="M45 4 C30 4 26 40 34 62 L40 84 L50 84 L56 62 C64 40 60 4 45 4Z" fill="#ffd23f"/>
       <path d="M45 4 C40 4 39 40 42 62 L44 84 L46 84 L48 62 C51 40 50 4 45 4Z" fill="#2ec4d6"/>
       <path d="M36 84 L38 98 M54 84 L52 98" stroke="#7a4b2a" stroke-width="2"/>
       <rect x="34" y="98" width="22" height="16" rx="3" fill="#a0632e"/>`,
      'deco-hotair',
    ),
  kite: () =>
    svg(
      70,
      110,
      `<path d="M35 2 L60 30 L35 70 L10 30Z" fill="#7bd35a"/><path d="M35 2 L35 70 M10 30 L60 30" stroke="#fff" stroke-width="2"/>
       <path d="M35 70 Q25 80 38 88 Q50 96 36 108" stroke="#ff8a3d" stroke-width="2.5" fill="none"/>
       <circle cx="30" cy="80" r="3" fill="#ff5d8f"/><circle cx="42" cy="92" r="3" fill="#ffb627"/>`,
      'deco-kite',
    ),
  plane: () =>
    svg(
      150,
      60,
      `<path d="M10 32 Q12 22 30 22 L118 22 Q140 24 144 32 Q140 40 118 42 L30 42 Q12 42 10 32Z" fill="#fff"/>
       <path d="M70 26 L48 2 L62 2 L92 26Z M72 38 L52 58 L66 58 L94 38Z" fill="#2ec4d6"/>
       <path d="M14 30 L6 8 L20 8 L32 24Z" fill="#ff5d8f"/>
       <g fill="#4a6fd8"><circle cx="100" cy="30" r="3.5"/><circle cx="88" cy="30" r="3.5"/><circle cx="76" cy="30" r="3.5"/><circle cx="64" cy="30" r="3.5"/></g>`,
      'deco-plane',
    ),
  satellite: () =>
    svg(
      120,
      60,
      `<rect x="2" y="18" width="38" height="24" fill="#3e64c8" stroke="#9fc1ff" stroke-width="2"/>
       <rect x="80" y="18" width="38" height="24" fill="#3e64c8" stroke="#9fc1ff" stroke-width="2"/>
       <path d="M40 30 H80" stroke="#ccc" stroke-width="3"/><rect x="48" y="14" width="24" height="32" rx="4" fill="#e8e8f0"/>
       <circle cx="60" cy="8" r="5" fill="#ffd23f"/><path d="M60 13 V14" stroke="#ccc" stroke-width="2"/>`,
      'deco-satellite',
    ),
  moon: () =>
    svg(
      140,
      140,
      `<circle cx="70" cy="70" r="62" fill="#fff3c4"/><circle cx="48" cy="52" r="11" fill="#f0dc9a"/>
       <circle cx="90" cy="88" r="15" fill="#f0dc9a"/><circle cx="92" cy="44" r="7" fill="#f0dc9a"/><circle cx="52" cy="96" r="6" fill="#f0dc9a"/>
       <path d="M52 74 Q70 88 88 72" stroke="#c9a65a" stroke-width="3" fill="none" stroke-linecap="round"/>
       <circle cx="56" cy="64" r="3" fill="#c9a65a"/><circle cx="84" cy="62" r="3" fill="#c9a65a"/>`,
      'deco-moon',
    ),
  ufo: () =>
    svg(
      110,
      60,
      `<ellipse cx="55" cy="26" rx="22" ry="18" fill="#bff6ff" opacity=".9"/><circle cx="55" cy="26" r="8" fill="#7bd35a"/>
       <circle cx="52" cy="24" r="1.6" fill="#123"/><circle cx="58" cy="24" r="1.6" fill="#123"/>
       <ellipse cx="55" cy="38" rx="52" ry="12" fill="#a374ff"/>
       <g fill="#ffd23f"><circle cx="22" cy="40" r="4"/><circle cx="42" cy="44" r="4"/><circle cx="68" cy="44" r="4"/><circle cx="88" cy="40" r="4"/></g>`,
      'deco-ufo',
    ),
  saturn: () =>
    svg(
      200,
      120,
      `<g transform="rotate(-12 100 62)"><ellipse cx="100" cy="62" rx="94" ry="20" fill="none" stroke="#e8c88a" stroke-width="8"/>
       <circle cx="100" cy="60" r="42" fill="#ffc46b"/><path d="M62 48 Q100 40 138 48 M60 68 Q100 60 140 68" stroke="#f09a4a" stroke-width="6" fill="none"/>
       <path d="M6 62 A94 20 0 0 0 194 62" fill="none" stroke="#ffe3a8" stroke-width="8"/></g>`,
      'deco-saturn',
    ),
  planet: (c: string) =>
    svg(
      90,
      90,
      `<circle cx="45" cy="45" r="40" fill="${c}"/><path d="M10 38 Q45 30 80 38 M8 54 Q45 62 82 54" stroke="#fff" stroke-width="5" opacity=".3" fill="none"/>
       <circle cx="32" cy="30" r="9" fill="#fff" opacity=".25"/>`,
      'deco-planet',
    ),
  comet: () =>
    svg(
      160,
      50,
      `<defs><linearGradient id="ct" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#bff6ff"/></linearGradient></defs>
       <path d="M0 18 L140 20 L140 30 L0 32Z" fill="url(#ct)"/><circle cx="140" cy="25" r="11" fill="#fff"/>`,
      'deco-comet',
    ),
  astronaut: () =>
    svg(
      90,
      110,
      `<rect x="24" y="44" width="42" height="44" rx="14" fill="#f4f6ff"/><rect x="30" y="54" width="18" height="12" rx="3" fill="#ff5d8f"/>
       <rect x="8" y="48" width="20" height="12" rx="6" fill="#f4f6ff" transform="rotate(-30 18 54)"/>
       <rect x="62" y="48" width="20" height="12" rx="6" fill="#f4f6ff" transform="rotate(30 72 54)"/>
       <rect x="28" y="84" width="14" height="22" rx="6" fill="#f4f6ff"/><rect x="48" y="84" width="14" height="22" rx="6" fill="#f4f6ff"/>
       <circle cx="45" cy="28" r="24" fill="#f4f6ff"/><circle cx="45" cy="28" r="17" fill="#2b3a7a"/>
       <circle cx="39" cy="22" r="5" fill="#fff" opacity=".6"/>`,
      'deco-astronaut',
    ),
  galaxy: () =>
    svg(
      160,
      120,
      `<defs><radialGradient id="gx"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffb3f0"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient></defs>
       <ellipse cx="80" cy="60" rx="76" ry="34" fill="url(#gx)" transform="rotate(-20 80 60)"/>`,
      'deco-galaxy',
    ),
};

export const STAR_PATH =
  'M50 4 L62 36 L96 37 L69 58 L79 92 L50 72 L21 92 L31 58 L4 37 L38 36Z';

export const ROCKET = svg(
  120,
  200,
  `<path d="M60 6 C88 30 96 74 92 128 L28 128 C24 74 32 30 60 6Z" fill="#fdfdff"/>
   <path d="M60 6 C72 16 80 28 85 42 L35 42 C40 28 48 16 60 6Z" fill="#ff4d6d"/>
   <path d="M28 98 L6 146 L8 156 L32 132Z M92 98 L114 146 L112 156 L88 132Z" fill="#ff4d6d"/>
   <path d="M52 124 L68 124 L66 160 L54 160Z" fill="#ff4d6d"/>
   <rect x="34" y="128" width="52" height="12" rx="5" fill="#7a86b8"/>
   <path d="M86 46 C90 70 91 98 90 124" stroke="#d8def2" stroke-width="5" fill="none" stroke-linecap="round"/>
   <circle cx="60" cy="76" r="22" fill="#5fc3ff" stroke="#7a86b8" stroke-width="6"/>
   <g class="rocket-face">
     <circle cx="60" cy="80" r="13" fill="#ffd9b0"/>
     <path d="M47 76 Q50 62 60 64 Q70 62 73 76 Q67 70 60 71 Q53 70 47 76Z" fill="#6b3d1f"/>
     <circle cx="55" cy="80" r="2" fill="#2a1a12"/><circle cx="65" cy="80" r="2" fill="#2a1a12"/>
     <path d="M54 85 Q60 90 66 85" stroke="#2a1a12" stroke-width="2" fill="none" stroke-linecap="round"/>
     <circle cx="51" cy="85" r="2.4" fill="#ff8fa3" opacity=".7"/><circle cx="69" cy="85" r="2.4" fill="#ff8fa3" opacity=".7"/>
   </g>
   <ellipse cx="52" cy="68" rx="5" ry="8" fill="#fff" opacity=".5" transform="rotate(30 52 68)"/>`,
  'rocket-body',
);

export const FLAME = svg(
  60,
  90,
  `<path d="M30 0 C46 18 52 40 30 88 C8 40 14 18 30 0Z" fill="#ffb627"/>
   <path d="M30 6 C40 22 42 40 30 70 C18 40 20 22 30 6Z" fill="#fff1a8"/>`,
  'flame',
);

export const GROUND = `
  <svg class="ground-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 70 Q150 20 320 55 T640 45 T960 30 T1200 60 V300 H0Z" fill="#a3e07f"/>
    <path d="M0 84 Q300 68 600 80 T1200 78 V300 H0Z" fill="#5fc24a"/>
    <path d="M0 150 Q300 130 600 145 T1200 140 V300 H0Z" fill="#52b13f"/>
  </svg>
  <div class="ground-props">
    ${svg(70, 90, `<rect x="31" y="56" width="8" height="32" fill="#8a5a2b"/><circle cx="35" cy="40" r="26" fill="#3fa83a"/><circle cx="24" cy="30" r="9" fill="#5fc24a"/>`, 'tree t1')}
    ${svg(70, 90, `<rect x="31" y="56" width="8" height="32" fill="#8a5a2b"/><circle cx="35" cy="40" r="26" fill="#34a050"/><circle cx="46" cy="32" r="8" fill="#5fc24a"/>`, 'tree t2')}
    ${svg(110, 100, `<rect x="14" y="44" width="82" height="54" fill="#fff4dd"/><path d="M4 48 L55 6 L106 48Z" fill="#ff6b5a"/><rect x="44" y="64" width="20" height="34" rx="3" fill="#a0632e"/><rect x="22" y="58" width="16" height="16" fill="#8fd6ff" stroke="#fff" stroke-width="3"/><rect x="72" y="58" width="16" height="16" fill="#8fd6ff" stroke="#fff" stroke-width="3"/>`, 'house')}
    ${svg(40, 40, `<circle cx="20" cy="14" r="6" fill="#ffd23f"/><g fill="#fff"><circle cx="20" cy="5" r="5"/><circle cx="29" cy="14" r="5"/><circle cx="20" cy="23" r="5"/><circle cx="11" cy="14" r="5"/></g><circle cx="20" cy="14" r="4" fill="#ffb627"/><path d="M20 28 V40" stroke="#3fa83a" stroke-width="3"/>`, 'flower f1')}
    ${svg(40, 40, `<g fill="#ff8fc7"><circle cx="20" cy="5" r="5"/><circle cx="29" cy="14" r="5"/><circle cx="20" cy="23" r="5"/><circle cx="11" cy="14" r="5"/></g><circle cx="20" cy="14" r="4" fill="#ffd23f"/><path d="M20 28 V40" stroke="#3fa83a" stroke-width="3"/>`, 'flower f2')}
    ${svg(160, 40, `<rect x="0" y="20" width="160" height="20" rx="6" fill="#7a86b8"/><rect x="10" y="10" width="140" height="14" rx="5" fill="#a9b3d9"/><path d="M20 24 L20 40 M140 24 L140 40" stroke="#5a6596" stroke-width="5"/>`, 'pad')}
  </div>`;

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
    this.stars.style.opacity = String(Math.min(1, Math.max(0, (count - 40) / 35)));
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
    const r = rng(n);
    const fixed: Record<number, string> = {
      6: ART.kite(),
      17: ART.hotAir(),
      33: ART.plane(),
      64: ART.satellite(),
      76: ART.moon(),
      88: ART.ufo(),
      100: ART.saturn(),
      124: ART.astronaut(),
      150: ART.galaxy(),
    };
    const pieces: string[] = [];
    if (fixed[n]) pieces.push(fixed[n]);
    else if (n >= 2 && n <= 50 && r() < 0.6) pieces.push(ART.cloud(1 + Math.floor(r() * 3)));
    else if (n >= 3 && n <= 26 && r() < 0.35) pieces.push(r() < 0.5 ? ART.bird() : ART.balloon(COLORS[Math.floor(r() * COLORS.length)]));
    else if (n > 60 && r() < 0.12) pieces.push(ART.comet());
    else if (n > 104 && r() < 0.3) pieces.push(ART.planet(COLORS[Math.floor(r() * COLORS.length)]));
    for (const html of pieces) {
      const d = document.createElement('div');
      d.className = 'deco';
      d.innerHTML = html;
      // Keep the middle (the rocket's path and number stars) mostly clear.
      const left = r() < 0.5 ? 2 + r() * 22 : 70 + r() * 22;
      d.style.left = `${left}%`;
      d.style.bottom = `calc(var(--rocket-vh) + ${n * STEP + r() * STEP}px)`;
      d.style.setProperty('--drift', `${(r() * 2 - 1) * 30}px`);
      d.style.setProperty('--dur', `${6 + r() * 6}s`);
      this.world.appendChild(d);
    }
  }
}
