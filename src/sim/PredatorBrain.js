/**
 * 深渊守卫(巨型鳗)决策脑(纯逻辑,不碰渲染)。
 * 视图每帧喂入感知,决策脑输出意图状态与目标点,视图负责实际游动/动画/音效。
 *
 * 设计要点:光与声音是你的暴露源。灯越亮、移动越猛,感知距离越远;
 * 信标点亮范围是它不敢进入的避光区。
 */
export const PredatorMode = Object.freeze({
  PATROL: 'PATROL',         // 沿巢穴航点巡游
  INVESTIGATE: 'INVESTIGATE', // 被远处的光晕/声响吸引,前往查看
  CHASE: 'CHASE',           // 锁定目标追击
  LUNGE: 'LUNGE',           // 近距离猛扑(咬击判定窗口)
  RETREAT: 'RETREAT',       // 被光灼退/咬后撤离
});

const CFG = {
  baseSenseRange: 17,       // 基础感知半径(m)
  lightSenseBonus: 26,      // 目标满灯时感知半径增量
  stillSenseRange: 6.5,     // 目标静止(近似)时的感知半径
  fovCos: Math.cos((135 / 2) * Math.PI / 180), // 前方 135° 锥
  noiseRange: 42,           // 冲刺噪音传播距离
  lungeRange: 3.0,          // 扑咬距离
  lungeDuration: 0.55,      // 扑咬时长
  biteCooldown: 2.6,        // 两次扑咬最小间隔
  retreatDuration: 4.2,     // 撤退时长
  investigateGiveUp: 9.0,   // 调查无果放弃
  chaseGiveUp: 11.0,        // 追丢放弃
  loseSenseRange: 30,       // 追击中丢失目标的距离阈值(比感知远,咬住不放)
};

function dist2d(ax, ay, az, bx, by, bz) {
  const dx = ax - bx, dy = ay - by, dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class PredatorBrain {
  constructor(emit, homeWaypoints, cfg = CFG) {
    this.emit = emit || (() => {});
    this.cfg = cfg;
    this.waypoints = homeWaypoints; // [{x,y,z}]
    this.reset();
  }

  reset() {
    this.mode = PredatorMode.PATROL;
    this.wpIndex = 0;
    this.target = null;          // {x,y,z} 意向目标点
    this.chaseTarget = null;     // 追击中的玩家位置快照
    this.timer = 0;              // 状态内计时
    this._wasChasing = false;
  }

  /** 感知输入: { pos, facing:{x,z}, playerPos:{x,y,z}, playerLight(0..1), playerSpeed, sprinting, beacons:[{x,y,z,radius}] } */
  update(dt, perception) {
    const { pos, facing, playerPos, playerLight, playerSpeed, sprinting, beacons } = perception;
    this.timer += dt;
    this._facing = facing;
    this._beacons = beacons;

    // --- 全局规则:扑咬冷却与状态计时 ---
    if (this.biteCd === undefined) this.biteCd = 0;
    this.biteCd = Math.max(0, this.biteCd - dt);

    const d = dist2d(pos.x, pos.y, pos.z, playerPos.x, playerPos.y, playerPos.z);
    const playerInLight = beacons.some(b => dist2d(playerPos.x, playerPos.y, playerPos.z, b.x, b.y, b.z) < b.radius);

    // --- 感知判定 ---
    let senseRange = this.cfg.stillSenseRange + this.cfg.lightSenseBonus * playerLight;
    if (playerSpeed > 1.2) senseRange = this.cfg.baseSenseRange + this.cfg.lightSenseBonus * playerLight;
    const inFov = this._inCone(pos, facing, playerPos);
    const canSee = d < senseRange && inFov && !playerInLight;

    // --- 状态机 ---
    switch (this.mode) {
      case PredatorMode.PATROL: {
        if (sprinting && d < this.cfg.noiseRange) return this._enter(PredatorMode.INVESTIGATE, playerPos);
        if (canSee) return this._enter(PredatorMode.CHASE, playerPos);
        this.target = this.waypoints[this.wpIndex % this.waypoints.length];
        if (dist2d(pos.x, pos.y, pos.z, this.target.x, this.target.y, this.target.z) < 4) this.wpIndex++;
        break;
      }
      case PredatorMode.INVESTIGATE: {
        if (canSee) return this._enter(PredatorMode.CHASE, playerPos);
        if (sprinting && d < this.cfg.noiseRange) { this.timer = 0; this.target = { ...playerPos }; break; }
        if (this.timer > this.cfg.investigateGiveUp) return this._enter(PredatorMode.PATROL);
        break;
      }
      case PredatorMode.CHASE: {
        if (playerInLight || d > this.cfg.loseSenseRange) {
          return this._enter(PredatorMode.RETREAT);
        }
        if (!canSee && !sprinting) {
          if (this.timer > this.cfg.chaseGiveUp) return this._enter(PredatorMode.INVESTIGATE, this.chaseTarget);
        } else {
          this.timer = 0;
        }
        this.chaseTarget = { ...playerPos };
        this.target = { ...playerPos };
        if (d < this.cfg.lungeRange && this.biteCd <= 0) return this._enter(PredatorMode.LUNGE, playerPos);
        break;
      }
      case PredatorMode.LUNGE: {
        this.target = this.chaseTarget ? { ...this.chaseTarget } : { ...playerPos };
        if (this.timer >= this.cfg.lungeDuration) {
          this.biteCd = this.cfg.biteCooldown;
          this.emit('predator:bite', { pos: { ...pos } });
          return this._enter(PredatorMode.RETREAT);
        }
        break;
      }
      case PredatorMode.RETREAT: {
        if (this.timer >= this.cfg.retreatDuration) return this._enter(PredatorMode.PATROL);
        // 撤向离玩家最远的航点
        let best = this.waypoints[0], bestD = -1;
        for (const wp of this.waypoints) {
          const wd = dist2d(wp.x, wp.y, wp.z, playerPos.x, playerPos.y, playerPos.z);
          if (wd > bestD) { bestD = wd; best = wp; }
        }
        this.target = { ...best };
        break;
      }
      default: break;
    }
    return this.mode;
  }

  _enter(mode, at) {
    if (mode === PredatorMode.CHASE && !this._wasChasing) {
      this.emit('predator:spotted', {});
      this._wasChasing = true;
    }
    if (mode !== PredatorMode.CHASE && mode !== PredatorMode.LUNGE) this._wasChasing = false;
    this.mode = mode;
    this.timer = 0;
    if (at) this.target = { ...at };
    this.emit('predator:mode', { mode });
    return mode;
  }

  _inCone(pos, facing, p) {
    if (!facing) return true; // 无朝向数据时视为全向(保守)
    const fx = facing.x, fz = facing.z;
    const len = Math.hypot(fx, fz) || 1;
    const dx = (p.x - pos.x), dz = (p.z - pos.z);
    const dLen = Math.hypot(dx, dz) || 1;
    const cos = (dx / dLen) * (fx / len) + (dz / dLen) * (fz / len);
    return cos > this.cfg.fovCos;
  }

  get dangerLevel() {
    switch (this.mode) {
      case PredatorMode.LUNGE: return 1.0;
      case PredatorMode.CHASE: return 0.75;
      case PredatorMode.INVESTIGATE: return 0.35;
      default: return 0;
    }
  }
}
