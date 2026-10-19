import * as THREE from 'three';

/**
 * Small shader helpers shared by the sceneries, obstacles and characters.
 * They patch the built-in materials (so lighting, fog and shadows keep
 * working) instead of replacing them with custom shaders.
 */

/** Meters of scenery before it repeats. */
export const LOOP = 220;
/** How far behind the player a looping object goes before it wraps to the front. */
export const LOOP_BEHIND = 20;

/** Keeps a looping object between LOOP meters ahead and LOOP_BEHIND meters behind the player. */
export function wrapZ(z: number): number {
  return ((((z - LOOP_BEHIND) % LOOP) + LOOP) % LOOP) - LOOP + LOOP_BEHIND;
}

const WRAP_GLSL = /* glsl */ `
  float wrapZ(float z) { return mod(z - ${LOOP_BEHIND.toFixed(1)}, ${LOOP.toFixed(1)}) - ${LOOP.toFixed(1)} + ${LOOP_BEHIND.toFixed(1)}; }
`;

/** Uniforms shared by everything that loops with the travelled distance. */
export interface ScrollUniforms {
  uScroll: { value: number };
  uTime: { value: number };
}

export function scrollUniforms(): ScrollUniforms {
  return { uScroll: { value: 0 }, uTime: { value: 0 } };
}

/**
 * Makes an InstancedMesh material loop its instances along z on the GPU:
 * every instance moves by the scroll distance and wraps around, so scrolling
 * the whole scenery costs one uniform update per frame instead of rewriting
 * thousands of matrices.
 */
export function scrollInstances<M extends THREE.Material>(mat: M, u: ScrollUniforms): M {
  if (mat.userData.scrolls) return mat; // already patched (shared material)
  mat.userData.scrolls = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uScroll = u.uScroll;
    shader.vertexShader =
      `uniform float uScroll;\n${WRAP_GLSL}\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        THREE.ShaderChunk.project_vertex.replace(
          'mvPosition = modelViewMatrix * mvPosition;',
          `#ifdef USE_INSTANCING
            float oz = instanceMatrix[3].z;
            mvPosition.z += wrapZ(oz + uScroll) - oz;
          #endif
          mvPosition = modelViewMatrix * mvPosition;`,
        ),
      );
  };
  const key = patchKey(mat, 'scroll');
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** A fresnel rim light added to the emissive term: bright edges that pop against dark backgrounds. */
export const rimUniforms = {
  rimColor: { value: new THREE.Color('#ffd7b8') },
  rimPower: { value: 2.6 },
};

export function addRim<M extends THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>(mat: M, strength = 1): M {
  const prev = mat.onBeforeCompile;
  const rimStrength = { value: strength };
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.rimColor = rimUniforms.rimColor;
    shader.uniforms.rimPower = rimUniforms.rimPower;
    shader.uniforms.rimStrength = rimStrength;
    shader.fragmentShader =
      'uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance += rimColor * rimStrength * pow(rimF, rimPower);`,
      );
  };
  const key = patchKey(mat, 'rim');
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Program cache key naming every patch applied to a material (patches can stack). */
export function patchKey(mat: THREE.Material, name: string): string {
  return (mat.userData.fxKey = `${mat.userData.fxKey ?? ''}|${name}`);
}

/** Soft round glow, white on transparent — tint it with the material color. */
export function glowTexture(size = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface GlowPoint {
  x: number;
  y: number;
  z: number;
  color: THREE.ColorRepresentation;
  /** Diameter in meters. */
  size: number;
}

export interface GlowCloudOptions {
  /** Sideways/vertical drift amplitude, meters. */
  drift?: number;
  /** 0 = steady, 1 = blinks fully. */
  twinkle?: number;
  /** Brightness multiplier (values above 1 feed the bloom). */
  intensity?: number;
  /** Fade out beyond this distance from the camera, meters. */
  fadeFar?: number;
}

/**
 * Many glowing dots (fireflies, lantern halos, glowing fruit…) in a single
 * draw call. Positions loop with the scroll distance and animate entirely in
 * the vertex shader — no per-frame CPU work.
 */
export class GlowCloud {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private total: number;

  constructor(items: GlowPoint[], u: ScrollUniforms, opts: GlowCloudOptions = {}) {
    const n = items.length;
    this.total = n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const c = new THREE.Color();
    items.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      c.set(p.color);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = p.size;
      phase[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    // Positions move in the shader; a generous bound keeps it from being culled.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uScroll: u.uScroll,
        uTime: u.uTime,
        uViewH: { value: 720 },
        uDrift: { value: opts.drift ?? 0 },
        uTwinkle: { value: opts.twinkle ?? 0 },
        uIntensity: { value: opts.intensity ?? 1.5 },
        uFadeFar: { value: opts.fadeFar ?? 140 },
      },
      vertexShader: /* glsl */ `
        ${WRAP_GLSL}
        uniform float uScroll, uTime, uViewH, uDrift, uTwinkle, uIntensity, uFadeFar;
        attribute vec3 color;
        attribute float size;
        attribute float phase;
        varying vec3 vColor;
        void main() {
          vec3 p = position;
          p.z = wrapZ(p.z + uScroll);
          float ph = phase * 6.2831;
          p.x += sin(uTime * 0.45 + ph) * uDrift;
          p.y += sin(uTime * 0.7 + ph * 2.0) * uDrift * 0.5;
          p.z += cos(uTime * 0.38 + ph * 3.0) * uDrift;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(-mv.z, 0.1);
          float blink = mix(1.0, smoothstep(-0.3, 1.0, sin(uTime * (1.3 + phase * 1.7) + ph * 7.0)), uTwinkle);
          // Fade out far away, and right in front of the camera where a glow would fill the screen.
          float fade = (1.0 - smoothstep(uFadeFar * 0.6, uFadeFar, d)) * smoothstep(1.5, 5.0, d);
          // Keep far dots at least a couple of pixels wide (and dimmer) so they shimmer instead of
          // vanishing; cap near ones to bound the fill cost.
          float px = size * projectionMatrix[1][1] * uViewH * 0.5 / d;
          gl_PointSize = clamp(px, 2.0, uViewH * 0.25);
          vColor = color * uIntensity * blink * fade * min(1.0, px / 2.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-r * r * 5.0) * 0.55 + exp(-r * r * 40.0);
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /** Draw only a fraction of the points (quality scaling). */
  setDetail(fraction: number): void {
    this.points.geometry.setDrawRange(0, Math.round(this.total * THREE.MathUtils.clamp(fraction, 0, 1)));
  }

  setViewHeight(px: number): void {
    this.material.uniforms.uViewH.value = px;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** Multiplies a geometry's UVs, e.g. to repeat a texture along a long box. */
export function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
