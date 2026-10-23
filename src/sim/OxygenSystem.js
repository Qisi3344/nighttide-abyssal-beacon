/**
 * 氧气系统(纯逻辑):氧气 = 生命。常态缓慢消耗,冲刺加速,被咬大量损失,氧藻旁回充。
 * 低于警戒线发警告事件,归零发死亡事件。
 */
export class OxygenSystem {
  constructor(emit, { max = 100, drainRate = 1.15, sprintDrainRate = 3.1, biteLoss = 26, regenRate = 9, lowThreshold = 25 } = {}) {
    this.emit = emit || (() => {});
    this.max = max;
    this.drainRate = drainRate;
    this.sprintDrainRate = sprintDrainRate;
    this.biteLoss = biteLoss;
    this.regenRate = regenRate;
    this.lowThreshold = lowThreshold;
    this.reset();
  }

  reset() {
    this.value = this.max;
    this._low = false;
    this._inRefillZone = false;
  }

  setInRefillZone(inZone) { this._inRefillZone = Boolean(inZone); }

  get ratio() { return this.value / this.max; }
  get low() { return this.value <= this.lowThreshold; }

  update(dt, sprinting) {
    if (this._inRefillZone) {
      this.value = Math.min(this.max, this.value + this.regenRate * dt);
    } else {
      const rate = sprinting ? this.sprintDrainRate : this.drainRate;
      this.value = Math.max(0, this.value - rate * dt);
    }

    if (this.low && !this._low) {
      this._low = true;
      this.emit('oxygen:low', { value: this.value });
    } else if (!this.low && this._low) {
      this._low = false;
      this.emit('oxygen:recovered', { value: this.value });
    }

    if (this.value <= 0) {
      this.emit('oxygen:depleted', {});
      return false; // 死亡
    }
    return true;
  }

  bite() {
    this.value = Math.max(0, this.value - this.biteLoss);
    this.emit('oxygen:bitten', { value: this.value, loss: this.biteLoss });
    return this.value > 0;
  }
}
