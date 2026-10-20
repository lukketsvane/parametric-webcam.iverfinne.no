import * as THREE from 'three';

export function setupGestures({ canvas, camera, controls, onNudge, onLight, onEditStart, onEditEnd, render }) {
  const points = new Map();
  let mode = 'none';
  let last = { cx: 0, cy: 0, d: 0 };
  let snapshot = null;
  let frame = null;
  let editing = false;
  const endEdit = () => {
    if (!editing) return;
    editing = false;
    onEditEnd?.();
  };
  const restoreCamera = () => {
    if (!snapshot) return;
    camera.position.copy(snapshot.position);
    if (controls?.target) {
      controls.target.copy(snapshot.target);
      controls.update?.();
    }
    render();
  };
  const measure = () => {
    const [a, b] = points.values();
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const centroid = () => {
    let x = 0;
    let y = 0;
    for (const point of points.values()) {
      x += point.x;
      y += point.y;
    }
    return { x: x / points.size, y: y / points.size };
  };
  const process = () => {
    if (mode === 'light') {
      if (points.size < 3) return;
      const center = centroid();
      const dx = center.x - last.cx;
      const dy = center.y - last.cy;
      if (dx || dy) onLight?.(dx, dy);
      last = { cx: center.x, cy: center.y, d: 0 };
      return;
    }
    if (points.size !== 2) return;
    const center = measure();
    const dx = center.cx - last.cx;
    const dy = center.cy - last.cy;
    const dd = center.d - last.d;
    if (mode === 'none') {
      if (Math.abs(dd) > Math.max(Math.abs(dx), Math.abs(dy)) * 1.2 && Math.abs(dd) > 5) {
        mode = 'pinch';
      } else if (Math.abs(dy) > Math.abs(dx) * 1.3 && Math.abs(dy) > 5) {
        mode = 'vertical';
      } else if (Math.abs(dx) > Math.abs(dy) * 1.3 && Math.abs(dx) > 5) {
        mode = 'horizontal';
      } else {
        return;
      }
      if (mode !== 'pinch') {
        restoreCamera();
        if (!editing) {
          editing = true;
          onEditStart?.();
        }
      }
    }
    if (mode === 'pinch') {
      if (last.d > 0 && center.d > 0) {
        const target = controls?.target?.clone() ?? new THREE.Vector3();
        const offset = camera.position.clone().sub(target);
        const distance = THREE.MathUtils.clamp(
          offset.length() * last.d / center.d,
          controls?.minDistance ?? 0,
          controls?.maxDistance ?? Infinity
        );
        camera.position.copy(target).add(offset.setLength(distance));
        controls?.update?.();
        render();
      }
    } else if (mode === 'vertical') {
      if (dy) onNudge('vertical', -dy);
    } else if (dx) {
      onNudge('horizontal', dx);
    }
    last = center;
  };
  const flush = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    process();
  };
  const down = event => {
    if (event.pointerType !== 'touch') return;
    flush();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 1) {
      snapshot = {
        position: camera.position.clone(),
        target: controls?.target?.clone() ?? new THREE.Vector3()
      };
    }
    if (points.size === 2 && mode !== 'light') {
      mode = 'none';
      last = measure();
      if (controls) controls.enabled = false;
    }
    if (points.size >= 3) {
      const wasLight = mode === 'light';
      mode = 'light';
      endEdit();
      const center = centroid();
      last = { cx: center.x, cy: center.y, d: 0 };
      if (controls) controls.enabled = false;
      if (!wasLight) restoreCamera();
    }
  };
  const move = event => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size < 2 || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      process();
    });
  };
  const finish = () => {
    flush();
    points.clear();
    mode = 'none';
    snapshot = null;
    endEdit();
    if (controls) controls.enabled = true;
  };
  const up = event => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    flush();
    points.delete(event.pointerId);
    if (points.size === 0) finish();
    else if (mode === 'light') {
      const center = centroid();
      last = { cx: center.x, cy: center.y, d: 0 };
    } else if (points.size < 2) mode = 'none';
  };
  const cancel = event => {
    if (points.has(event.pointerId)) finish();
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', finish);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', finish);
    finish();
  };
}
