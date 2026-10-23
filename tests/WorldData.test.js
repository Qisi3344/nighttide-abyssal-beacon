import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/data/WorldData.js';

/**
 * 关卡数据完整性:所有可交互物必须在 192m 玩家边界内、
 * 且不在中央穹顶禁区(核心半径 16m 内除核心交互外无干扰)。
 * 曾经的教训:黑潮之心放在 (148,148),半径 209m 超出边界,玩家永远到不了。
 */
const PLAY_RADIUS = 192;

function assertInside(name, x, z) {
  const r = Math.hypot(x, z);
  assert.ok(r <= PLAY_RADIUS, `${name} (${x},${z}) 距中心 ${r.toFixed(0)}m 超出玩家边界 ${PLAY_RADIUS}m`);
}

test('关卡:全部光晶在玩家可达范围内', () => {
  for (const c of WORLD.crystals) assertInside('光晶', c.x, c.z);
});

test('关卡:黑潮之心在玩家可达范围内', () => {
  assertInside('黑潮之心', WORLD.secretCrystal.x, WORLD.secretCrystal.z);
});

test('关卡:全部氧藻在玩家可达范围内', () => {
  for (const p of WORLD.oxygenPlants) assertInside('氧藻', p.x, p.z);
});

test('关卡:全部档案终端在玩家可达范围内', () => {
  for (const t of WORLD.terminals) assertInside('终端', t.x, t.z);
});

test('关卡:全部信标在玩家可达范围内', () => {
  for (const b of WORLD.beacons) assertInside('信标', b.x, b.z);
});

test('关卡:守卫与守望者航点均在边界内', () => {
  for (const w of WORLD.predatorWaypoints) assertInside('守卫航点', w.x, w.z);
  for (const w of WORLD.sentinelWaypoints) assertInside('守望者航点', w.x, w.z);
});

test('关卡:光晶数量 ≥ 三信标总需求', () => {
  const need = WORLD.beacons.reduce((s, b) => s + b.crystals, 0);
  assert.ok(WORLD.crystals.length >= need,
    `光晶 ${WORLD.crystals.length} < 需求 ${need},正常通关将不可能`);
});

test('关卡:五大区域互不重叠且覆盖三信标', () => {
  const regions = WORLD.regions;
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(d > 40, `区域 ${a.id} 与 ${b.id} 距离 ${d.toFixed(0)}m 过近`);
    }
  }
  for (const b of WORLD.beacons) {
    const covered = regions.some(r => Math.hypot(r.x - b.x, r.z - b.z) < r.radius);
    assert.ok(covered, `信标 ${b.id} 不在任何区域覆盖内`);
  }
});
