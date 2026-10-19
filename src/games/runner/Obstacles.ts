import * as THREE from 'three';
import type { Lane } from '../../core/input/BodyState';
import { RUNNER } from './config';
import type { Beat } from './Course';

export type Outcome = 'pending' | 'perfect' | 'good' | 'miss';

interface Live {
  beat: Beat;
  obj: THREE.Group;
  outcome: Outcome;
  /** Seconds since resolved, for the reaction animation. */
  age: number;
  /** Parts animated on resolve (stars, crates…). */
  parts: THREE.Object3D[];
}

/**
 * Creates, scrolls and animates the obstacle for every beat of the course.
 * Obstacles are positioned purely from the travelled distance, so they always
 * reach the player exactly on the beat.
 */
export class Obstacles {
  readonly root = new THREE.Group();
  private live = new Map<number, Live>();
  private next = 0;
  private assets = new ObstacleAssets();

  constructor(private beats: Beat[]) {}

  update(distance: number, dt: number): void {
    // Spawn everything that came into view.
    while (this.next < this.beats.length && this.beats[this.next].distance - distance < RUNNER.viewAhead) {
      const beat = this.beats[this.next++];
      const { obj, parts } = this.assets.build(beat);
      this.root.add(obj);
      this.live.set(beat.id, { beat, obj, outcome: 'pending', age: 0, parts });
    }
    for (const [id, l] of this.live) {
      const z = distance - l.beat.distance;
      l.obj.position.z = z;
      if (l.outcome !== 'pending') {
        l.age += dt;
        this.animate(l, dt);
      }
      if (l.beat.kind === 'reach' && l.outcome === 'pending') {
        for (const p of l.parts) p.rotation.y += dt * 2.5;
      }
      if (z > 25) {
        this.root.remove(l.obj);
        this.live.delete(id);
      }
    }
  }

  resolve(beatId: number, outcome: Outcome, playerLane: Lane): void {
    const l = this.live.get(beatId);
    if (!l) return;
    l.outcome = outcome;
    l.age = 0;
    // Remember which part the player touched, for the animation.
    l.obj.userData.lane = playerLane;
  }

  private animate(l: Live, dt: number): void {
    const hit = l.outcome === 'miss';
    switch (l.beat.kind) {
      case 'reach':
        if (!hit) {
          for (const p of l.parts) {
            p.position.y += dt * 6;
            p.scale.multiplyScalar(1 + dt * 1.5);
            p.rotation.y += dt * 12;
          }
        }
        break;
      case 'jump':
      case 'duck':
        if (hit && l.age < 0.6) {
          // Knock the bar over.
          const bar = l.parts[0];
          bar.rotation.x = Math.max(bar.rotation.x - dt * 5, -1.2);
          bar.position.z = Math.min(bar.position.z + dt * 2, 0.6);
        }
        break;
      case 'lane':
        if (hit) {
          for (const p of l.parts) {
            if (p.userData.lane !== l.obj.userData.lane) continue;
            p.position.y += dt * 3;
            p.rotation.x -= dt * 4;
            p.position.z += dt * 5;
          }
        }
        break;
    }
  }

  dispose(): void {
    this.assets.dispose();
  }
}

/** Shared geometries/materials and per-kind builders. */
class ObstacleAssets {
  private box = new THREE.BoxGeometry(1, 1, 1);
  private cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  private star: THREE.ExtrudeGeometry;
  private arrow: THREE.ShapeGeometry;
  private mats = {
    post: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
    hurdle: new THREE.MeshStandardMaterial({ map: stripes('#ff3b3b', '#ffffff'), roughness: 0.5 }),
    beam: new THREE.MeshStandardMaterial({ map: stripes('#ffcc00', '#222222'), roughness: 0.5 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8 }),
    star: new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb300', emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 }),
    arrow: new THREE.MeshBasicMaterial({ color: '#4ef0a0', transparent: true, opacity: 0.85 }),
  };

  constructor() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.17 : 0.4;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    this.star = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    this.star.center();

    const a = new THREE.Shape();
    a.moveTo(0, 0.7);
    a.lineTo(0.5, 0.1);
    a.lineTo(0.18, 0.1);
    a.lineTo(0.18, -0.6);
    a.lineTo(-0.18, -0.6);
    a.lineTo(-0.18, 0.1);
    a.lineTo(-0.5, 0.1);
    a.closePath();
    this.arrow = new THREE.ShapeGeometry(a);
  }

  build(beat: Beat): { obj: THREE.Group; parts: THREE.Object3D[] } {
    const g = new THREE.Group();
    const parts: THREE.Object3D[] = [];
    const half = RUNNER.trackWidth / 2;
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const posts = (height: number) => {
      for (const side of [-1, 1]) {
        const p = mesh(this.cyl, this.mats.post);
        p.scale.set(0.16, height, 0.16);
        p.position.set(side * (half - 0.1), height / 2, 0);
        g.add(p);
      }
    };

    switch (beat.kind) {
      case 'jump': {
        posts(0.7);
        const bar = mesh(this.box, this.mats.hurdle);
        bar.scale.set(RUNNER.trackWidth, 0.22, 0.12);
        bar.position.y = 0.55;
        g.add(bar);
        parts.push(bar);
        break;
      }
      case 'duck': {
        posts(1.75);
        const beam = mesh(this.box, this.mats.beam);
        beam.scale.set(RUNNER.trackWidth, 0.4, 0.3);
        beam.position.y = 1.5;
        g.add(beam);
        parts.push(beam);
        break;
      }
      case 'lane': {
        for (const lane of [-1, 0, 1] as Lane[]) {
          if (lane === beat.lane) {
            // Guide arrow on the ground in the safe lane.
            const arrow = new THREE.Mesh(this.arrow, this.mats.arrow);
            arrow.rotation.x = -Math.PI / 2;
            arrow.position.set(lane * RUNNER.laneWidth, 0.03, 2.5);
            g.add(arrow);
            continue;
          }
          const stack = new THREE.Group();
          stack.userData.lane = lane;
          const c1 = mesh(this.box, this.mats.crate);
          c1.scale.set(1.3, 1.1, 1.1);
          c1.position.y = 0.55;
          const c2 = mesh(this.box, this.mats.crate);
          c2.scale.set(0.9, 0.8, 0.9);
          c2.position.set(0.1, 1.5, 0);
          c2.rotation.y = 0.3;
          stack.add(c1, c2);
          stack.position.x = lane * RUNNER.laneWidth;
          g.add(stack);
          parts.push(stack);
        }
        break;
      }
      case 'reach': {
        for (const lane of [-1, 0, 1]) {
          const s = mesh(this.star, this.mats.star);
          s.position.set(lane * RUNNER.laneWidth, 2.35, 0);
          s.scale.setScalar(1.1);
          g.add(s);
          parts.push(s);
        }
        break;
      }
    }
    return { obj: g, parts };
  }

  dispose(): void {
    this.box.dispose();
    this.cyl.dispose();
    this.star.dispose();
    this.arrow.dispose();
    for (const m of Object.values(this.mats)) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  }
}

function stripes(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.beginPath();
    g.moveTo(i * 16, 0);
    g.lineTo(i * 16 + 16, 0);
    g.lineTo(i * 16 + 32, 32);
    g.lineTo(i * 16 + 16, 32);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8873f';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8a5523';
  g.lineWidth = 12;
  g.strokeRect(6, 6, 116, 116);
  g.beginPath();
  g.moveTo(10, 10);
  g.lineTo(118, 118);
  g.moveTo(118, 10);
  g.lineTo(10, 118);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
