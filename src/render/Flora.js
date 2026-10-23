import * as THREE from 'three';
import { RNG } from '../core/RNG.js';
import { WORLD } from '../data/WorldData.js';

/** 生物荧光植被:荧光蘑菇(西区密林)/氧藻丛(回氧交互点)/灯笼水母/摇曳海草。 */
export class Flora {
  constructor(terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.jellies = [];
    this.oxygenBalls = [];
    this._buildMushrooms();
    this._buildOxygenPlants();
    this._buildJellies();
    this._buildKelp();
  }

  _buildMushrooms() {
    const rng = new RNG(881);
    const capGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    // 伞盖径向渐变顶点色:顶部亮 → 伞缘暗,一次烘进 geometry(实例共享)
    {
      const pos = capGeo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const bright = { r: 1.0, g: 1.0, b: 1.0 };   // 乘在材质色上的倍增
      const dim = { r: 0.45, g: 0.5, b: 0.55 };
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i); // 0(伞缘) ~ 1(顶)
        const t = Math.max(0, y);
        colors[i * 3] = dim.r + (bright.r - dim.r) * t;
        colors[i * 3 + 1] = dim.g + (bright.g - dim.g) * t;
        colors[i * 3 + 2] = dim.b + (bright.b - dim.b) * t;
      }
      capGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0b3a40, emissive: 0x2fe8c8, emissiveIntensity: 1.15, roughness: 0.5, vertexColors: true });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a4a52, roughness: 0.9 });
    const COUNT = 200;
    const caps = new THREE.InstancedMesh(capGeo, capMat, COUNT);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const grove = { x: WORLD.beacons[0].x, z: WORLD.beacons[0].z };
    let placed = 0, guard = 0;
    while (placed < COUNT && guard++ < 4000) {
      // 75% 密集在林谷核心,25% 散全图
      let x, z;
      if (rng.next() < 0.75) {
        const a = rng.range(0, Math.PI * 2), r = 3 + Math.pow(rng.next(), 0.7) * 34;
        x = grove.x + Math.cos(a) * r; z = grove.z + Math.sin(a) * r;
      } else { x = rng.range(-150, 150); z = rng.range(-150, 150); }
      const h = Math.hypot(x - WORLD.core.x, z - WORLD.core.z);
      if (h < 22) continue;
      const ground = this.terrain.heightAt(x, z);
      const scale = rng.range(0.9, 4.0);
      q.setFromEuler(new THREE.Euler(rng.range(-0.15, 0.15), rng.range(0, 3), rng.range(-0.15, 0.15)));
      p.set(x, ground + scale * 0.9, z); s.set(scale, scale, scale);
      m.compose(p, q, s); stems.setMatrixAt(placed, m);
      p.set(x, ground + scale * 1.7, z);
      m.compose(p, q, s); caps.setMatrixAt(placed, m);
      placed++;
    }
    caps.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    this.group.add(caps, stems);
  }

  _buildOxygenPlants() {
    const rng = new RNG(202);
    for (const def of WORLD.oxygenPlants) {
      const g = new THREE.Group();
      const y = this.terrain.heightAt(def.x, def.z);
      const mat = new THREE.MeshStandardMaterial({ color: 0x0e4a1e, emissive: 0x52ff7a, emissiveIntensity: 1.5, roughness: 0.6 });
      for (let i = 0; i < 6; i++) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.35, 0.7), 10, 8), mat);
        const a = rng.range(0, Math.PI * 2), r = rng.range(0.3, 1.6);
        ball.position.set(Math.cos(a) * r, rng.range(0.4, 2.2), Math.sin(a) * r);
        g.add(ball);
      }
      g.position.set(def.x, y, def.z);
      g.userData.def = def;
      this.group.add(g);
      this.oxygenBalls.push({ group: g, baseY: y, phase: rng.range(0, 6) });
    }
  }

  _buildJellies() {
    const rng = new RNG(1201);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const hue = rng.next() < 0.5 ? 0x66d9ff : 0xff7ad9;
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7),
        new THREE.MeshStandardMaterial({ color: 0x0a1420, emissive: hue, emissiveIntensity: 1.4, transparent: true, opacity: 0.85, roughness: 0.3, side: THREE.DoubleSide })
      );
      g.add(bell);
      const tentMat = new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.35 });
      for (let t = 0; t < 6; t++) {
        const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 3.2, 4), tentMat);
        const a = (t / 6) * Math.PI * 2;
        tent.position.set(Math.cos(a) * 0.7, -1.8, Math.sin(a) * 0.7);
        g.add(tent);
      }
      const light = new THREE.PointLight(hue, 0.6, 12, 1.8);
      g.add(light);
      g.position.set(rng.range(-130, 130), rng.range(-2, 16), rng.range(-130, 130));
      this.group.add(g);
      this.jellies.push({ g, phase: rng.range(0, 9), drift: new THREE.Vector3(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)) });
    }
  }

  _buildKelp() {
    const rng = new RNG(5501);
    const geo = new THREE.PlaneGeometry(0.9, 7, 1, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x14424a, emissive: 0x0f5560, emissiveIntensity: 0.35, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    // 顶点色从根到梢渐亮,配合 wind uniform 摇摆
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this._kelpTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float swayPhase = position.y * 0.35 + float(gl_VertexID) * 0.0;
          transformed.x += sin(uTime * 0.8 + swayPhase + instanceMatrix[3][0] * 0.3) * position.y * 0.12;
          transformed.z += cos(uTime * 0.6 + swayPhase * 1.3) * position.y * 0.09;
        `);
    };
    const COUNT = 220;
    const inst = new THREE.InstancedMesh(geo, mat, COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let placed = 0, guard = 0;
    while (placed < COUNT && guard++ < 3000) {
      const x = rng.range(-160, 160), z = rng.range(-160, 160);
      if (Math.hypot(x - WORLD.core.x, z - WORLD.core.z) < 24) continue;
      const ground = this.terrain.heightAt(x, z);
      if (ground > WORLD.seabedBase + 8) continue; // 崖壁上不长
      q.setFromEuler(new THREE.Euler(0, rng.range(0, 3), 0));
      const sc = rng.range(0.6, 1.7);
      s.set(sc, sc * rng.range(0.8, 1.5), sc);
      p.set(x, ground + 3.2 * s.y, z);
      m.compose(p, q, s);
      inst.setMatrixAt(placed, m);
      placed++;
    }
    inst.instanceMatrix.needsUpdate = true;
    this.kelpTimeUniform = null;
    this.group.add(inst);
  }

  update(dt, t) {
    if (this._kelpTime) this._kelpTime.value = t;
    for (const j of this.jellies) {
      j.phase += dt;
      j.g.position.addScaledVector(j.drift, dt);
      if (j.g.position.length() > 190) j.drift.negate();
      j.g.position.y += Math.sin(j.phase * 0.7) * dt * 0.3;
      const bell = j.g.children[0];
      bell.scale.set(1 + Math.sin(j.phase * 2.2) * 0.12, 1 - Math.sin(j.phase * 2.2) * 0.18, 1 + Math.sin(j.phase * 2.2) * 0.12);
    }
    for (const o of this.oxygenBalls) {
      o.group.position.y = o.baseY + Math.sin(t * 1.2 + o.phase) * 0.15;
    }
  }
}
