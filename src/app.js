import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createPlaMaterial,createDisplayGeometry} from './appearance.js';
import {createHistory} from './history.js';
import {VIEW_DIRECTIONS,frameCamera} from './view.js';
import {projectMeasurements,measurementMarkup} from './measurements.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {DEFAULTS,normalize,dimensions,generateScad,retentionLimits,RETENTION_WEB_MIN} from './model.js';
import {setupGestures} from './gestures.js';

const icons={undo:'M3 10h12a6 6 0 0 1 0 12M3 10l6-6m-6 6 6 6',redo:'M21 10H9a6 6 0 0 0 0 12m12-12-6-6m6 6-6 6',sliders:'M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10M8 3v6m6 0v6m-8 0v6',plus:'M12 5v14M5 12h14',minus:'M5 12h14',download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',upload:'M12 16V3m-5 5 5-5 5 5M5 16v5h14v-5',link:'m10 13 4-4m-5 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0-1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',github:'M9 19c-4 1-4-2-5-2m10 5v-4c0-1-.3-2-1-2 4 0 7-2 7-6 0-2-1-3-1-4 0-1 0-2-1-3-2 0-3 1-4 1a13 13 0 0 0-5 0C7 3 6 3 5 3c-1 1-1 2-1 3-1 1-1 2-1 4 0 4 3 6 7 6-1 0-1 1-1 2v4',fit:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 8h8v8H8Z',ruler:'m4 16 12-12 5 5L9 21Zm5-5 2 2m2-6 2 2m-10 6 2 2',wire:'m12 2 9 5v10l-9 5-9-5V7Zm0 0v10m9-5-9 5-9-5m9 5v10',orbit:'M5 5a10 10 0 0 1 14 14M3 8V3h5m13 13v5h-5M5 19a10 10 0 0 1-2-9m16-5a10 10 0 0 1 2 9',close:'m6 6 12 12M6 18 18 6',chevron:'m6 9 6 6 6-6',aperture:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 4l6 10M20 8H8m7 12-6-10M4 16h12'};
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
const edits=createHistory(params);
const worker=new Worker(new URL('./model-worker.js',import.meta.url),{type:'module'});
const canvas=$('canvas');
let renderer,scene,camera,controls,material,fallback,lightKey;
const perspectiveCamera=new THREE.PerspectiveCamera(32,1,.1,50000),inspectionCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,50000);
const theme=matchMedia('(prefers-color-scheme:dark)');
const wireMaterial=new THREE.MeshBasicMaterial({color:theme.matches?0xb5bac2:0x444a52,wireframe:true,transparent:true,opacity:.75});
scene=new THREE.Scene();
camera=perspectiveCamera;
controls=new OrbitControls(camera,canvas);
controls.enablePan=false;
controls.rotateSpeed=.75;
controls.minZoom=.1;controls.maxZoom=12;
controls.addEventListener('change',render);
material=createPlaMaterial();
const key=new THREE.DirectionalLight(0xfff9f2,2.4);key.position.set(-3,7,4);lightKey=key;
const fill=new THREE.DirectionalLight(0xe8efff,1.4);fill.position.set(5,2,-4);
scene.add(key,fill,new THREE.HemisphereLight(0xffffff,0x34363b,1.1));
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.setClearColor(0xf5f6f2,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;

 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(room,.04).texture;
 room.dispose();pmrem.dispose();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('build-state').textContent='3D paused. Reload to restore the view.';});
}catch{renderer=null;fallback=canvas.getContext('2d');}
new ResizeObserver(resize).observe($('viewport'));
function render(){if(!camera)return;if(renderer)renderer.render(scene,camera);else if(fallback)drawFallback();drawMeasurements();}
function drawMeasurements(){
 const overlay=$('dimension-overlay'),r=$('viewport').getBoundingClientRect(),visible=showDimensions&&mesh&&r.width>=240&&r.height>=240;overlay.toggleAttribute('hidden',!visible);
 if(!visible)return;
 overlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
 const measurements=projectMeasurements(mesh.userData.params,mesh.geometry.boundingBox,camera,r.width,r.height);
 overlay.innerHTML=measurementMarkup(measurements);
}
function drawFallback(){
 const ctx=fallback,w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 if(!mesh)return;
 camera.updateMatrixWorld();
 const positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
 const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const projected=[],world=[];
 for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i);world.push(v);const q=v.clone().applyMatrix4(matrix);projected.push([(q.x+1)*w/2,(1-q.y)*h/2,q.z]);}
 const image=ctx.createImageData(w,h),pixels=image.data,depth=new Float32Array(w*h).fill(Infinity);
 const light=lightKey.position.clone().normalize(),fillLight=fill.position.clone().normalize();
 const shades=[];
 const eye=camera.position.clone().normalize(),half=light.clone().add(eye).normalize(),n=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){n.fromBufferAttribute(normals,i);shades.push(15+31*Math.max(0,n.dot(light))+10*Math.max(0,n.dot(fillLight))+13*Math.pow(Math.max(0,n.dot(half)),8)+7*Math.pow(1-Math.abs(n.dot(eye)),3));}
 for(let i=0;i<positions.count;i+=3){
  const ai=i,bi=i+1,ci=i+2,a=projected[ai],b=projected[bi],c=projected[ci];
  const normal=new THREE.Vector3().subVectors(world[bi],world[ai]).cross(new THREE.Vector3().subVectors(world[ci],world[ai])).normalize();
  const facing=camera.isOrthographicCamera?camera.position.clone().sub(controls.target):camera.position.clone().sub(world[ai]);
  if(normal.dot(facing)<=0)continue;
  if(wireframe){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.strokeStyle=matchMedia('(prefers-color-scheme:dark)').matches?'#aaa':'#555';ctx.lineWidth=.5;ctx.stroke();continue;}
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<.001)continue;
  const left=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),right=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),top=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),bottom=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,t=1-u-v;
   if(u<-.0001||v<-.0001||t<-.0001)continue;
   const z=u*a[2]+v*b[2]+t*c[2],at=y*w+x;
   if(z>=depth[at])continue;
   const grain=((Math.imul(x,13)^Math.imul(y,37))&3)-1.5;
   const shade=Math.round(u*shades[ai]+v*shades[bi]+t*shades[ci]+grain);
   depth[at]=z;pixels[at*4]=shade;pixels[at*4+1]=shade;pixels[at*4+2]=shade;pixels[at*4+3]=255;
  }
 }
 if(!wireframe)ctx.putImageData(image,0,0);
}
let framedDistance=0;
function resize(){if(!camera)return;const r=$('viewport').getBoundingClientRect();if(!r.width||!r.height)return;$('dimensions-toggle').disabled=r.width<240||r.height<240;if(renderer)renderer.setSize(r.width,r.height,false);else{canvas.width=r.width*Math.min(devicePixelRatio,1.5);canvas.height=r.height*Math.min(devicePixelRatio,1.5);}perspectiveCamera.aspect=r.width/r.height;if(mesh)frameModel({preserveZoom:true});else{camera.updateProjectionMatrix();render();}}
function frameModel({direction,preserveZoom=false,parallel}={}){
 if(!mesh)return;
 const viewport=$('viewport').getBoundingClientRect();if(!viewport.width||!viewport.height)return;
 const offset=camera.position.clone().sub(controls.target);
 const zoom=preserveZoom&&framedDistance?(camera.isOrthographicCamera?camera.zoom:framedDistance/offset.length()):1;
 const axis=direction||(!framedDistance?VIEW_DIRECTIONS.iso:offset.normalize());
 if(parallel!==undefined){camera=parallel?inspectionCamera:perspectiveCamera;controls.object=camera;}
 const framed=frameCamera(camera,mesh.geometry.boundingBox,{width:viewport.width,height:viewport.height,direction:axis,zoom,padding:showDimensions&&viewport.width>=240&&viewport.height>=240?{x:52,y:84}:24});
 controls.target.copy(framed.center);controls.minDistance=framed.radius*.4;controls.maxDistance=framed.radius*100;
 framedDistance=framed.distance;controls.update();syncView();render();
}
function syncView(){
 if(!framedDistance)return;
 const direction=camera.position.clone().sub(controls.target).normalize();
 document.querySelectorAll('[data-view]').forEach(el=>{const selected=direction.dot(VIEW_DIRECTIONS[el.dataset.view])>.9999&&(el.dataset.view==='iso')===!camera.isOrthographicCamera;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});
 $('projection-label').hidden=!camera.isOrthographicCamera;
}
controls.addEventListener('change',syncView);
theme.addEventListener('change',()=>{wireMaterial.color.setHex(theme.matches?0xb5bac2:0x444a52);render();});
function fmt(n){return Number(n.toFixed(2)).toString();}
function sync(){
 const d=dimensions(params);
 const bounds={...retentionLimits(params),spacing:[d.minSpacing,1000],lens_d:[2,Math.min(100,params.cam_w+params.fit-2,params.cam_h+params.fit-2)],lens_dy:[-Math.min(60,(params.cam_h+params.fit-params.lens_d)/2-1),Math.min(60,(params.cam_h+params.fit-params.lens_d)/2-1)],cable_w:[2,Math.min(50,params.cam_w+params.fit-2)],cable_d:[1,Math.min(30,params.cam_d-2)],tie_back:[.8,Math.min(5,(params.cam_d-1)/3)],tie_z:[1,Math.min(8,params.cam_d-1-params.tie_back-.5)],corner_r:[.5,Math.min(12,(params.cam_h+params.fit+2*params.wall)/2-.1)]};
 for(const [key,[min,max]]of Object.entries(bounds))document.querySelectorAll(`[data-param="${key}"]`).forEach(el=>{el.min=min;el.max=max;});
 document.querySelectorAll('[data-param]').forEach(el=>{el.value=params[el.dataset.param];});
 document.querySelectorAll('[data-param="spacing"]').forEach(el=>{el.min=d.minSpacing;if(el.type==='range')el.max=Math.max(300,params.spacing);el.disabled=params.camera_count===1;});
 $('dock-spacing').textContent=params.camera_count===1?'single':fmt(params.spacing);
 $('spacing-unit').hidden=params.camera_count===1;
 $('undo').disabled=!edits.canUndo;$('redo').disabled=!edits.canRedo;
 $('model-size').textContent=`${fmt(d.width)} × ${fmt(d.height)} × ${fmt(d.depth)} mm`;
 const web=params.t_hole_x-params.t_hole/2-params.t_slot_x-params.t_slot[0]/2;
 $('retention-fit').textContent=`${fmt(params.t_slot[0])} × ${fmt(params.t_slot[1])} mm slots · ${fmt(web)} mm between openings`;
 $('export-stl').disabled=completedId!==requestId||!mesh;
}

