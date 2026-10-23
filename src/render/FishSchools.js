import * as THREE from 'three';
import { RNG } from '../core/RNG.js';

/** 鱼群(boids 简化版):围绕锚点游动的发光小鱼群,增强深海生命感。 */
const FISH_VERT = `
  uniform float uTime;
  attribute float aPhase;
  varying float vShade;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 8.0 + aPhase) * 0.06; // 尾摆
    vShade = 0.5 + 0.5 * sin(uTime * 8.0 + aPhase);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FISH_FRAG = `
  uniform vec3 uColorA; uniform vec3 uColorB;
  varying float vShade;
  void main() { gl_FragColor = vec4(mix(uColorA, uColorB, vShade), 1.0); }`;

export class FishSchools {
  constructor(terrain) {
    this.terrain = terrain;
    this.schools = [];
    const rng = new RNG(777001);
    const spots = [
      { x: -95, z: 20, r: 26 }, { x: 90, z: -35, r: 30 },
      { x: 0, z: -110, r: 28 }, { x: -20, z: 110, r: 24 }, { x: 0, z: 30, r: 34 },
    ];
    for (const s of spots) {
      this._makeSchool(rng, s.x, s.z, s.r, rng.int(26, 42));
    }
  }

  _makeSchool(rng, cx, cz, radius, count) {
    const geo = new THREE.ConeGeometry(0.09, 0.42, 4);
    geo.rotateX(Math.PI / 2);
    const phases = new Float32Array(count);
    const colors = [
      [new THREE.Color(0x2fb8d9), new THREE.Color(0x9ff0ff)],
      [new THREE.Color(0xd96fb8), new THREE.Color(0xffc2ea)],
      [new THREE.Color(0x6fd98a), new THREE.Color(0xc2ffdd)],
    ][rng.int(0, 2)];
    const uniforms = {
      uTime: { value: 0 },
      uColorA: { value: colors[0] }, uColorB: { value: colors[1] },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: FISH_VERT, fragmentShader: FISH_FRAG });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const state = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      phases[i] = rng.range(0, 20);
      const heading = rng.range(0, Math.PI * 2);
      state.push({
        pos: new THREE.Vector3(cx + rng.range(-8, 8), rng.range(-8, 2), cz + rng.range(-8, 8)),
        heading,
        speed: rng.range(2.2, 3.6),
        wobble: rng.range(0.5, 2.5),
      });
      p.copy(state[i].pos);
      q.setFromEuler(new THREE.Euler(0, heading, 0));
      m.compose(p, q, sc);
      inst.setMatrixAt(i, m);
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    this.schools.push({ inst, state, cx, cz, radius, uniforms, rng, m, q, sc, p, dummyE: new THREE.Euler() });
    return inst;
  }

  get group() {
    if (!this._group) {
      this._group = new THREE.Group();
      for (const s of this.schools) this._group.add(s.inst);
    }
    return this._group;
  }

  update(dt, t) {
    for (const s of this.schools) {
      s.uniforms.uTime.value = t;
      for (const f of s.state) {
        // 绕锚点漫游 + 个体噪声转向
        f.heading += (Math.sin(t * 0.5 + f.wobble * 9.1) + Math.sin(t * 0.23 + f.wobble * 4.7)) * dt * 0.6;
        const toCenterX = s.cx - f.pos.x, toCenterZ = s.cz - f.pos.z;
        const dc = Math.hypot(toCenterX, toCenterZ);
        if (dc > s.radius) {
          const want = Math.atan2(toCenterX, toCenterZ);
          f.heading += Math.sin(want - f.heading) * dt * 1.6;
        }
        f.pos.x += Math.sin(f.heading) * f.speed * dt;
        f.pos.z += Math.cos(f.heading) * f.speed * dt;
        const ground = this.terrain.heightAt(f.pos.x, f.pos.z);
        if (f.pos.y < ground + 1.5) f.pos.y += dt * 2;
        if (f.pos.y > 14) f.pos.y -= dt * 1.5;
      }
      const inst = s.inst;
      for (let i = 0; i < s.state.length; i++) {
        const f = s.state[i];
        s.p.copy(f.pos);
        s.dummyE.set(0, f.heading, Math.sin(t * 3 + f.wobble) * 0.15);
        s.q.setFromEuler(s.dummyE);
        s.m.compose(s.p, s.q, s.sc);
        inst.setMatrixAt(i, s.m);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  }
}
