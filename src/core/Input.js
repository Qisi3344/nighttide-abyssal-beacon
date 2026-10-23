/** 键鼠输入:WASD 游动 / Space 上浮 / C 下潜 / Shift 冲刺 / E 交互 / Esc 暂停。鼠标走 PointerLock。 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.interactPressed = false;   // 边沿触发,由游戏循环消费
    this.pointerLocked = false;
    this._onKey = (e) => {
      const code = e.code;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(code)) {
        e.preventDefault();
      }
      if (code === 'KeyE' && e.type === 'keydown' && !e.repeat) this.interactPressed = true;
      if (e.type === 'keydown') this.keys.add(code); else this.keys.delete(code);
    };
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    };
    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      if (!this.pointerLocked) this.keys.clear();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
    window.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  detach() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
    window.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }

  requestLock() {
    try {
      const p = this.dom.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* 无手势/不支持时静默,游戏仍可用键盘玩 */ }
  }
  releaseLock() { if (this.pointerLocked) document.exitPointerLock?.(); }

  axis() {
    const kx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const ky = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('KeyC') ? 1 : 0);
    const kz = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const g = this._gp || { x: 0, y: 0, z: 0 };
    const mix = (a, b) => Math.max(-1, Math.min(1, a + b));
    return { x: mix(kx, g.x), y: mix(ky, g.y), z: mix(kz, g.z) };
  }

  get sprinting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Boolean(this._gp?.sprint);
  }

  /** 手柄轮询:左摇杆移动 + 扳机浮沉 + A 交互 + B/RT 冲刺 */
  pollGamepad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(Boolean);
    if (!pad) { this._gp = null; return; }
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
    const rise = (pad.buttons[7]?.value || 0) - (pad.buttons[6]?.value || 0); // RT 上浮 / LT 下潜
    this._gp = {
      x: dz(pad.axes[0] || 0),
      y: dz(rise),
      z: -dz(pad.axes[1] || 0),
      sprint: (pad.buttons[10]?.pressed) || (pad.buttons[1]?.pressed) || (pad.buttons[7]?.value > 0.85),
      lookX: dz(pad.axes[2] || 0),
      lookY: dz(pad.axes[3] || 0),
      interact: pad.buttons[0]?.pressed || false,
    };
    if (this._gp.interact && !this._gpInteractLatch) {
      this._gpInteractLatch = true;
      this.interactPressed = true;
    } else if (!this._gp.interact) {
      this._gpInteractLatch = false;
    }
  }

  /** 手柄右摇杆视角增量(dx,dy),无手柄时为 0 */
  gamepadLook() {
    if (!this._gp) return { dx: 0, dy: 0 };
    return { dx: this._gp.lookX * 14, dy: this._gp.lookY * 10 };
  }
  get anyMovement() { return this.axis().x !== 0 || this.axis().y !== 0 || this.axis().z !== 0; }

  consumeMouse() {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  /** 按住交互(键盘 E 或手柄 A) */
  get interactHeld() { return this.keys.has('KeyE') || Boolean(this._gp?.interact); }
}
