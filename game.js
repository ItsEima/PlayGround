import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const dayFog = new THREE.Color('#a9b49a');
scene.background = dayFog.clone();
scene.fog = new THREE.Fog(dayFog, 24, 94);
const camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.1, 180);
camera.rotation.order = 'YXZ';
const player = { x: 0, z: 0, yaw: 0, pitch: 0, health: 100, hunger: 82, thirst: 76, warmth: 68, wood: 0, stone: 0, berries: 0, started: false, ended: false, paused: false, fire: false, elapsed: 0, day: 1, night: false, interactTarget: null, toastTimer: 0 };
const world = new THREE.Group(); scene.add(world);
const hemi = new THREE.HemisphereLight(0xdce6d0, 0x354337, 1.18); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6bc, 2.0); sun.position.set(-25, 34, -12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.bias = -0.0004; scene.add(sun);
const fill = new THREE.DirectionalLight(0xb9d2cd, .35); fill.position.set(20, 12, 24); scene.add(fill);
const clock = new THREE.Clock();
const resourceObjects = [];
const solidObjects = [];
const keys = Object.create(null);
const forward = new THREE.Vector3();
let toastTimeout;
let fireLight, fireFlame, fireGlow;

const mat = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
const groundMat = mat('#59694b');
const trunkMat = mat('#544333');
const leafMats = ['#263d2b','#304a31','#385336','#2c452e'].map(c => mat(c));
const rockMat = mat('#778071');
const berryMat = new THREE.MeshStandardMaterial({ color:'#b65851', roughness:.58 });
const woodMat = mat('#ab8052');
const stoneItemMat = mat('#a6aa98');
const terrainGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);
terrainGeometry.rotateX(-Math.PI / 2);
const posAttr = terrainGeometry.attributes.position;
for (let i=0; i<posAttr.count; i++) {
  const x = posAttr.getX(i), z = posAttr.getZ(i);
  posAttr.setY(i, Math.sin(x*.085)*.22 + Math.cos(z*.105)*.22 + Math.sin((x+z)*.06)*.14);
}
terrainGeometry.computeVertexNormals();
const terrain = new THREE.Mesh(terrainGeometry, groundMat); terrain.receiveShadow = true; world.add(terrain);

function groundY(x,z){ return Math.sin(x*.085)*.22 + Math.cos(z*.105)*.22 + Math.sin((x+z)*.06)*.14; }
function addTree(x,z,scale=1){
  const group = new THREE.Group(); group.position.set(x, groundY(x,z), z); group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.17,.28,2.1,7), trunkMat); trunk.position.y=1.05; trunk.castShadow=true; trunk.receiveShadow=true; group.add(trunk);
  for(let i=0;i<3;i++){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.05-i*.16, 2.1, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
    cone.position.y=2.1+i*.82; cone.rotation.y=Math.random()*1.5; cone.castShadow=true; group.add(cone);
  }
  world.add(group); solidObjects.push({x,z,r:scale*.72});
}
function addRock(x,z,scale=1){
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(.55*scale,0), rockMat); mesh.position.set(x,groundY(x,z)+.3*scale,z); mesh.scale.set(1.2,.72,.95); mesh.rotation.set(Math.random()*.2,Math.random()*3,Math.random()*.15); mesh.castShadow=true; mesh.receiveShadow=true; world.add(mesh);
}
function addResource(type,x,z){
  const group=new THREE.Group(); group.position.set(x,groundY(x,z),z); group.userData={type,active:true,respawn:0};
  if(type==='wood'){
    for(let i=0;i<3;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.92,6),woodMat);log.rotation.z=Math.PI/2;log.rotation.y=i*.16;log.position.set((i-1)*.14,.12+i*.015,0);log.castShadow=true;group.add(log);}
    const tip=new THREE.Mesh(new THREE.CylinderGeometry(.02,.11,.08,6),mat('#d1a26d'));tip.rotation.z=Math.PI/2;tip.position.set(.5,.12,0);group.add(tip);
  } else if(type==='stone'){
    const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.34,0),stoneItemMat);mesh.position.y=.24;mesh.scale.set(1.2,.75,.9);mesh.castShadow=true;group.add(mesh);
    const chip=new THREE.Mesh(new THREE.DodecahedronGeometry(.17,0),rockMat);chip.position.set(.23,.14,.18);group.add(chip);
  } else {
    const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(.36,1),mat('#526644'));bush.position.y=.32;bush.scale.y=.8;group.add(bush);
    for(let i=0;i<7;i++){const a=i*2.4;const berry=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),berryMat);berry.position.set(Math.cos(a)*(.2+Math.random()*.15),.3+Math.random()*.35,Math.sin(a)*(.2+Math.random()*.15));group.add(berry);}
  }
  world.add(group);resourceObjects.push(group);return group;
}

