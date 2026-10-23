/**
 * 游戏状态机(纯逻辑,可测试)。
 * BOOT → TITLE ⇄ (SETTINGS/HELP) ; TITLE → PLAYING ⇄ PAUSED ; PLAYING → VICTORY | DEFEATED → TITLE/PLAYING
 */
export const States = Object.freeze({
  BOOT: 'BOOT', TITLE: 'TITLE', SETTINGS: 'SETTINGS', HELP: 'HELP',
  PLAYING: 'PLAYING', PAUSED: 'PAUSED', VICTORY: 'VICTORY', DEFEATED: 'DEFEATED',
});

const TRANSITIONS = {
  [States.BOOT]:       [States.TITLE],
  [States.TITLE]:      [States.PLAYING, States.SETTINGS, States.HELP],
  [States.SETTINGS]:   [States.TITLE, States.PAUSED],
  [States.HELP]:       [States.TITLE, States.PAUSED],
  [States.PLAYING]:    [States.PAUSED, States.VICTORY, States.DEFEATED, States.TITLE],
  [States.PAUSED]:     [States.PLAYING, States.TITLE, States.SETTINGS, States.HELP],
  [States.VICTORY]:    [States.TITLE, States.PLAYING],
  [States.DEFEATED]:   [States.TITLE, States.PLAYING],
};

export class GameStateMachine {
  constructor(emit) {
    this.state = States.BOOT;
    this.emit = emit || (() => {});
    this.runStats = null;
  }

  canGo(next) {
    const allowed = TRANSITIONS[this.state];
    return Boolean(allowed && allowed.includes(next));
  }

  go(next, payload = null) {
    if (!this.canGo(next)) {
      throw new Error(`非法状态迁移: ${this.state} → ${next}`);
    }
    const prev = this.state;
    this.state = next;
    this.emit('state:changed', { prev, next, payload });
    return true;
  }

  /** 是否允许世界继续模拟(暂停时停) */
  get running() { return this.state === States.PLAYING; }

  startRun() {
    this.runStats = { startTime: Date.now(), crystals: 0, hits: 0, beaconsLit: 0, spotted: 0 };
    this.go(States.PLAYING);
  }

  endRun(outcome, stats) {
    this.runStats = { ...this.runStats, ...stats, endTime: Date.now() };
    this.go(outcome === 'victory' ? States.VICTORY : States.DEFEATED, this.runStats);
  }
}
