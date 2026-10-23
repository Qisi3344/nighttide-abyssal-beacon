import * as THREE from 'three';
import { App3D } from './render/App3D.js';
import { Terrain } from './render/Terrain.js';
import { Environment } from './render/Environment.js';
import { Flora } from './render/Flora.js';
import { Particles } from './render/Particles.js';
import { FishSchools } from './render/FishSchools.js';
import { Player } from './game/Player.js';
import { CameraRig } from './game/CameraRig.js';
import { Gameplay } from './game/Gameplay.js';
import { Input } from './core/Input.js';
import { SaveSystem } from './core/SaveSystem.js';
import { GameStateMachine, States } from './core/GameState.js';
import { Objectives } from './sim/Objectives.js';
import { OxygenSystem } from './sim/OxygenSystem.js';
import { UIManager } from './ui/UIManager.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { bus } from './core/EventBus.js';
import { WORLD } from './data/WorldData.js';

/* ============================== 装配 ============================== */
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const save = new SaveSystem();
let settings = save.loadSettings();

const app3d = new App3D(canvas, settings);
const input = new Input(canvas);
input.attach();

// 世界
const scene = app3d.scene;
const terrain = new Terrain();
scene.add(terrain.mesh);
const env = new Environment(terrain);
scene.add(env.group);
const flora = new Flora(terrain);
scene.add(flora.group);
const fish = new FishSchools(terrain);
scene.add(fish.group);
const particles = new Particles(scene);

// 灯光:微弱月光 + 深海环境光
const moon = new THREE.DirectionalLight(0x7ab8d0, 0.75);
moon.position.set(40, 120, -30);
moon.castShadow = true;
moon.shadow.camera.left = -80; moon.shadow.camera.right = 80;
moon.shadow.camera.top = 80; moon.shadow.camera.bottom = -80;
moon.shadow.camera.far = 300;
moon.shadow.mapSize.set(2048, 2048);
scene.add(moon);
const hemi = new THREE.HemisphereLight(0x2a6478, 0x0a141c, 0.8);
scene.add(hemi);

// 玩法
const player = new Player(terrain);
scene.add(player.model.group);
scene.add(player.auraLight); // 玩家随身微光,黑暗中保持可辨识
const cameraRig = new CameraRig(app3d.camera, terrain);
cameraRig.sensitivity = settings.sensitivity;

const objectives = new Objectives((t, p) => bus.emit(t, p), { beaconsTotal: 3, crystalsPerBeacon: 4 });
const oxygen = new OxygenSystem((t, p) => bus.emit(t, p));
const gameplay = new Gameplay(scene, terrain, env, particles, bus, objectives, oxygen);

const sm = new GameStateMachine((t, p) => bus.emit(t, p));
const audio = new AudioSystem();

// 计分
let crystalsTotal = 0;
bus.on('sfx:pickup', () => { crystalsTotal++; audio.pickup(); if (sm.runStats) sm.runStats.crystals = crystalsTotal; });
bus.on('sfx:repair-tick', () => audio.repairTick());
bus.on('sfx:beacon', () => { audio.beacon(); if (sm.runStats) sm.runStats.beaconsLit++; });
bus.on('sfx:victory', () => audio.victory());
bus.on('objectives:core-unlocked', () => audio.ping());
bus.on('predator:spotted', () => { audio.growl(); ui.flashSpot(); sm.runStats.spotted++; });
bus.on('predator:bite', () => {
  if (!sm.running) return;
  sm.runStats.hits++;
  gameplay.onBite(player, cameraRig);
  audio.bite();
  ui.flashDamage();
});
bus.on('game:bitten', () => audio.bite());
bus.on('oxygen:low', () => { audio.ping(); });
bus.on('objectives:changed', ({ current }) => { ui.setObjective(current.text); ui.setCrystals(objectives.crystals); });

/* ============================== UI ============================== */
const ui = new UIManager(uiRoot, {
  onStart: () => { audio.start(settings); startRun(); },
  onResume: () => resumeRun(),
  onQuitToTitle: () => { input.releaseLock(); sm.go(States.TITLE); enterTitleScene(); },
  onSettings: () => { uiSettingsFrom = sm.state; sm.go(States.SETTINGS); ui.showScreen('settings'); },
  onHelp: () => { uiSettingsFrom = sm.state; sm.go(States.HELP); ui.showScreen('help'); },
  onSettingsBack: () => {
    save.saveSettings(settings);
    backFromOverlay(States.SETTINGS);
  },
  onHelpBack: () => backFromOverlay(States.HELP),
  onApplySettings: (patch) => {
    settings = { ...settings, ...patch };
    audio.applySettings(settings);
    cameraRig.sensitivity = settings.sensitivity;
    app3d.applyQuality(settings);
    ui.loadSettingsToUI(settings);
    save.saveSettings(settings);
  },
});
let uiSettingsFrom = States.TITLE;

function backFromOverlay(from) {
  if (from === States.SETTINGS || from === States.HELP) {
    const target = (sm.state === from) ? (uiSettingsFrom === States.PAUSED ? States.PAUSED : States.TITLE) : sm.state;
    if (target === States.PAUSED) { sm.go(States.PLAYING); sm.go(States.PAUSED); ui.showScreen('pause'); }
    else { sm.go(States.TITLE); ui.showScreen('title'); }
  }
}

ui.loadSettingsToUI(settings);
ui.setObjective(objectives.current().text);

/* ============================== 场景状态 ============================== */
let titleCamAngle = 0;
let introTransition = 0; // 0..1 开场相机过渡进度

function enterTitleScene() {
  ui.showHUD(false);
  ui.showScreen('title');
  gameplay.reset();
  objectives.reset();
  oxygen.reset();
  player.respawn();
  crystalsTotal = 0;
}