// A quiet, walkable forest clearing with a stream to the east.
for(let i=0;i<135;i++){
  const angle=Math.random()*Math.PI*2, radius=11+Math.random()*75;
  let x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(x>9&&x<18&&Math.abs(z)<31) x+=Math.random()<.5?-6:6;
  if(Math.abs(x)>89||Math.abs(z)>89) continue;
  addTree(x,z,.72+Math.random()*.75);
}
for(let i=0;i<48;i++){const a=Math.random()*Math.PI*2,r=8+Math.random()*70;addRock(Math.cos(a)*r,Math.sin(a)*r,.45+Math.random()*.85);}
// Fallen branches, flint and food are deliberately easy to spot near the starting clearing.
[[3,-3],[-4,-2],[2,5],[-7,4],[8,-6],[5,9],[-10,-5],[13,-13],[-14,12]].forEach(([x,z])=>addResource('wood',x,z));
[[-3,7],[7,2],[-8,-7],[12,8],[22,-5],[-18,4],[3,15]].forEach(([x,z])=>addResource('stone',x,z));
[[5,-9],[-5,10],[9,11],[-12,-11],[17,5],[-20,9]].forEach(([x,z])=>addResource('berry',x,z));
// Stream ribbon, with a small pebble bank.
const waterMat=new THREE.MeshStandardMaterial({color:'#668e8a',roughness:.27,metalness:.08,transparent:true,opacity:.83});
const streamGeo=new THREE.PlaneGeometry(7,72,1,80);streamGeo.rotateX(-Math.PI/2);
const stream= new THREE.Mesh(streamGeo,waterMat);stream.position.set(14,.05,0);stream.receiveShadow=true;world.add(stream);
const bankMat=mat('#747762');
for(let i=0;i<40;i++){const z=-35+i*1.8;for(const side of [-1,1]){const x=14+side*(4+Math.random()*1.2);const peb=new THREE.Mesh(new THREE.DodecahedronGeometry(.15+Math.random()*.22,0),bankMat);peb.position.set(x,groundY(x,z)+.08,z);peb.scale.y=.6;peb.rotation.y=Math.random()*3;world.add(peb);}}
// Small ferns and pale mushrooms give the ground a readable sense of scale.
for(let i=0;i<90;i++){
  const a=Math.random()*Math.PI*2,r=5+Math.random()*76,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(x>10&&x<18&&Math.abs(z)<34)continue;
  const sprout=new THREE.Group();sprout.position.set(x,groundY(x,z),z);
  const leafmat=leafMats[Math.floor(Math.random()*leafMats.length)];
  for(let j=0;j<4;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.12,.7,5),leafmat);leaf.position.set(Math.cos(j*Math.PI/2)*.15,.28,Math.sin(j*Math.PI/2)*.15);leaf.rotation.z=-Math.cos(j*Math.PI/2)*.45;leaf.rotation.x=Math.sin(j*Math.PI/2)*.45;sprout.add(leaf);}
  world.add(sprout);
}

