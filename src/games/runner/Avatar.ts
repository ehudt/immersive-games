import * as THREE from 'three';
import { LM, type Vec3 } from '../../core/pose/landmarks';

export interface AvatarColors {
  shirt: string;
  pants: string;
  skin: string;
  shoes: string;
  hair: string;
}

const DEFAULT_COLORS: AvatarColors = {
  shirt: '#2ec4b6',
  pants: '#26408b',
  skin: '#f1c27d',
  shoes: '#ffffff',
  hair: '#3b2416',
};

type Seg = { a: number | 'neck' | 'pelvis'; b: number | 'neck' | 'pelvis'; r: number; part: keyof AvatarColors };

const SEGMENTS: Seg[] = [
  { a: 'neck', b: 'pelvis', r: 0.16, part: 'shirt' },
  { a: LM.LEFT_SHOULDER, b: LM.RIGHT_SHOULDER, r: 0.085, part: 'shirt' },
  { a: LM.LEFT_HIP, b: LM.RIGHT_HIP, r: 0.11, part: 'pants' },
  { a: LM.LEFT_SHOULDER, b: LM.LEFT_ELBOW, r: 0.065, part: 'shirt' },
  { a: LM.RIGHT_SHOULDER, b: LM.RIGHT_ELBOW, r: 0.065, part: 'shirt' },
  { a: LM.LEFT_ELBOW, b: LM.LEFT_WRIST, r: 0.05, part: 'skin' },
  { a: LM.RIGHT_ELBOW, b: LM.RIGHT_WRIST, r: 0.05, part: 'skin' },
  { a: LM.LEFT_HIP, b: LM.LEFT_KNEE, r: 0.085, part: 'pants' },
  { a: LM.RIGHT_HIP, b: LM.RIGHT_KNEE, r: 0.085, part: 'pants' },
  { a: LM.LEFT_KNEE, b: LM.LEFT_ANKLE, r: 0.065, part: 'pants' },
  { a: LM.RIGHT_KNEE, b: LM.RIGHT_ANKLE, r: 0.065, part: 'pants' },
  { a: LM.LEFT_HEEL, b: LM.LEFT_FOOT_INDEX, r: 0.055, part: 'shoes' },
  { a: LM.RIGHT_HEEL, b: LM.RIGHT_FOOT_INDEX, r: 0.055, part: 'shoes' },
];

const JOINTS: { i: number; r: number; part: keyof AvatarColors }[] = [
  { i: LM.LEFT_ELBOW, r: 0.06, part: 'shirt' },
  { i: LM.RIGHT_ELBOW, r: 0.06, part: 'shirt' },
  { i: LM.LEFT_WRIST, r: 0.065, part: 'skin' },
  { i: LM.RIGHT_WRIST, r: 0.065, part: 'skin' },
  { i: LM.LEFT_KNEE, r: 0.08, part: 'pants' },
  { i: LM.RIGHT_KNEE, r: 0.08, part: 'pants' },
  { i: LM.LEFT_ANKLE, r: 0.065, part: 'pants' },
  { i: LM.RIGHT_ANKLE, r: 0.065, part: 'pants' },
];

const FOOT_POINTS = [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];

/**
 * A stylized, rounded "toy figure" body driven directly by a 33-point
 * skeleton, so it copies the player's movements. Seen from behind.
 */
