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
    const x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const z = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const y = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('KeyC') ? 1 : 0);
    return { x, y, z };
  }

  get sprinting() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
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
}
