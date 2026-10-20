import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/history.js';

const state = spacing => ({ spacing, camera_count: 2, t_slot: [12, 3.2] });

test('records parameter changes and ignores duplicates', () => {
  const history = createHistory(state(140));
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.record(state(140)), false);
  assert.equal(history.record(state(150)), true);
  assert.deepEqual(history.undo(), state(140));
  assert.equal(history.undo(), null);
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.redo(), state(150));
  assert.equal(history.redo(), null);
});

test('a slider drag is one undo step even with repeated begins', () => {
  const history = createHistory(state(140));
  history.begin();
  history.record(state(145));
  history.begin();
  history.record(state(150));
  history.record(state(180));
  assert.equal(history.canUndo, true);
  history.end();
  history.end();
  assert.deepEqual(history.undo(), state(140));
  assert.equal(history.undo(), null);
  assert.deepEqual(history.redo(), state(180));
});

test('undo commits a pending gesture before stepping back', () => {
  const history = createHistory(state(140));
  history.record(state(150));
  history.begin();
  history.record(state(180));
  assert.deepEqual(history.undo(), state(150));
  assert.deepEqual(history.redo(), state(180));
  assert.deepEqual(history.undo(), state(150));
  assert.deepEqual(history.undo(), state(140));
});

test('completed edits after undo discard the redo branch', () => {
  const history = createHistory(state(140));
  history.record(state(150));
  history.record(state(180));
  history.undo();
  history.begin();
  history.record(state(170));
  assert.equal(history.canRedo, false);
  history.end();
  assert.equal(history.redo(), null);
  assert.deepEqual(history.undo(), state(150));
  assert.deepEqual(history.redo(), state(170));
});

test('no-op gestures preserve the redo branch', () => {
  const history = createHistory(state(140));
  history.record(state(150));
  history.undo();
  history.begin();
  history.record(state(145));
  history.record(state(140));
  history.end();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.redo(), state(150));
});

test('input and returned arrays cannot mutate stored snapshots', () => {
  const initial = state(140);
  const history = createHistory(initial);
  initial.t_slot[0] = 999;
  const edited = state(150);
  history.record(edited);
  edited.t_slot[1] = 999;
  const original = history.undo();
  assert.deepEqual(original, state(140));
  original.t_slot[0] = 999;
  const restored = history.redo();
  assert.deepEqual(restored, state(150));
  restored.t_slot[1] = 999;
  assert.deepEqual(history.undo(), state(140));
  assert.deepEqual(history.redo(), state(150));
});

test('history is bounded without losing the current configuration', () => {
  const history = createHistory(state(140), 3);
  for (const spacing of [150, 160, 170, 180]) history.record(state(spacing));
  assert.deepEqual(history.undo(), state(170));
  assert.deepEqual(history.undo(), state(160));
  assert.equal(history.undo(), null);
  assert.deepEqual(history.redo(), state(170));
  assert.deepEqual(history.redo(), state(180));
});
