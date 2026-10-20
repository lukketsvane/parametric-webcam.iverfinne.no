# Webcam · Parametric Studio

https://parametric-webcam.iverfinne.no

GitHub is the source of truth. Vercel builds `main` with `npm run build` and publishes `dist/` to the connected domain.

The interface is ported from the actual [Parametric Studio source](https://github.com/lukketsvane/parametric.iverfinne.no): `studio.tsx`, `controls-panel.tsx`, `viewer.tsx`, `gesture-params.tsx` and `globals.css`. It retains the white/black system theme, compact bottom dock, native picker, expandable parameter rows, automatic framing and touch gestures. The camera mount replaces the generative sculpture engines. There are no modal export menus or backdrop blur.

One finger orbits, pinch zooms, two-finger drag changes spacing or camera height, and three-finger drag moves the key light. Matte black PLA is the standard preview, with a fine procedural surface texture, soft studio lighting and smooth curved surfaces. Display normals and texture coordinates are separate from the exact indexed CAD mesh used for STL.

The dock downloads STL directly. Overall dimensions remain visible with the dock closed. Undo and redo group each slider drag or touch gesture into one edit; keyboard shortcuts use ⌘/Ctrl Z and ⌘/Ctrl Shift Z. Front, rear and top views help inspect pockets and channels. Model edits and dock resizing preserve the camera angle and relative zoom. Parameter slider limits track the current pocket geometry. Its expanded controls contain OpenSCAD, JSON, import, share and reset actions. PWA metadata, icons and an offline service worker support iOS Home Screen use.

Configure 1 to 14 cameras. Geometry is calculated with Manifold in a Web Worker, with Three.js rendering and a software fallback. Settings persist on the device and in shareable URL hashes.

```sh
npm ci
npm test
npm run build
```

Serve `dist/` using any static server. The original `camera_mount_parametric.scad` defines the geometry. Defaults: two cameras, 140 mm centre spacing, Ø19 mm apertures, 178.4 × 64.2 × 20.5 mm overall. The separate tripod connector is not merged into exported mounts.

Tests verify dimensions, closed topology, outward winding, apertures, pockets, display/export geometry separation, edit history and coalesced touch gestures. STL output uses millimetres and the original print orientation. Confirm physical fit and printer capacity before printing.
