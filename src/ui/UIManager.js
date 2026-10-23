import { WORLD } from '../data/WorldData.js';

/**
 * DOM UI 管理器:标题/开场/HUD/暂停/设置/帮助/结算。
 * 全部挂 #ui-root,游戏世界照常在 canvas 渲染,标题界面即实时场景。
 */
export class UIManager {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers; // {onStart, onResume, onRestart, onQuitToTitle, onSettings, onHelp, onApplySettings}
    this.el = {};
    this._build();
  }

  _build() {
    this.root.innerHTML = `
      <div id="hud">
        <div class="hud-tl">
          <div class="hud-objective panel"><span class="tag">◈ 当前目标</span><span id="obj-text"></span></div>
          <div class="hud-crystals panel"><span class="crystal-icon"></span><span id="crystal-count">0</span><span style="color:var(--text-dim);font-size:14px;letter-spacing:.2em">光晶</span></div>
        </div>
        <div class="compass panel"><div class="strip" id="compass-strip"></div><div class="center"></div></div>
        <div class="hud-bl">
          <div class="o2-ring panel" id="o2-ring">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="47" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
              <circle id="o2-arc" cx="55" cy="55" r="47" fill="none" stroke="#35f0ff" stroke-width="7"
                stroke-linecap="round" stroke-dasharray="295.3" stroke-dashoffset="0"
                style="filter: drop-shadow(0 0 6px rgba(53,240,255,.8)); transition: stroke .3s"/>
            </svg>
            <div class="label"><span id="o2-val">100</span><small>O₂</small></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="o2-depth panel">深度 <b id="depth-val">640</b> m</div>
            <div class="o2-refill panel" id="o2-refill">◈ 氧藻回充中</div>
          </div>
        </div>
        <div class="hud-interact panel" id="interact">
          <span id="interact-text"></span>
          <div class="hold-bar"><i id="hold-fill"></i></div>
        </div>
        <div class="spot-warn" id="spot-warn">它看见你了</div>
        <div class="vignette-damage" id="vg-damage"></div>
        <div class="vignette-low" id="vg-low"></div>
        <div class="vignette-predator" id="vg-predator"></div>
        <div class="vignette-edge" id="vg-edge"></div>
      </div>

      <div class="screen" id="screen-title">
        <div class="title-vignette"></div>
        <div class="title-logo">
          <div class="cn">晚 潮</div>
          <div class="en">NIGHTTIDE</div>
          <div class="sub">深 渊 信 标</div>
          <div class="title-rule"></div>
        </div>
        <div class="title-menu clickable">
          <button class="nt-btn primary" id="btn-start">潜 入</button>
          <button class="nt-btn" id="btn-help">操 作 说 明</button>
          <button class="nt-btn" id="btn-settings">设 置</button>
        </div>
        <div class="title-foot">GLM 全夜自主开发冲刺 · v0.1 · 潜入前请先深呼吸</div>
      </div>

      <div class="screen" id="screen-pause">
        <div class="overlay-dim"></div>
        <div class="overlay-card panel clickable">
          <h2>暂 停</h2>
          <div class="sub-title">潮水在此停驻</div>
          <button class="nt-btn" id="btn-resume">继 续</button>
          <button class="nt-btn" id="btn-p-settings">设 置</button>
          <button class="nt-btn" id="btn-p-help">操 作 说 明</button>
          <button class="nt-btn danger" id="btn-quit">返 回 标 题</button>
        </div>
      </div>

      <div class="screen" id="screen-settings">
        <div class="overlay-dim"></div>
        <div class="overlay-card panel clickable">
          <h2>设 置</h2>
          <div class="sub-title">调节你的潜水舱</div>
          <div class="setting-row"><label>主音量 <span id="v-master"></span></label><input type="range" id="s-master" min="0" max="1" step="0.05"></div>
          <div class="setting-row"><label>环境音 <span id="v-ambient"></span></label><input type="range" id="s-ambient" min="0" max="1" step="0.05"></div>
          <div class="setting-row"><label>音效 <span id="v-sfx"></span></label><input type="range" id="s-sfx" min="0" max="1" step="0.05"></div>
          <div class="setting-row"><label>鼠标灵敏度</label><input type="range" id="s-sens" min="0.3" max="2.2" step="0.1"></div>
          <div class="setting-row"><label>画质</label>
            <div class="seg"><button id="q-high">高(辉光)</button><button id="q-low">低(流畅)</button></div>
          </div>
          <button class="nt-btn" id="btn-settings-back">返 回</button>
        </div>
      </div>

      <div class="screen" id="screen-help">
        <div class="overlay-dim"></div>
        <div class="overlay-card panel clickable">
          <h2>操 作 说 明</h2>
          <div class="sub-title">守灯人手册</div>
          <div class="help-grid">
            <span class="k">W A S D</span><span>游动(朝相机方向)</span>
            <span class="k">SPACE / C</span><span>上浮 / 下潜</span>
            <span class="k">SHIFT</span><span>冲刺(更快消耗氧气,更容易被察觉)</span>
            <span class="k">E</span><span>按住修复信标 / 唤醒核心</span>
            <span class="k">ESC</span><span>暂停</span>
            <span class="k">鼠标</span><span>视角(点击画面锁定指针)</span>
          </div>
          <p class="help-tip">
            收集<strong>光晶</strong>修复三座<strong>信标</strong>;信标点亮处,深渊守卫不敢靠近。<br>
            氧气就是生命——发光的<strong>氧藻丛</strong>可以回充。<br>
            那条<em>品红眼睛</em>的东西循光而来:熄灯静止能躲过它,冲刺的声响会把它引来。<br>
            手柄同样支持:左摇杆游动 / RT·LT 浮沉 / A 交互 / B 冲刺 / 右摇杆视角。
          </p>
          <button class="nt-btn" id="btn-help-back">返 回</button>
        </div>
      </div>

      <div class="screen" id="screen-end">
        <div class="overlay-dim"></div>
        <div class="overlay-card panel clickable">
          <h2 id="end-title">信标长明</h2>
          <div class="sub-title" id="end-sub"></div>
          <div id="end-stats"></div>
          <button class="nt-btn primary" id="btn-again">再 潜 一 次</button>
          <button class="nt-btn" id="btn-end-title">返 回 标 题</button>
        </div>
      </div>

      <div class="intro-text" id="intro-text">海面之下 640 米 —— 三座信标都熄灭了</div>
      <div class="cinematic-text" id="cinematic-text"></div>
      <div class="lore-panel panel" id="lore-panel">
        <div class="lore-tag">ARCHIVE · 档案残片</div>
        <div class="lore-title" id="lore-title"></div>
        <div class="lore-text" id="lore-text"></div>
      </div>
      <div class="fade-black" id="fade-black"></div>
    `;

    const $ = (id) => this.root.querySelector('#' + id);
    this.el = {
      hud: $('hud'), objText: $('obj-text'), crystalCount: $('crystal-count'),
      o2Arc: $('o2-arc'), o2Val: $('o2-val'), o2Ring: $('o2-ring'), depthVal: $('depth-val'), o2Refill: $('o2-refill'),
      compass: $('compass-strip'), interact: $('interact'), interactText: $('interact-text'), holdFill: $('hold-fill'),
      spotWarn: $('spot-warn'), vgDamage: $('vg-damage'), vgLow: $('vg-low'), vgPredator: $('vg-predator'), vgEdge: $('vg-edge'),
      cinematic: $('cinematic-text'), canvas: document.getElementById('game-canvas'),
      fadeBlack: $('fade-black'),
      lorePanel: $('lore-panel'), loreTitle: $('lore-title'), loreText: $('lore-text'),
      screens: {
        title: $('screen-title'), pause: $('screen-pause'), settings: $('screen-settings'),
        help: $('screen-help'), end: $('screen-end'),
      },
      endTitle: $('end-title'), endSub: $('end-sub'), endStats: $('end-stats'), intro: $('intro-text'),
      settings: {
        master: $('s-master'), ambient: $('s-ambient'), sfx: $('s-sfx'), sens: $('s-sens'),
        vMaster: $('v-master'), vAmbient: $('v-ambient'), vSfx: $('v-sfx'),
        qHigh: $('q-high'), qLow: $('q-low'),
      },
    };

    $('btn-start').onclick = () => this.h.onStart();
    $('btn-help').onclick = () => this.h.onHelp('title');
    $('btn-settings').onclick = () => this.h.onSettings('title');
    $('btn-resume').onclick = () => this.h.onResume();
    $('btn-p-settings').onclick = () => this.h.onSettings('pause');
    $('btn-p-help').onclick = () => this.h.onHelp('pause');
    $('btn-quit').onclick = () => this.h.onQuitToTitle();
    $('btn-settings-back').onclick = () => this.h.onSettingsBack();
    $('btn-help-back').onclick = () => this.h.onHelpBack();
    $('btn-again').onclick = () => this.h.onStart();
    $('btn-end-title').onclick = () => this.h.onQuitToTitle();

    // 罗盘标记
    for (const b of WORLD.beacons) {
      const m = document.createElement('div');
      m.className = `mark unlit`;
      m.dataset.beacon = b.id;
      this.el.compass.appendChild(m);
    }
    const core = document.createElement('div');
    core.className = 'mark core';
    core.dataset.core = '1';
    core.style.display = 'none';
    this.el.compass.appendChild(core);

    // 设置实时应用
    const s = this.el.settings;
    const bind = (input, label, key) => {
      input.addEventListener('input', () => {
        label.textContent = Math.round(input.value * 100) + '%';
        this.h.onApplySettings({ [key]: parseFloat(input.value) });
      });
    };
    bind(s.master, s.vMaster, 'master');
    bind(s.ambient, s.vAmbient, 'ambient');
    bind(s.sfx, s.vSfx, 'sfx');
    s.sens.addEventListener('input', () => this.h.onApplySettings({ sensitivity: parseFloat(s.sens.value) }));
    s.qHigh.onclick = () => this.h.onApplySettings({ quality: 'high' });
    s.qLow.onclick = () => this.h.onApplySettings({ quality: 'low' });
  }

  showScreen(name) {
    for (const [k, el] of Object.entries(this.el.screens)) {
      el.classList.toggle('show', k === name);
    }
  }

  hideAllScreens() { this.showScreen(null); }

  showHUD(on) { this.el.hud.classList.toggle('show', on); }

  loadSettingsToUI(s) {
    const e = this.el.settings;
    e.master.value = s.master; e.vMaster.textContent = Math.round(s.master * 100) + '%';
    e.ambient.value = s.ambient; e.vAmbient.textContent = Math.round(s.ambient * 100) + '%';
    e.sfx.value = s.sfx; e.vSfx.textContent = Math.round(s.sfx * 100) + '%';
    e.sens.value = s.sensitivity;
    e.qHigh.classList.toggle('on', s.quality === 'high');
    e.qLow.classList.toggle('on', s.quality === 'low');
  }

  setObjective(text) { this.el.objText.textContent = text; }
  setCrystals(n) { this.el.crystalCount.textContent = n; }

  setOxygen(ratio) {
    const CIRC = 295.3;
    this.el.o2Arc.style.strokeDashoffset = String(CIRC * (1 - ratio));
    this.el.o2Val.textContent = String(Math.ceil(ratio * 100));
    const cls = ratio <= 0.12 ? 'o2-ring panel crit' : ratio <= 0.25 ? 'o2-ring panel warn' : 'o2-ring panel';
    this.el.o2Ring.className = cls;
    this.el.o2Arc.style.stroke = ratio <= 0.12 ? '#ff3fae' : ratio <= 0.25 ? '#ffb35c' : '#35f0ff';
    this.el.vgLow.style.opacity = ratio <= 0.25 ? String(0.5 + (0.25 - ratio) * 2) : '0';
  }

  setDepth(y) {
    const depth = Math.round(640 + (WORLD.seaLevel - y) * 0.8);
    this.el.depthVal.textContent = String(depth);
  }

  setRefill(on) { this.el.o2Refill.classList.toggle('on', on); }

  /** camYaw:相机朝向角(rad,与 atan2(sin,cos) 同系);玩家位置决定标记方位 */
  updateCompass(camYaw, playerPos, beaconLitState, coreUnlocked) {
    const halfFov = Math.PI * 0.75; // 罗盘覆盖 ±135°
    const marks = this.el.compass.children;
    for (const m of marks) {
      let tx, tz, visible = true;
      if (m.dataset.beacon) {
        const b = WORLD.beacons.find(bb => bb.id === m.dataset.beacon);
        tx = b.x; tz = b.z;
        m.className = 'mark ' + (beaconLitState.get(b.id) ? 'lit' : 'unlit');
      } else if (m.dataset.core) {
        tx = WORLD.core.x; tz = WORLD.core.z;
        visible = coreUnlocked;
      } else continue;
      if (!visible) { m.style.display = 'none'; continue; }
      m.style.display = 'block';
      const bearing = Math.atan2(tx - playerPos.x, tz - playerPos.z);
      let rel = bearing - camYaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      if (Math.abs(rel) > halfFov) { m.style.display = 'none'; continue; }
      m.style.left = (50 + (rel / halfFov) * 48) + '%';
      // 距离角标
      const dist = Math.round(Math.hypot(tx - playerPos.x, tz - playerPos.z));
      if (!m._dist) {
        m._dist = document.createElement('span');
        m._dist.className = 'dist';
        this.el.compass.appendChild(m._dist);
      }
      m._dist.textContent = dist + 'm';
      m._dist.style.left = m.style.left;
      m._dist.style.display = 'block';
    }
    // 清理隐藏标记的距离角标
    for (const m of marks) {
      if (m.style.display === 'none' && m._dist) m._dist.style.display = 'none';
    }
  }

  showInteract(nearby, holdProgress) {
    const el = this.el.interact;
    if (!nearby) { el.classList.remove('show'); return; }
    el.classList.add('show');
    this.el.interactText.innerHTML = nearby.key
      ? `<span class="key">E</span> ${nearby.label.replace('按住 E ', '')}`
      : nearby.label;
    this.el.holdFill.style.width = Math.round(holdProgress * 100) + '%';
  }

  flashSpot() {
    const el = this.el.spotWarn;
    el.classList.remove('flash');
    void el.offsetWidth; // 重置动画
    el.classList.add('flash');
  }

  /** 终局狂暴提示 */
  flashRage() {
    const el = this.el.spotWarn;
    el.textContent = '三灯齐明 · 它愤怒了 —— 速去穹顶';
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => { el.textContent = '它看见你了'; }, 2600);
  }

  flashDamage() {
    this.el.vgDamage.style.opacity = '1';
    setTimeout(() => { this.el.vgDamage.style.opacity = '0'; }, 260);
  }

  showIntro() {
    // 开场:黑幕盖住 → 淡入 + 字幕
    const fb = this.el.fadeBlack;
    fb.classList.add('cover');
    void fb.offsetWidth;
    fb.classList.remove('cover');
    this.el.intro.classList.add('show');
    setTimeout(() => this.el.intro.classList.remove('show'), 5200);
  }

  /** 守卫接近度恐惧反馈:0(无)~1(贴脸) */
  setPredatorProximity(v) {
    this.el.vgPredator.style.opacity = v > 0 ? String(Math.min(0.9, v)) : '0';
  }

  /** 海沟边界反馈:接近边界时蓝色水流感 */
  setEdgeWarning(on) {
    this.el.vgEdge.style.opacity = on ? '0.8' : '0';
  }

  setPausedBlur(on) {
    this.el.canvas.classList.toggle('paused', on);
  }

  /** 终局演出字幕 */
  showCinematic(text) {
    const el = this.el.cinematic;
    el.textContent = text;
    el.classList.add('show');
  }
  hideCinematic() {
    this.el.cinematic.classList.remove('show');
  }

  /** 档案残片浮层(显示后自动淡出) */
  showLore({ title, text }) {
    this.el.loreTitle.textContent = title;
    this.el.loreText.textContent = text;
    this.el.lorePanel.classList.add('show');
    clearTimeout(this._loreTimer);
    this._loreTimer = setTimeout(() => this.el.lorePanel.classList.remove('show'), 9000);
  }

  showEnd(outcome, stats, best) {
    const win = outcome === 'victory';
    this.el.endTitle.textContent = win ? '信 标 长 明' : '沉 入 暗 潮';
    this.el.endTitle.className = win ? '' : 'magenta';
    this.el.endSub.textContent = win ? '核心苏醒 · 深渊退去' : '氧气见底 · 守卫得逞';
    const secs = Math.round((stats.endTime - stats.startTime) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
    const bestLine = best ? `最快纪录 ${Math.floor(best.durationMs / 60000)}:${String(Math.round(best.durationMs / 1000) % 60).padStart(2, '0')}` : '尚无纪录';
    this.el.endStats.innerHTML = `
      <div class="stat-row"><span>用时</span><b>${mm}:${ss}</b></div>
      <div class="stat-row"><span>收集光晶</span><b class="good">${stats.crystalsTotal ?? stats.crystals ?? 0} 枚</b></div>
      <div class="stat-row"><span>点亮信标</span><b class="good">${stats.beaconsLit}/3</b></div>
      <div class="stat-row"><span>被咬次数</span><b class="${stats.hits > 0 ? 'bad' : 'good'}">${stats.hits}</b></div>
      <div class="stat-row"><span>被察觉</span><b>${stats.spotted} 次</b></div>
      <div class="stat-row"><span>档案残片</span><b class="${(stats.loreRead || 0) >= 3 ? 'good' : ''}">${stats.loreRead || 0}/3</b></div>
      <div class="stat-row"><span>黑潮之心</span><b class="${stats.secret ? 'good' : ''}">${stats.secret ? '◈ 已寻获' : '未发现'}</b></div>
      <div class="stat-row"><span>${bestLine}</span><b></b></div>
    `;
    this.showScreen('end');
  }
}
