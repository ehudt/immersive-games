/**
 * Confetti, sparkles and fireworks on a 2D canvas overlay. The animation
 * loop only runs while there are particles.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
  shape: 'rect' | 'star' | 'dot';
  gravity: number;
  drag: number;
}

const COLORS = ['#ff5d8f', '#ffb627', '#2ec4d6', '#7bd35a', '#a374ff', '#ff8a3d', '#ffffff', '#ffe066'];

export class Confetti {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;
  private timers: number[] = [];
  private dpr = Math.min(2, window.devicePixelRatio || 1);

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-canvas';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Small sparkle puff (each counted number). */
  sparkle(x: number, y: number, n = 14): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 220;
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, maxLife: 0.6 + Math.random() * 0.4, size: 4 + Math.random() * 5, shape: Math.random() < 0.5 ? 'star' : 'dot', gravity: 120, drag: 2.5 });
    }
  }

  /** Confetti cannons from both bottom corners. */
  burst(n = 90): void {
    const w = innerWidth;
    const h = innerHeight;
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const a = (left ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.7;
      const v = h * (0.9 + Math.random() * 0.8);
      this.add({ x: left ? 0 : w, y: h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, maxLife: 2.6 + Math.random(), size: 7 + Math.random() * 7, shape: 'rect', gravity: 520, drag: 1.4 });
    }
  }

  /** Confetti falling from the top for a while. */
  rain(seconds: number): void {
    const count = Math.floor(seconds * 12);
    for (let i = 0; i < count; i++) {
      this.later(i * (seconds / count) * 1000, () => {
        for (let k = 0; k < 4; k++)
          this.add({ x: Math.random() * innerWidth, y: -20, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 80, maxLife: 6, size: 7 + Math.random() * 6, shape: Math.random() < 0.8 ? 'rect' : 'star', gravity: 40, drag: 0.6 });
      });
    }
  }

  /** A few fireworks bursting over the sky. */
  fireworks(count: number): void {
    for (let i = 0; i < count; i++) {
      this.later(i * 380 + Math.random() * 200, () => {
        const x = innerWidth * (0.15 + Math.random() * 0.7);
        const y = innerHeight * (0.12 + Math.random() * 0.35);
        const color = COLORS[Math.floor(Math.random() * (COLORS.length - 1))];
        for (let k = 0; k < 46; k++) {
          const a = (k / 46) * Math.PI * 2;
          const v = 160 + Math.random() * 90;
          this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, maxLife: 1.2 + Math.random() * 0.5, size: 3.5 + Math.random() * 2.5, color, shape: 'dot', gravity: 90, drag: 1.6 });
        }
      });
    }
  }

  clear(): void {
    this.parts = [];
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  dispose(): void {
    this.clear();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private add(p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'vx' | 'vy' | 'maxLife' | 'size' | 'shape' | 'gravity' | 'drag'>): void {
    this.parts.push({
      life: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: (Math.random() - 0.5) * 12,
      angle: Math.random() * Math.PI,
      ...p,
    });
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private resize = () => {
    this.canvas.width = Math.round(innerWidth * this.dpr);
    this.canvas.height = Math.round(innerHeight * this.dpr);
  };

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    this.parts = this.parts.filter((p) => (p.life += dt) < p.maxLife && p.y < innerHeight + 40);
    for (const p of this.parts) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      ctx.globalAlpha = Math.min(1, 2.5 * (1 - p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.sin(p.angle * 2)) * p.size * 0.4);
      } else if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        star(ctx, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // add() restarts the loop when new particles come.
    this.raf = this.parts.length ? requestAnimationFrame(this.frame) : 0;
  };
}

function star(ctx: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
