import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {DEFAULTS,normalize,dimensions,generateScad} from './model.js';
import {setupGestures} from './gestures.js';

const icons={sliders:'M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10M8 3v6m6 0v6m-8 0v6',plus:'M12 5v14M5 12h14',minus:'M5 12h14',download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',upload:'M12 16V3m-5 5 5-5 5 5M5 16v5h14v-5',link:'m10 13 4-4m-5 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0-1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',github:'M9 19c-4 1-4-2-5-2m10 5v-4c0-1-.3-2-1-2 4 0 7-2 7-6 0-2-1-3-1-4 0-1 0-2-1-3-2 0-3 1-4 1a13 13 0 0 0-5 0C7 3 6 3 5 3c-1 1-1 2-1 3-1 1-1 2-1 4 0 4 3 6 7 6-1 0-1 1-1 2v4',fit:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 8h8v8H8Z',ruler:'m4 16 12-12 5 5L9 21Zm5-5 2 2m2-6 2 2m-10 6 2 2',wire:'m12 2 9 5v10l-9 5-9-5V7Zm0 0v10m9-5-9 5-9-5m9 5v10',orbit:'M5 5a10 10 0 0 1 14 14M3 8V3h5m13 13v5h-5M5 19a10 10 0 0 1-2-9m16-5a10 10 0 0 1 2 9',close:'m6 6 12 12M6 18 18 6',chevron:'m6 9 6 6 6-6',aperture:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 4l6 10M20 8H8m7 12-6-10M4 16h12'};
function setIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[el.dataset.icon]||''}"/></svg>`;});}
setIcons();
const $=id=>document.getElementById(id);
const definitions={
 'layout-fields':[['spacing','spacing',52,300,1]],
 'camera-fields':[['cam_w','width',15,100,.1],['cam_h','height',15,120,.1],['cam_d','depth',5,80,.1]],
 'lens-fields':[['lens_d','lens Ø',2,100,.1],['lens_dy','lens y',-60,60,.1]],
 'fit-fields':[['fit','clearance',0,2,.05],['wall','wall',1.2,8,.1],['face_t','front',1.2,10,.1]],
 'adapter-fields':[['recess_w','adapter w',70,160,.1],['recess_h','adapter h',12,40,.1],['slop','fit',0,2,.1],['corner_r','radius',.5,12,.1]],
 'cable-fields':[['cable_w','cable w',2,50,.1],['cable_d','cable d',1,30,.1],['tie_z','tie depth',1,8,.1],['tie_y','tie height',1,5,.1],['tie_back','rear lip',.8,5,.1],['t_slot_x','slot x',8,15,.1],['t_hole','screw Ø',2,6,.1],['t_hole_x','screw x',20,28,.1]]
};
$('camera_count').innerHTML=Array.from({length:14},(_,i)=>`<option value="${i+1}">${i+1} ${i===0?'camera':'cameras'}</option>`).join('');
for(const [id,fields]of Object.entries(definitions))$(id).innerHTML=fields.map(([key,label,min,max,step])=>`<div class="parameter-row"><label for="${key}">${label}</label><input class="pslider" type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" aria-label="${label} slider"><input class="param-value" id="${key}" data-param="${key}" type="number" min="${min}" max="${max}" step="${step}" inputmode="decimal" aria-label="${label} in millimetres"></div>`).join('');
let params=normalize(DEFAULTS),mesh=null,requestId=0,completedId=0,view='iso',wireframe=false,showDimensions=false,toastTimer;
try{const hash=location.hash.slice(1);const saved=hash.startsWith('p=')?JSON.parse(decodeURIComponent(hash.slice(2))):JSON.parse(localStorage.getItem('webcam-parameters')||'null');if(saved&&typeof saved==='object')params=normalize(saved);}catch{}
const worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
const canvas=$('canvas');
let renderer,scene,camera,controls,material,dimensionGroup,fallback,lightKey;
scene=new THREE.Scene();
camera=new THREE.PerspectiveCamera(32,1,.1,50000);
controls=new OrbitControls(camera,canvas);
controls.enablePan=false;
controls.rotateSpeed=.75;
controls.addEventListener('change',render);
material=new THREE.MeshStandardMaterial({color:0x999999,metalness:.16,roughness:.55,flatShading:true});
dimensionGroup=new THREE.Group();scene.add(dimensionGroup);
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.setClearColor(0xf5f6f2,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;

 const key=new THREE.DirectionalLight(0xffffff,2.1);key.position.set(-3,5,7);lightKey=key;
 const fill=new THREE.DirectionalLight(0xdbe5ec,1.5);fill.position.set(5,1,-4);
 scene.add(key,fill,new THREE.HemisphereLight(0xffffff,0x929b8a,2));


 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('build-state').textContent='3D paused. Reload to restore the view.';});
}catch{renderer=null;fallback=canvas.getContext('2d');}
new ResizeObserver(resize).observe($('viewport'));
function render(){if(!camera)return;if(renderer)renderer.render(scene,camera);else if(fallback)drawFallback();if(showDimensions&&dimensionGroup.userData.label){const p=dimensionGroup.userData.label.clone().project(camera);const r=$('viewport').getBoundingClientRect();$('dimension-label').style.left=(r.width*(p.x+1)/2)+'px';$('dimension-label').style.top=(r.height*(1-p.y)/2+$('viewport').offsetTop-25)+'px';}}
function drawFallback(){
 const ctx=fallback,w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 if(!mesh)return;
 camera.updateMatrixWorld();
 const positions=mesh.geometry.attributes.position,indices=mesh.geometry.index;
 const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const projected=[],world=[];
 for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i);world.push(v);const q=v.clone().applyMatrix4(matrix);projected.push([(q.x+1)*w/2,(1-q.y)*h/2,q.z]);}
 const image=ctx.createImageData(w,h),pixels=image.data,depth=new Float32Array(w*h).fill(Infinity);
 const light=new THREE.Vector3(-.4,.65,.8).normalize();
 for(let i=0;i<indices.count;i+=3){
  const ai=indices.getX(i),bi=indices.getX(i+1),ci=indices.getX(i+2),a=projected[ai],b=projected[bi],c=projected[ci];
  const normal=new THREE.Vector3().subVectors(world[bi],world[ai]).cross(new THREE.Vector3().subVectors(world[ci],world[ai])).normalize();
  if(normal.dot(camera.position.clone().sub(world[ai]))<=0)continue;
  if(wireframe){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.strokeStyle='#8b9980';ctx.lineWidth=.5;ctx.stroke();continue;}
  const shade=Math.round(125+Math.max(0,normal.dot(light))*73),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<.001)continue;
  const left=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),right=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),top=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),bottom=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,t=1-u-v;
   if(u<-.0001||v<-.0001||t<-.0001)continue;
   const z=u*a[2]+v*b[2]+t*c[2],at=y*w+x;
   if(z>=depth[at])continue;
   depth[at]=z;pixels[at*4]=shade;pixels[at*4+1]=shade;pixels[at*4+2]=shade;pixels[at*4+3]=255;
  }
 }
 if(!wireframe)ctx.putImageData(image,0,0);
}
function resize(){if(!camera)return;const r=$('viewport').getBoundingClientRect();const old=camera.aspect;if(renderer)renderer.setSize(r.width,r.height,false);else{canvas.width=r.width*Math.min(devicePixelRatio,1.5);canvas.height=r.height*Math.min(devicePixelRatio,1.5);}camera.aspect=r.width/r.height;camera.updateProjectionMatrix();if(mesh&&Math.abs(camera.aspect-old)>.05)fitView();else render();}
function fitView(){if(!mesh||!camera)return;mesh.geometry.computeBoundingSphere();const radius=mesh.geometry.boundingSphere.radius;const vHalf=THREE.MathUtils.degToRad(camera.fov/2);const half=Math.min(vHalf,Math.atan(Math.tan(vHalf)*camera.aspect));const distance=radius/Math.sin(half)*1.12;const direction=view==='front'?new THREE.Vector3(0,0,1):view==='rear'?new THREE.Vector3(0,0,-1):new THREE.Vector3(.3,.23,1).normalize();controls.target.set(0,0,0);camera.position.copy(direction.multiplyScalar(distance));controls.minDistance=radius*.4;controls.maxDistance=radius*18;camera.near=Math.max(.1,radius/1000);camera.far=radius*100;camera.updateProjectionMatrix();controls.update();render();}
function dimensionLines(){if(!dimensionGroup)return;dimensionGroup.children.forEach(o=>o.geometry.dispose());dimensionGroup.clear();dimensionGroup.visible=showDimensions;const d=dimensions(params);const span=params.camera_count>1?params.spacing:d.width;const y=d.height/2+10,z=d.depth/2+2,mid=params.camera_count>1?-(params.camera_count-2)*params.spacing/2:0;const pts=[[-span/2,y,z],[span/2,y,z],[-span/2,y-5,z],[-span/2,y+5,z],[span/2,y-5,z],[span/2,y+5,z],[-span/2+4,y+2,z],[-span/2,y,z],[-span/2+4,y-2,z],[-span/2,y,z],[span/2-4,y+2,z],[span/2,y,z],[span/2-4,y-2,z],[span/2,y,z]];const geometry=new THREE.BufferGeometry().setFromPoints(pts.map(a=>new THREE.Vector3(a[0]+mid,a[1],a[2])));const lineMaterial=new THREE.LineBasicMaterial({color:0x869b72,transparent:true,opacity:.7,depthTest:false});dimensionGroup.add(new THREE.LineSegments(geometry,lineMaterial));dimensionGroup.userData.label=new THREE.Vector3(mid,y,z);$('dimension-value').textContent=fmt(span)+' mm';render();}
function fmt(n){return Number(n.toFixed(2)).toString();}
function sync(){
 const d=dimensions(params);
 document.querySelectorAll('[data-param]').forEach(el=>{el.value=params[el.dataset.param];});
 document.querySelectorAll('[data-param="spacing"]').forEach(el=>{el.min=d.minSpacing;el.max=Math.max(300,params.spacing);el.disabled=params.camera_count===1;});
 $('dock-spacing').textContent=fmt(params.spacing);
 $('model-size').textContent=`${fmt(d.width)} × ${fmt(d.height)} × ${fmt(d.depth)} mm`;
 $('export-stl').disabled=completedId!==requestId||!mesh;
}

