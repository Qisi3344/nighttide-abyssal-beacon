import * as THREE from 'three';
import { RNG } from '../core/RNG.js';

/**
 * 粒子系统:悬浮微尘(GPU 漂移)+ 气泡池(CPU 复用)。
 * 微尘用 ShaderMaterial 在 GPU 里做圆周漂移,零每帧 CPU 开销。
 */
const MOTE_VERT = `
  attribute float aSeed;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * (0.05 + aSeed * 0.1);
    p.x += sin(t * 6.28 + aSeed * 40.0) * 2.5;
    p.y += sin(t * 4.0 + aSeed * 80.0) * 1.5;
    p.z += cos(t * 5.0 + aSeed * 60.0) * 2.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = smoothstep(90.0, 20.0, -mv.z);
    gl_PointSize = (1.5 + aSeed * 3.0) * (30.0 / max(-mv.z, 1.0));
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float a = (1.0 - smoothstep(0.15, 0.5, d)) * vAlpha * 0.5;
    gl_FragColor = vec4(uColor, a);
  }`;

const SPORE_VERT = `
  attribute float aSeed;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float cycle = 48.0;
    float t = mod(uTime * (0.25 + aSeed * 0.35) + aSeed * cycle, cycle);
    p.y = mod(position.y + 14.0 + t, 48.0) - 14.0; // 从原高度出发循环上飘
    p.x += sin(uTime * 0.3 + aSeed * 50.0) * 1.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = smoothstep(80.0, 15.0, -mv.z);
    gl_PointSize = (2.0 + aSeed * 3.5) * (30.0 / max(-mv.z, 1.0));
    gl_Position = projectionMatrix * mv;
  }`;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this._buildMotes();
    this._buildBubbles();
  }

  _buildMotes() {
    const COUNT = 1400;
    const rng = new RNG(90210);
    const pos = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = rng.range(-180, 180);
      pos[i * 3 + 1] = rng.range(-16, 30);
      pos[i * 3 + 2] = rng.range(-180, 180);
      seeds[i] = rng.next();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.moteUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7de8ff) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.moteUniforms,
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);

    // 上升孢子:缓慢上飘的青色光点,把垂直水体串起来
    const SPORE_COUNT = 320;
    const spos = new Float32Array(SPORE_COUNT * 3);
    const sseeds = new Float32Array(SPORE_COUNT);
    for (let i = 0; i < SPORE_COUNT; i++) {
      spos[i * 3] = rng.range(-160, 160);
      spos[i * 3 + 1] = rng.range(-14, 34);
      spos[i * 3 + 2] = rng.range(-160, 160);
      sseeds[i] = rng.next();
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    sgeo.setAttribute('aSeed', new THREE.BufferAttribute(sseeds, 1));
    this.sporeUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x9fffe8) } };
    const smat = new THREE.ShaderMaterial({
      uniforms: this.sporeUniforms,
      vertexShader: SPORE_VERT, fragmentShader: MOTE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.spores = new THREE.Points(sgeo, smat);
    this.spores.frustumCulled = false;
    this.scene.add(this.spores);
  }

  _buildBubbles() {
    const MAX = 260;
    this.bubbleMax = MAX;
    const geo = new THREE.BufferGeometry();
    this.bubblePos = new Float32Array(MAX * 3);
    this.bubbleVel = new Float32Array(MAX * 3);
    this.bubbleLife = new Float32Array(MAX); // 0 = 空槽
    geo.setAttribute('position', new THREE.BufferAttribute(this.bubblePos, 3));
    geo.setDrawRange(0, MAX);
    const mat = new THREE.PointsMaterial({
      color: 0x9fe8ff, size: 0.22, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.bubbles = new THREE.Points(geo, mat);
    this.bubbles.frustumCulled = false;
    this._cursor = 0;
    this.scene.add(this.bubbles);
  }

  spawnBubbles(x, y, z, count = 5, spread = 0.4) {
    for (let i = 0; i < count; i++) {
      const idx = this._cursor = (this._cursor + 1) % this.bubbleMax;
      this.bubblePos[idx * 3] = x + (Math.random() - 0.5) * spread * 2;
      this.bubblePos[idx * 3 + 1] = y + (Math.random() - 0.5) * spread;
      this.bubblePos[idx * 3 + 2] = z + (Math.random() - 0.5) * spread * 2;
      this.bubbleVel[idx * 3] = (Math.random() - 0.5) * 0.3;
      this.bubbleVel[idx * 3 + 1] = 1.0 + Math.random() * 0.8;
      this.bubbleVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.3;
      this.bubbleLife[idx] = 3.5 + Math.random() * 2.5;
    }
  }

  update(dt, t) {
    this.moteUniforms.uTime.value = t;
    this.sporeUniforms.uTime.value = t;
    for (let i = 0; i < this.bubbleMax; i++) {
      if (this.bubbleLife[i] <= 0) { this.bubblePos[i * 3 + 1] = -9999; continue; }
      this.bubbleLife[i] -= dt;
      this.bubblePos[i * 3] += this.bubbleVel[i * 3] * dt;
      this.bubblePos[i * 3 + 1] += this.bubbleVel[i * 3 + 1] * dt;
      this.bubblePos[i * 3 + 2] += this.bubbleVel[i * 3 + 2] * dt;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }
}
