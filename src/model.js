export const DEFAULTS = Object.freeze({
  camera_count: 2, spacing: 140, cam_w: 31, cam_h: 39, cam_d: 18,
  fit: 0.4, lens_d: 19, lens_dy: 0, recess_w: 91, recess_h: 20,
  slop: 0.6, wall: 2.6, face_t: 3.5, corner_r: 2, cable_w: 9,
  cable_d: 6.5, tie_z: 3.6, tie_y: 2.2, tie_back: 1.6,
  t_slot: Object.freeze([12, 3.2]), t_slot_x: 9, t_hole: 3.4, t_hole_x: 22
});

const clamp = (value, fallback, low, high) => {
  const number = Number(value);
  return Math.min(high, Math.max(low, Number.isFinite(number) ? number : fallback));
};

export function normalize(input = {}) {
  const p = { ...DEFAULTS };
  const ranges = {
    camera_count: [1, 14], spacing: [1, 1000], cam_w: [15, 100], cam_h: [15, 120],
    cam_d: [5, 80], fit: [0, 2], lens_d: [2, 100], lens_dy: [-60, 60],
    recess_w: [70, 160], recess_h: [12, 40], slop: [0, 2], wall: [1.2, 8],
    face_t: [1.2, 10], corner_r: [0.5, 12], cable_w: [2, 50], cable_d: [1, 30],
    tie_z: [1, 8], tie_y: [1, 5], tie_back: [0.8, 5],
    t_slot_x: [8, 15], t_hole: [2, 6], t_hole_x: [20, 28]
  };
  for (const [key, [low, high]] of Object.entries(ranges)) {
    p[key] = clamp(input[key] ?? DEFAULTS[key], DEFAULTS[key], low, high);
  }
  p.camera_count = Math.round(p.camera_count);
  p.spacing = Math.max(p.spacing, p.cam_w + p.fit + 2 * p.wall + 15.4);
  p.lens_d = Math.min(p.lens_d, p.cam_w + p.fit - 2, p.cam_h + p.fit - 2);
  const lensTravel = (p.cam_h + p.fit - p.lens_d) / 2 - 1;
  p.lens_dy = Math.max(-lensTravel, Math.min(lensTravel, p.lens_dy));
  p.cable_w = Math.min(p.cable_w, p.cam_w + p.fit - 2);
  p.cable_d = Math.min(p.cable_d, p.cam_d - 2);
  p.tie_back = Math.min(p.tie_back, (p.cam_d - 1) / 3);
  p.tie_z = Math.min(p.tie_z, p.cam_d - 1 - p.tie_back - 0.5);
  p.corner_r = Math.min(p.corner_r, (p.cam_h + p.fit + 2 * p.wall) / 2 - 0.1);
  p.t_slot = [
    clamp(input.t_slot?.[0] ?? DEFAULTS.t_slot[0], 12, 6, 2 * p.t_slot_x - 2),
    clamp(input.t_slot?.[1] ?? DEFAULTS.t_slot[1], 3.2, 2, Math.min(6, p.recess_h - 4))
  ];
  return p;
}

function derive(p) {
  const pocketDepth = p.cam_d - 1;
  const pocketWidth = p.cam_w + p.fit;
  const pocketHeight = p.cam_h + p.fit;
  const outerWidth = pocketWidth + 2 * p.wall;
  const outerHeight = pocketHeight + 2 * p.wall;
  const plateWidth = p.recess_w - p.slop;
  const width = Math.max(plateWidth, (p.camera_count - 1) * p.spacing + outerWidth + 1.8);
  const tongueHeight = p.recess_h - 0.4;
  const odd = p.camera_count % 2 === 1;
  const rowBottom = odd ? Math.max(tongueHeight, 48) : tongueHeight;
  const height = rowBottom + outerHeight;
  const cameraY = rowBottom + outerHeight / 2;
  const depth = p.face_t + pocketDepth;
  const railTop = odd ? rowBottom : height;
  const centers = Array.from({ length: p.camera_count }, (_, i) => (i - (p.camera_count - 1) / 2) * p.spacing);
  return { pocketDepth, pocketWidth, pocketHeight, outerWidth, outerHeight, plateWidth, width, tongueHeight, rowBottom, height, cameraY, depth, railTop, centers };
}

