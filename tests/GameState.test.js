import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameStateMachine, States } from '../src/core/GameState.js';

test('状态机:合法迁移链 TITLE→PLAYING⇄PAUSED→VICTORY', () => {
  const sm = new GameStateMachine(() => {});
  sm.go(States.TITLE);
  sm.go(States.PLAYING);
  sm.go(States.PAUSED);
  sm.go(States.PLAYING);
  sm.go(States.VICTORY);
  assert.equal(sm.state, States.VICTORY);
});

test('状态机:非法迁移抛错', () => {
  const sm = new GameStateMachine(() => {});
  sm.go(States.TITLE);
  assert.throws(() => sm.go(States.VICTORY), /非法状态迁移/);
});

test('状态机:startRun/endRun 记录统计', () => {
  const events = [];
  const sm = new GameStateMachine((t, p) => events.push(t));
  sm.go(States.TITLE);
  sm.startRun();
  assert.equal(sm.state, States.PLAYING);
  assert.ok(sm.runStats.startTime > 0);
  sm.endRun('victory', { hits: 1 });
  assert.equal(sm.state, States.VICTORY);
  assert.equal(sm.runStats.hits, 1);
  assert.ok(sm.runStats.endTime >= sm.runStats.startTime);
});

test('状态机:running 属性', () => {
  const sm = new GameStateMachine(() => {});
  sm.go(States.TITLE);
  assert.equal(sm.running, false);
  sm.go(States.PLAYING);
  assert.equal(sm.running, true);
});
