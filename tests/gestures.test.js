import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupGestures } from '../src/gestures.js';

function fixture(camera = new THREE.PerspectiveCamera()) {
  const frames = new Map();
  let sequence = 0;
  const previous = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.window = new EventTarget();
  globalThis.requestAnimationFrame = callback => { const id = ++sequence; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const canvas = new EventTarget();
  let activeCamera = camera;
  camera.position.set(0, 0, 200);
  const controls = { target: new THREE.Vector3(), enabled: true, minDistance: 100, maxDistance: 300, update() {} };
  const nudges = [];
  const lights = [];
  const edits = [];
  const positions = new Map();
  const cleanup = setupGestures({ canvas, getCamera: () => activeCamera, controls, onNudge: (...args) => nudges.push(args), onLight: (...args) => lights.push(args), onEditStart: () => edits.push('start'), onEditEnd: () => edits.push('end'), render() {} });
  const send = (type, id, x, y, pointerType = 'touch') => {
    if (x === undefined) [x, y] = positions.get(id) || [0, 0];
    positions.set(id, [x, y]);
    const event = new Event(type);
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType });
    (type === 'pointerdown' ? canvas : window).dispatchEvent(event);
  };
  return {
    canvas, get camera() { return activeCamera; }, useCamera(next) { activeCamera = next; }, controls, nudges, lights, edits, send,
    tick() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); },
    pending: () => frames.size,
    blur: () => window.dispatchEvent(new Event('blur')),
    dispose() { cleanup(); Object.assign(globalThis, previous); }
  };
}

for (const [axis, initial, delta] of [
  ['horizontal', [[0, 0], [100, 0]], [20, 0]],
  ['vertical', [[0, 0], [0, 100]], [0, -20]]
]) {
  test(`parallel two-finger ${axis} movement shapes once per frame without pinch`, () => {
    const f = fixture();
    try {
      f.send('pointerdown', 1, ...initial[0]);
      f.send('pointerdown', 2, ...initial[1]);
      f.camera.position.x = 15;
      f.send('pointermove', 1, initial[0][0] + delta[0], initial[0][1] + delta[1]);
      f.send('pointermove', 2, initial[1][0] + delta[0], initial[1][1] + delta[1]);
      assert.equal(f.nudges.length, 0);
      assert.equal(f.pending(), 1);
      f.tick();
      assert.deepEqual(f.nudges, [[axis, 20]]);
      assert.deepEqual(f.camera.position.toArray(), [0, 0, 200]);
      assert.deepEqual(f.edits, ['start']);
      f.send('pointerup', 1);
      assert.deepEqual(f.edits, ['start']);
      f.send('pointerup', 2);
      assert.deepEqual(f.edits, ['start', 'end']);
      assert.equal(f.controls.enabled, true);
    } finally { f.dispose(); }
  });
}

test('pointerup flushes final pending displacement before ending the edit', () => {
  const f = fixture();
  try {
    f.send('pointerdown', 1, 0, 0);
    f.send('pointerdown', 2, 100, 0);
    f.send('pointermove', 1, 20, 0);
    f.send('pointermove', 2, 120, 0);
    f.send('pointerup', 1);
    assert.deepEqual(f.nudges, [['horizontal', 20]]);
    assert.equal(f.pending(), 0);
    f.send('pointerup', 2);
    f.tick();
    assert.deepEqual(f.nudges, [['horizontal', 20]]);
    assert.deepEqual(f.edits, ['start', 'end']);
  } finally { f.dispose(); }
});

test('repeated frames stay in one edit and retain all parameter displacement', () => {
  const f = fixture();
  try {
    f.send('pointerdown', 1, 0, 0);
    f.send('pointerdown', 2, 100, 0);
    for (let x = 20; x <= 80; x += 20) {
      f.send('pointermove', 1, x, 0);
      f.send('pointermove', 2, 100 + x, 0);
      f.tick();
    }
    f.send('pointerup', 1);
    f.send('pointerup', 2);
    assert.equal(f.nudges.reduce((sum, entry) => sum + entry[1], 0), 80);
    assert.deepEqual(f.edits, ['start', 'end']);
  } finally { f.dispose(); }
});

test('pinch keeps camera dolly behavior and millimetre distance limits without edits', () => {
  const f = fixture();
  try {
    f.send('pointerdown', 1, 0, 0);
    f.send('pointerdown', 2, 100, 0);
    f.send('pointermove', 2, 1000, 0);
    f.tick();
    assert.equal(f.camera.position.length(), 100);
    f.send('pointermove', 2, 10, 0);
    f.tick();
    assert.equal(f.camera.position.length(), 300);
    f.send('pointerup', 1);
    f.send('pointerup', 2);
    assert.deepEqual(f.nudges, []);
    assert.deepEqual(f.edits, []);
  } finally { f.dispose(); }
});