function setCamera(){camera.position.set(player.x,groundY(player.x,player.z)+1.62,player.z);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;}
function setToast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2100);}
function nearestResource(){let nearest=null,dist=3.0;for(const obj of resourceObjects){if(!obj.userData.active)continue;const d=Math.hypot(player.x-obj.position.x,player.z-obj.position.z);if(d<dist){dist=d;nearest=obj;}}return nearest;}
function nearCamp(){return Math.hypot(player.x,player.z)<3.2;}
function isAtWater(){return player.x>9.2&&player.x<18.8&&Math.abs(player.z)<35;}
function updateInteraction(){
  let text='',target=null;
  if(nearCamp()&&!player.fire&&player.wood>=3&&player.stone>=2){text='Build a warming fire · 3 wood, 2 stone';target='fire';}
  else if(isAtWater()&&player.thirst<98){text='Drink from the clear stream';target='water';}
  else {const obj=nearestResource();if(obj){target=obj;const type=obj.userData.type;text=type==='wood'?'Gather fallen branch':type==='stone'?'Pick up flint stone':'Gather wild berries';}}
  player.interactTarget=target;
  const prompt=document.querySelector('#interaction');prompt.classList.toggle('visible',!!target);
  if(target)document.querySelector('#interaction-text').textContent=text;
  const key=document.querySelector('.interaction-key');key.textContent=target==='fire'?'F':'E';
}
function lightFire(){
  player.wood-=3;player.stone-=2;player.fire=true;
  const pit=new THREE.Group();pit.position.set(0,groundY(0,0),0);world.add(pit);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const log=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,1.08,7),woodMat);log.rotation.z=Math.PI/2;log.rotation.y=a;log.position.set(Math.cos(a)*.32,.16,Math.sin(a)*.32);log.castShadow=true;pit.add(log);}
  const stones=new THREE.Mesh(new THREE.TorusGeometry(.78,.12,5,12),stoneItemMat);stones.rotation.x=Math.PI/2;stones.position.y=.12;pit.add(stones);
  fireGlow=new THREE.Mesh(new THREE.SphereGeometry(.42,10,8),new THREE.MeshBasicMaterial({color:'#ff9c4a',transparent:true,opacity:.74}));fireGlow.position.y=.55;pit.add(fireGlow);
  fireFlame=new THREE.Mesh(new THREE.ConeGeometry(.28,.92,7),new THREE.MeshBasicMaterial({color:'#f8bf67',transparent:true,opacity:.88}));fireFlame.position.y=.83;pit.add(fireFlame);
  fireLight=new THREE.PointLight(0xffa65b,2.2,15,2);fireLight.position.set(0,1.4,0);pit.add(fireLight);
  const glow=new THREE.PointLight(0xff873c,.5,6);glow.position.set(0,.35,0);pit.add(glow);
  setToast('A good fire. The night feels a little smaller.');updateQuest();
}
function interact(){
  if(!player.started||player.ended||player.paused)return;
  const target=player.interactTarget;
  if(target==='fire'){lightFire();}
  else if(target==='water'){player.thirst=Math.min(100,player.thirst+42);setToast('Cold, clear water. Thirst eased.');}
  else if(target?.userData?.active){const type=target.userData.type;target.userData.active=false;target.visible=false;target.userData.respawn=45;
    if(type==='wood'){player.wood++;setToast('A dry branch. +1 wood');}
    if(type==='stone'){player.stone++;setToast('Good flint. +1 stone');}
    if(type==='berry'){player.berries+=2;setToast('A handful of wild berries. +2 food');}
    updateInventory();updateQuest();
  }
}
function eat(){if(!player.started||player.ended||player.paused)return;if(player.berries>0){player.berries--;player.hunger=Math.min(100,player.hunger+27);player.health=Math.min(100,player.health+3);updateInventory();setToast('Sweet berries. A little strength back.');}else setToast('No berries in your pack. Look for red fruit.');}
function updateInventory(){document.querySelector('#wood-count').textContent=player.wood;document.querySelector('#stone-count').textContent=player.stone;document.querySelector('#berry-count').textContent=player.berries;document.querySelector('#pack-capacity').textContent=player.wood+player.stone+player.berries>10?'HEAVY':'LIGHT';}
function updateQuest(){const total=Math.min(5,Math.min(player.wood,3)+Math.min(player.stone,2));const done=player.fire?5:total;document.querySelector('#quest-progress').style.width=`${done/5*100}%`;document.querySelector('#quest-count').textContent=player.fire?'READY':' '+total+' / 5';if(player.fire){document.querySelector('#mission-title').textContent='The fire is yours.';document.querySelector('#mission-copy').textContent='Stay close when the dark settles in. Find the stream if thirst catches you.';}else{document.querySelector('#mission-title').textContent='Keep a fire through the night.';document.querySelector('#mission-copy').textContent='Gather 3 wood and 2 stones, then build your fire at the clearing.';}}

