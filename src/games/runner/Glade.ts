import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RUNNER } from './config';
import { mulberry32 } from './Course';
import { GlowCloud, LOOP, scrollInstances, scrollUniforms, type GlowPoint } from './fx';
import type { Scenery, SceneryLook } from './World';

/**
 * "Moonlit Glade": a twilight path of pale flagstones through a blue-green
 * forest. Signature elements: a huge low moon over layered ridges with a
 * faint aurora, ancient stone arches with glowing runes spanning the path,
 * and fireflies, glowing mushrooms and lanterns along the way.
 *
 * Performance: every looping prop is an InstancedMesh that scrolls on the
 * GPU (one uniform per frame), all glows share one Points draw call, only the
 * moonlight casts shadows, and nothing here casts them.
 */
export const GLADE = {
  zenith: '#0d0b2b',
  sky: '#2c2468',
  horizon: '#d49cb8',
  fog: '#6f5fa6',
  glow: '#ffb48a',
  moon: '#fff2da',
  grass: '#2e6461',
  stone: '#a9a3cc',
  rune: '#62f5d0',
  firefly: '#ffd27a',
  lantern: '#ffbe5c',
  mushrooms: ['#5ff2ff', '#ff7ad9', '#9d8cff'],
  flowers: ['#ffd27a', '#ff8fd0', '#7ff7e2', '#c3a8ff'],
} as const;

/** Moon direction: low over the horizon, a little left of the path. */
const MOON_DIR = new THREE.Vector3(Math.sin(-0.3), Math.sin(0.125), -Math.cos(-0.3)).normalize();

export class MoonlitGlade implements Scenery {
  readonly root = new THREE.Group();
  readonly horizon = new THREE.Color(GLADE.fog);
  readonly look: SceneryLook = {
    fog: { near: 28, far: 175 },
    exposure: 1.05,
    rim: '#ffcfb0',
    rimStrength: 0.9,
    bloom: { strength: 0.55, radius: 0.4, threshold: 1.0 },
    stageClass: 'theme-glade',
  };
  readonly sun: THREE.DirectionalLight;
  private u = scrollUniforms();
  private skyMat: THREE.ShaderMaterial;
  private trackTex: THREE.CanvasTexture;
  private trackGlow: THREE.CanvasTexture;
  private grassTex: THREE.CanvasTexture;
  private glows: GlowCloud;
  private fireflies: GlowCloud;
  private mist: THREE.Object3D[] = [];
  private disposables: { dispose(): void }[] = [];
  private time = 0;

