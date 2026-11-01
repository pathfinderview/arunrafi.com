import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {runSim} from 'teardown-kit/runtime.js';
import {createMachine} from './machine.js';
import {pose,SPEC,TAU} from './model.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const INFO={
 all:['How can a watch work without a battery?','A wound spring gives it power. Tiny moving parts turn that power into steady steps.'],
 barrel:['The power spring','Wind it up and it stores a push. Watchmakers call this the mainspring.'],
 train:['The turning wheels','Their teeth pass the push from one wheel to the next. Together, they are called the gear train.'],
 escape:['The stop-and-go part','It holds a wheel still, then lets it move a little. Its name is the escapement.'],
 balance:['The swinging wheel','Its name is the balance wheel. A thin spring pulls it back after each swing. Together, they set the pace.']
};
const LESSONS=[
 {part:'all',view:'hero',title:'Where does the power come from?',body:'The watch has no battery. Turning its small side knob tightens a spring. The spring wants to open again. That gives the wheels a push.',try:'Wind the watch',action:'wind',question:'Will winding it more make the hands go faster?',answer:'No. It stores more power, so the watch can run for longer. Another part keeps the pace steady.'},
 {part:'train',view:'hero',title:'How does the push travel?',body:'The wheels have tiny teeth. Each wheel turns the next one. Wheels of different sizes help the hands move at different speeds.',try:'Speed up the picture',action:'fast',question:'Does every hand take the same time to go around?',answer:'No. The second hand goes around in a minute. The minute hand takes an hour. The hour hand takes twelve hours.'},
 {part:'escape',view:'detail',title:'Why do the wheels not rush?',body:'A tiny fork holds a wheel still, then lets it move a little. Hold. Let go. Hold. Let go. This stop-and-go part is called the escapement.',try:'Let it take one tick',action:'tick',question:'What would happen if nothing held the wheels back?',answer:'The spring would unwind much faster. The hands would rush instead of keeping time.'},
 {part:'balance',view:'detail',title:'What sets the pace?',body:'This wheel swings back and forth. A thin spring pulls it back toward the middle. Each pass tells the stop-and-go part when to let go.',try:'Watch it in slow motion',action:'slow',question:'Which sets the rhythm: the power spring or this swinging wheel?',answer:'The swinging wheel and its thin spring set the rhythm. The big power spring supplies the energy to keep it going.'},
 {part:'all',view:'hero',dial:true,title:'How does it show the time?',body:'Those little steps turn the wheels. The wheels move the hands. The long, thin hand counts seconds. All of this happens under the watch face.',try:'Look under the face',action:'inside',question:'Can the hands keep moving forever without winding?',answer:'No. When the power spring has unwound, the watch needs winding again.'},
 {part:'all',view:'hero',explode:1,title:'Can we tell the story now?',body:'A spring stores power. Wheels carry it. A tiny gate lets it out in steps. A swinging wheel sets the pace. Together, they move the hands.',try:'Put it back together',action:'assemble',question:'How would you explain this watch to a friend?',answer:'It is a spring-powered machine that counts steady swings and shows them with hands.'}
];
const ui=document.createElement('main');ui.className='shell';ui.innerHTML=`
<header class="mast"><a class="brand" href="https://arunrafi.com/tools.html">Arun Rafi <span style="font-weight:400;opacity:.5">/ Studies</span></a><span class="edition">LOOK INSIDE · LEARN TOGETHER</span><a class="back" href="https://arunrafi.com/">Back to the writing ↗</a></header>
<div class="layout">
 <section class="intro" aria-label="Explore the watch">
  <p class="eyebrow">A watch we can explore together</p><h1>A second,<br>taken apart.</h1>
  <p class="lead">How does a watch work without a battery? Let’s look inside and follow one little push.</p>
  <div class="part-section"><h2 class="section-label">Follow the energy</h2><div class="part-list">
   ${[['all','00','The whole watch'],['barrel','01','The power spring'],['train','02','The turning wheels'],['escape','03','The stop-and-go part'],['balance','04','The swinging wheel']].map(([key,num,title])=>`<button class="part ${key==='all'?'active':''}" data-part="${key}" aria-pressed="${key==='all'}"><small>${num}</small>${title}<i class="dot"></i></button>`).join('')}
  </div></div>
  <div class="readout"><div class="section-label">One simple idea</div><p class="storyline">A spring gives power.<br>A wheel gives rhythm.</p></div>
 </section>
 <section class="stage" tabindex="-1" aria-label="Interactive 3D watch movement. Drag to rotate and scroll to zoom.">
  <div class="viewbar" role="group" aria-label="View options"><button data-view="hero" class="active" aria-pressed="true">Side view</button><button data-view="top" aria-pressed="false">Top</button><button data-view="detail" aria-pressed="false">Close-up</button><button id="bridges" aria-pressed="false">Top covers</button></div>
  <div class="annotation"><strong id="part-title"></strong><span id="part-text"></span></div>
  <div class="stage-caption">DRAG TO TURN IT · SCROLL TO LOOK CLOSER · TAP A PART</div>
  <div id="loading" class="status-note" role="status">Assembling the movement…</div>
 </section>
 <aside class="instruments" aria-label="Learn together">
  <section class="lesson-panel" aria-labelledby="lesson-title">
   <p class="eyebrow" id="lesson-progress">Learn together · 1 of 6</p>
   <h2 id="lesson-title"></h2><p id="lesson-body"></p>
   <button id="lesson-try" class="lesson-action"></button><button id="lesson-look" class="lesson-look">See this part ↑</button>
   <p id="lesson-observation" class="lesson-observation" role="status"></p>
   <div class="wonder"><p class="section-label">Wonder together</p><p id="lesson-question"></p>
    <button id="lesson-reveal" aria-expanded="false" aria-controls="lesson-answer">Show an answer</button><p id="lesson-answer" hidden></p>
   </div>
   <nav class="lesson-nav" aria-label="Lesson steps"><button id="lesson-back">← Back</button><button id="lesson-next">Next →</button></nav>
  </section>
  <section class="energy-section"><div class="metric-head"><h2 class="section-label" style="margin:0">Power left in this model</h2><strong id="reserve">28.8 h</strong></div><div class="energy"><b>POWER</b><i></i><span>GEARS</span><i></i><span>SWING</span></div><div style="height:3px;background:#deddd4"><div id="reserve-bar" style="height:100%;background:#b99861;width:72%"></div></div></section>
  <details class="numbers"><summary>See the numbers</summary><div class="number-content">

  <section><div class="metric-head"><h2 class="section-label" style="margin:0">The wheel’s swing</h2><strong id="angle">0°</strong></div><canvas id="wave" class="scope" aria-label="Balance angle over the last simulated second"></canvas><div class="phase"><i id="phase-dot"></i><span id="phase">Locked · free swing</span></div></section>
  <div class="stats"><div class="stat"><b id="beats">0</b><span>TICKS SO FAR</span></div><div class="stat"><b id="elapsed">0.00</b><span>WATCH SECONDS</span></div><div class="stat"><b>8</b><span>TICKS EACH SECOND</span></div><div class="stat"><b id="escape-angle">0°</b><span>WHEEL TURN</span></div></div>
  <section class="clock-instrument"><h2 class="section-label">What the hands show</h2><svg class="dial" viewBox="0 0 100 100" aria-label="Watch dial driven by the mechanism"><circle cx="50" cy="50" r="45" fill="none" stroke="#d5d4ca"/>${Array.from({length:12},(_,i)=>`<line x1="50" y1="9" x2="50" y2="${i%3===0?16:13}" transform="rotate(${i*30} 50 50)" stroke="#96988c"/>`).join('')}<line id="dial-hour" x1="50" y1="54" x2="50" y2="27" stroke="#333a34" stroke-width="2.7" stroke-linecap="round"/><line id="dial-minute" x1="50" y1="57" x2="50" y2="17" stroke="#333a34" stroke-width="1.6" stroke-linecap="round"/><line id="dial-second" x1="50" y1="59" x2="50" y2="12" stroke="#b66a3c" stroke-width=".8"/><circle cx="50" cy="50" r="2" fill="#b66a3c"/></svg></section>

</div></details>
  <details class="notebox"><summary>For grown-ups: how this model works</summary><p>This is a model to help explain a watch, not a copy of a watch you can buy. Some shapes and movements are simpler than real ones. It does not calculate real forces or how accurately a watch would keep time.</p><p>4 cycles × 2 beats = 8 beats/s. A 15-tooth escape wheel advancing half a tooth per beat turns at 16 rpm. The 16:1 ratio to the fourth wheel gives one turn per minute. The train to the centre wheel is 8 × 7.5 = 60:1.</p><p>Mechanism reference: <a href="https://www.grand-seiko.com/us-en/collections/movement/mechanical" target="_blank" rel="noopener">Grand Seiko</a>. Built with <a href="https://github.com/elvarofficial/teardown" target="_blank" rel="noopener">Teardown</a> and Three.js.</p></details>
 </aside>
</div>
<footer class="controls" aria-label="Simulation controls">
 <button class="play" id="play" aria-label="${reduced?'Play':'Pause'} simulation">${reduced?'▶':'Ⅱ'}</button>
 <label class="speed" for="speed">PICTURE SPEED <input id="speed" type="range" min="0" max="100" value="17" step="1"><output id="speed-value">0.08×</output></label>
 <button class="control-btn" id="real">Normal speed</button><button class="control-btn" id="step">Next tick →</button><span class="divider"></span>
 <button class="control-btn" id="explode" aria-pressed="false">Separate parts</button>
 <button class="control-btn" id="xray" aria-pressed="false">See through</button>
 <button class="control-btn" id="dial-toggle" aria-pressed="false">Watch face</button>
 <button class="control-btn wind" id="wind">Wind the watch</button>
 <button class="tour active" id="tour">Learn together</button>
</footer>`;
document.getElementById('app').appendChild(ui);
// Keep the model and the reading in separate spaces. Nothing is laid over the canvas.
const layout=ui.querySelector('.layout'),intro=ui.querySelector('.intro'),reader=ui.querySelector('.instruments');
reader.id='reading-panel';
const heading=document.createElement('section');heading.className='page-heading';
const title=intro.querySelector('h1');title.innerHTML='A second, taken apart.';
heading.append(title,intro.querySelector('.lead'));ui.querySelector('.mast').after(heading);
const machineArea=document.createElement('section');machineArea.className='machine';machineArea.setAttribute('aria-label','Watch diagram and controls');
const stage=ui.querySelector('.stage');layout.insertBefore(machineArea,stage);
const viewbar=stage.querySelector('.viewbar');
const focusButton=document.createElement('button');focusButton.id='focus-toggle';focusButton.className='focus-toggle';focusButton.textContent='Hide lesson';focusButton.setAttribute('aria-expanded','true');focusButton.setAttribute('aria-controls','reading-panel');
const viewRow=document.createElement('div');viewRow.className='view-row';viewRow.append(viewbar,focusButton);
const annotation=stage.querySelector('.annotation');reader.querySelector('.lesson-panel').after(annotation);
const hint=stage.querySelector('.stage-caption');
const toolbar=ui.querySelector('.controls');
const more=document.createElement('details');more.className='more-controls';
const summary=document.createElement('summary');summary.textContent='More controls';
const options=document.createElement('div');options.className='extra-controls';
for(const id of ['bridges','explode','xray','dial-toggle','wind'])options.append(id==='bridges'?viewbar.querySelector('#bridges'):ui.querySelector('#'+id));
more.append(summary,options);toolbar.querySelector('.divider').remove();toolbar.insertBefore(more,toolbar.querySelector('#tour'));
machineArea.append(viewRow,stage,hint,toolbar);
const parts=document.createElement('details');parts.className='explore-parts';
const partsSummary=document.createElement('summary');partsSummary.textContent='Explore the parts';parts.append(partsSummary,intro.querySelector('.part-section'));
reader.append(parts,intro.querySelector('.readout'));intro.remove();
function showReading(show){ui.classList.toggle('reading-hidden',!show);reader.hidden=!show;focusButton.textContent=show?'Hide lesson':'Show lesson';focusButton.setAttribute('aria-expanded',String(show));}
focusButton.onclick=()=>showReading(reader.hidden);