function persist(){try{localStorage.setItem('webcam-parameters',JSON.stringify(params));}catch{}history.replaceState(null,'','#p='+encodeURIComponent(JSON.stringify(params)));}
let rebuildTimer,workerBusy=false;
function update(input,debounce=false){const next=normalize(input);const changed=JSON.stringify(next)!==JSON.stringify(params);params=next;sync();persist();if(!changed&&mesh)return;requestId++;$('export-stl').disabled=true;$('build-state').textContent=mesh?'Updating geometry…':'';clearTimeout(rebuildTimer);const send=()=>{if(!workerBusy){workerBusy=true;worker.postMessage({id:requestId,params});}};if(debounce)rebuildTimer=setTimeout(send,80);else send();}
worker.onmessage=({data})=>{workerBusy=false;if(data.id!==requestId){workerBusy=true;worker.postMessage({id:requestId,params});return;}if(data.error){$('loading').hidden=true;$('build-state').textContent='Could not build this configuration. Adjust the dimensions.';toast('Geometry could not be built.');return;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeVertexNormals();const previousSize=mesh?mesh.userData.size:0;if(mesh){scene.remove(mesh);mesh.geometry.dispose();}mesh=new THREE.Mesh(geometry,material);mesh.userData.size=Math.hypot(data.dimensions.width,data.dimensions.height,data.dimensions.depth);scene.add(mesh);completedId=data.id;$('loading').hidden=true;$('build-state').textContent='';sync();dimensionLines();if(!previousSize||Math.abs(mesh.userData.size-previousSize)/previousSize>.12)fitView();else render();};
worker.onerror=()=>{$('loading').hidden=true;$('build-state').textContent='Geometry engine could not load. Reload to retry.';};
document.querySelectorAll('[data-param]').forEach(el=>{const event=el.type==='range'?'input':'change';el.addEventListener(event,()=>{const key=el.dataset.param;const raw=Number(el.value);if(el.value.trim()===''||!Number.isFinite(raw)){sync();return;}const next=normalize({...params,[key]:raw});if(Math.abs(next[key]-raw)>.001)toast(key==='spacing'?`Minimum spacing is ${fmt(next.spacing)} mm.`:'Adjusted to keep the mount geometry valid.');update(next,el.type==='range');});});
$('controls-toggle').onclick=()=>{const open=$('controls-body').hidden;$('controls-body').hidden=!open;$('controls-toggle').setAttribute('aria-expanded',String(open));$('controls-toggle').setAttribute('aria-label',open?'Hide controls':'Show controls');$('controls-toggle').dataset.icon=open?'chevron':'sliders';setIcons();};
$('fit-view').onclick=fitView;
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;document.querySelectorAll('[data-view]').forEach(t=>{t.classList.toggle('selected',t===el);t.setAttribute('aria-pressed',String(t===el));});fitView();});
$('wire-toggle').onclick=()=>{wireframe=!wireframe;if(material)material.wireframe=wireframe;$('wire-toggle').setAttribute('aria-pressed',String(wireframe));render();};
$('dimensions-toggle').onclick=()=>{showDimensions=!showDimensions;$('dimensions-toggle').setAttribute('aria-pressed',String(showDimensions));$('dimension-label').hidden=!showDimensions;dimensionLines();};
$('reset').onclick=()=>{update(DEFAULTS);toast('Original stereo mount restored.');};
function toast(message){clearTimeout(toastTimer);$('status').textContent=message;$('status').classList.add('visible');toastTimer=setTimeout(()=>$('status').classList.remove('visible'),2800);}
$('share').onclick=async()=>{persist();try{await navigator.clipboard.writeText(location.href);toast('Configuration link copied.');}catch{try{await navigator.share({title:'Webcam mount',url:location.href});}catch{toast('Copy the address to share this configuration.');}}};
function download(data,type,extension){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=`webcam-${params.camera_count}x-${fmt(params.spacing)}mm.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(`${extension.toUpperCase()} exported.`);}
$('export-stl').onclick=()=>{if(!mesh||completedId!==requestId)return;const geometry=mesh.geometry.clone();const p=geometry.attributes.position;const d=dimensions(params);for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i),p.getY(i)+d.height/2,-p.getZ(i)+d.depth/2);const indices=geometry.index;for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}geometry.computeVertexNormals();const exported=new THREE.Mesh(geometry);exported.updateMatrixWorld(true);download(new STLExporter().parse(exported,{binary:true}),'model/stl','stl');geometry.dispose();};
$('export-scad').onclick=()=>download(generateScad(params),'text/plain','scad');
$('export-json').onclick=()=>download(JSON.stringify(params,null,2),'application/json','json');
$('import-json').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error();const data=JSON.parse(await file.text());if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(DEFAULTS).some(k=>k in data))throw new Error();update(data);toast('Configuration imported.');}catch{toast('Choose a valid webcam settings JSON file.');}finally{e.target.value='';}};
window.addEventListener('hashchange',()=>{try{if(location.hash.startsWith('#p='))update(JSON.parse(decodeURIComponent(location.hash.slice(3))));}catch{toast('This configuration link could not be read.');}});
let light={az:.64,el:.95};
setupGestures({canvas,camera,controls,render,onNudge:(axis,delta)=>{const key=axis==='horizontal'?'spacing':'cam_h',span=axis==='horizontal'?248:105;update({...params,[key]:params[key]+delta/420*span},true);},onLight:(dx,dy)=>{light.az+=dx*.012;light.el=Math.min(1.4,Math.max(.12,light.el-dy*.008));if(lightKey){const r=8.6,h=r*Math.cos(light.el);lightKey.position.set(h*Math.cos(light.az),r*Math.sin(light.el),h*Math.sin(light.az));}render();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
resize();update(params);