function persist(){try{localStorage.setItem('webcam-parameters',JSON.stringify(params));}catch{}history.replaceState(null,'','#p='+encodeURIComponent(JSON.stringify(params)));}
let rebuildTimer,workerBusy=false;
function update(input,debounce=false,record=true){const next=normalize(input);const changed=JSON.stringify(next)!==JSON.stringify(params);params=next;if(changed&&record)edits.record(params);sync();persist();if(!changed&&mesh)return;requestId++;$('export-stl').disabled=true;$('build-state').textContent=mesh?'Updating geometry…':'';clearTimeout(rebuildTimer);const send=()=>{if(!workerBusy){workerBusy=true;worker.postMessage({id:requestId,params});}};if(debounce)rebuildTimer=setTimeout(send,80);else send();}
worker.onmessage=({data})=>{
 workerBusy=false;
 if(data.id!==requestId){workerBusy=true;worker.postMessage({id:requestId,params});return;}
 if(data.error){$('loading').hidden=true;$('build-state').textContent='Could not build this configuration. Adjust the dimensions.';toast('Geometry could not be built.');return;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
 if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.userData.exportGeometry.dispose();}
 mesh=new THREE.Mesh(createDisplayGeometry(geometry),wireframe?wireMaterial:material);mesh.geometry.computeBoundingBox();mesh.userData.exportGeometry=geometry;mesh.userData.params=structuredClone(params);scene.add(mesh);completedId=data.id;
 $('loading').hidden=true;$('build-state').textContent='';sync();frameModel({preserveZoom:true});
};
worker.onerror=()=>{$('loading').hidden=true;$('build-state').textContent='Geometry engine could not load. Reload to retry.';};
document.querySelectorAll('[data-param]').forEach(el=>{const event=el.type==='range'?'input':'change';el.addEventListener(event,()=>{const key=el.dataset.param;const raw=Number(el.value);if(el.value.trim()===''||!Number.isFinite(raw)){sync();return;}const entered={...params,[key]:raw},next=normalize(entered);if(JSON.stringify(next)!==JSON.stringify(entered))toast(key==='spacing'?`${raw<next.spacing?'Minimum':'Maximum'} spacing is ${fmt(next.spacing)} mm.`:['t_slot_x','t_hole_x','t_hole'].includes(key)?`Adjusted to retain at least ${fmt(RETENTION_WEB_MIN)} mm between openings.`:'Adjusted to keep the mount geometry valid.');update(next,el.type==='range');});});
let rangeEditing=false,rangeKeyActive=false;
document.querySelectorAll('input[type=range][data-param]').forEach(el=>{
 el.addEventListener('pointerdown',()=>{rangeEditing=true;rangeKeyActive=false;edits.begin();});
 el.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){rangeKeyActive=true;edits.begin();}});
 el.addEventListener('keyup',()=>{if(rangeKeyActive){rangeKeyActive=false;edits.end();sync();}});
 el.addEventListener('change',()=>{if(!rangeKeyActive){edits.end();sync();}});
 el.addEventListener('blur',()=>{rangeEditing=false;rangeKeyActive=false;edits.end();sync();});
});
for(const event of ['pointerup','pointercancel','blur'])window.addEventListener(event,()=>{if(rangeEditing){rangeEditing=false;edits.end();sync();}});
function restoreEdit(direction){const state=direction==='undo'?edits.undo():edits.redo();if(state){update(state,false,false);toast(direction==='undo'?'Change undone.':'Change restored.');}}
$('undo').onclick=()=>restoreEdit('undo');$('redo').onclick=()=>restoreEdit('redo');
window.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||e.altKey||!['z','y'].includes(e.key.toLowerCase())||e.target.closest('input:not([type=range]),textarea,[contenteditable]'))return;e.preventDefault();restoreEdit(e.shiftKey||e.key.toLowerCase()==='y'?'redo':'undo');});
$('controls-toggle').onclick=()=>{const open=$('controls-body').hidden;$('controls-body').hidden=!open;$('controls-toggle').setAttribute('aria-expanded',String(open));$('controls-toggle').setAttribute('aria-label',open?'Hide controls':'Show controls');$('controls-toggle').dataset.icon=open?'chevron':'sliders';setIcons();};
$('fit-view').onclick=()=>frameModel();
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;frameModel({direction:VIEW_DIRECTIONS[view],parallel:view!=='iso'});});
$('wire-toggle').onclick=()=>{wireframe=!wireframe;if(mesh)mesh.material=wireframe?wireMaterial:material;$('wire-toggle').setAttribute('aria-pressed',String(wireframe));render();};
$('dimensions-toggle').onclick=()=>{showDimensions=!showDimensions;$('dimensions-toggle').setAttribute('aria-pressed',String(showDimensions));frameModel({preserveZoom:true});};
$('reset').onclick=()=>{update(DEFAULTS);toast('Original stereo mount restored.');};
function toast(message){clearTimeout(toastTimer);$('status').textContent=message;$('status').classList.add('visible');toastTimer=setTimeout(()=>$('status').classList.remove('visible'),2800);}
$('share').onclick=async()=>{persist();try{await navigator.clipboard.writeText(location.href);toast('Configuration link copied.');}catch{try{await navigator.share({title:'Webcam mount',url:location.href});}catch{toast('Copy the address to share this configuration.');}}};
function download(data,extension){
 const url=URL.createObjectURL(new Blob([data],{type:'application/octet-stream'}));
 const a=document.createElement('a');
 a.href=url;
 a.download=`webcam-${params.camera_count}x-${fmt(params.spacing)}mm.${extension}`;
 a.hidden=true;
 document.body.append(a);
 a.click();
 setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},60000);
 toast(`${extension.toUpperCase()} download requested.`);
}
$('export-stl').onclick=()=>{if(!mesh||completedId!==requestId)return;const geometry=mesh.userData.exportGeometry.clone();const p=geometry.attributes.position;const d=dimensions(params);for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i),p.getY(i)+d.height/2,-p.getZ(i)+d.depth/2);const indices=geometry.index;for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}geometry.computeVertexNormals();const exported=new THREE.Mesh(geometry);exported.updateMatrixWorld(true);download(new STLExporter().parse(exported,{binary:true}),'stl');geometry.dispose();};
$('export-scad').onclick=()=>download(generateScad(params),'scad');
$('export-json').onclick=()=>download(JSON.stringify(params,null,2),'json');
$('import-json').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error();const data=JSON.parse(await file.text());if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(DEFAULTS).some(k=>k in data))throw new Error();const imported=normalize(data),adjusted=['t_slot_x','t_hole_x','t_hole'].some(k=>k in data&&Number(data[k])!==imported[k])||(Array.isArray(data.t_slot)&&data.t_slot.slice(0,2).some((n,i)=>Number(n)!==imported.t_slot[i]));update(imported);toast(adjusted?'Configuration imported; mounting clearances adjusted.':'Configuration imported.');}catch{toast('Choose a valid webcam settings JSON file.');}finally{e.target.value='';}};
window.addEventListener('hashchange',()=>{try{if(location.hash.startsWith('#p='))update(JSON.parse(decodeURIComponent(location.hash.slice(3))));}catch{toast('This configuration link could not be read.');}});
let light={az:Math.atan2(lightKey.position.z,lightKey.position.x),el:Math.asin(lightKey.position.y/lightKey.position.length())};
setupGestures({canvas,getCamera:()=>camera,controls,render,onEditStart:()=>edits.begin(),onEditEnd:()=>{edits.end();sync();},onNudge:(axis,delta)=>{const key=axis==='horizontal'?'spacing':'cam_h',span=axis==='horizontal'?248:105;update({...params,[key]:params[key]+delta/420*span},true);},onLight:(dx,dy)=>{light.az+=dx*.012;light.el=Math.min(1.4,Math.max(.12,light.el-dy*.008));if(lightKey){const r=8.6,h=r*Math.cos(light.el);lightKey.position.set(h*Math.cos(light.az),r*Math.sin(light.el),h*Math.sin(light.az));}render();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
resize();update(params);