export function dimensions(input = DEFAULTS) {
  const p = normalize(input);
  const d = derive(p);
  return { width: d.width, height: d.height, depth: d.depth, minSpacing: d.outerWidth + 15.4 };
}

function roundedRectangle(width, height, radius) {
  const points = [];
  for (let corner = 0; corner < 4; corner++) {
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
    const cy = (corner < 2 ? 1 : -1) * (height / 2 - radius);
    for (let step = 0; step <= 16; step++) {
      const angle = (corner * 16 + step) * Math.PI / 32;
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  }
  return [points];
}

export function buildModel(module, input = DEFAULTS) {
  const p = normalize(input);
  const d = derive(p);
  const { Manifold } = module;
  const resources = [];
  const keep = value => { resources.push(value); return value; };
  const move = (shape, position) => keep(shape.translate(position));
  const cube = (size, position, center = false) => move(keep(Manifold.cube(size, center)), position);
  const rounded = (width, height, radius, depth, position) => move(keep(Manifold.extrude(roundedRectangle(width, height, radius), depth)), position);
  const cylinder = (diameter, depth, position) => move(keep(Manifold.cylinder(depth, diameter / 2, diameter / 2, 64)), position);
  try {
    const solid = [
      rounded(d.plateWidth, d.height, p.corner_r, p.face_t, [0, d.height / 2, 0]),
      rounded(d.width, d.outerHeight, p.corner_r, p.face_t, [0, d.cameraY, 0])
    ];
    const cut = [];
    for (const sign of [-1, 1]) {
      solid.push(cube([p.wall, d.railTop - d.tongueHeight, d.depth], [sign * (7.7 + p.wall / 2), (d.tongueHeight + d.railTop) / 2, d.depth / 2], true));
      cut.push(cube([p.t_slot[0], p.t_slot[1], p.face_t + 2], [sign * p.t_slot_x - p.t_slot[0] / 2, d.tongueHeight / 2 - p.t_slot[1] / 2, -1]));
      cut.push(cylinder(p.t_hole, p.face_t + 2, [sign * p.t_hole_x, d.tongueHeight / 2, -1]));
    }
    for (const x of d.centers) {
      solid.push(rounded(d.outerWidth, d.outerHeight, 1.2, d.depth, [x, d.cameraY, 0]));
      cut.push(cube([d.pocketWidth, d.pocketHeight, d.pocketDepth + 1], [x - d.pocketWidth / 2, d.cameraY - d.pocketHeight / 2, p.face_t]));
      cut.push(cylinder(p.lens_d, p.face_t + 2, [x, d.cameraY + p.lens_dy, -1]));
      cut.push(cube([p.cable_w, p.wall + 2, p.cable_d + 1], [x - p.cable_w / 2, d.cameraY - d.outerHeight / 2 - 1, d.depth - p.cable_d]));
      for (const sign of [-1, 1]) {
        cut.push(cube([p.wall + 2, p.tie_y, p.tie_z], [x + sign * (d.pocketWidth / 2 + p.wall / 2), d.cameraY, d.depth - p.tie_back - p.tie_z / 2], true));
      }
    }
    const positive = keep(Manifold.union(solid));
    const negative = keep(Manifold.union(cut));
    const result = keep(positive.subtract(negative));
    const volume = result.volume();
    if (!(volume > 0) || result.status() !== 'NoError') throw new Error(`Invalid model: ${result.status()}`);
    const mesh = result.getMesh();
    const positions = new Float32Array(mesh.numVert * 3);
    for (let i = 0; i < mesh.numVert; i++) {
      positions[i * 3] = mesh.vertProperties[i * mesh.numProp];
      positions[i * 3 + 1] = mesh.vertProperties[i * mesh.numProp + 1] - d.height / 2;
      positions[i * 3 + 2] = d.depth / 2 - mesh.vertProperties[i * mesh.numProp + 2];
    }
    const indices = new Uint32Array(mesh.triVerts.length);
    for (let i = 0; i < indices.length; i += 3) {
      indices[i] = mesh.triVerts[i];
      indices[i + 1] = mesh.triVerts[i + 2];
      indices[i + 2] = mesh.triVerts[i + 1];
    }
    return { positions, indices, volume, dimensions: dimensions(p), triangles: indices.length / 3 };
  } finally {
    for (let i = resources.length - 1; i >= 0; i--) resources[i].delete();
  }
}

export function generateScad(input = DEFAULTS) {
  const p = normalize(input);
  const values = Object.keys(DEFAULTS).map(key => `${key} = ${JSON.stringify(p[key])};`).join('\n');
  return `${values}\n$fn = 64;\n\n${SCAD_BODY}`;
}

const SCAD_BODY = "module rrect(w, h, r) {\n    hull() for (sx = [-1, 1], sy = [-1, 1])\n        translate([sx*(w/2 - r), sy*(h/2 - r)]) circle(r = r);\n}\n\npocket_d = cam_d - 1.0;\npock_w = cam_w + fit;\npock_h = cam_h + fit;\nout_w = pock_w + 2*wall;\nout_h = pock_h + 2*wall;\nplate_w = recess_w - slop;\nupper_w = max(plate_w, (camera_count - 1)*spacing + out_w + 1.8);\nkey_gap = 15.4;\nkey_top = 46.0;\ntongue_h = recess_h - 0.4;\nodd_count = camera_count % 2 == 1;\nrow_bottom = odd_count ? max(tongue_h, key_top + 2.0) : tongue_h;\nplate_h = row_bottom + out_h;\ncam_cy = row_bottom + out_h/2;\nz_back = face_t + pocket_d;\nrail_top = odd_count ? row_bottom : plate_h;\nxs = [for (i = [0:camera_count - 1]) (i - (camera_count - 1)/2)*spacing];\n\nassert(camera_count >= 1 && camera_count <= 14 && camera_count == floor(camera_count), \"camera_count must be an integer from 1 to 14\");\nassert(camera_count == 1 || spacing >= out_w + key_gap, str(\"spacing must be at least \", out_w + key_gap, \" mm for this camera size and adapter\"));\necho(camera_count = camera_count, spacing_mm = spacing, overall_mm = [upper_w, plate_h, z_back]);\n\ndifference() {\n    union() {\n        translate([0, plate_h/2, 0])\n            linear_extrude(face_t) rrect(plate_w, plate_h, corner_r);\n        translate([0, cam_cy, 0])\n            linear_extrude(face_t) rrect(upper_w, out_h, corner_r);\n        for (s = [-1, 1])\n            translate([s*(key_gap/2 + wall/2), (tongue_h + rail_top)/2, z_back/2])\n                cube([wall, rail_top - tongue_h, z_back], center = true);\n        for (x = xs) translate([x, cam_cy, 0])\n            linear_extrude(z_back) rrect(out_w, out_h, 1.2);\n    }\n\n    for (x = xs) translate([x, cam_cy, face_t])\n        linear_extrude(pocket_d + 1) square([pock_w, pock_h], center = true);\n\n    for (x = xs) translate([x, cam_cy + lens_dy, -1])\n        cylinder(d = lens_d, h = face_t + 2);\n\n    for (x = xs) translate([x - cable_w/2, cam_cy - out_h/2 - 1, z_back - cable_d])\n        cube([cable_w, wall + 2, cable_d + 1]);\n\n    for (x = xs, s = [-1, 1])\n        translate([x + s*(pock_w/2 + wall/2), cam_cy, z_back - tie_back - tie_z/2])\n            cube([wall + 2, tie_y, tie_z], center = true);\n\n    for (s = [-1, 1]) {\n        translate([s*t_slot_x, tongue_h/2, -1])\n            linear_extrude(face_t + 2)\n                square([t_slot[0], t_slot[1]], center = true);\n        translate([s*t_hole_x, tongue_h/2, -1])\n            cylinder(d = t_hole, h = face_t + 2);\n    }\n}\n";
