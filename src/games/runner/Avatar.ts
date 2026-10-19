import * as THREE from 'three';
import { LM, type Vec3 } from '../../core/pose/landmarks';
import { addRim, glowTexture, patchKey } from './fx';

export interface AvatarColors {
  shirt: string;
  pants: string;
  skin: string;
  shoes: string;
  hair: string;
  pack: string;
}

const DEFAULT_COLORS: AvatarColors = {
  shirt: '#ff8040',
  pants: '#2e3b85',
  skin: '#f1c27d',
  shoes: '#f4f1ff',
  hair: '#3b2416',
  pack: '#6a4fb0',
};

type Point = number | 'neck' | 'pelvis';
/** A tapered limb from a to b; ra/rb are the radii at each end. */
type Seg = { a: Point; b: Point; ra: number; rb: number; part: keyof AvatarColors };

const SEGMENTS: Seg[] = [
  { a: 'pelvis', b: 'neck', ra: 0.14, rb: 0.165, part: 'shirt' },
  { a: LM.LEFT_SHOULDER, b: LM.RIGHT_SHOULDER, ra: 0.085, rb: 0.085, part: 'shirt' },
  { a: LM.LEFT_HIP, b: LM.RIGHT_HIP, ra: 0.1, rb: 0.1, part: 'pants' },
  { a: LM.LEFT_SHOULDER, b: LM.LEFT_ELBOW, ra: 0.068, rb: 0.056, part: 'shirt' },
  { a: LM.RIGHT_SHOULDER, b: LM.RIGHT_ELBOW, ra: 0.068, rb: 0.056, part: 'shirt' },
  { a: LM.LEFT_ELBOW, b: LM.LEFT_WRIST, ra: 0.05, rb: 0.04, part: 'skin' },
  { a: LM.RIGHT_ELBOW, b: LM.RIGHT_WRIST, ra: 0.05, rb: 0.04, part: 'skin' },
  { a: LM.LEFT_HIP, b: LM.LEFT_KNEE, ra: 0.095, rb: 0.072, part: 'pants' },
  { a: LM.RIGHT_HIP, b: LM.RIGHT_KNEE, ra: 0.095, rb: 0.072, part: 'pants' },
  { a: LM.LEFT_KNEE, b: LM.LEFT_ANKLE, ra: 0.07, rb: 0.055, part: 'pants' },
  { a: LM.RIGHT_KNEE, b: LM.RIGHT_ANKLE, ra: 0.07, rb: 0.055, part: 'pants' },
  { a: LM.LEFT_HEEL, b: LM.LEFT_FOOT_INDEX, ra: 0.062, rb: 0.052, part: 'shoes' },
  { a: LM.RIGHT_HEEL, b: LM.RIGHT_FOOT_INDEX, ra: 0.062, rb: 0.052, part: 'shoes' },
];

/** Extra spheres at joints (on top of each limb's rounded ends). */
const JOINTS: { i: number; r: number; part: keyof AvatarColors }[] = [
  { i: LM.LEFT_WRIST, r: 0.062, part: 'skin' },
  { i: LM.RIGHT_WRIST, r: 0.062, part: 'skin' },
  { i: LM.LEFT_ANKLE, r: 0.062, part: 'shoes' },
  { i: LM.RIGHT_ANKLE, r: 0.062, part: 'shoes' },
];

/** Head pieces in head space (y up, face toward −z): position, scale, color. */
const HEAD: { p: [number, number, number]; s: [number, number, number]; part: keyof AvatarColors }[] = [
  { p: [0, 0, 0], s: [0.125, 0.145, 0.135], part: 'skin' },
  { p: [0, 0.035, 0.014], s: [0.132, 0.128, 0.135], part: 'hair' },
  { p: [0, 0.07, 0.12], s: [0.058, 0.058, 0.058], part: 'hair' }, // bun
  { p: [-0.125, -0.01, 0.01], s: [0.03, 0.04, 0.025], part: 'skin' },
  { p: [0.125, -0.01, 0.01], s: [0.03, 0.04, 0.025], part: 'skin' },
];

const FOOT_POINTS = [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];

/** Number of sphere instances: two rounded ends per limb, joints, head pieces, backpack. */
const BALLS = SEGMENTS.length * 2 + JOINTS.length + HEAD.length + 1;

/**
 * A stylized, rounded figure driven directly by a 33-point skeleton, so it
 * copies the player's movements. Seen from behind, with a little backpack and
 * a glowing charm. The whole body is two instanced draw calls (tapered limbs
 * and spheres) with a rim light so it stands out against any background.
 */
