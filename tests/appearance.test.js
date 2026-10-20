import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import Module from 'manifold-3d';
import {createDisplayGeometry} from '../src/appearance.js';
import {buildModel} from '../src/model.js';

test('display smoothing preserves every CAD triangle and leaves indexed export geometry intact',async()=>{
 const module=await Module();module.setup();
 const model=buildModel(module);
 const source=new THREE.BufferGeometry();
 source.setAttribute('position',new THREE.BufferAttribute(model.positions,3));
 source.setIndex(new THREE.BufferAttribute(model.indices,1));
 const originalPositions=model.positions.slice(),originalIndices=model.indices.slice();
 const display=createDisplayGeometry(source);
 assert.equal(display.index,null);
 assert.equal(display.attributes.position.count,model.indices.length);
 for(let i=0;i<model.indices.length;i++)for(let axis=0;axis<3;axis++)assert.equal(display.attributes.position.array[i*3+axis],model.positions[model.indices[i]*3+axis]);
 assert.deepEqual(source.attributes.position.array,originalPositions);
 assert.deepEqual(source.index.array,originalIndices);
 assert.ok([...display.attributes.normal.array,...display.attributes.uv.array].every(Number.isFinite));
 source.dispose();display.dispose();
});

test('rounded surfaces are smooth while right-angle edges remain sharp',()=>{
 const box=new THREE.BoxGeometry(2,2,2),displayBox=createDisplayGeometry(box);
 for(let i=0;i<displayBox.attributes.normal.count;i++){
  const normal=new THREE.Vector3().fromBufferAttribute(displayBox.attributes.normal,i);
  assert.ok(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z))>.999);
 }
 const cylinder=new THREE.CylinderGeometry(2,2,4,32),displayCylinder=createDisplayGeometry(cylinder);
 let smoothSides=0;
 for(let i=0;i<displayCylinder.attributes.normal.count;i++){
  const normal=new THREE.Vector3().fromBufferAttribute(displayCylinder.attributes.normal,i);
  assert.ok(Math.abs(normal.length()-1)<1e-6);
  if(Math.abs(normal.y)<1e-6&&Math.abs(normal.x)>.1&&Math.abs(normal.z)>.1)smoothSides++;
 }
 assert.ok(smoothSides>80);
 for(const geometry of [box,displayBox,cylinder,displayCylinder])geometry.dispose();
});
