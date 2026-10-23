import * as THREE from 'three';
import { WORLD } from '../data/WorldData.js';
import { PredatorBrain, PredatorMode } from '../sim/PredatorBrain.js';
import { PredatorModel } from '../render/PredatorModel.js';

/**
 * 玩法视图组装:光晶/信标修复(按住E引导)/核心唤醒/掠食者实体驱动/氧区检测。
 * 交互规则:
 *  - 光晶:靠近 <2.4m 磁吸收集
 *  - 信标:距 <4.5m 且光晶足够时按住 E 3s 修复;不够则提示缺口
 *  - 核心:三信标齐后距 <7m 按住 E 3s 唤醒 → 胜利
 */
const BEACON_REPAIR_TIME = 3.0;
const CORE_AWAKEN_TIME = 3.0;

export class Gameplay {
  constructor(scene, terrain, env, particles, bus, objectives, oxygen) {
    this.scene = scene;
    this.terrain = terrain;
    this.env = env;
    this.particles = particles;
    this.bus = bus;
    this.objectives = objectives;
    this.oxygen = oxygen;

    this.crystalViews = [];
    this.holdProgress = 0;
    this.holdTarget = null; // {kind:'beacon'|'core', id}
    this.coreProgress = 0;
    this.nearby = null;     // 当前最近可交互对象描述
    this._t = 0;

    this._buildCrystals();
    this._buildPredator();
    this.reset();
  }

