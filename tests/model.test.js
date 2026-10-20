import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { DEFAULTS, normalize, dimensions, buildModel, generateScad } from '../src/model.js';

const module = await Module();
module.setup();

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis], positions[i]);
    max[axis] = Math.max(max[axis], positions[i]);
  }
  return { min, max };
}

function intersections(model, x, y) {
  const hits = [];
  for (let i = 0; i < model.indices.length; i += 3) {
    const vertices = Array.from(model.indices.slice(i, i + 3), index => model.positions.slice(index * 3, index * 3 + 3));
    const [a, b, c] = vertices;
    const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(determinant) < 1e-10) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / determinant;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / determinant;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) hits.push(u * a[2] + v * b[2] + (1 - u - v) * c[2]);
  }
  return hits.filter((value, index) => hits.findIndex(other => Math.abs(value - other) < 1e-4) === index).sort((a, b) => a - b);
}

function verifyMesh(model, expected) {
  assert.ok(model.volume > 0);
  assert.ok(model.triangles > 100);
  assert.equal(model.indices.length, model.triangles * 3);
  assert.ok([...model.positions].every(Number.isFinite));
  const actual = bounds(model.positions);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(actual.min[axis] + expected[axis] / 2) < 0.001);
    assert.ok(Math.abs(actual.max[axis] - expected[axis] / 2) < 0.001);
  }
  const edges = new Map();
  let signedVolume = 0;
  for (let i = 0; i < model.indices.length; i += 3) {
    const face = model.indices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = face[j];
      const b = face[(j + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const counts = edges.get(key) || [0, 0];
      counts[0]++;
      counts[1] += a < b ? 1 : -1;
      edges.set(key, counts);
    }
    const [a, b, c] = Array.from(face, index => model.positions.slice(index * 3, index * 3 + 3));
    signedVolume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  for (const counts of edges.values()) assert.deepEqual(counts, [2, 0]);
  assert.ok(Math.abs(signedVolume - model.volume) / model.volume < 1e-5);
}

for (const [count, expected] of [[1, [90.4, 92.6, 20.5]], [2, [178.4, 64.2, 20.5]], [3, [318.4, 92.6, 20.5]], [14, [1858.4, 64.2, 20.5]]]) {
  test(`${count} cameras: dimensions, closed topology, positive winding, lens apertures and pockets`, () => {
    const model = buildModel(module, { camera_count: count });
    verifyMesh(model, expected);
    const rowBottom = count % 2 ? 48 : 19.6;
    const cameraY = rowBottom + 44.6 / 2 - expected[1] / 2;
    for (let camera = 0; camera < count; camera++) {
      const cameraX = (camera - (count - 1) / 2) * 140;
      assert.equal(intersections(model, cameraX + 0.13, cameraY + 0.17).length, 0);
      const floor = intersections(model, cameraX + 11, cameraY + 0.17);
      assert.equal(floor.length, 2);
      assert.ok(Math.abs(floor[0] - 6.75) < 0.001);
      assert.ok(Math.abs(floor[1] - 10.25) < 0.001);
      const wall = intersections(model, cameraX + 17, cameraY + 5.17);
      assert.equal(wall.length, 2);
      assert.ok(Math.abs(wall[0] + 10.25) < 0.001);
      assert.ok(Math.abs(wall[1] - 10.25) < 0.001);
    }
  });
}

test('minimum spacing preserves connected valid geometry', () => {
  const p = normalize({ camera_count: 2, spacing: 1 });
  assert.equal(p.spacing, 52);
  verifyMesh(buildModel(module, p), [90.4, 64.2, 20.5]);
});

test('changed camera dimensions produce matching bounds', () => {
  const p = { camera_count: 3, spacing: 115, cam_w: 43, cam_h: 51, cam_d: 25, wall: 3.2, face_t: 4, lens_d: 22 };
  verifyMesh(buildModel(module, p), [281.6, 105.8, 28]);
});

test('normalization bounds invalid inputs and leaves defaults intact', () => {
  const p = normalize({ camera_count: 99, spacing: -1, cam_w: NaN, lens_d: 999, lens_dy: 999, cam_d: -4 });
  assert.equal(p.camera_count, 14);
  assert.equal(p.cam_w, DEFAULTS.cam_w);
  assert.equal(p.spacing, 52);
  assert.equal(p.cam_d, 5);
  assert.ok(p.lens_d <= p.cam_w + p.fit - 2);
  assert.ok(Math.abs(p.lens_dy) + p.lens_d / 2 <= (p.cam_h + p.fit) / 2 - 1);
  assert.equal(DEFAULTS.camera_count, 2);
  assert.deepEqual(dimensions(), { width: 178.4, height: 64.2, depth: 20.5, minSpacing: 52 });
});

test('SCAD export carries normalized parameters and original boolean geometry', () => {
  const source = generateScad({ camera_count: 3, spacing: 100, fit: 0.6 });
  assert.match(source, /^camera_count = 3;/);
  assert.match(source, /spacing = 100;/);
  assert.match(source, /fit = 0.6;/);
  assert.match(source, /\$fn = 64;/);
  assert.match(source, /difference\(\)\s*\{\s*union\(\)/);
  assert.match(source, /cube\(\[wall \+ 2, tie_y, tie_z\], center = true\)/);
  assert.match(source, /assert\(camera_count >= 1 && camera_count <= 14/);
});