  constructor() {
    const rand = mulberry32(11);
    const glowPoints: GlowPoint[] = [];

    this.skyMat = this.track(skyMaterial());
    const sky = new THREE.Mesh(this.track(new THREE.SphereGeometry(400, 48, 24)), this.skyMat);
    sky.renderOrder = -1;
    this.root.add(sky);

    // Cool twilight fill, plus soft moonlight from behind the camera so the
    // player's back and the obstacles' faces stay well lit. The warm moon
    // ahead shows up as the rim light on the characters instead.
    this.root.add(new THREE.HemisphereLight('#c3bff2', '#2a4a50', 1.7));
    this.sun = new THREE.DirectionalLight('#ffe0c8', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 14;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 50;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun, this.sun.target);

    // Ground.
    this.grassTex = this.track(grassTexture(rand));
    this.grassTex.wrapS = this.grassTex.wrapT = THREE.RepeatWrapping;
    this.grassTex.repeat.set(50, 50);
    const ground = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(400, 400)),
      this.track(new THREE.MeshLambertMaterial({ map: this.grassTex })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -150;
    ground.receiveShadow = true;
    this.root.add(ground);

    // Flagstone path with softly glowing lane runes.
    this.trackTex = this.track(trackTexture());
    this.trackGlow = this.track(trackGlowTexture());
    const trackLen = 300;
    for (const t of [this.trackTex, this.trackGlow]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, trackLen / 8);
    }
    const track = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(RUNNER.trackWidth, trackLen)),
      this.track(
        new THREE.MeshLambertMaterial({ map: this.trackTex, emissive: '#ffffff', emissiveMap: this.trackGlow, emissiveIntensity: 1.3 }),
      ),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0.01, -trackLen / 2 + 20);
    track.receiveShadow = true;
    this.root.add(track);

    const curbMat = this.track(new THREE.MeshLambertMaterial({ color: '#4c4777' }));
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.34, 0.16, trackLen)), curbMat);
      curb.position.set(side * (RUNNER.trackWidth / 2 + 0.17), 0.08, -trackLen / 2 + 20);
      curb.receiveShadow = true;
      this.root.add(curb);
    }

    const stone = this.stoneMaterial();
    this.addRidges(rand);
    this.addArches(stone, glowPoints);
    this.addStones(rand, stone);
    this.addTrees(rand, glowPoints);
    this.addLanterns(glowPoints);
    this.addMushrooms(rand, glowPoints);
    this.addFlowers(rand, glowPoints);
    this.addTufts(rand);
    this.addMist(rand);

    this.glows = this.track(new GlowCloud(glowPoints, this.u, { intensity: 1.6, fadeFar: 170 }));
    this.root.add(this.glows.points);
    this.fireflies = this.track(new GlowCloud(fireflyPoints(rand), this.u, { drift: 0.9, twinkle: 1, intensity: 2.2, fadeFar: 90 }));
    this.root.add(this.fireflies.points);
  }

  update(distance: number, dt: number, focus: THREE.Vector3): void {
    this.time += dt;
    this.u.uScroll.value = distance;
    this.u.uTime.value = this.time;
    this.skyMat.uniforms.uTime.value = this.time;
    this.trackTex.offset.y = this.trackGlow.offset.y = distance / 8;
    this.grassTex.offset.y = distance / 8;
    this.sun.position.set(focus.x - 4, 14, focus.z + 9);
    this.sun.target.position.set(focus.x, 0, focus.z - 4);
  }

  setDetail(detail: number): void {
    this.fireflies.setDetail(0.3 + detail * 0.7);
    for (const m of this.mist) m.visible = detail > 0.5;
  }

  setViewHeight(px: number): void {
    this.glows.setViewHeight(px);
    this.fireflies.setViewHeight(px);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }

  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }

  /** An InstancedMesh whose instances loop along z with the travelled distance (on the GPU). */
  private looping(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colors?: THREE.Color[]): THREE.InstancedMesh {
    scrollInstances(mat, this.u);
    const mesh = new THREE.InstancedMesh(this.track(geo), this.track(mat), mats.length);
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors?.forEach((c, i) => mesh.setColorAt(i, c));
    // Instances move in the shader, so the CPU-side bounds would be wrong.
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return mesh;
  }

  private stoneMaterial(): THREE.MeshLambertMaterial {
    const map = this.track(stoneTexture());
    const runes = this.track(runeTexture());
    for (const t of [map, runes]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: runes, emissiveIntensity: 1.4 });
  }

  /** Layered ridges on the horizon, colors pre-blended into the haze (no fog, no lighting). */
  private addRidges(rand: () => number): void {
    const layers = [
      { z: -330, base: 14, amp: 34, top: '#8c74b8', bottom: '#7a68ad' },
      { z: -290, base: 6, amp: 24, top: '#5b4d96', bottom: '#4d4488' },
      { z: -240, base: 0, amp: 14, top: '#38376f', bottom: '#2e3163' },
    ];
    layers.forEach((l, li) => {
      const seg = 140;
      const width = 1100;
      const pos: number[] = [];
      const col: number[] = [];
      const top = new THREE.Color(l.top);
      const bottom = new THREE.Color(l.bottom);
      const p1 = rand() * 10;
      const p2 = rand() * 10;
      for (let i = 0; i <= seg; i++) {
        const x = (i / seg - 0.5) * width;
        const u = x / 60;
        let y = l.base + l.amp * (0.55 + 0.3 * Math.sin(u * 0.9 + p1) + 0.18 * Math.sin(u * 2.3 + p2) + 0.07 * Math.sin(u * 6.1));
        // A gentle dip ahead so the moon sits in a notch of the ridges.
        y -= l.amp * 0.5 * Math.exp(-(((x + 75) / 120) ** 2)) * (li === 2 ? 1.4 : 1);
        pos.push(x, y, l.z, x, -30, l.z);
        col.push(top.r, top.g, top.b, bottom.r, bottom.g, bottom.b);
      }
      const index: number[] = [];
      for (let i = 0; i < seg; i++) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(index);
      const mesh = new THREE.Mesh(this.track(geo), this.track(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
      mesh.renderOrder = -1;
      this.root.add(mesh);
    });

    // Ruined towers on the middle ridge: distant, quiet silhouettes.
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, h] of [[-190, 46], [-150, 30], [120, 40], [235, 54]] as const) {
      parts.push(new THREE.BoxGeometry(9, h, 9).translate(x, h / 2, -292));
      parts.push(new THREE.BoxGeometry(4, 8, 9).translate(x - 2.5, h + 3, -292));
    }
    const towers = new THREE.Mesh(this.track(mergeGeometries(parts)), this.track(new THREE.MeshBasicMaterial({ color: '#4f4588', fog: false })));
    parts.forEach((p) => p.dispose());
    towers.renderOrder = -1;
    this.root.add(towers);
  }

  /** Stone arches with glowing runes spanning the path. */
  private addArches(stone: THREE.MeshLambertMaterial, glows: GlowPoint[]): void {
    const count = 4;
    const half = RUNNER.trackWidth / 2;
    const px = half + 1.1;
    const h = 6.4;
    const pillar = worldUV(new THREE.BoxGeometry(1.1, h, 1.1).translate(0, h / 2, 0), 0.5);
    const lintel = worldUV(new THREE.BoxGeometry(px * 2 + 2.2, 1.0, 1.3).translate(0, h + 0.5, 0), 0.5);
    const cap = worldUV(new THREE.BoxGeometry(px * 2 + 3, 0.35, 1.6).translate(0, h + 1.17, 0), 0.5);
    const base = worldUV(new THREE.BoxGeometry(1.5, 0.5, 1.5).translate(0, 0.25, 0), 0.5);
    const geo = mergeGeometries([
      pillar.clone().translate(-px, 0, 0),
      pillar.clone().translate(px, 0, 0),
      base.clone().translate(-px, 0, 0),
      base.clone().translate(px, 0, 0),
      lintel,
      cap,
    ]);
    for (const g of [pillar, lintel, cap, base]) g.dispose();
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const z = -30 - i * (LOOP / count);
      mats.push(new THREE.Matrix4().makeTranslation(0, 0, z));
      // A hanging light at the keystone and runes glowing at the pillar feet.
      glows.push({ x: 0, y: h - 0.35, z, color: GLADE.rune, size: 1.6 });
      for (const s of [-1, 1]) glows.push({ x: s * px, y: 0.9, z, color: GLADE.rune, size: 1.4 });
    }
    this.looping(geo, stone, mats);
  }

  private addStones(rand: () => number, stone: THREE.MeshLambertMaterial): void {
    const count = 26;
    const geo = worldUV(new THREE.BoxGeometry(1, 2.6, 0.7, 1, 2, 1).translate(0, 1.2, 0), 0.6);
    // Taper the top so they read as weathered menhirs rather than boxes.
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 1 - Math.max(0, p.getY(i)) * 0.12;
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (RUNNER.trackWidth / 2 + 2.5 + rand() * 14);
      const s = 0.6 + rand() * 0.8;
      mats.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, -0.2, -rand() * LOOP),
          new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.15, rand() * Math.PI, (rand() - 0.5) * 0.2)),
          new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s),
        ),
      );
    }
    this.looping(geo, stone, mats);
  }

  private addTrees(rand: () => number, glows: GlowPoint[]): void {
    const count = 110;
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 2, 6).translate(0, 1, 0);
    const pineParts = [
      new THREE.ConeGeometry(1.25, 2.6, 7).translate(0, 2.2, 0),
      new THREE.ConeGeometry(0.95, 2.2, 7).translate(0, 3.5, 0),
      new THREE.ConeGeometry(0.6, 1.7, 7).translate(0, 4.6, 0),
    ];
    const pineGeo = mergeGeometries(pineParts);
    pineParts.forEach((g) => g.dispose());
    const roundGeo = new THREE.IcosahedronGeometry(1.35, 1).translate(0, 2.9, 0);
    const trunkMats: THREE.Matrix4[] = [];
    const pineMats: THREE.Matrix4[] = [];
    const roundMats: THREE.Matrix4[] = [];
    const pineCols: THREE.Color[] = [];
    const roundCols: THREE.Color[] = [];
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const pines = ['#2c6a66', '#317470', '#285c66', '#3a7468'];
    const rounds = ['#4c9a8c', '#5a7fb0', '#56a084', '#7a7cc0'];
    const fruit = ['#ff8fd0', '#7ff7e2', '#ffd27a'];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (RUNNER.trackWidth / 2 + 4.5 + rand() ** 1.4 * 40);
      const z = -rand() * LOOP;
      const s = 0.8 + rand() * 0.9;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(s, s * (0.9 + rand() * 0.4), s),
      );
      trunkMats.push(m);
      const isPine = rand() < 0.55;
      const away = hidden.clone().setPosition(x, 0, z);
      pineMats.push(isPine ? m : away);
      roundMats.push(isPine ? away : m);
      pineCols.push(new THREE.Color(pines[Math.floor(rand() * pines.length)]));
      roundCols.push(new THREE.Color(rounds[Math.floor(rand() * rounds.length)]));
      // Some round trees carry glowing fruit.
      if (!isPine && rand() < 0.55) {
        const c = fruit[Math.floor(rand() * fruit.length)];
        for (let k = 0; k < 4; k++) {
          const a = rand() * Math.PI * 2;
          glows.push({ x: x + Math.cos(a) * 1.2 * s, y: (2.2 + rand() * 1.4) * s, z: z + Math.sin(a) * 1.2 * s, color: c, size: 0.55 });
        }
      }
    }
    this.looping(trunkGeo, new THREE.MeshLambertMaterial({ color: '#3a2c3f' }), trunkMats);
    this.looping(pineGeo, new THREE.MeshLambertMaterial({ flatShading: true }), pineMats, pineCols);
    this.looping(roundGeo, new THREE.MeshLambertMaterial({ flatShading: true }), roundMats, roundCols);
  }

  private addLanterns(glows: GlowPoint[]): void {
    const perSide = 10;
    const x = RUNNER.trackWidth / 2 + 0.75;
    const postGeo = new THREE.CylinderGeometry(0.05, 0.08, 1.2, 6).translate(0, 0.6, 0);
    const lampGeo = new THREE.OctahedronGeometry(0.15, 0).scale(1, 1.4, 1).translate(0, 1.38, 0);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < perSide * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -Math.floor(i / 2) * (LOOP / perSide) - 12;
      mats.push(new THREE.Matrix4().makeTranslation(side * x, 0, z));
      glows.push({ x: side * x, y: 1.38, z, color: GLADE.lantern, size: 1.5 });
    }
    this.looping(postGeo, new THREE.MeshLambertMaterial({ color: '#2a2440' }), mats);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GLADE.lantern).multiplyScalar(2.2) });
    this.looping(lampGeo, lampMat, mats.map((m) => m.clone()));
  }

  private addMushrooms(rand: () => number, glows: GlowPoint[]): void {
    const count = 80;
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6).translate(0, 0.2, 0);
    const capGeo = new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.36, 0);
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (let i = 0; i < count; i++) {
      // Small clusters close to the path.
      const side = rand() < 0.5 ? -1 : 1;
      const cx = side * (RUNNER.trackWidth / 2 + 0.9 + rand() ** 1.5 * 9);
      const cz = -rand() * LOOP;
      const color = GLADE.mushrooms[Math.floor(rand() * GLADE.mushrooms.length)];
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n && mats.length < count; k++) {
        const s = 0.6 + rand() * 1.6;
        const x = cx + (rand() - 0.5) * 0.9;
        const z = cz + (rand() - 0.5) * 0.9;
        mats.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, 0, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3)),
            new THREE.Vector3(s, s, s),
          ),
        );
        cols.push(new THREE.Color(color).multiplyScalar(1.1));
        glows.push({ x, y: 0.38 * s, z, color, size: 0.5 * s });
      }
    }
    this.looping(stemGeo, new THREE.MeshLambertMaterial({ color: '#d9d2f0' }), mats);
    this.looping(capGeo, new THREE.MeshBasicMaterial(), mats.map((m) => m.clone()), cols);
  }

  private addFlowers(rand: () => number, glows: GlowPoint[]): void {
    const count = 240;
    const geo = new THREE.IcosahedronGeometry(0.07, 0);
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (RUNNER.trackWidth / 2 + 0.5 + rand() ** 1.3 * 16);
      const y = 0.12 + rand() * 0.25;
      const z = -rand() * LOOP;
      const c = GLADE.flowers[i % GLADE.flowers.length];
      mats.push(new THREE.Matrix4().makeTranslation(x, y, z));
      cols.push(new THREE.Color(c).multiplyScalar(1.1));
      if (i % 3 === 0) glows.push({ x, y, z, color: c, size: 0.35 });
    }
    this.looping(geo, new THREE.MeshBasicMaterial(), mats, cols);
  }

  /** Grass tufts and ferns that break up the ground near the path. */
  private addTufts(rand: () => number): void {
    const count = 320;
    const blades: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      blades.push(
        new THREE.ConeGeometry(0.06, 0.55, 3)
          .translate(0, 0.27, 0)
          .rotateZ(Math.cos(a) * 0.35)
          .rotateX(Math.sin(a) * 0.35)
          .translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08),
      );
    }
    const geo = mergeGeometries(blades);
    blades.forEach((b) => b.dispose());
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const greens = ['#3f8a86', '#2f7486', '#4a9a8a', '#3c6d8e'];
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (RUNNER.trackWidth / 2 + 0.45 + rand() ** 1.6 * 22);
      const s = 0.7 + rand() * 0.9;
      mats.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0, -rand() * LOOP),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28),
          new THREE.Vector3(s, s, s),
        ),
      );
      cols.push(new THREE.Color(greens[Math.floor(rand() * greens.length)]));
    }
    this.looping(geo, new THREE.MeshLambertMaterial({ flatShading: true }), mats, cols);
  }

  /** Soft banks of mist between the tree rows: depth layering at little cost. */
  private addMist(rand: () => number): void {
    const count = 18;
    const tex = this.track(mistTexture(rand));
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: '#c9b8f0',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const w = 30 + rand() * 30;
      const x = side * (RUNNER.trackWidth / 2 + 4 + w / 2 + rand() * 10);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.3, -rand() * LOOP), new THREE.Quaternion(), new THREE.Vector3(w, 3 + rand() * 3, 1)));
    }
    const mesh = this.looping(geo, mat, mats);
    mesh.renderOrder = 1;
    this.mist.push(mesh);
  }
}

