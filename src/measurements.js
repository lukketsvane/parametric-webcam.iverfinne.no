import * as THREE from 'three';
import {dimensions} from './model.js';
import {boxCorners} from './view.js';

const fmt=n=>Number(n.toFixed(2)).toString();

export function projectMeasurements(params,bounds,camera,width,height){
 if(width<240||height<240)return [];
 camera.updateMatrixWorld();
 const d=dimensions(params),center=bounds.getCenter(new THREE.Vector3());
 const direction=camera.position.clone().sub(center).normalize();
 const z=direction.z>=0?bounds.max.z:bounds.min.z;
 const faceY=direction.y>.9?bounds.max.y:bounds.min.y;
 const specs=[
  ['width',`W ${fmt(d.width)} mm`,[bounds.min.x,bounds.min.y,z],[bounds.max.x,bounds.min.y,z]],
  ['height',`H ${fmt(d.height)} mm`,[bounds.max.x,bounds.min.y,z],[bounds.max.x,bounds.max.y,z]],
  ['depth',`D ${fmt(d.depth)} mm`,[bounds.min.x,faceY,bounds.min.z],[bounds.min.x,faceY,bounds.max.z]]
 ];
 if(params.camera_count>1&&Math.abs(direction.z)>.5){
  const x=-(params.camera_count-1)*params.spacing/2,y=bounds.max.y-(params.cam_h+params.fit+2*params.wall)/2+params.lens_dy;
  specs.push(['spacing',`${fmt(params.spacing)} mm centres`,[x,y,z],[x+params.spacing,y,z]]);
 }
 const project=point=>{
  const p=new THREE.Vector3(...point).project(camera);
  return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};
 };
 const origin=project(center.toArray()),hull=boxCorners(bounds).map(p=>project(p.toArray())),result=[];
 for(const [id,text,from,to]of specs){
  const a=project(from),b=project(to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<(id==='spacing'?38:12)||![a,b].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.z>=-1&&p.z<=1))continue;
  const nx=-dy/length,ny=dx/length,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  const sign=nx*(mx-origin.x)+ny*(my-origin.y)>=0?1:-1;
  const normal={x:nx*sign,y:ny*sign},textWidth=text.length*5.8+12;
  let angle=Math.atan2(dy,dx);if(angle>Math.PI/2)angle-=Math.PI;if(angle<-Math.PI/2)angle+=Math.PI;
  const labelWidth=Math.abs(Math.cos(angle))*textWidth+Math.abs(Math.sin(angle))*19,labelHeight=Math.abs(Math.sin(angle))*textWidth+Math.abs(Math.cos(angle))*19;
  const clearance=Math.max(20,...hull.map(p=>(p.x-mx)*normal.x+(p.y-my)*normal.y+16));
  let item;
  for(let attempt=0;attempt<4;attempt++){
   const offset=clearance+attempt*17;
   const start={x:a.x+normal.x*offset,y:a.y+normal.y*offset},end={x:b.x+normal.x*offset,y:b.y+normal.y*offset};
   const label={x:Math.max(8,Math.min(width-labelWidth-8,(start.x+end.x)/2-labelWidth/2+normal.x*12)),y:Math.max(8,Math.min(height-labelHeight-42,(start.y+end.y)/2-labelHeight/2+normal.y*12)),width:labelWidth,height:labelHeight};
   const collides=result.some(m=>label.x<m.label.x+m.label.width+5&&label.x+label.width+5>m.label.x&&label.y<m.label.y+m.label.height+4&&label.y+label.height+4>m.label.y);
   if(!collides){item={id,text,a,b,start,end,normal,label,textWidth,angle:angle*180/Math.PI};break;}
  }
  if(item)result.push(item);
 }
 return result;
}

export function measurementMarkup(measurements){
 const n=value=>Number(value.toFixed(2));
 return measurements.map(m=>{
  const {a,b,start:s,end:e,normal:v,label:l}=m;
  return `<g data-measure="${m.id}"><path d="M${n(a.x)} ${n(a.y)}L${n(s.x+v.x*4)} ${n(s.y+v.y*4)}M${n(b.x)} ${n(b.y)}L${n(e.x+v.x*4)} ${n(e.y+v.y*4)}M${n(s.x)} ${n(s.y)}L${n(e.x)} ${n(e.y)}M${n(s.x-v.x*3)} ${n(s.y-v.y*3)}L${n(s.x+v.x*3)} ${n(s.y+v.y*3)}M${n(e.x-v.x*3)} ${n(e.y-v.y*3)}L${n(e.x+v.x*3)} ${n(e.y+v.y*3)}"/><g transform="translate(${n(l.x+l.width/2)} ${n(l.y+l.height/2)}) rotate(${n(m.angle)})"><rect x="${n(-m.textWidth/2)}" y="-9.5" width="${n(m.textWidth)}" height="19" rx="4"/><text x="0" y="3.5">${m.text}</text></g></g>`;
 }).join('');
}
