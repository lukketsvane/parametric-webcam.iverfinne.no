import Module from 'manifold-3d';
import { buildModel } from './model.js';

const ready = Module({ locateFile: () => new URL('./manifold.wasm', import.meta.url).href }).then(module => {
  module.setup();
  return module;
});

self.onmessage = async ({ data: { id, params } }) => {
  try {
    const result = buildModel(await ready, params);
    self.postMessage({ id, ...result }, [result.positions.buffer, result.indices.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
