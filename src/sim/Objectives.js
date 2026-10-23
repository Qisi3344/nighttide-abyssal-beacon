/**
 * 任务系统(纯逻辑):阶段化目标推进,发事件供 HUD 更新。
 */
export const ObjectiveId = Object.freeze({
  CRYSTALS: 'crystals',
  BEACONS: 'beacons',
  CORE_UNLOCK: 'core-unlock',
  CORE_ACTIVATE: 'core-activate',
});

export class Objectives {
  constructor(emit, { beaconsTotal = 3, crystalsPerBeacon = 4 } = {}) {
    this.emit = emit || (() => {});
    this.beaconsTotal = beaconsTotal;
    this.crystalsPerBeacon = crystalsPerBeacon;
    this.reset();
  }

  reset() {
    this.crystals = 0;
    this.beaconsLit = 0;
    this.coreUnlocked = false;
    this.complete = false;
    this._emit();
  }

  onCrystalCollected() {
    this.crystals++;
    this._emit();
  }

  /** 尝试修复信标:消耗 crystalsPerBeacon 枚光晶。成功返回 true。 */
  trySpendForBeacon() {
    if (this.crystals < this.crystalsPerBeacon) return false;
    this.crystals -= this.crystalsPerBeacon;
    this.beaconsLit++;
    if (this.beaconsLit >= this.beaconsTotal && !this.coreUnlocked) {
      this.coreUnlocked = true;
      this.emit('objectives:core-unlocked', {});
    }
    this._emit();
    return true;
  }

  onCoreActivated() {
    if (!this.coreUnlocked || this.complete) return false;
    this.complete = true;
    this.emit('objectives:complete', {});
    this._emit();
    return true;
  }

  current() {
    if (this.complete) return { id: null, text: '信标全部点亮,核心已苏醒' };
    if (this.coreUnlocked) return { id: ObjectiveId.CORE_ACTIVATE, text: '进入中央穹顶,唤醒设施核心' };
    if (this.crystals >= this.crystalsPerBeacon) {
      return { id: ObjectiveId.BEACONS, text: `修复信标(${this.beaconsLit}/${this.beaconsTotal}) — 你已备好 ${this.crystalsPerBeacon} 枚光晶` };
    }
    const need = this.crystalsPerBeacon - this.crystals;
    return { id: ObjectiveId.CRYSTALS, text: `收集光晶,还差 ${need} 枚可修复信标(${this.beaconsLit}/${this.beaconsTotal})` };
  }

  snapshot() {
    return {
      crystals: this.crystals, beaconsLit: this.beaconsLit,
      beaconsTotal: this.beaconsTotal, coreUnlocked: this.coreUnlocked, complete: this.complete,
    };
  }

  _emit() {
    this.emit('objectives:changed', { current: this.current(), snapshot: this.snapshot() });
  }
}