/** Sets UVs from vertex positions (per face direction) so textures keep a constant size on any box. */
function worldUV<G extends THREE.BufferGeometry>(geo: G, scale: number): G {
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv.setXY(i, u * scale, v * scale);
  }
  return geo;
}

function fireflyPoints(rand: () => number): GlowPoint[] {
  const out: GlowPoint[] = [];
  for (let i = 0; i < 520; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    // Mostly along the edges of the path and in the near forest; a few over it.
    const x = rand() < 0.12 ? (rand() - 0.5) * RUNNER.trackWidth : side * (RUNNER.trackWidth / 2 + rand() ** 1.5 * 26);
    out.push({
      x,
      y: 0.3 + rand() ** 1.5 * 4.5,
      z: -rand() * LOOP,
      color: rand() < 0.75 ? GLADE.firefly : GLADE.rune,
      size: 0.1 + rand() * 0.08,
    });
  }
  return out;
}

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(GLADE.zenith) },
      uSky: { value: new THREE.Color(GLADE.sky) },
      uHorizon: { value: new THREE.Color(GLADE.horizon) },
      uGlow: { value: new THREE.Color(GLADE.glow) },
      uMoon: { value: new THREE.Color(GLADE.moon) },
      uMoonDir: { value: MOON_DIR },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uSky, uHorizon, uGlow, uMoon, uMoonDir;
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float az = atan(d.x, -d.z);

        vec3 col = mix(uHorizon, uSky, smoothstep(0.0, 0.32, h));
        col = mix(col, uZenith, smoothstep(0.25, 0.85, h));

        // Warm glow around the moon and along the horizon below it.
        float md = dot(d, uMoonDir);
        float ang = acos(clamp(md, -1.0, 1.0));
        float lowSky = 1.0 - smoothstep(0.0, 0.55, h);
        col += uGlow * (0.55 * exp(-ang * ang * 9.0) + 0.22 * exp(-ang * 2.2)) * lowSky;
        col += uGlow * 0.3 * exp(-abs(h) * 9.0) * (0.6 + 0.4 * max(md, 0.0));

        // Soft rays fanning out from the moon.
        vec3 right = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(right, uMoonDir);
        vec2 m = vec2(dot(d, right), dot(d, up));
        float ra = atan(m.y, m.x);
        float rays = pow(0.5 + 0.5 * sin(ra * 11.0 + sin(ra * 3.0 + uTime * 0.05) * 2.0), 8.0);
        col += uGlow * rays * 0.14 * exp(-ang * 3.5) * smoothstep(0.07, 0.14, ang) * step(0.0, md);

        // Aurora: a faint ribbon of curtains high in the sky.
        float wave = sin(az * 2.0 + uTime * 0.04) * 0.06 + sin(az * 5.3 - uTime * 0.07) * 0.025;
        float band = exp(-pow((h - 0.42 - wave) * 7.0, 2.0));
        float curtains = 0.55 + 0.45 * sin(az * 38.0 + sin(az * 4.0 + uTime * 0.15) * 4.0);
        vec3 aurora = mix(vec3(0.25, 0.95, 0.75), vec3(0.55, 0.4, 1.0), smoothstep(0.35, 0.55, h + wave));
        col += aurora * band * curtains * 0.16 * smoothstep(0.15, 0.3, h);

        // Stars, twinkling, fading out toward the horizon and the moon.
        vec2 g = vec2(az, asin(clamp(h, -1.0, 1.0))) * 70.0;
        vec2 cell = floor(g);
        float r = hash(cell);
        vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5;
        float star = smoothstep(0.16, 0.0, length(fract(g) - 0.5 - off * 0.6)) * step(0.82, r);
        float twinkle = 0.65 + 0.35 * sin(uTime * (1.0 + r * 3.0) + r * 60.0);
        col += vec3(1.0, 0.95, 0.88) * star * twinkle * (0.4 + r) * smoothstep(0.08, 0.35, h) * smoothstep(0.25, 0.6, ang);

        // The moon: a big soft disc with gentle maria and limb darkening.
        float R = 0.095;
        vec2 mm = m / R;
        float disc = smoothstep(R, R - 0.003, ang) * step(0.0, md);
        float maria = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(mm.x * 3.3 + 1.1) * sin(mm.y * 2.6 + 0.5) + 0.25 * sin(mm.x * 7.0 - mm.y * 5.0));
        vec3 moon = uMoon * (1.2 - 0.25 * maria) * (0.8 + 0.2 * sqrt(max(0.0, 1.0 - dot(mm, mm))));
        col = mix(col, moon, disc);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Pale flagstones, 8 m of path per tile. */
function trackTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  const rand = mulberry32(5);
  g.fillStyle = '#625b8a';
  g.fillRect(0, 0, 256, 256);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = (r / rows) * 256;
    const hgt = 256 / rows;
    let x = r % 2 ? -20 : 0;
    while (x < 256) {
      const w = 34 + rand() * 30;
      const l = 68 + rand() * 12;
      g.fillStyle = `hsl(${248 + rand() * 14}, ${14 + rand() * 8}%, ${l}%)`;
      roundRect(g, x + 2, y + 2, w - 4, hgt - 4, 5);
      // Speckle and a lighter top edge.
      for (let k = 0; k < 10; k++) {
        g.fillStyle = rand() < 0.5 ? 'rgba(60,50,110,0.12)' : 'rgba(255,255,255,0.18)';
        g.fillRect(x + 4 + rand() * (w - 10), y + 4 + rand() * (hgt - 10), 2 + rand() * 4, 2 + rand() * 3);
      }
      x += w;
    }
  }
  return tex(c);
}

/** Emissive map for the path: glowing dashed rune lines between the lanes. */
function trackGlowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const laneFrac = RUNNER.laneWidth / RUNNER.trackWidth;
  g.shadowColor = GLADE.rune;
  g.shadowBlur = 10;
  g.fillStyle = GLADE.rune;
  for (const x of [0.5 - laneFrac / 2, 0.5 + laneFrac / 2]) {
    for (let k = 0; k < 4; k++) {
      // A dash and a small diamond "rune" per segment.
      g.fillRect(x * 256 - 2.5, k * 64 + 6, 5, 32);
      g.beginPath();
      g.moveTo(x * 256, k * 64 + 44);
      g.lineTo(x * 256 + 5, k * 64 + 51);
      g.lineTo(x * 256, k * 64 + 58);
      g.lineTo(x * 256 - 5, k * 64 + 51);
      g.fill();
    }
  }
  return tex(c);
}

