import * as THREE from 'three';

const $ = id => document.getElementById(id);
const screens = ['authScreen','lobbyScreen','roomScreen','gameScreen','resultsScreen'];
const show = id => screens.forEach(s => $(s).classList.toggle('hidden',s!==id));
let token=localStorage.getItem('os_token')||'', user=null, socket=null, currentRoom=null, characters=[], weapons={}, ammoByWeapon={}, authMode='login', selectedCharacter=null, selectedTeam=null, isReady=false;
let scene,camera,renderer,clock,localMesh,remoteMeshes=new Map(),keys={},yaw=0,pitch=0,velocity=0,gameActive=false,weaponKey='rifle',ammo=30,lastFire=0,moveTimer=0,fireHeld=false,sniperScoped=false,minimapTimer=0;
const weaponOrder=['rifle','sniper','shotgun','pistol'];
const weaponDefaults={rifle:{name:'ASSAULT RIFLE',magazine:30},sniper:{name:'SNIPER RIFLE',magazine:5},shotgun:{name:'SHOTGUN',magazine:8},pistol:{name:'SIDEARM',magazine:12}};
function message(id,text,ok=false){$(id).textContent=text;$(id).style.color=ok?'#68d6a1':'#ff6b70';}
function connect(){
 if(!token)return;
 socket=io({auth:{token}});
 socket.on('connect',()=>{ $('connection').classList.add('online');$('connection').innerHTML='<i></i> CONNECTED';});
 socket.on('disconnect',()=>{ $('connection').classList.remove('online');$('connection').innerHTML='<i></i> DISCONNECTED';});
 socket.on('connect_error',e=>message('authMessage',e.message));
 socket.on('characters:list',list=>{characters=list;});
 socket.on('weapons:list',list=>{weapons=list;});
 socket.on('rooms:update',renderRooms);
 socket.on('room:update',room=>{currentRoom=room;renderRoom(room);});
 socket.on('game:start',data=>startGame(data));
 socket.on('game:clock',data=>{const m=Math.floor(data.remaining/60),s=data.remaining%60;$('clock').textContent=m+':'+String(s).padStart(2,'0');});
 socket.on('score:update',renderScores);
 socket.on('game:finished',data=>{fireHeld=false;if(document.pointerLockElement)document.exitPointerLock();showResults(data);});
 socket.on('player:moved',data=>{const mesh=remoteMeshes.get(data.id);if(mesh){mesh.position.x=data.x;mesh.position.z=data.z;mesh.rotation.y=data.yaw;}});
 socket.on('player:respawn',data=>{if(data.id===user.id){localMesh.position.set(data.x,0,data.z);localMesh.visible=true;$('health').textContent='100';$('healthBar').style.width='100%';$('gameNotice').textContent='RESPAWNED · BACK IN ACTION';}else{const mesh=remoteMeshes.get(data.id);if(mesh){mesh.position.set(data.x,0,data.z);mesh.visible=true;}}});
 socket.on('combat:elimination',data=>{if(data.victim===user.id){localMesh.visible=false;$('gameNotice').textContent='ELIMINATED · RESPAWNING';}else{const victim=remoteMeshes.get(data.victim);if(victim)victim.visible=false;if(data.killer===user.id){$('gameNotice').textContent='TARGET ELIMINATED';setTimeout(()=>{$('gameNotice').textContent='WASD MOVE · MOUSE AIM · CLICK FIRE';},1200);}}});
 socket.on('combat:hit',data=>{if(data.to===user.id){$('health').textContent=data.health;$('healthBar').style.width=data.health+'%';}});
 socket.on('weapon:reloaded',data=>{ammoByWeapon[data.weapon]=data.ammo;if(data.weapon===weaponKey){ammo=data.ammo;$('ammo').textContent=ammo+' / ∞';}});
}
function authRequest(pathname,body){
 return fetch('/api/'+pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;});
}
$('authForm').addEventListener('submit',async e=>{
 e.preventDefault();message('authMessage','');
 try{const data=await authRequest(authMode==='login'?'login':'register',{username:$('username').value,password:$('password').value});token=data.token;user=data.user;localStorage.setItem('os_token',token);enterLobby();}
 catch(err){message('authMessage',err.message);}
});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{authMode=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').innerHTML=authMode==='login'?'ENTER THE GAME <span>↗</span>':'CREATE ACCOUNT <span>↗</span>';$('password').autocomplete=authMode==='login'?'current-password':'new-password';}));
function enterLobby(){ $('userBadge').textContent=user.username;$('userBadge').classList.remove('hidden');show('lobbyScreen');connect();}
$('logoutBtn').onclick=()=>{if(socket)socket.disconnect();socket=null;token='';user=null;localStorage.removeItem('os_token');$('userBadge').classList.add('hidden');show('authScreen');};
$('createRoom').onclick=()=>socket?.emit('room:create',{name:$('roomName').value,maxPlayers:Number($('maxPlayers').value)},res=>{if(!res.ok)alert(res.error);});
$('refreshRooms').onclick=()=>socket?.emit('rooms:refresh');
function renderRooms(rooms){const list=$('roomList');if(!rooms.length){list.innerHTML='<p class="muted">No open rooms. Create one and invite your friends.</p>';return;}list.innerHTML=rooms.map(r=>'<div class="room-item"><div><strong>'+escapeHtml(r.name)+'</strong><small>HOST: '+escapeHtml(r.host)+' · '+r.players+'/'+r.maxPlayers+' PLAYERS</small></div><button class="join-btn" data-room="'+r.id+'">JOIN ↗</button></div>').join('');list.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>socket.emit('room:join',b.dataset.room,res=>{if(!res.ok)alert(res.error);}));}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderRoom(room){
 show('roomScreen');$('roomTitle').textContent=room.name.toUpperCase();$('roomMeta').textContent=room.players.length+' / '+room.maxPlayers+' OPERATORS · '+room.status.toUpperCase();
 const me=room.players.find(p=>p.id===user.id);selectedCharacter=me?.character||null;selectedTeam=me?.team||null;isReady=!!me?.ready;
 const occupied=new Set(room.players.filter(p=>p.id!==user.id).map(p=>p.character));
 $('characterGrid').innerHTML=characters.map(c=>'<button class="character-card '+(selectedCharacter===c.id?'selected ':'')+(occupied.has(c.id)?'occupied':'')+'" data-char="'+c.id+'" '+(!c.unlocked||occupied.has(c.id)?'disabled':'')+'><div class="character-art" style="--c:'+c.color+'"></div><strong>'+c.name+'</strong><small>'+(occupied.has(c.id)?'IN USE':c.unlocked?'AVAILABLE':'🔒 LOCKED')+'</small></button>').join('');
 $('characterGrid').querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>socket.emit('player:character',b.dataset.char,res=>{if(!res.ok)message('roomMessage',res.error);else message('roomMessage','Operator selected.',true);}));
 document.querySelectorAll('[data-team]').forEach(b=>b.classList.toggle('active',b.dataset.team===selectedTeam));
 for(const team of ['blue','red']){$(team+'Players').innerHTML=room.players.filter(p=>p.team===team).map(p=>'<div class="player-row"><span>'+escapeHtml(p.username)+'</span><small>'+(p.ready?'READY':'NOT READY')+'</small></div>').join('')||'<p class="tiny muted">No players yet</p>';}
 $('readyBtn').textContent=isReady?'CANCEL READY':"I'M READY ✓";$('readyBtn').disabled=!selectedCharacter||!selectedTeam;
 $('startBtn').classList.toggle('hidden',room.hostId!==user.id);
}
document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>socket.emit('player:team',b.dataset.team,res=>{if(!res.ok)message('roomMessage',res.error);}));
$('readyBtn').onclick=()=>socket.emit('player:ready',!isReady,res=>{if(!res.ok)message('roomMessage',res.error);});
$('startBtn').onclick=()=>socket.emit('room:start',res=>{if(!res.ok)message('roomMessage',res.error);});
$('leaveRoom').onclick=()=>{socket.emit('room:leave');currentRoom=null;show('lobbyScreen');};
$('backLobby').onclick=()=>{destroyGame();socket.emit('room:leave');currentRoom=null;show('lobbyScreen');};
function initThree(){
 const host=$('gameCanvas');scene=new THREE.Scene();scene.background=new THREE.Color(0x8797a0);scene.fog=new THREE.Fog(0x8797a0,45,100);
 camera=new THREE.PerspectiveCamera(75,host.clientWidth/host.clientHeight,.1,150);camera.position.set(0,1.65,0);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xdcecff,0x38412f,2.1));const sun=new THREE.DirectionalLight(0xffe3c1,2.4);sun.position.set(-15,28,10);sun.castShadow=true;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0x69745f,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(90,45,0x73806b,0x58634f);grid.position.y=.015;scene.add(grid);
 const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.85});
 function block(x,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);}
 // Compact training-yard arena: perimeter walls, central cover, containers and watch towers.
 // Tactical dressing: concrete lanes, container ribs, barricades and perimeter floodlights.
 const detail=(x,y,z,w,h,d,color,roughness=.82)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;};
 // Asphalt firing lanes and painted lane markings.
 detail(0,.012,0,12,.018,66,0x555b59);
 for(let z=-29;z<=29;z+=6){detail(-5.15,.025,z,.12,.025,2.4,0xc7b77c);detail(5.15,.025,z,.12,.025,2.4,0xc7b77c);}
 // Corrugated container faces and corner posts.
 for(const [x,z,w,d,color] of [[-18,-16,8,5,0x536d70],[17,-15,7,6,0x6e5948],[-18,16,7,5,0x596b58],[18,17,8,5,0x59616b]]){
   for(let i=0;i<Math.floor(w/.65);i++)detail(x-w/2+.35+i*.65,1.52,z+d/2+.035,.045,2.9,.07,0x9b9b88);
   for(const sx of [-1,1])for(const sz of [-1,1])detail(x+sx*(w/2-.12),1.5,z+sz*(d/2-.12),.24,3,.24,0x343c3d);
 }
 // Low concrete jersey barriers create readable cover without blocking the whole arena.
 for(const [x,z,rot] of [[-11,-8,.18],[11,8,-.18],[-12,9,-.2],[12,-9,.2]]){
   const b=detail(x,.58,z,5.5,1.16,.72,0x777b73);b.rotation.y=rot;
   for(let i=-2;i<=2;i++)detail(x+i*1.05,1.18,z,.07,.08,.76,0xaaa99a);
 }
 // Sandbag positions near the center and team approaches.
 for(const [x,z] of [[-4,-12],[4,12],[-22,4],[22,-4]]){
   for(let row=0;row<2;row++)for(let i=0;i<3;i++){
     const bag=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.62,3,6),mat(0x8a8063));
     bag.rotation.z=Math.PI/2;bag.position.set(x+(i-1)*.62+(row%2)*.2,.34+row*.38,z);bag.castShadow=true;scene.add(bag);
   }
 }
 // Watchtower frames and bright lamps at the four corners.
 for(const [x,z] of [[-27,-27],[27,-27],[-27,27],[27,27]]){
   for(const sx of [-1,1])for(const sz of [-1,1])detail(x+sx*.9,2.6,z+sz*.9,.13,5.2,.13,0x41494a);
   detail(x,5.15,z,2.2,.18,2.2,0x41494a);
   const lamp=new THREE.PointLight(0xffd99a,22,15,2);lamp.position.set(x,5.45,z);scene.add(lamp);
   detail(x,5.5,z,.42,.18,.42,0xffd99a,.35);
 }
 block(0,-34,70,5,2,0x59615e);block(0,34,70,5,2,0x59615e);block(-34,0,2,5,70,0x59615e);block(34,0,2,5,70,0x59615e);
 [[-18,-16,8,3,5],[17,-15,7,3,6],[-18,16,7,3,5],[18,17,8,3,5],[0,-21,10,2.5,3],[0,21,10,2.5,3],[-8,0,3,2.3,8],[8,0,3,2.3,8],[-25,0,3,4,3],[25,0,3,4,3]].forEach((a,i)=>block(...a,i%2?0x68746c:0x7d6650));
 for(let i=0;i<12;i++){const x=(i%4)*15-22,z=Math.floor(i/4)*18-18;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),mat(0x5c4632));trunk.position.set(x,1.4,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.4,3.6,7),mat(0x3e5941));crown.position.set(x,4,z);scene.add(crown);}
 for(let i=0;i<18;i++){const x=(Math.random()-.5)*58,z=(Math.random()-.5)*58;const crate=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.1,1.2),mat(0x8a795a));crate.position.set(x,.55,z);crate.castShadow=true;scene.add(crate);}
 localMesh=makeOperator(0x4b94c8,null,'blue');scene.add(localMesh);localMesh.visible=false;
 if(currentRoom)syncRemotePlayers(currentRoom.players);
 clock=new THREE.Clock();window.addEventListener('resize',resizeGame);animate();
}
function makeOperator(_teamColor,characterId,team){
 const group=new THREE.Group(),index=Math.max(0,characters.findIndex(c=>c.id===characterId));
 const palette=[0x596b4d,0x4d6258,0x7a6650,0x515968,0x68715d,0x76584a,0x465c69,0x77724e,0x66574c,0x4c6864,0x806443,0x594b5c,0x526c78,0x50545a,0x74756c];
 const uniform=palette[index%palette.length],dark=0x252d31,skin=[0xb98263,0xd0a17d,0x9a6d55,0xc18d70][index%4];
 const material=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness});
 const part=(geometry,color,x,y,z,rx=0,ry=0,rz=0)=>{const mesh=new THREE.Mesh(geometry,material(color));mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 part(new THREE.CapsuleGeometry(.34,.72,4,8),uniform,0,1.05,0);
 part(new THREE.BoxGeometry(.64,.62,.28),0x343d3c,0,1.14,-.035);
 part(new THREE.BoxGeometry(.48,.54,.12),uniform,0,1.17,-.205);
 for(let i=-1;i<=1;i++)part(new THREE.BoxGeometry(.115,.17,.055),0x9a8054,i*.15,1.12,-.28);
 for(const side of [-1,1]){part(new THREE.CapsuleGeometry(.105,.48,4,7),uniform,side*.43,1.08,0,0,0,side*.1);part(new THREE.SphereGeometry(.14,8,7),dark,side*.47,.77,-.015);part(new THREE.SphereGeometry(.17,8,7),0x39433e,side*.39,1.34,0);}
 for(const side of [-1,1]){part(new THREE.CapsuleGeometry(.14,.55,4,7),uniform,side*.19,.42,0);part(new THREE.BoxGeometry(.2,.16,.25),0x343b39,side*.19,.39,-.12);part(new THREE.BoxGeometry(.22,.16,.36),dark,side*.19,.11,-.07);}
 part(new THREE.CylinderGeometry(.11,.12,.18,8),skin,0,1.55,0);
 part(new THREE.SphereGeometry(.205,12,10),skin,0,1.76,0);
 part(new THREE.SphereGeometry(.235,12,9,0,Math.PI*2,0,Math.PI/2),dark,0,1.86,0);
 part(new THREE.BoxGeometry(.34,.055,.19),0x303a3c,0,1.82,-.12);
 part(new THREE.BoxGeometry(.12,.055,.09),0xb08a4e,0,1.96,-.02);
 for(const side of [-1,1])part(new THREE.CylinderGeometry(.045,.045,.06,8),0x252a2b,side*.21,1.76,0,Math.PI/2,0,0);
 part(new THREE.BoxGeometry(.38,.55,.2),0x343f39,0,1.13,.23);
 part(new THREE.CylinderGeometry(.012,.012,.3,5),0x242a2a,.16,1.65,.25);
 const teamColor=team==='blue'?0x368ce8:team==='red'?0xd84c55:0xaaaaaa;
 part(new THREE.BoxGeometry(.14,.13,.28),teamColor,.47,1.28,0);
 return group;
}
function addRemote(p){if(remoteMeshes.has(p.id))return;const m=makeOperator(0,p.character,p.team);m.position.set(p.x||0,0,p.z||0);scene.add(m);remoteMeshes.set(p.id,m);}
function syncRemotePlayers(players){const active=new Set(players.filter(p=>p.id!==user.id).map(p=>p.id));for(const [id,mesh] of remoteMeshes)if(!active.has(id)){scene.remove(mesh);remoteMeshes.delete(id);}for(const p of players)if(p.id!==user.id){if(!remoteMeshes.has(p.id))addRemote(p);else{const mesh=remoteMeshes.get(p.id);mesh.visible=p.health>0;}}}
function startGame(data){currentRoom=data.room;show('gameScreen');if(!scene)initThree();const me=currentRoom.players.find(p=>p.id===user.id);scene.remove(localMesh);localMesh=makeOperator(0,me?.character,me?.team);scene.add(localMesh);localMesh.visible=true;localMesh.position.set(me?.x||0,0,me?.z||0);camera.position.set(localMesh.position.x,1.65,localMesh.position.z);yaw=me?.yaw||0;pitch=0;camera.rotation.set(0,yaw,0);ammoByWeapon={...(me?.ammo||{})};$('health').textContent='100';$('healthBar').style.width='100%';setWeapon('rifle');$('gameNotice').textContent='CLICK TO LOCK MOUSE · WASD MOVE · LEFT CLICK FIRE';$('compassHeading').textContent='N';gameActive=true;syncRemotePlayers(currentRoom.players);renderMinimap();}
function resizeGame(){if(!renderer)return;const h=$('gameCanvas');camera.aspect=h.clientWidth/h.clientHeight;camera.updateProjectionMatrix();renderer.setSize(h.clientWidth,h.clientHeight);}
function animate(){if(!renderer)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(gameActive&&localMesh){const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);const speed=keys.ShiftLeft?9:5.5,length=Math.hypot(forward,side)||1;const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt/length,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt/length;localMesh.position.x=THREE.MathUtils.clamp(localMesh.position.x+dx,-31,31);localMesh.position.z=THREE.MathUtils.clamp(localMesh.position.z+dz,-31,31);localMesh.rotation.y=yaw;camera.position.set(localMesh.position.x,1.65,localMesh.position.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;moveTimer+=dt;minimapTimer+=dt;if(moveTimer>.08){socket.emit('player:move',{x:localMesh.position.x,z:localMesh.position.z,yaw});moveTimer=0;}if(minimapTimer>.12){renderMinimap();minimapTimer=0;}if(fireHeld)fire();}renderer.render(scene,camera);}
function renderMinimap(){const map=$('minimap');if(!map||!localMesh)return;map.querySelectorAll('.map-dot').forEach(n=>n.remove());const dot=(x,z,team,local=false)=>{const el=document.createElement('i');el.className='map-dot '+team+(local?' self':'');el.style.left=((x+34)/68*100)+'%';el.style.top=((z+34)/68*100)+'%';map.appendChild(el);};dot(localMesh.position.x,localMesh.position.z,'self',true);for(const [id,mesh] of remoteMeshes){const p=currentRoom?.players.find(x=>x.id===id);if(p&&mesh.visible)dot(mesh.position.x,mesh.position.z,p.team||'red');}const dirs=['N','NE','E','SE','S','SW','W','NW'];$('compassHeading').textContent=dirs[Math.round((((-yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8];}
function setWeapon(key){weaponKey=key;const w=weaponDefaults[key];ammo=ammoByWeapon[key]??w.magazine;$('weaponName').textContent=w.name;$('ammo').textContent=ammo+' / ∞';if(sniperScoped&&key!=='sniper')setScope(false);}
function setScope(enabled){sniperScoped=!!enabled&&weaponKey==='sniper';if(camera){camera.fov=sniperScoped?30:75;camera.updateProjectionMatrix();}$('gameScreen').classList.toggle('scoped',sniperScoped);}
function fire(){if(!gameActive||!renderer||document.pointerLockElement!==renderer.domElement)return;const w=weapons[weaponKey]||{rpm:600};if(Date.now()-lastFire<60000/w.rpm)return;lastFire=Date.now();socket.emit('weapon:fire',{weapon:weaponKey,yaw,pitch},res=>{if(res?.ok){ammo=res.ammo;ammoByWeapon[weaponKey]=ammo;$('ammo').textContent=ammo+' / ∞';}else if(res?.error==='Reload required.')$('ammo').textContent='RELOAD (R)';});}
function destroyGame(){gameActive=false;fireHeld=false;setScope(false);if(renderer){window.removeEventListener('resize',resizeGame);renderer.dispose();$('gameCanvas').innerHTML='';renderer=null;scene=null;remoteMeshes.clear();}}
function renderScores(data){$('blueScore').textContent=data.totals.blue;$('redScore').textContent=data.totals.red;const me=data.players.find(p=>p.id===user.id);if(me){$('myKills').textContent=me.kills;$('myDeaths').textContent=me.deaths;}}
function showResults(data){gameActive=false;$('winnerTitle').innerHTML=data.winner==='draw'?'MATCH <span class="accent">DRAW</span>':(data.winner==='blue'?'BLUE':'RED')+' <span class="accent">TEAM WINS</span>';const rows=data.players.map(p=>'<div class="final-row"><span>'+escapeHtml(p.username)+' · '+p.team.toUpperCase()+'</span><strong>'+p.kills+' K</strong><strong>'+p.deaths+' D</strong><span>'+((p.kills/Math.max(1,p.deaths)).toFixed(2))+' K/D</span></div>').join('');$('finalScores').innerHTML='<div class="final-row"><strong>PLAYER</strong><strong>KILLS</strong><strong>DEATHS</strong><strong>K/D</strong></div>'+rows;show('resultsScreen');}
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5))-1;if(weaponOrder[n])setWeapon(weaponOrder[n]);}if(e.code==='KeyR'&&gameActive)socket.emit('weapon:reload',weaponKey);});
window.addEventListener('keyup',e=>keys[e.code]=false);
$('gameCanvas').addEventListener('click',()=>{if(renderer&&gameActive)renderer.domElement.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer?.domElement&&gameActive)$('gameNotice').textContent='CLICK TO RESUME';});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer?.domElement){yaw-=e.movementX*.0022;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0022,-1.2,1.2);}});
document.addEventListener('mousedown',e=>{if(e.button===0&&gameActive){if(weapons[weaponKey]?.automatic)fireHeld=true;else fire();}if(e.button===2&&gameActive&&weaponKey==='sniper')setScope(true);});
document.addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2&&sniperScoped)setScope(false);});
window.addEventListener('blur',()=>{fireHeld=false;keys={};if(sniperScoped)setScope(false);});
window.addEventListener('contextmenu',e=>{if(gameActive)e.preventDefault();});
if(token){fetch('/api/health').then(r=>r.json()).then(()=>{try{const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const raw=JSON.parse(atob(payload));if(raw.exp*1000>Date.now()){user={id:raw.id,username:raw.username};enterLobby();}else throw Error();}catch{localStorage.removeItem('os_token');token='';}}).catch(()=>{});}
