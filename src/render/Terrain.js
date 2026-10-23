import * as THREE from 'three';
import { RNG } from '../core/RNG.js';
import { WORLD } from '../data/WorldData.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * 程序化海沟地形:中央洼地 + 边缘山壁 + 三大功能区局部压平。
 * heightAt 是解析函数,mesh 顶点与碰撞检测共用同一实现,保证视觉=物理。
 */
export class Terrain {
  constructor(seed = 20261024) {
    this.rng = new RNG(seed);
    this.mesh = this._buildMesh();
  }

  /** 世界任意点的海底高度(解析) */
  heightAt(x, z) {
    const base = WORLD.seabedBase;
    let h = base + (this.rng.fbm(x * 0.012 + 7.3, z * 0.012 + 2.1, 4) - 0.5) * 9.0;
    h += (this.rng.fbm(x * 0.045, z * 0.045, 3) - 0.5) * 2.2; // 细节

    // 边缘山壁:距中心超过 150 后急速抬升,围出海沟
    const r = Math.hypot(x, z);
    h += smoothstep(150, 205, r) * 34;

    // 核心穹顶区:压平
    const rCore = Math.hypot(x - WORLD.core.x, z - WORLD.core.z);
    const coreFlat = 1 - smoothstep(WORLD.core.radius * 0.9, WORLD.core.radius * 1.7, rCore);
    h = h * (1 - coreFlat) + (base + 1.5) * coreFlat;

    // 各信标周围缓平(可落脚)
    for (const b of WORLD.beacons) {
      const rb = Math.hypot(x - b.x, z - b.z);
      const flat = 1 - smoothstep(8, 22, rb);
      h = h * (1 - flat * 0.75) + (base + 1.2) * flat * 0.75;
    }
    // 出生点缓平
    const rs = Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z);
    const spawnFlat = 1 - smoothstep(6, 18, rs);
    h = h * (1 - spawnFlat * 0.8) + (base + 1.0) * spawnFlat * 0.8;
    return h;
  }

  _buildMesh() {
    const size = WORLD.size, segs = 188;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const sandDeep = new THREE.Color(0x1e3d4e);
    const sandMid = new THREE.Color(0x2a5468);
    const rock = new THREE.Color(0x12303e);
    const algae = new THREE.Color(0x12707f);

    const rng = new RNG(991);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);

      const slope = Math.abs(this.heightAt(x + 1.5, z) - this.heightAt(x - 1.5, z))
        + Math.abs(this.heightAt(x, z + 1.5) - this.heightAt(x, z - 1.5));
      const c = sandDeep.clone().lerp(sandMid, clamp01((h - WORLD.seabedBase) / 8));
      c.lerp(rock, clamp01(slope * 0.55));
      if (rng.fbm(x * 0.05 + 3, z * 0.05 + 8, 3) > 0.62) c.lerp(algae, 0.55); // 荧光藻斑
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
