/** 轻量事件总线:解耦 SIM 逻辑层与 VIEW 渲染层/UI 层。 */
export class EventBus {
  constructor() { this.map = new Map(); }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.map.get(type).delete(fn);
  }

  emit(type, payload) {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (err) { console.error(`[EventBus] handler for "${type}" threw:`, err); }
    }
  }

  clear() { this.map.clear(); }
}

export const bus = new EventBus();
