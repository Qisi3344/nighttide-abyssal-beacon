import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Objectives } from '../src/sim/Objectives.js';

test('任务:初始目标为收集光晶', () => {
  const obj = new Objectives(() => {});
  assert.equal(obj.current().id, 'crystals');
  assert.match(obj.current().text, /还差 4 枚/);
});

test('任务:修复信标消耗光晶并推进', () => {
  const obj = new Objectives(() => {});
  for (let i = 0; i < 4; i++) obj.onCrystalCollected();
  assert.equal(obj.crystals, 4);
  assert.equal(obj.trySpendForBeacon(), true);
  assert.equal(obj.crystals, 0);
  assert.equal(obj.beaconsLit, 1);
  // 不够时拒绝
  assert.equal(obj.trySpendForBeacon(), false);
  assert.equal(obj.beaconsLit, 1);
});

test('任务:三信标齐 → 解锁核心 → 激活完成', () => {
  const events = [];
  const obj = new Objectives((t) => events.push(t));
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 4; i++) obj.onCrystalCollected();
    obj.trySpendForBeacon();
  }
  assert.equal(obj.coreUnlocked, true);
  assert.ok(events.includes('objectives:core-unlocked'));
  // 未解锁时不能激活
  assert.equal(obj.onCoreActivated(), true);
  assert.equal(obj.complete, true);
  assert.ok(events.includes('objectives:complete'));
  // 重复激活无效
  assert.equal(obj.onCoreActivated(), false);
});

test('任务:reset 清空进度', () => {
  const obj = new Objectives(() => {});
  obj.onCrystalCollected();
  obj.reset();
  assert.equal(obj.crystals, 0);
  assert.equal(obj.beaconsLit, 0);
  assert.equal(obj.coreUnlocked, false);
});