const $=id=>document.getElementById(id);
const partButtons=[...document.querySelectorAll('[data-part]')],viewButtons=[...document.querySelectorAll('[data-view]')];
const controls={part:'all',view:'hero',explode:0,xray:false,dial:false,bridges:false};
let paused=reduced,speed=.08,anchorT=0,anchorSim=0,lastT=0,current=0,wind=72;
let lessonIndex=0;
const sampleTime=t=>paused?anchorSim:anchorSim+(t-anchorT)*speed;
function touch(){}
function syncTime(){anchorSim=sampleTime(lastT);anchorT=lastT;}
function setPart(key){controls.part=key;partButtons.forEach(b=>{b.classList.toggle('active',b.dataset.part===key);b.setAttribute('aria-pressed',String(b.dataset.part===key));});$('part-title').textContent=INFO[key][0];$('part-text').textContent=INFO[key][1];}
let cameraRequest=null;
function setView(view){controls.view=view;viewButtons.forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});cameraRequest=view;}
function setButton(id,on){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
function choosePart(key){showLesson({barrel:0,train:1,escape:2,balance:3,all:5}[key]);if(key==='all'){controls.explode=0;setButton('explode',false);}}
partButtons.forEach(b=>b.onclick=()=>choosePart(b.dataset.part));
viewButtons.forEach(b=>b.onclick=()=>{touch();setView(b.dataset.view);});
$('play').onclick=()=>{touch();syncTime();paused=!paused;$('play').textContent=paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',paused?'Play simulation':'Pause simulation');};
const toSpeed=n=>.02*Math.pow(3000,n/100),toSlider=s=>100*Math.log(s/.02)/Math.log(3000);
function showSpeed(){$('speed-value').textContent=speed<1?'Slow':speed===1?'Normal':'Fast';$('speed-value').title=`${speed.toFixed(2)} times normal speed`;$('speed').value=toSlider(speed);$('speed').setAttribute('aria-valuetext',`${speed.toFixed(2)} times real time`);}
$('speed').oninput=()=>{touch();syncTime();speed=toSpeed(Number($('speed').value));showSpeed();};
$('real').onclick=()=>{touch();syncTime();speed=1;showSpeed();};
$('step').onclick=()=>{touch();syncTime();anchorSim=(Math.floor(anchorSim*8+1e-6)+1)/8;paused=true;$('play').textContent='▶';$('play').setAttribute('aria-label','Play simulation');};
for(const[id,key]of[['bridges','bridges'],['explode','explode'],['xray','xray'],['dial-toggle','dial']])$(id).onclick=()=>{touch();controls[key]=controls[key]?0:1;setButton(id,!!controls[key]);if(key==='explode'){setPart('all');setView('hero');}if(key==='dial'&&controls.dial){setPart('all');controls.explode=0;setButton('explode',false);setView('hero');}};
$('wind').onclick=()=>{touch();const s=pose(sampleTime(lastT),wind);wind=Math.min(40,s.reserve+8)/40*100+sampleTime(lastT)/1440;};
function changeSpeed(value){syncTime();speed=value;showSpeed();}
function resume(){if(paused){syncTime();paused=false;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','Pause simulation');}}
function showLesson(index,focus=false){
 lessonIndex=Math.max(0,Math.min(LESSONS.length-1,index));const lesson=LESSONS[lessonIndex];
 $('lesson-progress').textContent=`Learn together · ${lessonIndex+1} of ${LESSONS.length}`;
 $('lesson-title').textContent=lesson.title;$('lesson-body').textContent=lesson.body;
 $('lesson-try').textContent=lesson.try;$('lesson-question').textContent=lesson.question;
 $('lesson-answer').textContent=lesson.answer;$('lesson-answer').hidden=true;
 $('lesson-reveal').textContent='Show an answer';$('lesson-reveal').setAttribute('aria-expanded','false');
 $('lesson-observation').textContent='';$('lesson-back').disabled=lessonIndex===0;
 $('lesson-next').textContent=lessonIndex===LESSONS.length-1?'Start again ↺':'Next →';
 setPart(lesson.part);controls.explode=lesson.explode||0;controls.dial=!!lesson.dial;controls.xray=false;
 setButton('explode',!!controls.explode);setButton('dial-toggle',controls.dial);setButton('xray',false);
 changeSpeed(.08);if(!reduced)resume();setView(lesson.view);
 if(focus)$('lesson-title').focus({preventScroll:true});
}
$('lesson-title').tabIndex=-1;
$('lesson-next').onclick=()=>showLesson(lessonIndex===LESSONS.length-1?0:lessonIndex+1,true);
$('lesson-back').onclick=()=>showLesson(lessonIndex-1,true);
$('lesson-reveal').onclick=()=>{const answer=$('lesson-answer');answer.hidden=!answer.hidden;$('lesson-reveal').setAttribute('aria-expanded',String(!answer.hidden));$('lesson-reveal').textContent=answer.hidden?'Show an answer':'Hide the answer';};
$('lesson-try').onclick=()=>{
 const action=LESSONS[lessonIndex].action;
 const messages={wind:'More power stored. The watch still keeps the same pace.',fast:'Only our picture is faster. A real watch keeps its own pace.',tick:'One more tick. The little wheel has moved one step.',slow:'The picture is slower. Look at the thin spring as the wheel swings.',inside:'The hands are still there. We have lifted the face so we can see underneath.',assemble:'The parts are back together. Try telling their story in order.'};
 if(action==='wind'){$('wind').click();setPart('barrel');setView('detail');}
 if(action==='fast'){changeSpeed(60);resume();}
 if(action==='tick')$('step').click();
 if(action==='slow'){changeSpeed(.04);resume();}
 if(action==='inside'){controls.dial=false;setButton('dial-toggle',false);setView('hero');}
 if(action==='assemble'){controls.explode=0;setButton('explode',false);setView('hero');}
 $('lesson-observation').textContent=messages[action];
};
$('lesson-look').onclick=()=>{const stage=document.querySelector('.stage');stage.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});stage.focus({preventScroll:true});$('tour').textContent='Back to lesson';};
$('tour').onclick=()=>{showReading(true);$('tour').textContent='Learn together';$('lesson-title').scrollIntoView({behavior:reduced?'instant':'smooth',block:'nearest'});$('lesson-title').focus({preventScroll:true});};
addEventListener('keydown',e=>{if(e.target.matches('input,button,a,summary'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.key==='e')$('explode').click();if(e.key==='x')$('xray').click();});
showLesson(0);showSpeed();

runSim({duration:86400,theme:'light',accent:'#b66a3c',hud:{enabled:false,title:'Mechanical Watch',subtitle:'— Arun Rafi'},director:{enabled:false}},async({canvas,capture})=>{
 const stage=document.querySelector('.stage');stage.prepend(canvas);canvas.removeAttribute('id');canvas.setAttribute('aria-label','3D mechanical watch. Drag to rotate; use camera buttons for preset views.');
 let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});}catch(e){$('loading').textContent='This browser could not show the watch. Try another browser.';throw e;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor('#f5f3ed',0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const scene=new T.Scene();const camera=new T.PerspectiveCamera(35,1,.1,250);camera.position.set(17,-23,40);camera.up.set(0,1,0);
 scene.add(new T.HemisphereLight('#fff8e9','#a6a7a2',2.4));
 const key=new T.DirectionalLight('#fff6df',2.6);key.position.set(-15,18,35);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-18;key.shadow.camera.right=18;key.shadow.camera.top=18;key.shadow.camera.bottom=-18;key.shadow.camera.near=1;key.shadow.camera.far=90;key.shadow.bias=-.0002;key.shadow.normalBias=.06;scene.add(key);
 const fill=new T.DirectionalLight('#dce7ee',1.6);fill.position.set(20,-5,10);scene.add(fill);
 const machine=createMachine(scene);
 const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.ShadowMaterial({color:'#606357',opacity:.13}));floor.position.z=-1.6;floor.receiveShadow=true;scene.add(floor);
 const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.dampingFactor=.075;orbit.minDistance=15;orbit.maxDistance=85;orbit.minPolarAngle=.05;orbit.maxPolarAngle=Math.PI*.88;orbit.target.set(0,0,1.3);orbit.update();
 orbit.addEventListener('start',()=>{touch();cameraRequest=null;cameraTween=null;});
 let cameraTween=null,explosion=0,previous=0,frame=0,viewState='hero',lastExploded=false;
 const views={hero:{position:[18,-25,45],target:[0,0,1.3]},top:{position:[0,-.01,43],target:[0,0,1.2]},detail:{position:[1,-14,23],target:[-1.1,-3.8,4.3]}};
 const ray=new T.Raycaster(),pointer=new T.Vector2();let down;
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(machine.parts).find(h=>h.object.visible&&h.object.material.opacity>.4&&h.object.userData.part!=='case'&&h.object.userData.part!=='dial'&&h.object.userData.part!=='bridges');if(hit){touch();choosePart(hit.object.userData.part);}});
 function resize(){const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();cameraRequest=controls.view;}
 const stageObserver=new ResizeObserver(resize);stageObserver.observe(stage);
 const chart=$('wave'),ctx=chart.getContext('2d');
 function chartDraw(s){const r=chart.getBoundingClientRect();if(r.width<1||r.height<1)return;const d=Math.min(devicePixelRatio,2);if(chart.width!==Math.round(r.width*d)||chart.height!==Math.round(r.height*d)){chart.width=Math.round(r.width*d);chart.height=Math.round(r.height*d);}ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);ctx.strokeStyle='#deddd4';ctx.lineWidth=.7;for(const f of[.15,.5,.85]){ctx.beginPath();ctx.moveTo(0,r.height*f);ctx.lineTo(r.width,r.height*f);ctx.stroke();}ctx.strokeStyle='#9b6847';ctx.lineWidth=1.4;ctx.beginPath();for(let x=0;x<=r.width;x++){const time=s.seconds-(1-x/r.width)*.75;const y=r.height/2-Math.sin(time*SPEC.hz*TAU)*r.height*.34;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();const y=r.height/2-Math.sin(s.seconds*SPEC.hz*TAU)*r.height*.34;ctx.fillStyle='#b66a3c';ctx.beginPath();ctx.arc(r.width-2,y,3,0,TAU);ctx.fill();}
 function instruments(s){$('angle').textContent=Math.round(s.balanceAngle*180/Math.PI)+'°';$('beats').textContent=s.beats.toLocaleString('en');$('elapsed').textContent=s.seconds.toFixed(2);$('escape-angle').textContent=Math.round((s.escapeAngle*180/Math.PI)%360)+'°';$('reserve').textContent=s.reserve.toFixed(1)+' h';$('reserve-bar').style.width=(s.reserve/40*100)+'%';$('phase').textContent=!s.running?'The spring needs winding':s.impulse?'Let go · one small step':'Hold · the wheel swings';$('phase-dot').style.opacity=s.impulse?'1':'.3';
  for(const[name,a]of[['second',-s.secondsAngle*180/Math.PI],['minute',48-s.minuteAngle*180/Math.PI],['hour',304-s.hourAngle*180/Math.PI]])$('dial-'+name).setAttribute('transform',`rotate(${a} 50 50)`);chartDraw(s);}
 return {resize,async warm(){await renderer.compileAsync(scene,camera);$('loading').classList.add('hidden');},render(t){
  lastT=t;const dt=Math.max(0,Math.min(.08,t-previous));previous=t;
  if(cameraRequest){const narrow=camera.aspect<1.1;const focusViews={barrel:{position:[-1,-4,23],target:[-5,4,1]},train:{position:[9,-13,32],target:[1,2,3]},escape:{position:[1,-12,24],target:[-.2,-4,4.3]},balance:{position:[-1,-12,20],target:[-3.9,-4,4.3]}};const v=cameraRequest==='detail'&&focusViews[controls.part]?focusViews[controls.part]:cameraRequest==='hero'&&controls.explode?{position:narrow?[30,-36,68]:[24,-31,57],target:[0,0,6]}:narrow?({hero:{position:[22,-29,51],target:[.7,0,1.3]},top:{position:[0,-.01,52],target:[.7,0,1.2]},detail:{position:[1,-16,26],target:[-1.1,-3.8,4.3]}}[cameraRequest]):views[cameraRequest];cameraTween={from:camera.position.clone(),to:new T.Vector3(...v.position),start:orbit.target.clone(),end:new T.Vector3(...v.target),at:t};viewState=cameraRequest;cameraRequest=null;}
  if(cameraTween){const k=Math.min(1,(t-cameraTween.at)/1.2),u=k*k*(3-2*k);camera.position.lerpVectors(cameraTween.from,cameraTween.to,u);orbit.target.lerpVectors(cameraTween.start,cameraTween.end,u);if(k===1)cameraTween=null;}
  explosion+=(controls.explode-explosion)*(1-Math.exp(-dt*5));current=sampleTime(t);const state=pose(current,wind);const apart=controls.explode>.1;if(apart!==lastExploded){lastExploded=apart;$('part-title').textContent=apart?'Taken apart so we can see':INFO[controls.part][0];$('part-text').textContent=apart?'Real parts must fit together to work. This picture keeps moving to help us follow them.':INFO[controls.part][1];}machine.update(state,{...controls,explode:explosion});
  orbit.update();renderer.render(scene,camera);if(frame++%2===0)instruments(state);if(capture)$('loading').classList.add('hidden');return {};
 }};
}).catch(e=>{console.error(e);$('loading').classList.remove('hidden');$('loading').textContent='The watch could not load. Try reloading the page or opening it in another browser.';});
