import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PredatorBrain, PredatorMode } from '../src/sim/PredatorBrain.js';

const WAYPOINTS = [{ x: 0, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, { x: 0, y: 0, z: 40 }];
const AT_ORIGIN = { x: 0, y: 0, z: 0 };
const FACING_Z = { x: 0, z: 1 }; // 朝 +Z

function perc(over = {}) {
  return {
    pos: AT_ORIGIN, facing: FACING_Z,
    playerPos: { x: 0, y: 0, z: 60 }, // 默认玩家在 60m 外(感知之外)
    playerLight: 0, playerSpeed: 3, sprinting: false,
    beacons: [],
    ...over,
  };
}

test('守卫:初始 PATROL', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  assert.equal(brain.mode, PredatorMode.PATROL);
  brain.update(0.016, perc()); // 玩家远在感知外
  assert.equal(brain.mode, PredatorMode.PATROL);
});

test('守卫:移动目标进入感知范围(前方锥内) → CHASE + spotted 事件', () => {
  const events = [];
  const brain = new PredatorBrain((t) => events.push(t), WAYPOINTS);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 8 }, playerSpeed: 3 })); // 8m < baseSense 17,视野内
  assert.equal(brain.mode, PredatorMode.CHASE);
  assert.ok(events.includes('predator:spotted'));
});

test('守卫:静止且暗的目标只有 6.5m 感知', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 8 }, playerSpeed: 0, playerLight: 0 }));
  assert.equal(brain.mode, PredatorMode.PATROL); // 8m > 6.5m 看不见
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 5 }, playerSpeed: 0, playerLight: 0 }));
  assert.equal(brain.mode, PredatorMode.CHASE); // 5m < 6.5m 发现
});

test('守卫:高灯显著扩大感知距离', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 24 }, playerSpeed: 0, playerLight: 1.0 }));
  // still 6.5 + lightBonus 26 = 32.5 → 24m 应被发现
  assert.equal(brain.mode, PredatorMode.CHASE);
});

test('守卫:视野锥外的目标不被发现', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  // 守卫朝 +Z,玩家在 -Z 正后方 3m
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: -3 }, playerSpeed: 3 }));
  assert.equal(brain.mode, PredatorMode.PATROL);
});

test('守卫:冲刺噪音把巡逻者引来 INVESTIGATE', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  // 玩家在锥外远处冲刺
  brain.update(0.016, perc({ playerPos: { x: -30, y: 0, z: 10 }, sprinting: true }));
  assert.equal(brain.mode, PredatorMode.INVESTIGATE);
});

test('守卫:玩家进入信标光圈 → 放弃追击 RETREAT', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 8 }, playerSpeed: 3 }));
  assert.equal(brain.mode, PredatorMode.CHASE);
  brain.update(0.016, perc({
    playerPos: { x: 0, y: 0, z: 8 }, playerSpeed: 3,
    beacons: [{ x: 0, y: 0, z: 8, radius: 10 }],
  }));
  assert.equal(brain.mode, PredatorMode.RETREAT);
});

test('守卫:近距离触发 LUNGE 并在结束时发 bite', () => {
  const events = [];
  const brain = new PredatorBrain((t) => events.push(t), WAYPOINTS);
  // 状态机逐帧推进:PATROL→CHASE(本帧),CHASE→LUNGE(下帧),LUNGE 计满→bite
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 2.2 }, playerSpeed: 3 }));
  assert.equal(brain.mode, PredatorMode.CHASE);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 2.2 }, playerSpeed: 3 }));
  assert.equal(brain.mode, PredatorMode.LUNGE);
  brain.update(0.6, perc({ playerPos: { x: 0, y: 0, z: 2.2 }, playerSpeed: 3 }));
  assert.ok(events.includes('predator:bite'));
  assert.equal(brain.mode, PredatorMode.RETREAT);
});

test('守卫:追丢(超 loseSenseRange)后撤退', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 8 }, playerSpeed: 3 }));
  assert.equal(brain.mode, PredatorMode.CHASE);
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 60 }, playerSpeed: 3 })); // 60m 外
  assert.equal(brain.mode, PredatorMode.RETREAT);
});

test('守卫:dangerLevel 分级', () => {
  const brain = new PredatorBrain(() => {}, WAYPOINTS);
  assert.equal(brain.dangerLevel, 0); // PATROL
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 2.2 }, playerSpeed: 3 }));
  assert.equal(brain.dangerLevel, 0.75); // CHASE
  brain.update(0.016, perc({ playerPos: { x: 0, y: 0, z: 2.2 }, playerSpeed: 3 }));
  assert.equal(brain.dangerLevel, 1.0); // LUNGE
});
