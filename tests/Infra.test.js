import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/RNG.js';
import { SaveSystem, DEFAULT_SETTINGS } from '../src/core/SaveSystem.js';

test('RNG:同种子序列确定', () => {
  const a = new RNG(42), b = new RNG(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('RNG:range 范围正确', () => {
  const r = new RNG(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.range(-3, 5);
    assert.ok(v >= -3 && v < 5);
  }
});

test('RNG:fbm 输出 0..1', () => {
  const r = new RNG(9);
  for (let i = 0; i < 500; i++) {
    const v = r.fbm(i * 0.13, i * 0.29, 4);
    assert.ok(v >= 0 && v <= 1, `fbm=${v}`);
  }
});

test('RNG:noise2 双线性连续(网格点上连续)', () => {
  const r = new RNG(11);
  const a = r.noise2(1.5, 1.5);
  const b = r.noise2(1.5001, 1.5);
  assert.ok(Math.abs(a - b) < 0.01);
});

function memStorage() {
  let data = null;
  return {
    getItem: () => data,
    setItem: (k, v) => { data = v; },
  };
}

test('存档:默认设置回退', () => {
  const save = new SaveSystem(memStorage());
  assert.deepEqual(save.loadSettings(), DEFAULT_SETTINGS);
  assert.equal(save.loadBest(), null);
});

test('存档:设置持久化', () => {
  const store = memStorage();
  const save = new SaveSystem(store);
  save.saveSettings({ ...DEFAULT_SETTINGS, master: 0.3 });
  const save2 = new SaveSystem(store);
  assert.equal(save2.loadSettings().master, 0.3);
});

test('存档:最佳成绩只保留更快的', () => {
  const store = memStorage();
  const save = new SaveSystem(store);
  save.saveBest({ durationMs: 120000, crystals: 12, hits: 0 });
  save.saveBest({ durationMs: 200000, crystals: 12, hits: 0 }); // 更慢,不覆盖
  assert.equal(save.loadBest().durationMs, 120000);
  save.saveBest({ durationMs: 90000, crystals: 12, hits: 1 });
  assert.equal(save.loadBest().durationMs, 90000);
});

test('存档:startTime/endTime 也能算成绩', () => {
  const store = memStorage();
  const save = new SaveSystem(store);
  save.saveBest({ startTime: 1000, endTime: 61000, crystals: 5, hits: 0 });
  assert.equal(save.loadBest().durationMs, 60000);
});

test('存档:历史坏纪录(非有限数)会被好成绩覆盖', () => {
  const store = memStorage();
  store.setItem('nighttide.save.v1', JSON.stringify({ settings: {}, best: { durationMs: undefined, crystals: 0, hits: 0 } }));
  const save = new SaveSystem(store);
  const best = save.saveBest({ startTime: 0, endTime: 90000, crystals: 12, hits: 1 });
  assert.equal(best.durationMs, 90000);
  assert.equal(save.loadBest().durationMs, 90000);
});

test('存档:损坏数据安静回退', () => {
  const store = { getItem: () => '{{{not json', setItem: () => {} };
  const save = new SaveSystem(store);
  assert.deepEqual(save.loadSettings(), DEFAULT_SETTINGS);
});