export class Avatar {
  readonly root = new THREE.Group();
  /** The posed body (child of root), offset so the feet touch the ground. */
  private body = new THREE.Group();
  private limbs: THREE.InstancedMesh;
  private balls: THREE.InstancedMesh;
  private charm: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;
  private limbMaterial: THREE.MeshStandardMaterial;
  private groundOffset = 1.0;
  private flash = 0;
  private stumble = 0;
  private shadow: THREE.Mesh;
  private aura: THREE.Mesh;
  private time = 0;
  private disposables: { dispose(): void }[] = [];
  // Scratch objects, reused every frame.
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private d = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private m = new THREE.Matrix4();
  private head = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private euler = new THREE.Euler();
  private right = new THREE.Vector3();
  private back = new THREE.Vector3();

  constructor(colors: Partial<AvatarColors> = {}) {
    const col = { ...DEFAULT_COLORS, ...colors };
    const d = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const material = () => new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#ff2a2a', emissiveIntensity: 0 });
    this.material = d(addRim(material()));

    // Limbs: an open unit cylinder, tapered per instance in the vertex shader.
    const cyl = d(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true));
    const radii = new Float32Array((SEGMENTS.length + 1) * 2);
    SEGMENTS.forEach((sg, i) => radii.set([sg.ra, sg.rb], i * 2));
    radii.set([0.05, 0.055], SEGMENTS.length * 2); // neck
    cyl.setAttribute('aRadii', new THREE.InstancedBufferAttribute(radii, 2));
    this.limbMaterial = d(addRim(taper(material())));
    this.limbs = new THREE.InstancedMesh(cyl, this.limbMaterial, SEGMENTS.length + 1);
    this.limbs.customDepthMaterial = d(taper(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })));
    const color = new THREE.Color();
    SEGMENTS.forEach((sg, i) => this.limbs.setColorAt(i, color.set(col[sg.part])));
    this.limbs.setColorAt(SEGMENTS.length, color.set(col.skin));

    const sph = d(new THREE.SphereGeometry(1, 18, 12));
    this.balls = new THREE.InstancedMesh(sph, this.material, BALLS);
    let k = 0;
    for (const sg of SEGMENTS) {
      this.balls.setColorAt(k++, color.set(col[sg.part]));
      this.balls.setColorAt(k++, color.set(col[sg.part]));
    }
    for (const j of JOINTS) this.balls.setColorAt(k++, color.set(col[j.part]));
    for (const h of HEAD) this.balls.setColorAt(k++, color.set(col[h.part]));
    this.balls.setColorAt(k, color.set(col.pack));

    for (const m of [this.limbs, this.balls]) {
      m.castShadow = true;
      m.frustumCulled = false; // instances move every frame
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.body.add(m);
    }

    // A little lantern charm on the backpack.
    this.charm = new THREE.Mesh(d(new THREE.OctahedronGeometry(0.035, 0)), d(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.5) })));
    this.body.add(this.charm);

    // Soft blob shadow so the player can judge jumps even without shadow maps,
    // and a faint glowing ring that marks the player's spot on the path.
    this.shadow = new THREE.Mesh(
      d(new THREE.PlaneGeometry(1, 1)),
      d(new THREE.MeshBasicMaterial({ map: d(blobTexture()), transparent: true, depthWrite: false })),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.shadow.scale.set(0.9, 0.9, 1);
    this.aura = new THREE.Mesh(
      d(new THREE.RingGeometry(0.42, 0.62, 40)),
      d(
        new THREE.MeshBasicMaterial({
          map: d(glowTexture()),
          color: new THREE.Color('#7ff7e2').multiplyScalar(0.8),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.03;

    this.body.visible = false; // until the first skeleton arrives
    this.root.add(this.body, this.shadow, this.aura);
  }

  /** Flash red and stagger — called when the player hits an obstacle. */
  hit(): void {
    this.flash = 1;
    this.stumble = 1;
  }

  /**
   * @param skeleton avatar-space joints (see BodyState.skeleton)
   * @param lift extra height (m) when jumping
   */
  update(skeleton: Vec3[] | null, lift: number, dt: number): void {
    this.time += dt;
    if (skeleton) {
      this.pose(skeleton);
      this.body.visible = true;

      // Keep the lowest foot on the ground, then add the jump on top.
      let minY = Infinity;
      for (const i of FOOT_POINTS) minY = Math.min(minY, skeleton[i].y);
      const target = -minY + 0.05;
      this.groundOffset += (target - this.groundOffset) * Math.min(1, dt * 10);
    }
    this.body.position.y = this.groundOffset + lift;
    const shadowScale = 0.9 / (1 + lift * 0.8);
    this.shadow.scale.set(shadowScale, shadowScale, 1);
    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    this.aura.scale.set(pulse, pulse, 1);

    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.stumble = Math.max(0, this.stumble - dt * 2);
    this.material.emissiveIntensity = this.limbMaterial.emissiveIntensity = this.flash * 0.9;
    this.body.rotation.x = Math.sin(this.stumble * Math.PI) * 0.35;
  }

  private point(p: Vec3[], k: Point, out: THREE.Vector3): THREE.Vector3 {
    if (k === 'neck') return mid(p[LM.LEFT_SHOULDER], p[LM.RIGHT_SHOULDER], out);
    if (k === 'pelvis') return mid(p[LM.LEFT_HIP], p[LM.RIGHT_HIP], out);
    return out.set(p[k].x, p[k].y, p[k].z);
  }

  private pose(p: Vec3[]): void {
    const { a, b, c, s, q, m } = this;
    let k = 0;
    SEGMENTS.forEach((sg, i) => {
      this.point(p, sg.a, a);
      this.point(p, sg.b, b);
      const len = Math.max(a.distanceTo(b), 1e-4);
      c.copy(a).add(b).multiplyScalar(0.5);
      q.setFromUnitVectors(this.up, this.d.copy(b).sub(a).divideScalar(len));
      this.limbs.setMatrixAt(i, m.compose(c, q, s.set(1, len, 1)));
      // Rounded ends.
      this.balls.setMatrixAt(k++, m.compose(a, q, s.setScalar(sg.ra)));
      this.balls.setMatrixAt(k++, m.compose(b, q, s.setScalar(sg.rb)));
    });
    for (const j of JOINTS) {
      this.balls.setMatrixAt(k++, m.compose(a.set(p[j.i].x, p[j.i].y, p[j.i].z), q.identity(), s.setScalar(j.r)));
    }

    // Head centered between the ears, facing where the nose points, tilting with the ear line.
    mid(p[LM.LEFT_EAR], p[LM.RIGHT_EAR], c);
    a.set(p[LM.NOSE].x, p[LM.NOSE].y, p[LM.NOSE].z);
    b.copy(c).lerp(a, 0.25); // head position
    a.sub(c); // forward
    const yaw = a.x * a.x + a.z * a.z > 1e-6 ? Math.atan2(-a.x, -a.z) : 0;
    const sx = p[LM.RIGHT_EAR].x - p[LM.LEFT_EAR].x;
    const sy = p[LM.RIGHT_EAR].y - p[LM.LEFT_EAR].y;
    const tilt = THREE.MathUtils.clamp(Math.atan2(sy, Math.max(sx, 0.02)), -0.6, 0.6);
    this.head.compose(b, q.setFromEuler(this.euler.set(0, yaw, tilt)), s.setScalar(1));
    for (const h of HEAD) {
      m.compose(a.set(...h.p), q.identity(), s.set(...h.s)).premultiply(this.head);
      this.balls.setMatrixAt(k++, m);
    }
    // Neck: a short limb below the head.
    m.compose(a.set(0, -0.13, 0), q.identity(), s.set(1, 0.14, 1)).premultiply(this.head);
    this.limbs.setMatrixAt(SEGMENTS.length, m);

    // Backpack on the upper back, oriented with the torso.
    mid(p[LM.LEFT_SHOULDER], p[LM.RIGHT_SHOULDER], a); // neck
    mid(p[LM.LEFT_HIP], p[LM.RIGHT_HIP], b); // pelvis
    const { right, back } = this;
    const up = this.d.copy(a).sub(b).normalize();
    right.set(p[LM.RIGHT_SHOULDER].x - p[LM.LEFT_SHOULDER].x, p[LM.RIGHT_SHOULDER].y - p[LM.LEFT_SHOULDER].y, p[LM.RIGHT_SHOULDER].z - p[LM.LEFT_SHOULDER].z);
    right.addScaledVector(up, -right.dot(up)).normalize();
    back.crossVectors(right, up); // +z when upright: toward the camera
    const center = b.lerp(a, 0.62).addScaledVector(back, 0.15);
    m.makeBasis(right, up, back).scale(s.set(0.16, 0.19, 0.08)).setPosition(center);
    this.balls.setMatrixAt(k, m);
    this.charm.position.copy(center).addScaledVector(back, 0.085).addScaledVector(up, -0.08);
    this.charm.rotation.y = this.time * 2;

    this.limbs.instanceMatrix.needsUpdate = true;
    this.balls.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const x of this.disposables) x.dispose();
  }
}

function mid(p: Vec3, r: Vec3, out: THREE.Vector3): THREE.Vector3 {
  return out.set((p.x + r.x) / 2, (p.y + r.y) / 2, (p.z + r.z) / 2);
}

/** Scales each limb's radius from `aRadii.x` (bottom) to `aRadii.y` (top). */
function taper<M extends THREE.Material>(mat: M): M {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec2 aRadii;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.xz *= mix(aRadii.x, aRadii.y, position.y + 0.5);',
    );
  };
  const key = patchKey(mat, 'taper');
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
