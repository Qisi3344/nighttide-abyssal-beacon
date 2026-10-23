import * as THREE from 'three';

/**
 * 深渊守卫:程序化巨型鳗。头部+14 节身体链+背鳍+尾鳍,
 * 节链跟随(每节向前节收敛)产生蛇形游动,身体正弦侧摆由 shader 相位完成。
 * 发光眼(品红)= 危险信号,与青色信标光形成敌我色彩语言。
 */
const SEG_COUNT = 14;
const UP = new THREE.Vector3(0, 1, 0);
const _m4 = new THREE.Matrix4();

export class PredatorModel {
  constructor(eyeColor = 0xff3fae) {
    this.group = new THREE.Group();
    this.head = new THREE.Group();
    this.group.add(this.head);
    this.segments = [];
    this._phase = 0;
    this._build(eyeColor);
  }

  _build(eyeColor) {
    const skin = new THREE.MeshStandardMaterial({ color: 0x121a24, roughness: 0.6, metalness: 0.3 });
    const spots = new THREE.MeshStandardMaterial({ color: 0x1a0a14, emissive: eyeColor, emissiveIntensity: 2.0, roughness: 0.4 });

    // 头:锥形吻 + 上下颚(可张合)+ 双眼
    const skull = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 10), skin);
    skull.rotation.x = Math.PI / 2; // 指向 +Z
    skull.castShadow = true;
    this.head.add(skull);
    this.jawTop = new THREE.Group();
    this.jawBottom = new THREE.Group();
    this.jawTop.position.set(0, 0.18, 0.6);
    this.jawBottom.position.set(0, -0.18, 0.6);
    for (const [jaw, dir] of [[this.jawTop, 1], [this.jawBottom, -1]]) {
      const jawMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 6), skin);
      jawMesh.rotation.x = Math.PI / 2;
      jawMesh.position.z = 0.9;
      jaw.add(jawMesh);
      // 牙
      for (let i = 0; i < 4; i++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4),
          new THREE.MeshStandardMaterial({ color: 0xdfe8ec, roughness: 0.3 }));
        tooth.position.set(-0.3 + i * 0.2, dir * 0.32, 0.4 + i * 0.25);
        tooth.rotation.x = -dir * Math.PI / 2 * 0.9;
        jaw.add(tooth);
      }
      this.head.add(jaw);
    }
    // 眼
    const eyeGeo = new THREE.SphereGeometry(0.16, 8, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, spots);
      eye.position.set(side * 0.55, 0.28, 0.75);
      this.head.add(eye);
    }
    this.eyeGlow = new THREE.PointLight(eyeColor, 1.4, 14, 1.8);
    this.eyeGlow.position.set(0, 0.3, 0.8);
    this.head.add(this.eyeGlow);

    // 身体节链:半径渐细
    for (let i = 0; i < SEG_COUNT; i++) {
      const t = i / (SEG_COUNT - 1);
      const r = 0.85 * (1 - t * 0.72);
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), skin);
      seg.castShadow = true;
      const segGroup = new THREE.Group();
      segGroup.add(seg);
      // 背部荧光斑(越靠尾越少)
      if (i % 2 === 0 && i < SEG_COUNT - 3) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 6, 6), spots);
        dot.position.y = r * 0.85;
        segGroup.add(dot);
      }
      // 背鳍/尾鳍
      if (i >= SEG_COUNT - 3) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5 * (1 - t) + 0.2, 1.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.8, transparent: true, opacity: 0.85 }));
        fin.position.y = 0.5;
        fin.rotation.x = -0.4;
        segGroup.add(fin);
      }
      // 侧鳍(前段两节,锥形压扁,游动时随波动轻摆)
      if (i === 2 || i === 3) {
        for (const side of [-1, 1]) {
          const pectoral = new THREE.Mesh(new THREE.ConeGeometry(0.34, r * 2.2, 4),
            new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 0.7, transparent: true, opacity: 0.9 }));
          pectoral.scale.z = 0.3;
          pectoral.rotation.z = side * (Math.PI / 2) - side * 0.5;
          pectoral.position.set(side * r * 0.9, -r * 0.15, 0.3);
          segGroup.add(pectoral);
          (this._pectoralFins = this._pectoralFins || []).push({ mesh: pectoral, side });
        }
      }
      this.group.add(segGroup);
      this.segments.push({ group: segGroup, radius: r });
    }
    this._segSpacing = 1.35;
  }

  reset(pos) {
    this.group.position.copy(pos);
    this.head.position.set(0, 0, 0);
    let zOff = -this._segSpacing;
    for (const s of this.segments) {
      s.group.position.set(0, 0, zOff);
      zOff -= this._segSpacing;
    }
  }

  /**
   * 每帧移动:朝 target 游动。wagSpeed 控制摆频,agitation 控制张颚/眼亮度。
   * 返回实际朝向(供决策脑做视锥判定)。
   */
  update(dt, target, speed, agitation) {
    this._phase += dt * (2.2 + speed * 0.55);
    const headPos = this.head.getWorldPosition(new THREE.Vector3());

    // 头部朝目标转向(平滑)
    const dir = new THREE.Vector3().subVectors(target, headPos);
    // 头部朝目标转向(平滑,注意角度环绕)
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dy = yaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * 2.4);
    this.group.rotation.x += (pitch - this.group.rotation.x) * Math.min(1, dt * 2.0);

    // 前进(沿自身 +Z)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
    this.group.position.addScaledVector(forward, speed * dt);
    // 侧摆推进:身体正弦
    const sway = Math.sin(this._phase) * (0.25 + speed * 0.08);
    this.group.rotation.z = sway * 0.25;

    // 节链跟随:每节以阻尼方式收敛到前一节后方(急转弯时身体拉成弧线,避免折线穿插)
    let prevPos = this.head.getWorldPosition(new THREE.Vector3());
    let prevDir = forward.clone();
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      const segPos = s.group.getWorldPosition(new THREE.Vector3());
      const toPrev = new THREE.Vector3().subVectors(prevPos, segPos);
      const dist = toPrev.length();
      if (dist > this._segSpacing) {
        const dirN = toPrev.clone().normalize();
        // 收敛量阻尼:单帧最多吃掉超额距离的 55%,弯曲自然传递
        const overshoot = dist - this._segSpacing;
        segPos.addScaledVector(dirN, overshoot * 0.55);
        // 带正弦偏移,产生波动传递
        const wave = Math.sin(this._phase - i * 0.8) * 0.35;
        const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dirN).normalize();
        segPos.addScaledVector(side, wave * dt * speed * 0.4);
        // 世界坐标回写(节节点挂在外层 group 下,逆变换回本地)
        const local = this.group.worldToLocal(segPos.clone());
        s.group.position.copy(local);
        const lookTarget = this.group.localToWorld(prevPos.clone());
        // 平滑朝向:限制单帧转角,避免急转时节段硬折
        const desired = new THREE.Quaternion();
        _m4.lookAt(s.group.getWorldPosition(new THREE.Vector3()), lookTarget, UP);
        desired.setFromRotationMatrix(_m4);
        s.group.quaternion.slerp(desired, Math.min(1, dt * 7));
      }
      prevPos = segPos;
      prevDir = toPrev;
    }

    // 张颚与眼亮度
    const jawOpen = agitation * 0.55;
    this.jawTop.rotation.x = -jawOpen;
    this.jawBottom.rotation.x = jawOpen;
    this.eyeGlow.intensity = 1.0 + agitation * 2.2;

    // 侧鳍随身体波动轻摆
    if (this._pectoralFins) {
      for (const f of this._pectoralFins) {
        f.mesh.rotation.x = Math.sin(this._phase * 0.9 + f.side) * 0.35;
      }
    }

    return { x: forward.x, z: forward.z };
  }
}