function use(){interact();}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='e')interact();if(k==='f'&&player.interactTarget==='fire')interact();if(k==='q')eat();if(k==='escape'&&player.started&&!player.ended){player.paused=!player.paused;document.querySelector('#pause-screen').classList.toggle('hidden',!player.paused);}});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let dragging=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{if(!player.started||player.ended)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{if(!dragging||player.paused)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;player.yaw-=dx*.0032;player.pitch=Math.max(-1.05,Math.min(1.05,player.pitch-dy*.0025));});
const joy=document.querySelector('#joystick'),knob=document.querySelector('#joy-knob');let joyPointer=null,joyX=0,joyY=0;
joy.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)joyMove(e);});
function joyMove(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=39,len=Math.max(1,Math.hypot(dx,dy)),scale=Math.min(1,max/len);joyX=dx/39*scale;joyY=dy/39*scale;knob.style.left=`calc(50% + ${joyX*39}px)`;knob.style.top=`calc(50% + ${joyY*39}px)`;}
function resetJoy(){joyPointer=null;joyX=joyY=0;knob.style.left='50%';knob.style.top='50%';}
joy.addEventListener('pointerup',resetJoy);joy.addEventListener('pointercancel',resetJoy);
document.querySelector('#touch-use').addEventListener('pointerdown',e=>{e.preventDefault();use();});
document.querySelector('#touch-eat').addEventListener('pointerdown',e=>{e.preventDefault();eat();});
document.querySelector('#start-button').addEventListener('click',()=>{player.started=true;document.querySelector('#game-shell').classList.remove('not-started');document.querySelector('#start-screen').classList.add('hidden');document.querySelector('#desktop-hint').style.opacity=matchMedia('(pointer:coarse)').matches?'0':'1';setToast('Find branches and flint. Your camp is right here.');});
document.querySelector('#mission-dismiss').addEventListener('click',()=>document.querySelector('#mission-card').classList.add('collapsed'));
document.querySelector('#resume-button').addEventListener('click',()=>{player.paused=false;document.querySelector('#pause-screen').classList.add('hidden');});
document.querySelector('#restart-button').addEventListener('click',()=>location.reload());
document.querySelector('#sound-button').addEventListener('click',e=>{const b=e.currentTarget;b.textContent=b.textContent==='♫'?'♪':'♫';setToast(b.textContent==='♫'?'Sound on':'Sound off');});

