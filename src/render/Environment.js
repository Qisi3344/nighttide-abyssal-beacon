import * as THREE from 'three';
import { RNG } from '../core/RNG.js';
import { WORLD } from '../data/WorldData.js';

/** 淹没设施与结构:残骸船/断裂管道/废墟塔群/中央穹顶/信标塔/散石。全部程序化建模。 */
export class Environment {
  constructor(terrain) {
    this.terrain = terrain;
    this.rng = new RNG(4242);
    this.group = new THREE.Group();
    this.beaconViews = new Map(); // id → { crystal, light, shaft, rings, baseY }
    this._mats = this._makeMaterials();
    this._build();
  }

  _makeMaterials() {
    return {
      rust: new THREE.MeshStandardMaterial({ color: 0x51616b, roughness: 0.88, metalness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2b3844, roughness: 0.8, metalness: 0.7 }),
      glow: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x35f0ff, emissiveIntensity: 2.4, roughness: 0.4 }),
      warm: new THREE.MeshStandardMaterial({ color: 0x3a2f22, emissive: 0xffb35c, emissiveIntensity: 0.9, roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide }),
      crystal: new THREE.MeshStandardMaterial({ color: 0x123c48, emissive: 0x35f0ff, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.1, flatShading: true }),
    };
  }

  _build() {
    this._buildWreck();
    this._buildPipes();
    this._buildRuins();
    this._buildCoreDome();
    this._buildBeacons();
    this._buildTerminals();
    this._buildRubble();
    this._buildGodRays();
  }

  /** 档案终端:小立柱+琥珀屏,调查后熄灭 */
  _buildTerminals() {
    this.terminalViews = new Map();
    for (const t of WORLD.terminals) {
      const g = new THREE.Group();
      const y = this.terrain.heightAt(t.x, t.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 8), this._mats.dark);
      post.position.set(t.x, y + 0.8, t.z);
      post.castShadow = true;
      g.add(post);
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x33220e, emissive: 0xffb35c, emissiveIntensity: 1.6, roughness: 0.4 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.12), screenMat);
      screen.position.set(t.x, y + 1.5, t.z);
      screen.rotation.y = Math.PI * 0.25;
      g.add(screen);
      const glow = new THREE.PointLight(0xffb35c, 0.5, 6, 2);
      glow.position.set(t.x, y + 1.6, t.z);
      g.add(glow);
      this.group.add(g);
      this.terminalViews.set(t.id, { def: t, group: g, screenMat, glow, read: false });
    }
  }

  /** 南口残骸船:扭曲舱段,故事的起点 */
  _buildWreck() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x46545e, roughness: 0.9, metalness: 0.5 });
    const addBox = (w, h, d, x, y, z, ry, rz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || hull);
      m.position.set(x, y, z);
      m.rotation.y = ry || 0; m.rotation.z = rz || 0;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    // 侧躺的主船体(半埋进沙)
    addBox(26, 7, 8, 6, WORLD.seabedBase + 3.2, 138, 0.3, 1.35);
    addBox(14, 5.5, 7, -12, WORLD.seabedBase + 2.4, 126, -0.4, 1.5);
    addBox(9, 4, 6, 20, WORLD.seabedBase + 1.8, 126, 0.9, 1.2);
    // 断口框架(发光条)
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6.5), this._mats.glow);
      s.position.set(6 + Math.cos(i * 1.7) * 3, WORLD.seabedBase + 3 + i * 0.9, 134.5);
      g.add(s);
    }
    // 散落的箱子
    const rng = this.rng;
    for (let i = 0; i < 10; i++) {
      addBox(1.6, 1.1, 1.2, rng.range(-24, 24), 0, rng.range(118, 148), rng.range(0, 3), rng.range(-0.4, 0.4));
      g.children[g.children.length - 1].position.y = this.terrain.heightAt(g.children[g.children.length - 1].position.x, g.children[g.children.length - 1].position.z) + 0.6;
    }
    this.group.add(g);
  }

  /** 东区断裂管道:三根大管沿曲线,断口喷光 */
  _buildPipes() {
    const g = new THREE.Group();
    const specs = [
      { pts: [[150, 4, -90], [120, 2, -60], [86, 1, -36], [60, 3, -8]], r: 1.6 },
      { pts: [[128, 8, -20], [104, 3, -34], [76, 1.5, -58], [52, 5, -92]], r: 1.1 },
      { pts: [[70, 2, 20], [86, 1, -6], [98, 4, -30], [88, 6, -64]], r: 0.8 },
    ];
    for (const s of specs) {
      const curvePts = s.pts.map(([x, y, z]) => new THREE.Vector3(x, WORLD.seabedBase + y, z));
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, s.r, 10, false), this._mats.rust);
      tube.castShadow = true; tube.receiveShadow = true;
      g.add(tube);
      // 管箍
      for (let t = 0.15; t < 1; t += 0.22) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r + 0.18, 0.14, 8, 20), this._mats.dark);
        const p = curve.getPointAt(t);
        ring.position.copy(p);
        ring.lookAt(curve.getPointAt(Math.min(t + 0.01, 1)));
        g.add(ring);
      }
      // 断口光
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.85, s.r * 0.85, 0.4, 12), this._mats.glow);
      const end = curve.getPointAt(1);
      mouth.position.copy(end);
      mouth.rotation.z = Math.PI / 2;
      mouth.lookAt(end.clone().add(curve.getTangentAt(1)));
      g.add(mouth);
    }
    this.group.add(g);
  }

  /** 北区废墟塔群:倾斜的断楼 */
  _buildRuins() {
    const g = new THREE.Group();
    const rng = new RNG(777);
    const spots = [[-30, -110], [4, -128], [-52, -96], [30, -122], [58, -98], [-78, -118], [18, -92]];
    for (const [sx, sz] of spots) {
      const baseY = this.terrain.heightAt(sx, sz);
      const h = rng.range(10, 26);
      const lean = rng.range(-0.16, 0.16);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(rng.range(4, 7), h, rng.range(4, 7)), this._mats.rust);
      tower.position.set(sx, baseY + h / 2 - 1.5, sz);
      tower.rotation.set(lean, rng.range(0, 3), lean * 0.7);
      tower.castShadow = true; tower.receiveShadow = true;
      g.add(tower);
      // 塔身窗光条
      for (let i = 1; i < 4; i++) {
        if (rng.next() < 0.55) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), rng.next() < 0.3 ? this._mats.warm : this._mats.glow);
          strip.position.set(sx + Math.sin(lean) * (h / 2), baseY + (h / 4) * i, sz + 2.4);
          g.add(strip);
        }
      }
    }
    this.group.add(g);
  }

  /** 中央穹顶:目标地。三信标点亮前内核暗淡,点亮后苏醒。 */
  _buildCoreDome() {
    const g = new THREE.Group();
    const { x, y, z } = WORLD.core;
    // 外层线框球
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 1),
      new THREE.MeshBasicMaterial({ color: 0x2a6b7d, wireframe: true, transparent: true, opacity: 0.5 }));
    wire.position.set(x, y + 13, z);
    g.add(wire);
    // 玻璃内壳
    const shell = new THREE.Mesh(new THREE.SphereGeometry(12.2, 32, 24), this._mats.glass);
    shell.position.set(x, y + 13, z);
    g.add(shell);
    // 周围立柱环
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * 16, pz = z + Math.sin(a) * 16;
      const py = this.terrain.heightAt(px, pz);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 9, 8), this._mats.dark);
      col.position.set(px, py + 4, pz);
      col.castShadow = true;
      g.add(col);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), this._mats.crystal);
      tip.position.set(px, py + 8.8, pz);
      g.add(tip);
    }
    // 核心:悬浮大晶簇(视图激活时点亮)
    this.coreCrystal = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), this._mats.crystal.clone());
    this.coreCrystal.position.set(x, y + 13, z);
    g.add(this.coreCrystal);
    this.coreGlow = new THREE.PointLight(0x35f0ff, 0, 46, 1.6);
    this.coreGlow.position.copy(this.coreCrystal.position);
    g.add(this.coreGlow);
    this.coreWire = wire;
    this.group.add(g);
  }

  /** 三座信标塔 */
  _buildBeacons() {
    for (const b of WORLD.beacons) {
      const g = new THREE.Group();
      const py = this.terrain.heightAt(b.x, b.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 1.2, 12), this._mats.dark);
      base.position.set(b.x, py + 0.6, b.z);
      base.receiveShadow = true; base.castShadow = true;
      g.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 12, 8), this._mats.rust);
      pole.position.set(b.x, py + 6.4, b.z);
      pole.castShadow = true;
      g.add(pole);
      // 三环(点亮时旋转发光)
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6 - i * 0.35, 0.1, 8, 28), this._mats.crystal.clone());
        ring.position.set(b.x, py + 11 + i * 1.1, b.z);
        ring.rotation.x = Math.PI / 2 + i * 0.2;
        g.add(ring);
        rings.push(ring);
      }
      // 顶晶簇
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), this._mats.crystal.clone());
      crystal.position.set(b.x, py + 13.4, b.z);
      g.add(crystal);
      // 点亮后才加入的灯与光柱
      const light = new THREE.PointLight(0x35f0ff, 0, 42, 1.5);
      light.position.copy(crystal.position);
      g.add(light);
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 3.2, 60, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x66f6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
      );
      shaft.position.set(b.x, py + 40, b.z);
      g.add(shaft);
      // 未点亮时的极暗引导微束(远处可辨"这里有个目标")
      const hint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.9, 46, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x2e7d8f, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
      );
      hint.position.set(b.x, py + 30, b.z);
      g.add(hint);
      this.group.add(g);
      this.beaconViews.set(b.id, { def: b, group: g, crystal, rings, light, shaft, hint, baseY: py, lit: false, pulse: this.rng.range(0, 6) });
    }
  }

  /** 散落碎石(实例化) */
  _buildRubble() {
    const geo = new THREE.DodecahedronGeometry(0.8, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x33424d, roughness: 0.95 });
    const count = 150;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const rng = new RNG(31337);
    for (let i = 0; i < count; i++) {
      const x = rng.range(-160, 160), z = rng.range(-160, 160);
      p.set(x, this.terrain.heightAt(x, z) + rng.range(0.1, 0.5), z);
      q.setFromEuler(new THREE.Euler(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3)));
      const sc = rng.range(0.4, 2.2);
      s.set(sc, sc * 0.7, sc);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = true; inst.receiveShadow = true;
    this.group.add(inst);
  }

  /** 从上方斜插的天光(加性混合锥,营造"来自海面的残光"纵深) */
  _buildGodRays() {
    this.godRays = [];
    const rng = new RNG(606);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2e7d8f, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.CylinderGeometry(0.4, 5.5, 90, 8, 1, true);
      const shaft = new THREE.Mesh(geo, mat.clone());
      shaft.material.opacity = rng.range(0.03, 0.075);
      const x = rng.range(-130, 130), z = rng.range(-130, 130);
      shaft.position.set(x, 30, z);
      shaft.rotation.set(rng.range(-0.12, 0.12), 0, rng.range(-0.3, 0.3));
      this.group.add(shaft);
      this.godRays.push(shaft);
    }
  }

  setBeaconLit(id, lit) {
    const v = this.beaconViews.get(id);
    if (!v || v.lit === lit) return;
    v.lit = lit;
    v.crystal.material.emissiveIntensity = lit ? 3.2 : 0.35;
    v.light.intensity = lit ? 3.2 : 0;
    v.shaft.material.opacity = lit ? 0.16 : 0;
    v.hint.material.opacity = lit ? 0 : 0.06; // 点亮后引导微束功成身退
    for (const r of v.rings) r.material.emissiveIntensity = lit ? 2.2 : 0.35;
  }

  setCoreAwake(awake) {
    this.coreAwake = awake;
    this.coreCrystal.material.emissiveIntensity = awake ? 3.8 : 0.3;
    this.coreGlow.intensity = awake ? 4.5 : 0;
  }

  update(dt, t) {
    // 信标环与晶簇动画
    for (const v of this.beaconViews.values()) {
      v.pulse += dt;
      v.crystal.rotation.y += dt * (v.lit ? 1.6 : 0.25);
      v.crystal.position.y = v.baseY + 13.4 + Math.sin(v.pulse * 1.4) * 0.25;
      if (v.lit) {
        v.rings.forEach((r, i) => { r.rotation.z += dt * (0.6 + i * 0.3); });
        v.light.intensity = 3.2 + Math.sin(t * 2.1 + v.pulse) * 0.5;
      }
    }
    // 核心呼吸
    this.coreCrystal.rotation.y += dt * (this.coreAwake ? 1.2 : 0.15);
    this.coreCrystal.rotation.x += dt * 0.1;
    if (this.coreAwake) {
      this.coreGlow.intensity = 4.5 + Math.sin(t * 3.0) * 1.1;
      this.coreWire.rotation.y += dt * 0.2;
    }
    // 天光微摆
    for (const s of this.godRays) s.rotation.z += Math.sin(t * 0.13 + s.position.x) * dt * 0.01;
  }
}
