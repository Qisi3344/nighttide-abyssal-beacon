import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OxygenSystem } from '../src/sim/OxygenSystem.js';

function makeOxy(over = {}) {
  const events = [];
  const oxy = new OxygenSystem((t, p) => events.push({ t, p }), over);
  return { oxy, events };
}

test('氧气:常态消耗速率正确', () => {
  const { oxy } = makeOxy();
  for (let i = 0; i < 100; i++) oxy.update(0.1, false); // 10s
  assert.ok(Math.abs(oxy.value - (100 - 11.5)) < 0.01, `value=${oxy.value}`);
});

test('氧气:冲刺消耗更快', () => {
  const { oxy } = makeOxy();
  for (let i = 0; i < 100; i++) oxy.update(0.1, true); // 10s
  assert.ok(Math.abs(oxy.value - (100 - 31)) < 0.01, `value=${oxy.value}`);
});

test('氧气:氧藻区回充', () => {
  const { oxy } = makeOxy();
  oxy.value = 50;
  oxy.setInRefillZone(true);
  oxy.update(1.0, false);
  assert.equal(oxy.value, 59);
  oxy.setInRefillZone(false);
});

test('氧气:归零触发 depleted 并返回 false', () => {
  const { oxy, events } = makeOxy();
  oxy.value = 0.05;
  const alive = oxy.update(0.1, false);
  assert.equal(alive, false);
  assert.ok(events.some(e => e.t === 'oxygen:depleted'));
});

test('氧气:低氧警告与恢复各触发一次', () => {
  const { oxy, events } = makeOxy();
  oxy.value = 30;
  oxy.update(0.01, false);          // 30→未低
  oxy.value = 24;
  oxy.update(0.01, false);          // 进入低氧
  oxy.update(0.01, false);          // 持续低氧(不重复)
  oxy.value = 60;
  oxy.update(0.01, false);          // 恢复
  const lows = events.filter(e => e.t === 'oxygen:low').length;
  const recovers = events.filter(e => e.t === 'oxygen:recovered').length;
  assert.equal(lows, 1);
  assert.equal(recovers, 1);
});

test('氧气:被咬固定损失并存活', () => {
  const { oxy, events } = makeOxy();
  oxy.value = 60;
  const alive = oxy.bite();
  assert.equal(alive, true);
  assert.equal(oxy.value, 34);
  assert.ok(events.some(e => e.t === 'oxygen:bitten'));
});

test('氧气:被咬可致死', () => {
  const { oxy } = makeOxy();
  oxy.value = 10;
  oxy.bite();
  assert.equal(oxy.value, 0);
});