test('one finger and subthreshold multi-touch do not start parameter edits', () => {
  const f = fixture();
  try {
    f.send('pointerdown', 1, 0, 0);
    f.send('pointermove', 1, 20, 0);
    assert.equal(f.controls.enabled, true);
    f.send('pointerdown', 2, 120, 0);
    f.send('pointermove', 1, 22, 0);
    f.send('pointermove', 2, 122, 0);
    f.tick();
    assert.deepEqual(f.edits, []);
    assert.deepEqual(f.nudges, []);
    f.send('pointerup', 1);
    f.send('pointerup', 2);
  } finally { f.dispose(); }
});

test('third finger ends parameter edit, restores camera, and locks gesture to lighting', () => {
  const f = fixture();
  try {
    f.send('pointerdown', 1, 0, 0);
    f.camera.position.x = 20;
    f.send('pointerdown', 2, 100, 0);
    f.send('pointermove', 1, 20, 0);
    f.send('pointermove', 2, 120, 0);
    f.tick();
    f.send('pointerdown', 3, 70, 100);
    assert.deepEqual(f.edits, ['start', 'end']);
    assert.deepEqual(f.camera.position.toArray(), [0, 0, 200]);
    f.send('pointermove', 1, 30, 0);
    f.send('pointermove', 2, 130, 0);
    f.send('pointermove', 3, 80, 100);
    f.tick();
    assert.deepEqual(f.lights, [[10, 0]]);
    f.send('pointerup', 3);
    f.send('pointermove', 2, 160, 0);
    f.tick();
    assert.equal(f.nudges.length, 1);
    assert.equal(f.controls.enabled, false);
    f.send('pointerup', 1);
    f.send('pointerup', 2);
    assert.equal(f.controls.enabled, true);
  } finally { f.dispose(); }
});

for (const end of ['blur', 'cancel', 'unmount']) {
  test(`${end} flushes and ends an interrupted parameter edit once`, () => {
    const f = fixture();
    let disposed = false;
    try {
      f.send('pointerdown', 1, 0, 0);
      f.send('pointerdown', 2, 100, 0);
      f.send('pointermove', 1, 20, 0);
      f.send('pointermove', 2, 120, 0);
      f.tick();
      f.send('pointermove', 1, 30, 0);
      f.send('pointermove', 2, 130, 0);
      if (end === 'blur') f.blur();
      else if (end === 'cancel') f.send('pointercancel', 1);
      else { f.dispose(); disposed = true; }
      assert.deepEqual(f.edits, ['start', 'end']);
      assert.deepEqual(f.nudges, [['horizontal', 20], ['horizontal', 10]]);
      assert.equal(f.controls.enabled, true);
      assert.equal(f.pending(), 0);
      if (!disposed) {
        f.send('pointerup', 1);
        f.send('pointerup', 2);
        assert.deepEqual(f.edits, ['start', 'end']);
      }
    } finally { if (!disposed) f.dispose(); }
  });
}

test('orthographic pinch changes zoom without moving the camera and respects zoom limits', () => {
  const camera = new THREE.OrthographicCamera(-100,100,100,-100,.1,1000);
  const f = fixture(camera);
  f.controls.minZoom=.5;f.controls.maxZoom=2;
  try {
    f.send('pointerdown',1,0,0);f.send('pointerdown',2,100,0);
    f.send('pointermove',1,-25,0);f.send('pointermove',2,125,0);f.tick();
    assert.equal(camera.zoom,1.5);
    assert.deepEqual(camera.position.toArray(),[0,0,200]);
    f.send('pointermove',1,-250,0);f.send('pointermove',2,350,0);f.tick();
    assert.equal(camera.zoom,2);
    f.send('pointermove',1,49,0);f.send('pointermove',2,51,0);f.tick();
    assert.equal(camera.zoom,.5);
    assert.deepEqual(f.nudges,[]);assert.deepEqual(f.edits,[]);
  } finally { f.dispose(); }
});

test('gestures use the active camera after changing projection', () => {
  const f=fixture(),previous=f.camera;
  const next=new THREE.OrthographicCamera(-100,100,100,-100,.1,1000);next.position.set(0,0,200);
  f.useCamera(next);
  try {
    f.send('pointerdown',1,0,0);f.send('pointerdown',2,100,0);
    f.send('pointermove',1,-25,0);f.send('pointermove',2,125,0);f.tick();
    assert.equal(next.zoom,1.5);assert.equal(previous.zoom,1);
    assert.deepEqual(previous.position.toArray(),[0,0,200]);
  } finally { f.dispose(); }
});