function endGame(won){player.ended=true;document.querySelector('#end-screen').classList.remove('hidden');document.querySelector('#end-kicker').textContent=won?'FIELD REPORT / 03':'FIELD REPORT / CUT SHORT';document.querySelector('#end-title').innerHTML=won?'The forest<br><em>remembers.</em>':'The woods<br><em>go quiet.</em>';document.querySelector('#end-copy').textContent=won?'Three days, two nights, and one small fire. You made a place for yourself here.':'The wilderness asked more than you had to give. There is always another morning.';}
function updateMeters(dt){
  player.hunger=Math.max(0,player.hunger-dt*.11);player.thirst=Math.max(0,player.thirst-dt*.17);
  const nearFire=player.fire&&Math.hypot(player.x,player.z)<7;
  if(player.night){player.warmth=nearFire?Math.min(100,player.warmth+dt*.72):Math.max(0,player.warmth-dt*.48);}else player.warmth=Math.min(100,player.warmth+dt*.18);
  if(player.hunger<=0||player.thirst<=0)player.health=Math.max(0,player.health-dt*.36);
  if(player.warmth<18)player.health=Math.max(0,player.health-dt*.22);
  if(nearFire)player.health=Math.min(100,player.health+dt*.035);
  const entries=[['health',player.health],['food',player.hunger],['water',player.thirst],['warmth',player.warmth]];
  entries.forEach(([name,val])=>{document.querySelector(`#${name}-fill`).style.width=`${val}%`;document.querySelector(`#${name}-value`).textContent=Math.round(val);});
  const condition=document.querySelector('#condition-label');condition.textContent=player.health<30?'CRITICAL':player.thirst<25?'THIRSTY':player.warmth<25?'COLD':player.hunger<25?'HUNGRY':'STEADY';condition.style.color=player.health<30?'#df8a73':player.warmth<25?'#e4ad76':'#a7c094';
  if(player.health<=0)endGame(false);
}
function updateTime(dt){
  player.elapsed+=dt;
  const cycle=110,phase=player.elapsed%cycle,newDay=Math.floor(player.elapsed/cycle)+1;
  if(newDay!==player.day){player.day=newDay;if(player.day>=3){endGame(true);return;}setToast(`Day ${String(player.day).padStart(2,'0')}. You made it through the night.`);}
  const night=phase>=76;player.night=night;
  const daylight=night?Math.max(.15,1-(phase-76)/34):Math.max(.35,Math.min(1,phase/12,1-(phase-62)/14));
  const dusk=Math.max(0,1-Math.abs(phase-76)/17);
  const sky=new THREE.Color('#a9b49a').lerp(new THREE.Color('#172532'),night?.9:dusk*.62);
  scene.background.copy(sky);scene.fog.color.copy(sky);scene.fog.near=night?13:24;scene.fog.far=night?58:94;
  hemi.intensity=.2+daylight*.98;sun.intensity=.16+daylight*1.85;fill.intensity=.1+daylight*.3;
  sun.color.set(night?'#8195be':dusk>.3?'#ffc18a':'#ffe6bc');
  document.querySelector('#day-label').innerHTML=`DAY ${String(player.day).padStart(2,'0')} <i>·</i> ${night?'NIGHT':phase>60?'DUSK':phase<12?'MORNING':'DAYLIGHT'}`;
  document.querySelector('#weather-icon').textContent=night?'☾':phase>60?'◒':'☀';
  if(fireLight){fireLight.intensity=2.0+Math.sin(player.elapsed*13)*.32;fireFlame.scale.y=.78+Math.sin(player.elapsed*10)*.24;fireGlow.scale.setScalar(.85+Math.sin(player.elapsed*8)*.16);}
}
function updateMovement(dt){
  let f=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)-joyY;
  let s=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joyX;
  const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
  const speed=(keys.shift?7.2:4.7)*dt;
  const dx=(Math.sin(player.yaw)*f+Math.cos(player.yaw)*s)*speed;
  const dz=(-Math.cos(player.yaw)*f+Math.sin(player.yaw)*s)*speed;
  const nx=player.x+dx,nz=player.z+dz;
  if(Math.abs(nx)<94&&!solidObjects.some(o=>Math.hypot(nx-o.x,nz-o.z)<o.r+.35))player.x=nx;
  if(Math.abs(nz)<94&&!solidObjects.some(o=>Math.hypot(player.x,nz-o.z)<o.r+.35))player.z=nz;
}
function updateResources(dt){for(const obj of resourceObjects){if(!obj.userData.active){obj.userData.respawn-=dt;if(obj.userData.respawn<=0){obj.userData.active=true;obj.visible=true;}}}}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(player.started&&!player.ended&&!player.paused){updateTime(dt);updateMovement(dt);updateResources(dt);updateMeters(dt);updateInteraction();}setCamera();document.querySelector('#compass').style.setProperty('--yaw',`${-player.yaw}rad`);const needle=document.querySelector('.compass-needle');needle.style.transform=`rotate(${-player.yaw}rad)`;renderer.render(scene,camera);}
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));});
updateInventory();updateQuest();setCamera();animate();
