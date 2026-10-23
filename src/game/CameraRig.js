import * as THREE from 'three';

/** 第三人称相机:鼠标 yaw/pitch,阻尼跟随,不穿地。 */
export class CameraRig {
  constructor(camera, terrain) {
    this.camera = camera;
    this.terrain = terrain;
    this.yaw = Math.PI;
    this.pitch = -0.18;
    this.distance = 5.4;
    this.height = 1.4;
    this._pos = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this.sensitivity = 1.0;
    this.fovBoost = 0;
    this.entryT = 0; // >0 时用慢阻尼(入场俯冲)
  }

  /** 开启入场俯冲(慢阻尼 2.4 秒) */
  beginEntry() { this.entryT = 2.4; }

  consumeMouse(mouse) {
    this.yaw -= mouse.dx * 0.0022 * this.sensitivity;
    this.pitch -= mouse.dy * 0.0022 * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.25, 0.95);
  }

  update(dt, playerPos, sprinting) {
    const focus = this._lookTarget.copy(playerPos);
    focus.y += this.height;

    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const ideal = focus.clone().addScaledVector(dir, -this.distance);

    // 相机不钻地
    const ground = this.terrain.heightAt(ideal.x, ideal.z) + 0.6;
    if (ideal.y < ground) ideal.y = ground;
    ideal.y = Math.min(ideal.y, 40);

    // 入场期用慢阻尼(俯冲仪式感),之后恢复正常跟手
    const damping = this.entryT > 0 ? 2.2 : 9;
    if (this.entryT > 0) this.entryT -= dt;
    this._pos.lerp(ideal, 1 - Math.exp(-damping * dt));
    this.camera.position.copy(this._pos);
    this.camera.lookAt(focus);

    // 冲刺 FOV 反馈
    const targetBoost = sprinting ? 7 : 0;
    this.fovBoost += (targetBoost - this.fovBoost) * Math.min(1, dt * 4);
    this.camera.fov = 62 + this.fovBoost;
    this.camera.updateProjectionMatrix();
  }

  /** 抖动(受击/事件反馈) */
  shake(amount) {
    this.camera.position.x += (Math.random() - 0.5) * amount;
    this.camera.position.y += (Math.random() - 0.5) * amount;
  }
}
