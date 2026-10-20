import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DEFAULTS,normalize,dimensions} from '../src/model.js';
import {VIEW_DIRECTIONS,boxCorners,frameCamera} from '../src/view.js';
import {projectMeasurements,measurementMarkup} from '../src/measurements.js';

function boundsFor(params){
 const d=dimensions(params);
 return new THREE.Box3(new THREE.Vector3(-d.width/2,-d.height/2,-d.depth/2),new THREE.Vector3(d.width/2,d.height/2,d.depth/2));
}

for(const count of [1,2,3,14])test(`${count} cameras fit phone, expanded dock, landscape and desktop without clipping`,()=>{
 const bounds=boundsFor({...DEFAULTS,camera_count:count});
 for(const [width,height]of [[390,760],[390,320],[320,200],[1363,780]]){
  for(const direction of Object.values(VIEW_DIRECTIONS))for(const parallel of [false,true]){
   const camera=parallel?new THREE.OrthographicCamera():new THREE.PerspectiveCamera(32);
   frameCamera(camera,bounds,{width,height,direction,padding:48});
   for(const corner of boxCorners(bounds)){
    const p=corner.project(camera);
    assert.ok(Math.abs(p.x)<=1-2*Math.min(48,width*.25)/width+1e-6,`${width}×${height} x=${p.x}`);
    assert.ok(Math.abs(p.y)<=1-2*Math.min(48,height*.25)/height+1e-6,`${width}×${height} y=${p.y}`);
    assert.ok(p.z>=-1&&p.z<=1);
   }
  }
 }
});

test('orthographic inspection preserves lengths at different depths',()=>{
 const camera=new THREE.OrthographicCamera(),bounds=boundsFor(DEFAULTS);
 frameCamera(camera,bounds,{width:390,height:500,direction:VIEW_DIRECTIONS.front});
 const near=[new THREE.Vector3(-10,0,10),new THREE.Vector3(10,0,10)].map(p=>p.project(camera));
 const far=[new THREE.Vector3(-10,0,-10),new THREE.Vector3(10,0,-10)].map(p=>p.project(camera));
 assert.ok(Math.abs(near[1].x-near[0].x-(far[1].x-far[0].x))<1e-10);
});

test('refitting preserves relative zoom and direction as dimensions and viewport change',()=>{
 for(const camera of [new THREE.OrthographicCamera(),new THREE.PerspectiveCamera(32)]){
  const direction=new THREE.Vector3(-.5,.4,1).normalize();
  const first=frameCamera(camera,boundsFor(DEFAULTS),{width:390,height:760,direction,zoom:1.4});
  const scale=camera.isOrthographicCamera?camera.zoom:first.distance/camera.position.distanceTo(first.center);
  const next=frameCamera(camera,boundsFor({...DEFAULTS,spacing:230}),{width:760,height:390,direction,zoom:scale});
  const actual=camera.isOrthographicCamera?camera.zoom:next.distance/camera.position.distanceTo(next.center);
  assert.ok(Math.abs(actual-1.4)<1e-10);
  assert.ok(camera.position.clone().sub(next.center).normalize().dot(direction)>.999999);
 }
});

test('front and top dimensions use the built model axes and omit end-on measurements',()=>{
 const camera=new THREE.OrthographicCamera(),bounds=boundsFor(DEFAULTS);
 frameCamera(camera,bounds,{width:390,height:550,direction:VIEW_DIRECTIONS.front,padding:48});
 const front=projectMeasurements(DEFAULTS,bounds,camera,390,550);
 assert.deepEqual(front.map(m=>m.id),['width','height','spacing']);
 assert.ok(front.some(m=>m.text==='W 178.4 mm'));
 assert.ok(front.some(m=>m.text==='140 mm centres'));
 frameCamera(camera,bounds,{width:390,height:550,direction:VIEW_DIRECTIONS.top,padding:48});
 const top=projectMeasurements(DEFAULTS,bounds,camera,390,550);
 assert.deepEqual(top.map(m=>m.id),['width','depth']);
 assert.ok(top.some(m=>m.text==='D 20.5 mm'));
 const markup=measurementMarkup(front);
 assert.ok(markup.includes('data-measure="spacing"'));
 assert.ok(!/NaN|Infinity|undefined/.test(markup));
});

test('dimension labels stay readable and separated for 1–14 cameras on a phone',()=>{
 for(let count=1;count<=14;count++)for(const direction of Object.values(VIEW_DIRECTIONS)){
  const params=normalize({...DEFAULTS,camera_count:count}),bounds=boundsFor(params),camera=new THREE.OrthographicCamera();
  frameCamera(camera,bounds,{width:390,height:320,direction,padding:48});
  const measurements=projectMeasurements(params,bounds,camera,390,320);
  assert.ok(measurements.some(m=>m.id==='width'));
  if(count===1)assert.ok(!measurements.some(m=>m.id==='spacing'));
  for(let i=0;i<measurements.length;i++){
   const a=measurements[i].label;
   assert.ok(a.x>=8&&a.x+a.width<=382&&a.y>=8&&a.y+a.height<=278);
   for(const other of measurements.slice(i+1)){
    const b=other.label;
    assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));
   }
  }
 }
});

test('OrbitControls retain correct projection and zoom when switching cameras',()=>{
 const perspective=new THREE.PerspectiveCamera(32),parallel=new THREE.OrthographicCamera();
 const controls=new OrbitControls(perspective);
 const bounds=boundsFor(DEFAULTS);
 for(const [camera,direction]of [[perspective,VIEW_DIRECTIONS.iso],[parallel,VIEW_DIRECTIONS.front],[parallel,VIEW_DIRECTIONS.rear],[parallel,VIEW_DIRECTIONS.top],[perspective,VIEW_DIRECTIONS.iso]]){
  controls.object=camera;
  const frame=frameCamera(camera,bounds,{width:390,height:550,direction,zoom:1,padding:48});
  controls.target.copy(frame.center);controls.update();camera.updateMatrixWorld();
  assert.ok(camera.position.clone().sub(controls.target).normalize().dot(direction)>.99999);
  for(const corner of boxCorners(bounds)){
   const p=corner.project(camera);
   assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1);
  }
 }
});

test('inspection margins leave labels clear of a single-camera part and its caption',()=>{
 const params=normalize({...DEFAULTS,camera_count:1}),bounds=boundsFor(params),camera=new THREE.OrthographicCamera();
 frameCamera(camera,bounds,{width:320,height:320,direction:VIEW_DIRECTIONS.front,padding:{x:52,y:84}});
 const points=boxCorners(bounds).map(p=>p.project(camera));
 const right=Math.max(...points.map(p=>(p.x+1)*160)),bottom=Math.max(...points.map(p=>(1-p.y)*160));
 const labels=projectMeasurements(params,bounds,camera,320,320);
 assert.ok(labels.find(m=>m.id==='width').label.y>=bottom+8);
 assert.ok(labels.find(m=>m.id==='height').label.x>=right+8);
 assert.deepEqual(projectMeasurements(params,bounds,camera,390,200),[]);
});
