camera_count = 2;
spacing = 140.0;
cam_w = 31.0;
cam_h = 39.0;
cam_d = 18.0;
fit = 0.40;
lens_d = 19.0;
lens_dy = 0.0;
recess_w = 91.0;
recess_h = 20.0;
slop = 0.6;
wall = 2.6;
face_t = 3.5;
corner_r = 2.0;
cable_w = 9.0;
cable_d = 6.5;
tie_z = 3.6;
tie_y = 2.2;
tie_back = 1.6;
t_slot = [12.0, 3.2];
t_slot_x = 9.0;
t_hole = 3.4;
t_hole_x = 22.0;
$fn = 64;

module rrect(w, h, r) {
    hull() for (sx = [-1, 1], sy = [-1, 1])
        translate([sx*(w/2 - r), sy*(h/2 - r)]) circle(r = r);
}

pocket_d = cam_d - 1.0;
pock_w = cam_w + fit;
pock_h = cam_h + fit;
out_w = pock_w + 2*wall;
out_h = pock_h + 2*wall;
plate_w = recess_w - slop;
upper_w = max(plate_w, (camera_count - 1)*spacing + out_w + 1.8);
key_gap = 15.4;
key_top = 46.0;
tongue_h = recess_h - 0.4;
odd_count = camera_count % 2 == 1;
row_bottom = odd_count ? max(tongue_h, key_top + 2.0) : tongue_h;
plate_h = row_bottom + out_h;
cam_cy = row_bottom + out_h/2;
z_back = face_t + pocket_d;
rail_top = odd_count ? row_bottom : plate_h;
xs = [for (i = [0:camera_count - 1]) (i - (camera_count - 1)/2)*spacing];

assert(camera_count >= 1 && camera_count <= 14 && camera_count == floor(camera_count), "camera_count must be an integer from 1 to 14");
assert(camera_count == 1 || spacing >= out_w + key_gap, str("spacing must be at least ", out_w + key_gap, " mm for this camera size and adapter"));
echo(camera_count = camera_count, spacing_mm = spacing, overall_mm = [upper_w, plate_h, z_back]);

difference() {
    union() {
        translate([0, plate_h/2, 0])
            linear_extrude(face_t) rrect(plate_w, plate_h, corner_r);
        translate([0, cam_cy, 0])
            linear_extrude(face_t) rrect(upper_w, out_h, corner_r);
        for (s = [-1, 1])
            translate([s*(key_gap/2 + wall/2), (tongue_h + rail_top)/2, z_back/2])
                cube([wall, rail_top - tongue_h, z_back], center = true);
        for (x = xs) translate([x, cam_cy, 0])
            linear_extrude(z_back) rrect(out_w, out_h, 1.2);
    }

    for (x = xs) translate([x, cam_cy, face_t])
        linear_extrude(pocket_d + 1) square([pock_w, pock_h], center = true);

    for (x = xs) translate([x, cam_cy + lens_dy, -1])
        cylinder(d = lens_d, h = face_t + 2);

    for (x = xs) translate([x - cable_w/2, cam_cy - out_h/2 - 1, z_back - cable_d])
        cube([cable_w, wall + 2, cable_d + 1]);

    for (x = xs, s = [-1, 1])
        translate([x + s*(pock_w/2 + wall/2), cam_cy, z_back - tie_back - tie_z/2])
            cube([wall + 2, tie_y, tie_z], center = true);

    for (s = [-1, 1]) {
        translate([s*t_slot_x, tongue_h/2, -1])
            linear_extrude(face_t + 2)
                square([t_slot[0], t_slot[1]], center = true);
        translate([s*t_hole_x, tongue_h/2, -1])
            cylinder(d = t_hole, h = face_t + 2);
    }
}
