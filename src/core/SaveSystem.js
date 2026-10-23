/** 本地存档:设置项 + 最佳战绩(localStorage)。密钥错误/不存在时安静回退默认值。 */
const KEY = 'nighttide.save.v1';

export const DEFAULT_SETTINGS = {
  master: 0.8, sfx: 0.9, ambient: 0.7,
  sensitivity: 1.0, quality: 'high', // 'high' | 'low'
};

export class SaveSystem {
  constructor(storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  loadSettings() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const data = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  saveSettings(settings) {
    const data = { settings };
    try { this.storage?.setItem(KEY, JSON.stringify(data)); } catch { /* 隐私模式等:忽略 */ }
  }

  loadBest() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw).best || null;
    } catch { return null; }
  }

  saveBest(run) {
    const prev = this.loadBest();
    const durationMs = run.durationMs ?? (run.endTime && run.startTime ? run.endTime - run.startTime : Infinity);
    const better = !prev || durationMs < prev.durationMs;
    if (!better) return prev;
    const best = { durationMs, crystals: run.crystals, hits: run.hits, date: new Date().toISOString() };
    const settings = this.loadSettings();
    try { this.storage?.setItem(KEY, JSON.stringify({ settings, best })); } catch {}
    return best;
  }
}
