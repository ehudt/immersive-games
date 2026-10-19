import * as THREE from 'three';
import { RUNNER } from './config';
import { mulberry32 } from './Course';
import { LOOP, wrapZ } from './fx';

/** How a scenery wants the shared renderer, characters and post-processing set up. */
export interface SceneryLook {
  /** Distance fog range, meters. */
  fog: { near: number; far: number };
  exposure: number;
  /** Fresnel rim light on the avatar and the coach. */
  rim: THREE.ColorRepresentation;
  rimStrength: number;
  /** Bloom settings, or null for none. Only used on capable machines. */
  bloom: { strength: number; radius: number; threshold: number } | null;
  /** CSS class added to the game stage (vignette, HUD accents…). */
  stageClass: string;
}

/**
 * The scenery the player runs through. A world only needs to scroll with the
 * distance travelled; obstacles and characters are handled elsewhere, so new
 * themes (beach, space, city…) can be added as other Scenery implementations.
 */
export interface Scenery {
  readonly root: THREE.Object3D;
  /** Fog / sky color, used to match the renderer background. */
  readonly horizon: THREE.Color;
  readonly look: SceneryLook;
  update(distance: number, dt: number, focus: THREE.Vector3): void;
  /** 0..1 — scales optional effects (particles, mist) for slower machines. */
  setDetail(detail: number): void;
  /** Drawing-buffer height in pixels, for effects sized on screen. */
  setViewHeight(px: number): void;
  dispose(): void;
}

interface Clouds {
  mesh: THREE.InstancedMesh;
  puffs: { cloud: number; base: THREE.Matrix4 }[];
  cloudX: number[];
}