function grassTexture(rand: () => number): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  g.fillStyle = GLADE.grass;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const l = 20 + rand() * 22;
    g.fillStyle = `hsla(${175 + rand() * 30}, 40%, ${l}%, 0.7)`;
    g.fillRect(rand() * 128, rand() * 128, 1.5, 3 + rand() * 4);
  }
  return tex(c);
}

function stoneTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  const rand = mulberry32(9);
  g.fillStyle = '#8f89b8';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(50,45,90,0.16)' : 'rgba(255,255,255,0.12)';
    g.fillRect(rand() * 128, rand() * 128, 2 + rand() * 6, 2 + rand() * 5);
  }
  // Moss at random spots.
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(70,140,120,0.35)';
    g.beginPath();
    g.arc(rand() * 128, rand() * 128, 3 + rand() * 7, 0, 7);
    g.fill();
  }
  return tex(c);
}

/** Sparse glowing glyphs on black (an emissive map). */
function runeTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  const rand = mulberry32(21);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = GLADE.rune;
  g.shadowColor = GLADE.rune;
  g.shadowBlur = 8;
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  const cells = 4;
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      if (rand() < 0.45) continue;
      const x0 = cx * 64 + 18;
      const y0 = cy * 64 + 14;
      g.beginPath();
      // A vertical stave with 2–3 branches: rune-like but not any real script.
      g.moveTo(x0 + 14, y0);
      g.lineTo(x0 + 14, y0 + 36);
      for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
        const y = y0 + rand() * 30;
        const dir = rand() < 0.5 ? -1 : 1;
        g.moveTo(x0 + 14, y);
        g.lineTo(x0 + 14 + dir * 12, y + (rand() < 0.5 ? -9 : 9));
      }
      g.stroke();
    }
  }
  return tex(c);
}

function mistTexture(rand: () => number): THREE.CanvasTexture {
  const [c, g] = canvas(256, 64);
  for (let i = 0; i < 60; i++) {
    const x = rand() * 256;
    const y = 40 + rand() * 24;
    const r = 14 + rand() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 64);
  }
  // Fade the left/right ends so the banks have no hard edges.
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 256, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.2, 'rgba(0,0,0,1)');
  fade.addColorStop(0.8, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 256, 64);
  return tex(c);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}
