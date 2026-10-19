import { BONES, type PoseFrame } from '../pose/landmarks';

/**
 * Small mirrored webcam view with the detected skeleton drawn on top, so the
 * player can see that tracking works and where they stand in the frame.
 */
export class CameraPreview {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(video: HTMLVideoElement) {
    this.el = document.createElement('div');
    this.el.className = 'camera-preview';
    video.classList.add('camera-video');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'camera-overlay';
    this.el.append(video, this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(frame: PoseFrame | null, color = '#4ef0a0'): void {
    const { canvas, ctx } = this;
    const w = Math.round(this.el.clientWidth * devicePixelRatio);
    const h = Math.round(this.el.clientHeight * devicePixelRatio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    if (!frame) return;
    const lm = frame.image;
    // Mirror horizontally to match the mirrored video.
    const px = (i: number) => [(1 - lm[i].x) * w, lm[i].y * h] as const;
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (const [a, b] of BONES) {
      if (lm[a].visibility < 0.4 || lm[b].visibility < 0.4) continue;
      const [ax, ay] = px(a);
      const [bx, by] = px(b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    for (let i = 0; i < lm.length; i++) {
      if (lm[i].visibility < 0.4 || (i > 0 && i < 11)) continue;
      const [x, y] = px(i);
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