export class Avatar {
  readonly root = new THREE.Group();
  /** The posed body (child of root), offset so the feet touch the ground. */
  private body = new THREE.Group();
  private segs: THREE.Mesh[] = [];
  private joints: THREE.Mesh[] = [];
  private head = new THREE.Group();
  private materials: Record<keyof AvatarColors, THREE.MeshStandardMaterial>;
  private groundOffset = 1.0;
  private flash = 0;
  private stumble = 0;
  private shadow: THREE.Mesh;
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(colors: Partial<AvatarColors> = {}) {
    const c = { ...DEFAULT_COLORS, ...colors };
    const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: '#ff0000', emissiveIntensity: 0 });
    this.materials = {
      shirt: mat(c.shirt),
      pants: mat(c.pants),
      skin: mat(c.skin),
      shoes: mat(c.shoes),
      hair: mat(c.hair),
    };

    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const sph = new THREE.SphereGeometry(1, 16, 12);
    for (const s of SEGMENTS) {
      const m = new THREE.Mesh(cyl, this.materials[s.part]);
      m.castShadow = true;
      this.segs.push(m);
      this.body.add(m);
      // Rounded ends.
      for (let k = 0; k < 2; k++) {
        const cap = new THREE.Mesh(sph, this.materials[s.part]);
        cap.castShadow = true;
        cap.userData.cap = k;
        m.add(cap);
      }
    }
    for (const j of JOINTS) {
      const m = new THREE.Mesh(sph, this.materials[j.part]);
      m.scale.setScalar(j.r);
      m.castShadow = true;
      this.joints.push(m);
      this.body.add(m);
    }

    // Head: face + hair cap + ears.
    const face = new THREE.Mesh(sph, this.materials.skin);
    face.scale.set(0.12, 0.14, 0.13);
    const hair = new THREE.Mesh(sph, this.materials.hair);
    hair.scale.set(0.125, 0.12, 0.13);
    hair.position.set(0, 0.035, 0.012);
    const neck = new THREE.Mesh(cyl, this.materials.skin);
    neck.scale.set(0.05, 0.12, 0.05);
    neck.position.y = -0.13;
    face.castShadow = hair.castShadow = true;
    this.head.add(face, hair, neck);
    this.body.add(this.head);

    // Soft blob shadow so the player can judge jumps even without shadow maps.
    const shadowTex = blobTexture();
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.shadow.scale.set(0.9, 0.9, 1);

    this.body.visible = false; // until the first skeleton arrives
    this.root.add(this.body, this.shadow);
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
    if (skeleton) {
      this.pose(skeleton);
      this.body.visible = true;
    }

    // Keep the lowest foot on the ground, then add the jump on top.
    if (skeleton) {
      let minY = Infinity;
      for (const i of FOOT_POINTS) minY = Math.min(minY, skeleton[i].y);
      const target = -minY + 0.05;
      this.groundOffset += (target - this.groundOffset) * Math.min(1, dt * 10);
    }
    this.body.position.y = this.groundOffset + lift;
    const shadowScale = 0.9 / (1 + lift * 0.8);
    this.shadow.scale.set(shadowScale, shadowScale, 1);

    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.stumble = Math.max(0, this.stumble - dt * 2);
    for (const m of Object.values(this.materials)) m.emissiveIntensity = this.flash * 0.8;
    this.body.rotation.x = Math.sin(this.stumble * Math.PI) * 0.35;
  }

  private pose(p: Vec3[]): void {
    const point = (k: Seg['a'], out: THREE.Vector3) => {
      if (k === 'neck') return out.set(0, 0, 0).add(v3(p[LM.LEFT_SHOULDER])).add(v3(p[LM.RIGHT_SHOULDER])).multiplyScalar(0.5);
      if (k === 'pelvis') return out.set(0, 0, 0).add(v3(p[LM.LEFT_HIP])).add(v3(p[LM.RIGHT_HIP])).multiplyScalar(0.5);
      return out.set(p[k].x, p[k].y, p[k].z);
    };
    SEGMENTS.forEach((s, idx) => {
      const m = this.segs[idx];
      point(s.a, this.v);
      point(s.b, this.w);
      const len = Math.max(this.v.distanceTo(this.w), 1e-4);
      m.position.copy(this.v).add(this.w).multiplyScalar(0.5);
      m.scale.set(s.r, len, s.r);
      m.quaternion.setFromUnitVectors(this.up, this.w.sub(this.v).normalize());
      // Caps live in the segment's scaled space; undo the scale to keep them round.
      for (const cap of m.children) {
        cap.scale.set(1, s.r / len, 1);
        cap.position.y = cap.userData.cap ? 0.5 : -0.5;
      }
    });
    JOINTS.forEach((j, idx) => this.joints[idx].position.set(p[j.i].x, p[j.i].y, p[j.i].z));

    // Head centered between the ears, facing where the nose points.
    const le = v3(p[LM.LEFT_EAR]);
    const re = v3(p[LM.RIGHT_EAR]);
    const center = le.clone().add(re).multiplyScalar(0.5);
    const nose = v3(p[LM.NOSE]);
    this.head.position.copy(center).lerp(nose, 0.25);
    const fwd = nose.sub(center);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-6) this.head.rotation.y = Math.atan2(-fwd.x, -fwd.z);
    const side = re.sub(le);
    this.head.rotation.z = THREE.MathUtils.clamp(Math.atan2(side.y, Math.max(side.x, 0.02)), -0.6, 0.6);
  }

  dispose(): void {
    for (const m of Object.values(this.materials)) m.dispose();
    this.segs[0]?.geometry.dispose();
    this.joints[0]?.geometry.dispose();
  }
}

function v3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
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
