import * as THREE from 'three';

export const VIEW_DIRECTIONS={iso:new THREE.Vector3(.3,.23,1).normalize(),front:new THREE.Vector3(0,0,1),rear:new THREE.Vector3(0,0,-1),top:new THREE.Vector3(0,1,.000001).normalize()};

export function boxCorners(bounds){
 const points=[];
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));
 return points;
}

export function frameCamera(camera,bounds,{width,height,direction,zoom=1,padding=24}){
 const center=bounds.getCenter(new THREE.Vector3()),radius=Math.max(.01,bounds.getSize(new THREE.Vector3()).length()/2);
 const axis=direction.clone().normalize(),aspect=width/height;
 camera.position.copy(center).add(axis);camera.lookAt(center);camera.updateMatrixWorld();
 const inverse=camera.quaternion.clone().invert();
 const points=boxCorners(bounds).map(p=>p.sub(center).applyQuaternion(inverse));
 const padX=typeof padding==='number'?padding:padding.x,padY=typeof padding==='number'?padding:padding.y;
 const usableX=Math.max(.16,(width-2*Math.min(padX,width*.42))/width),usableY=Math.max(.16,(height-2*Math.min(padY,height*.42))/height);
 let distance;
 if(camera.isOrthographicCamera){
  const halfHeight=Math.max(...points.map(p=>Math.max(Math.abs(p.y)/usableY,Math.abs(p.x)/(aspect*usableX))),.01)*1.04;
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.zoom=THREE.MathUtils.clamp(zoom,.1,12);distance=radius*3;
 }else{
  camera.aspect=aspect;camera.zoom=1;
  const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  distance=Math.max(...points.map(p=>p.z+Math.max(Math.abs(p.x)/(tan*aspect*usableX),Math.abs(p.y)/(tan*usableY))),radius*.5)*1.04;
 }
 camera.position.copy(center).addScaledVector(axis,camera.isOrthographicCamera?distance:THREE.MathUtils.clamp(distance/zoom,radius*.4,radius*100));
 camera.near=Math.max(.001,radius/1000);camera.far=radius*220;
 camera.updateProjectionMatrix();camera.updateMatrixWorld();
 return {distance,radius,center};
}
