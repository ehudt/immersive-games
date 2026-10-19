import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Lane } from '../../core/input/BodyState';
import { RUNNER } from './config';
import type { Beat } from './Course';
import { glowTexture } from './fx';

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
    this.assets.update(dt);
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

/** Glow colors per move — matched by the HUD cue colors. */
export const MOVE_COLORS = {
  jump: '#ff4632',
  duck: '#ffb21f',
  block: '#b98cff',
  safe: '#3ff0b4',
  reach: '#ffd84a',
} as const;

/**
 * Shared geometries/materials and per-kind builders. The visual language:
 * weathered stone posts carry glowing barriers — a low coral bar to jump, a
 * high amber beam to duck under — violet crystals block lanes, a mint arrow
 * marks the safe lane, and golden stars hang up high. Each also casts a soft
 * glow on the path, so it reads from far away and in any light.
 */
class ObstacleAssets {
  private box = new THREE.BoxGeometry(1, 1, 1);
  private pillar = new THREE.CylinderGeometry(0.11, 0.14, 1, 6).translate(0, 0.5, 0);
  private orb = new THREE.IcosahedronGeometry(0.11, 1);
  private quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private crystals = crystalCluster();
  private star: THREE.ExtrudeGeometry;
  private arrow: THREE.ShapeGeometry;
  private glow = glowTexture();
  private mats = {
    stone: new THREE.MeshStandardMaterial({ color: '#6a6596', roughness: 0.85 }),
    hurdle: glowingStripes(MOVE_COLORS.jump, '#ffe6cc', 0.35),
    beam: glowingStripes(MOVE_COLORS.duck, '#2a2350', 0.5),
    orbJump: new THREE.MeshBasicMaterial({ color: hdr(MOVE_COLORS.jump, 2) }),
    orbDuck: new THREE.MeshBasicMaterial({ color: hdr(MOVE_COLORS.duck, 2) }),
    crystal: new THREE.MeshStandardMaterial({
      color: '#c9a8ff',
      emissive: '#7a3cff',
      emissiveIntensity: 0.9,
      roughness: 0.25,
      flatShading: true,
    }),
    star: new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb300', emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.3 }),
    arrow: new THREE.MeshBasicMaterial({ color: hdr(MOVE_COLORS.safe, 1.1), transparent: true, opacity: 0.9, depthWrite: false }),
    glowJump: groundGlow(this.glow, MOVE_COLORS.jump),
    glowDuck: groundGlow(this.glow, MOVE_COLORS.duck),
    glowBlock: groundGlow(this.glow, MOVE_COLORS.block),
    glowSafe: groundGlow(this.glow, MOVE_COLORS.safe),
    halo: new THREE.SpriteMaterial({
      map: this.glow,
      color: hdr(MOVE_COLORS.reach, 1.2),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
  private time = 0;

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

  /** Shared animation: pulsing safe-lane arrows. */
  update(dt: number): void {
    this.time += dt;
    this.mats.arrow.opacity = 0.88 + 0.12 * Math.sin(this.time * 7);
  }

  build(beat: Beat): { obj: THREE.Group; parts: THREE.Object3D[] } {
    const g = new THREE.Group();
    const parts: THREE.Object3D[] = [];
    const half = RUNNER.trackWidth / 2;
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      return m;
    };
    const glowOnGround = (mat: THREE.Material, x: number, w: number, d: number) => {
      const m = mesh(this.quad, mat, false);
      m.scale.set(w, 1, d);
      m.position.set(x, 0.04, 0);
      m.renderOrder = 1;
      g.add(m);
    };
    const posts = (height: number, orbMat: THREE.Material) => {
      for (const side of [-1, 1]) {
        const p = mesh(this.pillar, this.mats.stone);
        p.scale.set(1, height, 1);
        p.position.set(side * (half - 0.1), 0, 0);
        const orb = mesh(this.orb, orbMat, false);
        orb.position.set(side * (half - 0.1), height + 0.1, 0);
        g.add(p, orb);
      }
    };

    switch (beat.kind) {
      case 'jump': {
        posts(0.75, this.mats.orbJump);
        const bar = mesh(this.box, this.mats.hurdle);
        bar.scale.set(RUNNER.trackWidth, 0.22, 0.12);
        bar.position.y = 0.55;
        g.add(bar);
        parts.push(bar);
        glowOnGround(this.mats.glowJump, 0, RUNNER.trackWidth + 1.5, 2.2);
        break;
      }
      case 'duck': {
        posts(1.85, this.mats.orbDuck);
        const beam = mesh(this.box, this.mats.beam);
        beam.scale.set(RUNNER.trackWidth, 0.4, 0.3);
        beam.position.y = 1.5;
        g.add(beam);
        parts.push(beam);
        glowOnGround(this.mats.glowDuck, 0, RUNNER.trackWidth + 1.5, 2.2);
        break;
      }
      case 'lane': {
        for (const lane of [-1, 0, 1] as Lane[]) {
          const x = lane * RUNNER.laneWidth;
          if (lane === beat.lane) {
            // Guide arrow on the ground in the safe lane.
            const arrow = mesh(this.arrow, this.mats.arrow, false);
            arrow.rotation.x = -Math.PI / 2;
            arrow.scale.setScalar(1.15);
            arrow.position.set(x, 0.05, 2.5);
            arrow.renderOrder = 2;
            g.add(arrow);
            const glow = mesh(this.quad, this.mats.glowSafe, false);
            glow.scale.set(1.8, 1, 3.2);
            glow.position.set(x, 0.04, 2.3);
            glow.renderOrder = 1;
            g.add(glow);
            continue;
          }
          const stack = new THREE.Group();
          stack.userData.lane = lane;
          stack.add(mesh(this.crystals, this.mats.crystal));
          stack.rotation.y = lane * 0.7 + beat.id;
          stack.position.x = x;
          g.add(stack);
          parts.push(stack);
          glowOnGround(this.mats.glowBlock, x, 2.2, 2.2);
        }
        break;
      }
      case 'reach': {
        for (const lane of [-1, 0, 1]) {
          const s = mesh(this.star, this.mats.star);
          s.position.set(lane * RUNNER.laneWidth, 2.35, 0);
          s.scale.setScalar(1.1);
          const halo = new THREE.Sprite(this.mats.halo);
          halo.scale.setScalar(1.6);
          s.add(halo);
          g.add(s);
          parts.push(s);
        }
        break;
      }
    }
    return { obj: g, parts };
  }

  dispose(): void {
    for (const geo of [this.box, this.pillar, this.orb, this.quad, this.crystals, this.star, this.arrow]) geo.dispose();
    this.glow.dispose();
    for (const m of Object.values(this.mats)) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  }
}

function hdr(color: string, k: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(k);
}

/** A striped bar that glows with its own stripes, so it stays bright at night. */
function glowingStripes(a: string, b: string, glow: number): THREE.MeshStandardMaterial {
  const map = stripes(a, b);
  return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: glow, roughness: 0.5 });
}

/** Soft additive light pooled on the path under an obstacle. */
function groundGlow(map: THREE.Texture, color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color: hdr(color, 0.9),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** A cluster of tall crystals (one merged geometry), about 1.4 m wide and 2 m tall. */
function crystalCluster(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spec = [
    [0, 0, 0.36, 1.05, 0, 0],
    [-0.38, 0.1, 0.26, 0.75, 0.35, 0.1],
    [0.4, -0.05, 0.28, 0.8, -0.4, -0.05],
    [0.1, 0.35, 0.22, 0.6, 0.15, 0.4],
    [-0.15, -0.35, 0.22, 0.55, -0.1, -0.45],
  ];
  for (const [x, z, r, h, tz, tx] of spec) {
    parts.push(
      new THREE.OctahedronGeometry(1, 0)
        .scale(r, h, r)
        .rotateZ(tz)
        .rotateX(tx)
        .translate(x, h * 0.8, z),
    );
  }
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return geo;
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
