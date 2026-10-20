# Webcam studio design

Reference: https://parametric.iverfinne.no/, inspected 20 October 2026. GitHub source: lukketsvane/parametric.iverfinne.no, main tree 6a52ea64d4310dc17ba8cac4765914c4633bc7fa.

Observed in the screenshot and source: a large model stage, system sans-serif, a sparse white canvas, monochrome controls, bottom floating toolbar, demand-driven Three.js rendering, automatic framing and shareable URL parameter state. The reference uses a 32-degree perspective camera, capped device pixel ratio and no visible panel shadows.

The webcam editor adapts these patterns to a precise manufacturing task: persistent 326 px sidebar on desktop, compact bottom controls on phones, a warm white stage (#f5f6f2), restrained green-gray control accents, 1 px borders and system typography. It adds explicit millimetre units, editable numeric values, geometry constraints and export choices. These dimensions and colors are proposed values, not claims of pixel-perfect reference reproduction.

Mobile layout is triggered at 700 px. Primary actions remain in the header. Layout, Camera and Mount tabs contain related controls; secondary retention geometry sits in a disclosure. The model remains visible while the compact panel scrolls independently.
