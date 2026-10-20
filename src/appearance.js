import * as THREE from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

export function createPlaMaterial() {
 const size=128,data=new Uint8Array(size*size*4);
 let seed=73;
 for(let i=0;i<size*size;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const grain=218+(seed>>>27);
  data.set([grain,grain,grain,255],i*4);
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return new THREE.MeshStandardMaterial({
  color:0x18191b,metalness:0,roughness:.92,
  roughnessMap:texture,bumpMap:texture,bumpScale:.018,
  envMapIntensity:.85
 });
}

export function createDisplayGeometry(source) {
 const geometry=toCreasedNormals(source,Math.PI/4);
 const positions=geometry.attributes.position;
 const uv=new Float32Array(positions.count*2);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<positions.count;i+=3){
  a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);
  normal.subVectors(b,a).cross(c.sub(a));
  const x=Math.abs(normal.x),y=Math.abs(normal.y),z=Math.abs(normal.z);
  for(let j=i;j<i+3;j++){
   uv[j*2]=(x>y&&x>z?positions.getY(j):positions.getX(j))/3;
   uv[j*2+1]=(z>=x&&z>=y?positions.getY(j):positions.getZ(j))/3;
  }
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 return geometry;
}