function startRun() {
  gameplay.reset();
  objectives.reset();
  oxygen.reset();
  player.respawn();
  cameraRig.yaw = WORLD.spawn.yaw;
  cameraRig.pitch = -0.15;
  cameraRig._pos.set(player.position.x, player.position.y + 30, player.position.z + 40);
  crystalsTotal = 0;
  sm.startRun();
  sm.runStats.crystalsTotal = 0;
  ui.hideAllScreens();
  ui.showHUD(true);
  ui.setObjective(objectives.current().text);
  ui.setCrystals(0);
  ui.showIntro();
  introTransition = 1;
  input.requestLock();
}

function resumeRun() {
  sm.go(States.PLAYING);
  ui.hideAllScreens();
  ui.showHUD(true);
  input.requestLock();
}

bus.on('state:changed', ({ next }) => {
  if (next === States.PAUSED) {
    ui.showScreen('pause');
    ui.showHUD(true);
    input.releaseLock();
  } else if (next === States.VICTORY || next === States.DEFEATED) {
    input.releaseLock();
    const stats = { ...sm.runStats, crystalsTotal };
    ui.showEnd(next === States.VICTORY ? 'victory' : 'defeat', stats, save.saveBest(stats));
    ui.showHUD(false);
    audio.defeat();
  }
});

// Esc 暂停
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (sm.state === States.PLAYING) { sm.go(States.PAUSED); }
    else if (sm.state === States.PAUSED) { resumeRun(); }
  }
});

// 点击画面锁定指针(游戏中)
canvas.addEventListener('click', () => {
  if (sm.state === States.PLAYING && !input.pointerLocked) input.requestLock();
});

/* ============================== 主循环 ============================== */
const clock = new THREE.Clock();
let bubbleTimer = 0;
let rafLastAt = performance.now();   // rAF 最后驱动时刻(看门狗依据)
let lastFrameAt = 0;                 // 任意驱动最后帧时刻(重入保护)
let timeoutDriven = false;

function frame(fromTimeout = false) {
  const now = performance.now();
  if (!fromTimeout) rafLastAt = now;
  if (now - lastFrameAt < 8) return; // 双驱动重入保护
  lastFrameAt = now;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 世界氛围永远流动(标题/暂停亦然,画面保持生命感)
  env.update(dt, t);
  flora.update(dt, t);
  fish.update(dt, t);
  particles.update(dt, t);

  if (sm.state === States.TITLE || sm.state === States.SETTINGS || sm.state === States.HELP ||
      sm.state === States.VICTORY || sm.state === States.DEFEATED) {
    // 标题:绕核心穹顶缓慢环游
    titleCamAngle += dt * 0.06;
    const r = 46;
    app3d.camera.position.set(
      WORLD.core.x + Math.cos(titleCamAngle) * r,
      WORLD.seabedBase + 22 + Math.sin(titleCamAngle * 0.7) * 4,
      WORLD.core.z + Math.sin(titleCamAngle) * r,
    );
    app3d.camera.lookAt(WORLD.core.x, WORLD.seabedBase + 12, WORLD.core.z);
    if (sm.state === States.TITLE && Math.random() < dt * 0.4) audio.ping?.();
  } else if (sm.state === States.PLAYING || sm.state === States.PAUSED) {
    if (sm.state === States.PLAYING) {
      cameraRig.consumeMouse(input.consumeMouse());
      player.update(dt, input, cameraRig.yaw);
      cameraRig.update(dt, player.position, player.sprinting);

      if (introTransition > 0) introTransition = Math.max(0, introTransition - dt * 0.8);

      const res = gameplay.update(dt, player, input, cameraRig);
      const alive = oxygen.update(dt, player.sprinting);
      audio.update(dt, oxygen.low, oxygen.ratio);

      // 呼吸气泡
      bubbleTimer -= dt;
      if (bubbleTimer <= 0) {
        bubbleTimer = 0.8;
        particles.spawnBubbles(player.position.x, player.position.y + 0.4, player.position.z, 2, 0.25);
        if (Math.random() < 0.5) audio.bubble();
      }

      // HUD
      ui.setOxygen(oxygen.ratio);
      ui.setDepth(player.position.y);
      ui.setRefill(res.inOxygen);
      ui.showInteract(gameplay.nearby, gameplay.holdProgress);
      const litMap = new Map(WORLD.beacons.map(b => [b.id, env.beaconViews.get(b.id).lit]));
      ui.updateCompass(cameraRig.yaw, player.position, litMap, objectives.coreUnlocked);

      // 胜负
      if (!alive) {
        sm.endRun('defeat');
      } else if (objectives.complete) {
        sm.endRun('victory');
      }
    } else {
      // 暂停:仅渲染静态帧
      cameraRig.consumeMouse({ dx: 0, dy: 0 });
    }
  }

  app3d.render(dt);
  requestAnimationFrame((t) => frame(false));
}

/**
 * 看门狗:某些嵌入 webview 可见但无焦点时会暂停 rAF。
 * 检测 rAF 停滞即用 setTimeout 兜底驱动;rAF 恢复后自动让位。
 */
setInterval(() => {
  if (!timeoutDriven && performance.now() - rafLastAt > 250) {
    timeoutDriven = true;
    const loop = () => {
      if (performance.now() - rafLastAt < 80) { timeoutDriven = false; return; } // rAF 已接管
      frame(true);
      setTimeout(loop, 16);
    };
    loop();
  }
}, 200);

/* ============================== 启动 ============================== */
// QA 调试钩子:自动化测试与验收用(只读引用,不含任何敏感数据)
window.__nighttide = { sm, objectives, oxygen, player, gameplay, env, cameraRig, settings: () => settings };

enterTitleScene();
sm.go(States.TITLE);
frame();
