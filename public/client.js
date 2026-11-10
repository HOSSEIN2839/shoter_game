import * as THREE from 'three';

const $ = id => document.getElementById(id);
const screens = ['authScreen','lobbyScreen','roomScreen','gameScreen','resultsScreen'];
const show = id => screens.forEach(s => $(s).classList.toggle('hidden',s!==id));
let token=localStorage.getItem('os_token')||'', user=null, socket=null, currentRoom=null, characters=[], weapons={}, authMode='login', selectedCharacter=null, selectedTeam=null, isReady=false;
let scene,camera,renderer,clock,localMesh,remoteMeshes=new Map(),keys={},yaw=0,pitch=0,velocity=0,gameActive=false,weaponKey='rifle',ammo=30,lastFire=0,moveTimer=0;
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
 socket.on('game:finished',showResults);
 socket.on('player:moved',data=>{const mesh=remoteMeshes.get(data.id);if(mesh){mesh.position.x=data.x;mesh.position.z=data.z;mesh.rotation.y=data.yaw;}});
 socket.on('player:respawn',data=>{if(data.id===user.id){localMesh.position.set(data.x,0,data.z);localMesh.visible=true;$('health').textContent='100';$('healthBar').style.width='100%';$('gameNotice').textContent='RESPAWNED · BACK IN ACTION';}else{const mesh=remoteMeshes.get(data.id);if(mesh){mesh.position.set(data.x,0,data.z);mesh.visible=true;}}});
 socket.on('combat:elimination',data=>{if(data.victim===user.id){localMesh.visible=false;$('gameNotice').textContent='ELIMINATED · RESPAWNING';}else{const victim=remoteMeshes.get(data.victim);if(victim)victim.visible=false;if(data.killer===user.id){$('gameNotice').textContent='TARGET ELIMINATED';setTimeout(()=>{$('gameNotice').textContent='WASD MOVE · MOUSE AIM · CLICK FIRE';},1200);}}});
 socket.on('combat:hit',data=>{if(data.to===user.id){$('health').textContent=data.health;$('healthBar').style.width=data.health+'%';}});
 socket.on('weapon:reloaded',data=>{if(data.weapon===weaponKey){ammo=data.ammo;$('ammo').textContent=ammo+' / ∞';}});
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
 const me=room.players.find(p=>p.id===user.id);selectedCharacter=me?.character||selectedCharacter;selectedTeam=me?.team||selectedTeam;isReady=!!me?.ready;
 const occupied=new Set(room.players.filter(p=>p.id!==user.id).map(p=>p.character));
 $('characterGrid').innerHTML=characters.map(c=>'<button class="character-card '+(selectedCharacter===c.id?'selected ':'')+(occupied.has(c.id)?'occupied':'')+'" data-char="'+c.id+'" '+(!c.unlocked||occupied.has(c.id)?'disabled':'')+'><div class="character-art" style="--c:'+c.color+'"></div><strong>'+c.name+'</strong><small>'+(occupied.has(c.id)?'IN USE':c.unlocked?'AVAILABLE':'🔒 LOCKED')+'</small></button>').join('');
 $('characterGrid').querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>socket.emit('player:character',b.dataset.char,res=>{if(!res.ok)message('roomMessage',res.error);else message('roomMessage','Operator selected.',true);}));
 document.querySelectorAll('[data-team]').forEach(b=>b.classList.toggle('active',b.dataset.team===selectedTeam));
 for(const team of ['blue','red']){$(team+'Players').innerHTML=room.players.filter(p=>p.team===team).map(p=>'<div class="player-row"><span>'+escapeHtml(p.username)+'</span><small>'+(p.ready?'READY':'NOT READY')+'</small></div>').join('')||'<p class="tiny muted">No players yet</p>';}
 $('readyBtn').textContent=isReady?'CANCEL READY':'I\\'M READY ✓';$('readyBtn').disabled=!selectedCharacter||!selectedTeam;
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
 block(0,-34,70,5,2,0x59615e);block(0,34,70,5,2,0x59615e);block(-34,0,2,5,70,0x59615e);block(34,0,2,5,70,0x59615e);
 [[-18,-16,8,3,5],[17,-15,7,3,6],[-18,16,7,3,5],[18,17,8,3,5],[0,-21,10,2.5,3],[0,21,10,2.5,3],[-8,0,3,2.3,8],[8,0,3,2.3,8],[-25,0,3,4,3],[25,0,3,4,3]].forEach((a,i)=>block(...a,i%2?0x68746c:0x7d6650));
 for(let i=0;i<12;i++){const x=(i%4)*15-22,z=Math.floor(i/4)*18-18;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),mat(0x5c4632));trunk.position.set(x,1.4,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.4,3.6,7),mat(0x3e5941));crown.position.set(x,4,z);scene.add(crown);}
 for(let i=0;i<18;i++){const x=(Math.random()-.5)*58,z=(Math.random()-.5)*58;const crate=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.1,1.2),mat(0x8a795a));crate.position.set(x,.55,z);crate.castShadow=true;scene.add(crate);}
 localMesh=makeOperator(0x4b94c8);scene.add(localMesh);localMesh.visible=false;
 if(currentRoom)for(const p of currentRoom.players)if(p.id!==user.id)addRemote(p);
 clock=new THREE.Clock();window.addEventListener('resize',resizeGame);animate();
}
function makeOperator(color){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.8,4,8),new THREE.MeshStandardMaterial({color}));body.position.y=1.05;group.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.24,12,10),new THREE.MeshStandardMaterial({color:0xc69b78}));head.position.y=1.72;group.add(head);const helmet=new THREE.Mesh(new THREE.SphereGeometry(.27,12,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x26323a}));helmet.position.y=1.82;group.add(helmet);return group;}
function addRemote(p){if(remoteMeshes.has(p.id))return;const m=makeOperator(p.team==='blue'?0x438ee0:0xd84c55);m.position.set(p.x||0,0,p.z||0);scene.add(m);remoteMeshes.set(p.id,m);}
function startGame(data){currentRoom=data.room;show('gameScreen');if(!scene)initThree();else{localMesh.visible=true;}const me=currentRoom.players.find(p=>p.id===user.id);localMesh.visible=true;localMesh.position.set(me?.x||0,0,me?.z||0);camera.position.set(localMesh.position.x,1.65,localMesh.position.z);$('health').textContent='100';$('healthBar').style.width='100%';setWeapon('rifle');$('gameNotice').textContent='CLICK TO LOCK MOUSE · WASD MOVE · LEFT CLICK FIRE';gameActive=true;}
function resizeGame(){if(!renderer)return;const h=$('gameCanvas');camera.aspect=h.clientWidth/h.clientHeight;camera.updateProjectionMatrix();renderer.setSize(h.clientWidth,h.clientHeight);}
function animate(){if(!renderer)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(gameActive&&localMesh){const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);const speed=keys.ShiftLeft?10:6;const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*dt,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*dt;localMesh.position.x=THREE.MathUtils.clamp(localMesh.position.x+dx,-31,31);localMesh.position.z=THREE.MathUtils.clamp(localMesh.position.z+dz,-31,31);localMesh.rotation.y=yaw;camera.position.set(localMesh.position.x,1.65,localMesh.position.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;moveTimer+=dt;if(moveTimer>.08){socket.emit('player:move',{x:localMesh.position.x,z:localMesh.position.z,yaw});moveTimer=0;} }renderer.render(scene,camera);}
function setWeapon(key){weaponKey=key;const w=weaponDefaults[key];ammo=w.magazine;$('weaponName').textContent=w.name;$('ammo').textContent=ammo+' / ∞';}
function fire(){if(!gameActive||document.pointerLockElement!==renderer.domElement)return;const w=weapons[weaponKey]||{rpm:600};if(Date.now()-lastFire<60000/w.rpm)return;lastFire=Date.now();socket.emit('weapon:fire',{weapon:weaponKey,yaw,pitch},res=>{if(res?.ok){ammo=res.ammo;$('ammo').textContent=ammo+' / ∞';}else if(res?.error==='Reload required.')$('ammo').textContent='RELOAD (R)';});}
function destroyGame(){gameActive=false;if(renderer){window.removeEventListener('resize',resizeGame);renderer.dispose();$('gameCanvas').innerHTML='';renderer=null;scene=null;remoteMeshes.clear();}}
function renderScores(data){$('blueScore').textContent=data.totals.blue;$('redScore').textContent=data.totals.red;const me=data.players.find(p=>p.id===user.id);if(me){$('myKills').textContent=me.kills;$('myDeaths').textContent=me.deaths;}}
function showResults(data){gameActive=false;$('winnerTitle').innerHTML=data.winner==='draw'?'MATCH <span class="accent">DRAW</span>':(data.winner==='blue'?'BLUE':'RED')+' <span class="accent">TEAM WINS</span>';const rows=data.players.map(p=>'<div class="final-row"><span>'+escapeHtml(p.username)+' · '+p.team.toUpperCase()+'</span><strong>'+p.kills+' K</strong><strong>'+p.deaths+' D</strong><span>'+((p.kills/Math.max(1,p.deaths)).toFixed(2))+' K/D</span></div>').join('');$('finalScores').innerHTML='<div class="final-row"><strong>PLAYER</strong><strong>KILLS</strong><strong>DEATHS</strong><strong>K/D</strong></div>'+rows;show('resultsScreen');}
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5))-1;if(weaponOrder[n])setWeapon(weaponOrder[n]);}if(e.code==='KeyR'&&gameActive)socket.emit('weapon:reload',weaponKey);});
window.addEventListener('keyup',e=>keys[e.code]=false);
$('gameCanvas').addEventListener('click',()=>{if(renderer&&gameActive)renderer.domElement.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer?.domElement&&gameActive)$('gameNotice').textContent='CLICK TO RESUME';});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer?.domElement){yaw-=e.movementX*.0022;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0022,-1.2,1.2);}});
document.addEventListener('mousedown',e=>{if(e.button===0)fire();if(e.button===2&&gameActive&&weaponKey==='sniper'){camera.fov=camera.fov===75?28:75;camera.updateProjectionMatrix();}});
window.addEventListener('contextmenu',e=>{if(gameActive)e.preventDefault();});
if(token){fetch('/api/health').then(r=>r.json()).then(()=>{try{const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const raw=JSON.parse(atob(payload));if(raw.exp*1000>Date.now()){user={id:raw.id,username:raw.username};enterLobby();}else throw Error();}catch{localStorage.removeItem('os_token');token='';}}).catch(()=>{});}
