import * as THREE from 'three';
import type { Lane } from '../../core/input/BodyState';
import { blobTexture } from './Avatar';
import { RUNNER } from './config';
import type { Beat } from './Course';

/**
 * "Bolt", the hover-bot coach. Floats ahead of the player facing them and
 * demonstrates every move a moment before the player has to do it — the role
 * the familiar characters play in warm-up videos.
 */
export class Coach {
  readonly root = new THREE.Group();
  private bot = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private flame: THREE.Mesh;
  private shadow: THREE.Mesh;
  private lane = 0;
  private t = 0;
  private spin = 0;
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const d = <T extends { dispose(): void }>(x: T) => (this.disposables.push(x), x);
    const sph = d(new THREE.SphereGeometry(1, 24, 16));
    const white = d(new THREE.MeshStandardMaterial({ color: '#f6f7fb', roughness: 0.35, metalness: 0.1 }));
    const orange = d(new THREE.MeshStandardMaterial({ color: '#ff8a1f', roughness: 0.4 }));
    const visor = d(new THREE.MeshStandardMaterial({ color: '#141a2e', roughness: 0.15, metalness: 0.4 }));
    const glow = d(new THREE.MeshBasicMaterial({ color: '#5ff3ff' }));

    const body = new THREE.Mesh(sph, white);
    body.scale.set(0.42, 0.38, 0.4);
    body.castShadow = true;
    const belly = new THREE.Mesh(sph, orange);
    belly.scale.set(0.3, 0.12, 0.3);
    belly.position.y = -0.2;
    const head = new THREE.Mesh(sph, white);
    head.scale.set(0.34, 0.28, 0.32);
    head.position.y = 0.5;
    head.castShadow = true;
    const face = new THREE.Mesh(sph, visor);
    face.scale.set(0.27, 0.19, 0.12);
    face.position.set(0, 0.5, 0.23);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(sph, glow);
      eye.scale.set(0.05, 0.07, 0.02);
      eye.position.set(s * 0.1, 0.52, 0.345);
      this.eyes.push(eye);
    }
    const antenna = new THREE.Mesh(d(new THREE.CylinderGeometry(0.015, 0.015, 0.25)), white);
    antenna.position.y = 0.88;
    const bulb = new THREE.Mesh(sph, d(new THREE.MeshBasicMaterial({ color: '#ff5470' })));
    bulb.scale.setScalar(0.06);
    bulb.position.y = 1.02;

    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      const upper = new THREE.Mesh(d(new THREE.CapsuleGeometry(0.06, 0.3, 4, 10)), orange);
      upper.position.y = -0.2;
      const hand = new THREE.Mesh(sph, white);
      hand.scale.setScalar(0.09);
      hand.position.y = -0.4;
      arm.add(upper, hand);
      arm.position.set(s * 0.42, 0.1, 0);
      arm.rotation.z = s * 0.3;
    }

    this.flame = new THREE.Mesh(
      d(new THREE.ConeGeometry(0.16, 0.45, 12)),
      d(new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85 })),
    );
    this.flame.rotation.x = Math.PI;
    this.flame.position.y = -0.55;

    this.bot.add(body, belly, head, face, ...this.eyes, antenna, bulb, this.armL, this.armR, this.flame);
    this.bot.scale.setScalar(1.1);

    this.shadow = new THREE.Mesh(
      d(new THREE.PlaneGeometry(1, 1)),
      d(new THREE.MeshBasicMaterial({ map: d(blobTexture()), transparent: true, depthWrite: false })),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;

    this.root.add(this.bot, this.shadow);
    this.root.position.z = -RUNNER.coachAhead;
  }

  /** A happy spin, e.g. after a perfect move. */
  cheer(): void {
    if (this.spin <= 0) this.spin = 1;
  }

  update(dt: number, distance: number, speed: number, beats: Beat[], nextIndex: number): void {
    this.t += dt;
    const coachDistance = distance + RUNNER.coachAhead;
    let hop = 0;
    let squash = 0;
    let arms = 0;
    let targetLane: Lane | null = null;

    for (let i = Math.max(0, nextIndex - 2); i < beats.length; i++) {
      const b = beats[i];
      const tc = (b.distance - coachDistance) / speed; // seconds until the coach reaches it
      if (tc > 2) break;
      const near = Math.abs(tc);
      if (b.kind === 'jump' && near < 0.4) hop = Math.max(hop, 1 - (tc / 0.4) ** 2);
      if (b.kind === 'duck' && near < 0.45) squash = Math.max(squash, 1 - near / 0.45);
      if (b.kind === 'reach' && near < 0.55) arms = Math.max(arms, 1 - near / 0.55);
      if (b.kind === 'lane' && tc > -0.3 && targetLane === null) targetLane = b.lane;
    }
    if (targetLane !== null) this.lane += (targetLane - this.lane) * Math.min(1, dt * 6);

    const bob = Math.sin(this.t * 6) * 0.06;
    this.root.position.x = this.lane * RUNNER.laneWidth;
    this.bot.position.y = 1.0 + bob + hop * 1.3 - squash * 0.55;
    this.bot.scale.set(1.1 + squash * 0.15, 1.1 - squash * 0.35, 1.1);

    // Arms: swing while "running", raise for reach, flail on hop.
    const swing = Math.sin(this.t * 10) * 0.5;
    const raise = Math.max(arms, hop * 0.7) * 2.6;
    this.armL.rotation.set(swing * (1 - arms), 0, -0.3 - raise);
    this.armR.rotation.set(-swing * (1 - arms), 0, 0.3 + raise);

    // Blink.
    const blink = this.t % 3.2 < 0.12 ? 0.15 : 1;
    for (const e of this.eyes) e.scale.y = 0.07 * blink;

    this.flame.scale.set(1, 0.8 + Math.random() * 0.4 + hop * 0.8, 1);

    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 1.6);
      this.bot.rotation.y = (1 - this.spin) * Math.PI * 2;
    } else {
      this.bot.rotation.y = 0;
    }

    const s = 0.9 / (1 + (this.bot.position.y - 1) * 0.5);
    this.shadow.scale.set(s, s, 1);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