  _buildCrystals() {
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0e4a58, emissive: 0x35f0ff, emissiveIntensity: 1.9, roughness: 0.2, flatShading: true });
    const haloGeo = new THREE.SphereGeometry(1.1, 10, 8);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x35f0ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const def of WORLD.crystals) {
      this._addCrystal(def, geo, mat, haloGeo, haloMat, false);
    }
    // 隐藏彩蛋:黑潮之心(品红,稍大)
    const secretMat = new THREE.MeshStandardMaterial({ color: 0x48102c, emissive: 0xff3fae, emissiveIntensity: 2.4, roughness: 0.2, flatShading: true });
    const secretHalo = new THREE.MeshBasicMaterial({ color: 0xff3fae, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    this._addCrystal(WORLD.secretCrystal, new THREE.OctahedronGeometry(0.8, 0), secretMat, haloGeo, secretHalo, true);
  }

  _addCrystal(def, geo, mat, haloGeo, haloMat, secret) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const halo = new THREE.Mesh(haloGeo, haloMat);
    g.add(mesh, halo);
    const groundY = this.terrain.heightAt(def.x, def.z);
    g.position.set(def.x, Math.max(def.y, groundY + 1.2), def.z);
    this.scene.add(g);
    this.crystalViews.push({ group: g, mesh, taken: false, phase: Math.random() * 7, bubbleTimer: Math.random() * 2, secret });
  }

  _buildPredator() {
    this.predatorModel = new PredatorModel();
    this.scene.add(this.predatorModel.group);
    this.brain = new PredatorBrain(
      (t, p) => this.bus.emit(t, p),
      WORLD.predatorWaypoints.map(w => ({ ...w })),
    );
    this.predSpeed = 0;
    this.predatorReady = true;
  }

  reset() {
    for (const c of this.crystalViews) {
      c.taken = false;
      c.group.visible = true;
    }
    this.brain.reset();
    this.holdProgress = 0;
    this.coreProgress = 0;
    this.nearby = null;
    if (this.predatorModel) {
      const wp = WORLD.predatorWaypoints[0];
      this.predatorModel.reset(new THREE.Vector3(wp.x, wp.y, wp.z));
    }
    for (const b of WORLD.beacons) this.env.setBeaconLit(b.id, false);
    this.env.setCoreAwake(false);
  }

  /** 每帧玩法逻辑。playerLight 供 AI 感知。 */
  update(dt, player, input, camForward) {
    this._t += dt;
    const t = this._t;
    const pos = player.position;

    // ---- 光晶动画与收集 ----
    let magnetHint = null;
    for (const c of this.crystalViews) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 1.4;
      c.mesh.position.y = Math.sin(t * 1.6 + c.phase) * 0.18;
      const d = c.group.position.distanceTo(pos);
      if (d < 2.4) {
        c.taken = true;
        c.group.visible = false;
        if (c.secret) {
          this.bus.emit('game:secret-found', {});
        } else {
          this.objectives.onCrystalCollected();
          this.bus.emit('sfx:pickup', {});
        }
      } else if (d < 6) {
        magnetHint = c;
        c.group.position.lerp(new THREE.Vector3(pos.x, c.group.position.y, pos.z), dt * 0.06); // 远程微磁吸引导
      }
      // 晶体冒泡
      c.bubbleTimer -= dt;
      if (c.bubbleTimer <= 0) {
        c.bubbleTimer = 1.4 + Math.random() * 2;
        this.particles.spawnBubbles(c.group.position.x, c.group.position.y, c.group.position.z, 1, 0.2);
      }
    }

    // ---- 氧区 ----
    let inOxygen = false;
    for (const p of WORLD.oxygenPlants) {
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < 6) { inOxygen = true; break; }
    }
    this.oxygen.setInRefillZone(inOxygen);

    // ---- 交互目标发现 ----
    this.nearby = null;
    let holdActive = false;
    for (const b of WORLD.beacons) {
      if (this.env.beaconViews.get(b.id).lit) continue;
      const d = Math.hypot(pos.x - b.x, pos.z - b.z);
      if (d < 4.5) {
        const have = this.objectives.crystals;
        if (have >= b.crystals) this.nearby = { kind: 'beacon', id: b.id, label: `按住 E 修复「${b.name}」`, key: 'KeyE' };
        else this.nearby = { kind: 'info', label: `「${b.name}」需要 ${b.crystals} 枚光晶(现有 ${have})` };
        break;
      }
    }
    if (!this.nearby && this.objectives.coreUnlocked && !this.objectives.complete) {
      const d = Math.hypot(pos.x - WORLD.core.x, pos.z - WORLD.core.z);
      if (d < 9) this.nearby = { kind: 'core', label: '按住 E 唤醒设施核心', key: 'KeyE' };
    }

    // ---- 按住 E 推进 ----
    const holding = this.nearby && this.nearby.kind !== 'info' && input.keys.has('KeyE');
    if (holding) {
      holdActive = true;
      const dur = this.nearby.kind === 'beacon' ? BEACON_REPAIR_TIME : CORE_AWAKEN_TIME;
      this.holdProgress += dt / dur;
      this.holdTarget = this.nearby;
      if (this.holdProgress % 0.25 < dt / dur) this.bus.emit('sfx:repair-tick', {});
      if (this.holdProgress >= 1) {
        if (this.nearby.kind === 'beacon') {
          if (this.objectives.trySpendForBeacon()) {
            this.env.setBeaconLit(this.nearby.id, true);
            this.bus.emit('sfx:beacon', {});
            this.bus.emit('game:beacon-lit', { id: this.nearby.id });
          }
        } else if (this.objectives.onCoreActivated()) {
          this.env.setCoreAwake(true);
          this.bus.emit('sfx:victory', {});
        }
        this.holdProgress = 0;
        this.holdTarget = null;
      }
    } else {
      this.holdProgress = Math.max(0, this.holdProgress - dt * 1.6);
      if (this.holdProgress === 0) this.holdTarget = null;
    }

    // ---- 掠食者驱动 ----
    if (this.predatorReady) {
      const model = this.predatorModel;
      const playerLight = player.sprinting ? 1.0 : (player.speed > 1.2 ? 0.5 : 0.18);
      const beaconsLit = WORLD.beacons
        .filter(b => this.env.beaconViews.get(b.id).lit)
        .map(b => ({ x: b.x, y: b.baseY, z: b.z, radius: 30 }));
      const pPos = model.group.position;
      const facing = model._lastFacing || { x: 0, z: 1 };
      this.brain.update(dt, {
        pos: { x: pPos.x, y: pPos.y, z: pPos.z },
        facing,
        playerPos: { x: pos.x, y: pos.y, z: pos.z },
        playerLight, playerSpeed: player.speed, sprinting: player.sprinting,
        beacons: beaconsLit,
      });
      const speedMap = { [PredatorMode.PATROL]: 3.0, [PredatorMode.INVESTIGATE]: 4.4, [PredatorMode.CHASE]: 7.4, [PredatorMode.LUNGE]: 12.5, [PredatorMode.RETREAT]: 5.8 };
      // 终局狂暴:三信标齐后守卫提速(压迫终局节奏)
      const rage = this.objectives.coreUnlocked ? 1.28 : 1.0;
      const target = this.brain.target || WORLD.predatorWaypoints[0];
      model._lastFacing = model.update(dt, new THREE.Vector3(target.x, target.y, target.z), (speedMap[this.brain.mode] || 3) * rage, this.brain.dangerLevel);
      // 游动气泡
      if (Math.random() < dt * 2.2) {
        this.particles.spawnBubbles(pPos.x, pPos.y + 0.5, pPos.z, 1, 0.6);
      }
    }

    return { holding, holdActive, inOxygen };
  }

  /** 被咬处理(main 挂接) */
  onBite(player, cameraRig) {
    const ok = this.oxygen.bite();
    cameraRig.shake(0.5);
    this.bus.emit('game:bitten', {});
    return ok;
  }
}
