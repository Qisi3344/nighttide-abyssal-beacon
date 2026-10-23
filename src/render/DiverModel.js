import * as THREE from 'three';

/**
 * 程序化深潜者模型:潜水服 + 玻璃头盔 + 双氧气瓶 + 头灯。
 * 无外部骨骼,手臂/腿部用程序化游泳摆动驱动(频率随速度),呼吸气泡由 Particles 承接。
 */
export class DiverModel {
  constructor() {
    this.group = new THREE.Group();
    this.speed01 = 0;       // 0..1 归一化速度,驱动动画
    this.sprint01 = 0;
    this._phase = 0;
    this._build();
  }

  _build() {
    const suit = new THREE.MeshStandardMaterial({ color: 0x27343f, roughness: 0.7, metalness: 0.2 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x35f0ff, emissiveIntensity: 1.6, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x88c9dd, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x5a6a74, roughness: 0.5, metalness: 0.8 });

    // 躯干(略前倾的胶囊)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 6, 12), suit);
    torso.rotation.x = Math.PI / 2; // 面朝 -Z? 统一:模型面朝 +Z
    torso.castShadow = true;
    this.torso = new THREE.Group();
    this.torso.add(torso);
    this.group.add(this.torso);

    // 胸口指示灯条
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.5), accent);
    chest.position.set(0, 0.18, 0.12);
    this.torso.add(chest);

    // 头盔
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), glass);
    helmet.position.set(0, 0.14, 0.62);
    this.torso.add(helmet);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 8, 20), metal);
    rim.position.copy(helmet.position);
    rim.rotation.x = Math.PI / 2 - 0.35;
    this.torso.add(rim);
    // 头盔内小脸灯
    const face = new THREE.PointLight(0xffd9a0, 0.5, 3.2, 2);
    face.position.set(0, 0.14, 0.6);
    this.torso.add(face);

    // 背部氧气瓶 x2
    for (const side of [-0.16, 0.16]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), metal);
      tank.rotation.x = Math.PI / 2;
      tank.position.set(side, 0.16, -0.42);
      this.torso.add(tank);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), accent);
      cap.position.set(side, 0.16, -0.68);
      this.torso.add(cap);
    }

    // 四肢:肩/髋挂点,两段式(上臂+前臂简化为单段胶囊+手蹼)
    const limbMat = suit;
    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.42, 0.16, 0.32);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.62, 4, 8), limbMat);
      arm.rotation.x = Math.PI / 2;
      arm.position.z = 0.42;
      arm.castShadow = true;
      armPivot.add(arm);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.24), accent);
      fin.position.z = 0.82;
      armPivot.add(fin);
      this.torso.add(armPivot);
      this.arms.push(armPivot);

      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.18, 0, -0.48);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.66, 4, 8), limbMat);
      leg.rotation.x = Math.PI / 2;
      leg.position.z = -0.46;
      leg.castShadow = true;
      legPivot.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.3), accent);
      foot.position.z = -0.9;
      legPivot.add(foot);
      this.torso.add(legPivot);
      this.legs.push(legPivot);
    }

    // 头灯(SpotLight):模型面朝 +Z,灯照向前方
    this.headlamp = new THREE.SpotLight(0xcfeaff, 0, 40, 0.52, 0.45, 1.3);
    this.headlamp.position.set(0, 0.2, 0.78);
    this.headlampTarget = new THREE.Object3D();
    this.headlampTarget.position.set(0, 0, 8);
    this.torso.add(this.headlamp, this.headlampTarget);
    this.headlamp.target = this.headlampTarget;
    this.headlamp.castShadow = true;
    this.headlamp.shadow.mapSize.set(1024, 1024);
    this.headlamp.shadow.camera.near = 0.5;
    this.headlamp.shadow.camera.far = 40;
  }

  setLampIntensity(v) { this.headlamp.intensity = v; }

  /** 每帧驱动程序动画:双臂交替划水,双腿打水,速度越快摆越快;turnBank 为转向侧倾(-1..1) */
  update(dt, turnBank = 0, hurtT = 0) {
    const move = Math.max(this.speed01, this.sprint01 * 0.2);
    this._phase += dt * (2.0 + move * 7.5);
    const swing = 0.35 + move * 1.05;
    // 手臂交替
    this.arms[0].rotation.x = Math.sin(this._phase) * swing - 0.35;
    this.arms[1].rotation.x = Math.sin(this._phase + Math.PI) * swing - 0.35;
    this.arms.forEach((a, i) => { a.rotation.y = Math.sin(this._phase * 0.5 + i) * 0.12; });
    // 双腿同相打水(海豚腿)
    const legSwing = Math.sin(this._phase + Math.PI * 0.5) * (0.28 + move * 0.75);
    this.legs[0].rotation.x = legSwing;
    this.legs[1].rotation.x = legSwing;
    // 躯干轻微起伏 + 转向侧倾(banking)
    this.torso.position.y = Math.sin(this._phase * 0.5) * 0.06;
    this.torso.rotation.x = -move * 0.18; // 游起来身体前倾
    this.torso.rotation.z = THREE.MathUtils.clamp(-turnBank * 0.5, -0.4, 0.4);
    // 受击痉挛
    if (hurtT > 0) {
      this.torso.position.x = Math.sin(hurtT * 60) * 0.12 * hurtT;
    } else {
      this.torso.position.x = 0;
    }
  }
}
