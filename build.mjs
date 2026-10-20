import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});
await build({entryPoints:['src/app.js','src/model-worker.js'],outdir:'dist/assets',bundle:true,format:'esm',minify:true,target:'es2022',external:['module'],entryNames:'[name]'});
await Promise.all([copyFile('src/index.html','dist/index.html'),copyFile('src/style.css','dist/assets/style.css'),copyFile('node_modules/manifold-3d/manifold.wasm','dist/assets/manifold.wasm')]);
