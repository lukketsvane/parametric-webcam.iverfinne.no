# Webcam · Parametric Studio

A mobile-friendly parametric editor for the original webcam mount. Configure 1–14 cameras, adjust body and adapter dimensions, inspect front/rear/isometric views, and export STL, OpenSCAD or JSON. Settings persist locally and in shareable URL hashes.

The interface follows the studio patterns in [parametric.iverfinne.no](https://github.com/lukketsvane/parametric.iverfinne.no): a quiet model stage, direct parameter controls, orbit navigation, automatic framing and shareable state. The focused browser app uses Three.js directly and computes exact solid geometry with Manifold in a Web Worker. All runtime dependencies are bundled locally.

## Development

```sh
npm ci
npm test
npm run build
```

Serve `dist/` using any static web server. The repository root also contains the built app for static hosting. No server or secrets are required.

The original `camera_mount_parametric.scad` defines the geometry. Defaults are 2 cameras, 140 mm centre spacing and Ø19 mm lens apertures. Bounds are 178.4 × 64.2 × 20.5 mm. Odd camera counts preserve the raised camera row from the source. The separate tripod connector is not merged into exported mounts.

Geometry tests verify dimensions, closed topology, outward winding, lens apertures, pocket depth and edited parameter combinations. STL files use millimetres and retain the source print orientation. Large arrays can exceed a printer’s build volume; physical fit still requires a test print.

A software renderer keeps inspection usable when WebGL is unavailable. The browser verification environment has WebGL disabled, so the GPU render path could not be visually checked there.