/** "Sunny Meadow": a dirt path through rolling grass, trees, fences and hills. */
export class MeadowWorld implements Scenery {
  readonly root = new THREE.Group();
  readonly horizon = new THREE.Color('#bfe3ff');
  readonly look: SceneryLook = {
    fog: { near: 60, far: 190 },
    exposure: 1,
    rim: '#ffffff',
    rimStrength: 0.25,
    bloom: null,
    stageClass: 'theme-meadow',
  };
  readonly sun: THREE.DirectionalLight;
  private trackTex: THREE.CanvasTexture;
  private grassTex: THREE.CanvasTexture;
  private scrollers: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[]; z: number[] }[] = [];
  private clouds: Clouds;
  private disposables: { dispose(): void }[] = [];
  private tmp = new THREE.Matrix4();

  constructor() {
    const rand = mulberry32(7);

    // Sky dome with a vertical gradient.
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#3f8fe6') },
        bottom: { value: this.horizon.clone() },
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
        void main(){ float h = clamp(normalize(vPos).y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -1;
    this.root.add(sky);
    this.track(skyGeo);
    this.track(skyMat);

    // Lights.
    this.root.add(new THREE.HemisphereLight('#dff1ff', '#5b8a3a', 1.6));
    this.sun = new THREE.DirectionalLight('#fff3d6', 2.4);
    this.sun.position.set(-8, 16, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 12;
    sc.bottom = -12;
    sc.near = 1;
    sc.far = 50;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun, this.sun.target);

    // Ground with a scrolling grass texture for a sense of speed.
    this.grassTex = this.track(grassTexture(rand));
    this.grassTex.wrapS = this.grassTex.wrapT = THREE.RepeatWrapping;
    this.grassTex.repeat.set(40, 40);
    const ground = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(400, 400)),
      this.track(new THREE.MeshLambertMaterial({ map: this.grassTex, color: '#8fd16a' })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -150;
    ground.receiveShadow = true;
    this.root.add(ground);

    // The running track.
    this.trackTex = this.track(trackTexture());
    this.trackTex.wrapS = this.trackTex.wrapT = THREE.RepeatWrapping;
    const trackLen = 300;
    this.trackTex.repeat.set(1, trackLen / 8);
    const track = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(RUNNER.trackWidth, trackLen)),
      this.track(new THREE.MeshLambertMaterial({ map: this.trackTex })),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0.01, -trackLen / 2 + 20);
    track.receiveShadow = true;
    this.root.add(track);

    // Track borders.
    for (const side of [-1, 1]) {
      const border = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.3, 0.12, trackLen)),
        this.track(new THREE.MeshLambertMaterial({ color: '#f4f1e6' })),
      );
      border.position.set(side * (RUNNER.trackWidth / 2 + 0.15), 0.06, -trackLen / 2 + 20);
      border.receiveShadow = true;
      this.root.add(border);
    }

    this.addTrees(rand);
    this.addFences();
    this.addFlowers(rand);
    this.addHills(rand);
    this.clouds = this.addClouds(rand);
  }

  update(distance: number, dt: number, focus: THREE.Vector3): void {
    // Track texture tiles every 8m (repeat set so 1 unit of offset = 8m).
    this.trackTex.offset.y = distance / 8;
    this.grassTex.offset.y = distance / 10;

    for (const s of this.scrollers) {
      for (let i = 0; i < s.base.length; i++) {
        const z = wrapZ(s.z[i] + distance);
        this.tmp.copy(s.base[i]);
        this.tmp.elements[14] = z;
        s.mesh.setMatrixAt(i, this.tmp);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    }

    const c = this.clouds;
    for (let i = 0; i < c.cloudX.length; i++) {
      c.cloudX[i] += dt * 0.6;
      if (c.cloudX[i] > 160) c.cloudX[i] = -160;
    }
    c.puffs.forEach((p, i) => {
      this.tmp.copy(p.base);
      this.tmp.elements[12] += c.cloudX[p.cloud];
      c.mesh.setMatrixAt(i, this.tmp);
    });
    c.mesh.instanceMatrix.needsUpdate = true;

    // Keep the shadow camera around the player.
    this.sun.position.set(focus.x - 8, 16, focus.z + 6);
    this.sun.target.position.set(focus.x, 0, focus.z - 4);
  }

  setDetail(): void {}
  setViewHeight(): void {}

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }

  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }

  /** Registers instanced meshes whose instances loop along z with the distance. */
  private scroller(mesh: THREE.InstancedMesh, mats: THREE.Matrix4[]): void {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scrollers.push({ mesh, base: mats, z: mats.map((m) => m.elements[14]) });
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    this.root.add(mesh);
  }

  private addTrees(rand: () => number): void {
    const count = 90;
    const trunkGeo = this.track(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6).translate(0, 0.8, 0));
    const leafGeo = this.track(new THREE.IcosahedronGeometry(1.1, 0).translate(0, 2.3, 0));
    const pineGeo = this.track(new THREE.ConeGeometry(1.0, 2.8, 7).translate(0, 2.6, 0));
    const trunks = new THREE.InstancedMesh(trunkGeo, this.track(new THREE.MeshLambertMaterial({ color: '#7a5233' })), count);
    const leaves = new THREE.InstancedMesh(leafGeo, this.track(new THREE.MeshLambertMaterial({ flatShading: true })), count);
    const pines = new THREE.InstancedMesh(pineGeo, this.track(new THREE.MeshLambertMaterial({ flatShading: true })), count);
    const trunkMats: THREE.Matrix4[] = [];
    const leafMats: THREE.Matrix4[] = [];
    const pineMats: THREE.Matrix4[] = [];
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const greens = ['#3f9b45', '#56b04a', '#2f7d3a', '#6cbf4f', '#4aa35a'];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (RUNNER.trackWidth / 2 + 3 + rand() * 30);
      const z = -rand() * LOOP;
      const s = 0.8 + rand() * 0.9;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(s, s, s),
      );
      trunkMats.push(m);
      const isPine = rand() < 0.4;
      leafMats.push(isPine ? hidden.clone().setPosition(x, 0, z) : m);
      pineMats.push(isPine ? m : hidden.clone().setPosition(x, 0, z));
      const color = new THREE.Color(greens[Math.floor(rand() * greens.length)]);
      leaves.setColorAt(i, color);
      pines.setColorAt(i, color.clone().multiplyScalar(0.85));
    }
    for (const m of [trunks, leaves, pines]) m.castShadow = true;
    this.scroller(trunks, trunkMats);
    this.scroller(leaves, leafMats);
    this.scroller(pines, pineMats);
  }

  private addFences(): void {
    const spacing = 4;
    const count = Math.floor(LOOP / spacing) * 2;
    const postGeo = this.track(new THREE.BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0));
    const railGeo = this.track(new THREE.BoxGeometry(0.06, 0.1, spacing).translate(0, 0.7, spacing / 2));
    const mat = this.track(new THREE.MeshLambertMaterial({ color: '#c99a63' }));
    const posts = new THREE.InstancedMesh(postGeo, mat, count);
    const rails = new THREE.InstancedMesh(railGeo, mat, count);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      mats.push(new THREE.Matrix4().makeTranslation(side * (RUNNER.trackWidth / 2 + 1.2), 0, -Math.floor(i / 2) * spacing));
    }
    this.scroller(posts, mats);
    this.scroller(rails, mats.map((m) => m.clone()));
  }

  private addFlowers(rand: () => number): void {
    const count = 260;
    const geo = this.track(new THREE.IcosahedronGeometry(0.12, 0));
    const flowers = new THREE.InstancedMesh(geo, this.track(new THREE.MeshLambertMaterial()), count);
    const colors = ['#ff6b8b', '#ffd34d', '#ffffff', '#b98cff', '#ff9a3c'];
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (RUNNER.trackWidth / 2 + 0.6 + rand() * 14);
      mats.push(new THREE.Matrix4().makeTranslation(x, 0.12, -rand() * LOOP));
      flowers.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    this.scroller(flowers, mats);
  }

  private addHills(rand: () => number): void {
    const mat = this.track(new THREE.MeshLambertMaterial({ color: '#7fb6d9', flatShading: true, fog: false }));
    const snow = this.track(new THREE.MeshLambertMaterial({ color: '#f2f7ff', flatShading: true, fog: false }));
    for (let i = 0; i < 14; i++) {
      const h = 30 + rand() * 50;
      const r = 40 + rand() * 40;
      const geo = this.track(new THREE.ConeGeometry(r, h, 6 + Math.floor(rand() * 3)));
      const m = new THREE.Mesh(geo, mat);
      const x = (i / 13 - 0.5) * 520 + (rand() - 0.5) * 30;
      m.position.set(x, h / 2 - 4, -300 - rand() * 40);
      m.rotation.y = rand() * Math.PI;
      this.root.add(m);
      const capGeo = this.track(new THREE.ConeGeometry(r * 0.3, h * 0.3, geo.parameters.radialSegments));
      const cap = new THREE.Mesh(capGeo, snow);
      cap.position.set(0, h * 0.35 + 0.1, 0);
      m.add(cap);
    }
    // Closer rolling green hills.
    const green = this.track(new THREE.MeshLambertMaterial({ color: '#6fb85a', flatShading: true }));
    for (let i = 0; i < 10; i++) {
      const geo = this.track(new THREE.SphereGeometry(30 + rand() * 25, 10, 6));
      const m = new THREE.Mesh(geo, green);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * (70 + rand() * 60), -18, -120 - rand() * 120);
      m.scale.y = 0.6;
      this.root.add(m);
    }
  }

  /** All cloud puffs in one instanced draw call; each cloud drifts sideways. */
  private addClouds(rand: () => number): Clouds {
    const puffs: Clouds['puffs'] = [];
    const cloudX: number[] = [];
    for (let i = 0; i < 16; i++) {
      cloudX.push((rand() - 0.5) * 320);
      const n = 3 + Math.floor(rand() * 4);
      const y = 45 + rand() * 35;
      const z = -120 - rand() * 180;
      for (let j = 0; j < n; j++) {
        const s = 3 + rand() * 3.5;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(j * 6 - n * 3, y + rand() * 2, z + rand() * 4),
          new THREE.Quaternion(),
          new THREE.Vector3(s * 1.4, s, s),
        );
        puffs.push({ cloud: i, base: m });
      }
    }
    const mesh = new THREE.InstancedMesh(
      this.track(new THREE.IcosahedronGeometry(1, 1)),
      this.track(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, fog: false, emissive: '#9fb4c8' })),
      puffs.length,
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return { mesh, puffs, cloudX };
  }
}

function trackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9a46c';
  g.fillRect(0, 0, 256, 256);
  // Speckles for texture.
  const rand = mulberry32(3);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(120,70,30,0.18)' : 'rgba(255,240,210,0.25)';
    g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 3, 2 + rand() * 3);
  }
  // Dashed lane dividers (track is 3 lanes + margins).
  const laneFrac = RUNNER.laneWidth / RUNNER.trackWidth;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const x of [0.5 - laneFrac / 2, 0.5 + laneFrac / 2]) {
    g.fillRect(x * 256 - 3, 0, 6, 150);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grassTexture(rand: () => number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const v = 200 + Math.floor(rand() * 55);
    g.fillStyle = `rgb(${v - 30},${v},${v - 40})`;
    g.fillRect(rand() * 128, rand() * 128, 2, 3 + rand() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
