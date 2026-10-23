import * as THREE from 'three';
import { DiverModel } from '../render/DiverModel.js';
import { WORLD } from '../data/WorldData.js';

/**
 * 玩家:水中六自由度游泳。
 * 加速度-阻尼模型(水感),地形/边界碰撞,面向速度方向,
 * 冲刺提速+头灯增亮(代价:氧气 + 暴露)。
 */
const ACCEL = 26;
const DRAG = 2.35;
const MAX_SPEED = 5.6;
const SPRINT_MULT = 1.72;
const PLAYER_RADIUS = 0.9;

export class Player {
  constructor(terrain) {
    this.terrain = terrain;
    this.model = new DiverModel();
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.speed01 = 0;
    this.sprinting = false;
    this.breathTimer = 0;
  }

  respawn() {
    this.position.set(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z);
    this.velocity.set(0, 0, 0);
    this.yaw = WORLD.spawn.yaw;
    this.model.group.position.copy(this.position);
    this.model.group.rotation.y = this.yaw;
  }

  get speed() { return this.velocity.length(); }

  update(dt, input, camYaw) {
    const axis = input.axis();
    this.sprinting = input.sprinting && (axis.x !== 0 || axis.y !== 0 || axis.z !== 0);

    // 相对相机朝向的加速度
    const fwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const accel = new THREE.Vector3()
      .addScaledVector(fwd, axis.z)
      .addScaledVector(right, axis.x);
    if (accel.lengthSq() > 1) accel.normalize();
    accel.y += axis.y * 0.9;
    const power = ACCEL * (this.sprinting ? SPRINT_MULT : 1);
    this.velocity.addScaledVector(accel, power * dt);

    // 水阻(指数)
    const drag = Math.exp(-DRAG * dt);
    this.velocity.multiplyScalar(drag);

    // 限速
    const vmax = MAX_SPEED * (this.sprinting ? SPRINT_MULT : 1);
    const sp = this.velocity.length();
    if (sp > vmax) this.velocity.multiplyScalar(vmax / sp);

    // 轻微正浮力(松手缓缓上飘,像真的在水里)
    this.velocity.y += 0.35 * dt;

    // 位移
    this.position.addScaledVector(this.velocity, dt);

    // --- 碰撞:地形/上界/边界 ---
    const ground = this.terrain.heightAt(this.position.x, this.position.z) + PLAYER_RADIUS;
    if (this.position.y < ground) {
      this.position.y = ground;
      if (this.velocity.y < 0) this.velocity.y *= -0.15;
    }
    if (this.position.y > WORLD.ceiling) {
      this.position.y = WORLD.ceiling;
      this.velocity.y = Math.min(this.velocity.y, 0);
    }
    const rEdge = Math.hypot(this.position.x, this.position.z);
    if (rEdge > 192) {
      const k = 192 / rEdge;
      this.position.x *= k; this.position.z *= k;
      this.velocity.x *= 0.4; this.velocity.z *= 0.4;
    }

    // --- 模型朝向与动画 ---
    const horiz = Math.hypot(this.velocity.x, this.velocity.z);
    if (horiz > 0.35) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      let dy = targetYaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 5.5);
    }
    this.model.group.position.copy(this.position);
    this.model.group.rotation.y = this.yaw;
    // 身体俯仰随垂直速度
    this.model.group.rotation.x = THREE.MathUtils.clamp(-this.velocity.y * 0.12, -0.6, 0.6);

    this.speed01 = Math.min(1, sp / (MAX_SPEED * SPRINT_MULT));
    this.model.speed01 = this.speed01;
    this.model.sprint01 = this.sprinting ? 1 : 0;
    this.model.setLampIntensity(this.sprinting ? 7.5 : 3.4);
    this.model.update(dt);
    if (this._aura) this._aura.position.copy(this.position);

    // 呼吸气泡
    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      this.breathTimer = this.sprinting ? 0.7 : 1.6;
      return true; // 提示外部生成气泡
    }
    return false;
  }

  /** 玩家随身微光:黑暗中让玩家与近旁环境可辨识(轮廓照明) */
  get auraLight() {
    if (!this._aura) {
      this._aura = new THREE.PointLight(0x7fdfff, 1.5, 11, 1.7);
    }
    this._aura.position.copy(this.position);
    return this._aura;
  }
}
