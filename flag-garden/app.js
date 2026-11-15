import {dayKey,addDays,freshProgress,rateRecord,makeDaily,validateProgress} from './learning.mjs';

const $=id=>document.getElementById(id);
const STORAGE='flag-garden-v1';
let countries=[],byCode=new Map(),progress,queue=[],index=0,mode='daily',revealed=false,activeClue=-1;
let timer=null,sequence=0,voice=null,ready=false;
const audio=new Audio(); audio.preload='auto';
audio.id='narration';audio.hidden=true;document.body.append(audio);
let cancelPendingAudio=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const current=()=>byCode.get(queue[index]);

function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify(progress));}
  catch{$('status').textContent='Progress can’t be saved in this browser. You can still play; use a backup before leaving.';}
  updateCounts();
}
function stopNarration(){
  sequence++;clearTimeout(timer);audio.pause();audio.onended=null;audio.onerror=null;
  cancelPendingAudio?.();cancelPendingAudio=null;
  if('speechSynthesis'in window) speechSynthesis.cancel();
}
function fallbackSpeech(text){
  return new Promise(resolve=>{
    if(!('speechSynthesis'in window)){resolve();$('status').textContent='Audio is unavailable here. Try the Listen button again with device sound on.';return;}
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.85;
    const voices=speechSynthesis.getVoices();voice=voices.find(v=>v.lang==='en-IN')||voices.find(v=>v.lang==='en-US');if(voice)utterance.voice=voice;
    utterance.onend=resolve;utterance.onerror=()=>{ $('status').textContent='Sound couldn’t play. You can still read the country and clues.';resolve();};
    cancelPendingAudio=resolve;speechSynthesis.speak(utterance);
  });
}
function playFile(suffix,text){
  if(!progress.sound)return Promise.resolve();
  return new Promise(resolve=>{
    const token=sequence;let settled=false,fellBack=false;
    const done=()=>{if(!settled){settled=true;resolve();}};
    cancelPendingAudio=done;
    audio.pause();audio.src=`assets/audio/${current().code}-${suffix}.mp3`;
    audio.onended=done;
    const fallback=()=>{if(fellBack)return;fellBack=true;if(token===sequence)fallbackSpeech(text).then(done);else done();};
    audio.onerror=fallback;
    audio.play().then(()=>{if($('status').textContent.startsWith('Sound couldn’t')||$('status').textContent.startsWith('Audio is'))$('status').textContent='';}).catch(fallback);
  });
}
function delay(ms){return new Promise(resolve=>{timer=setTimeout(resolve,ms);});}
function fitFlag(){
  const c=current();if(!c)return;
  const maxHeight=innerWidth<=700?190:innerWidth<=900?200:225;
  $('flag-wrap').style.width=`min(78%, ${Math.min(370,maxHeight*c.ratio)}px)`;
  $('flag-wrap').style.aspectRatio=String(c.ratio);
}
function highlight(i){
  activeClue=i;
  const clue=current()?.clues[i];if(!clue)return;
  const [x,y,w,h]=clue.box;
  Object.assign($('highlight').style,{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`});
  $('highlight').hidden=false;$('highlight-number').textContent=String(i+1);
  $('country-subtitle').textContent=clue.text;
  document.querySelectorAll('.clue-button').forEach((b,j)=>{b.classList.toggle('active',j===i);b.setAttribute('aria-pressed',String(j===i));});
}
async function narrateTour(){
  stopNarration();const token=sequence;
  $('tour').textContent='Ⅱ Pause the story';$('tour').dataset.playing='true';
  for(let i=0;i<current().clues.length;i++){
    if(token!==sequence)return;
    highlight(i);await playFile(i,current().clues[i].text);
    if(token!==sequence)return;
    await delay(progress.sound?400:2400);
  }
  if(token===sequence){$('tour').textContent='↻ Show me again';$('tour').dataset.playing='false';}
}
function resetTourButton(){$('tour').textContent='↻ Show me again';$('tour').dataset.playing='false';}
function buildClues(){
  $('clues').replaceChildren();
  current().clues.forEach((clue,i)=>{
    const b=document.createElement('button');b.className='clue-button';b.setAttribute('aria-pressed','false');
    const num=document.createElement('span');num.textContent=i+1;num.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=clue.text;b.append(num,text);
    b.addEventListener('click',()=>{stopNarration();resetTourButton();highlight(i);playFile(i,clue.text);});
    $('clues').append(b);
  });
}
function updateCounts(){
  if(!progress)return;
  const seen=Object.values(progress.records).filter(r=>r.seen).length;
  const mastered=Object.values(progress.records).filter(r=>r.mastered).length;
  $('collection-count').textContent=`${seen} / 195`;
  $('parent-stats').textContent=`${seen} flags discovered · ${mastered} remembered · ${progress.days.length} ${progress.days.length===1?'day':'days'} together`;
  $('world-summary').textContent=`${seen} flags discovered. ${mastered} remembered. Every one starts with a little look.`;
}
function renderDots(){
  $('session-dots').replaceChildren();if(mode!=='daily')return;
  queue.forEach((code,i)=>{const dot=document.createElement('span');dot.classList.toggle('current',i===index);dot.classList.toggle('done',progress.daily.done.includes(code));$('session-dots').append(dot);});
}
function render(){
  if(!current())return;
  stopNarration();revealed=false;activeClue=-1;resetTourButton();
  const c=current();
  $('flag-wrap').classList.remove('revealed');$('flag-wrap').classList.add('loading');$('flag-wrap').classList.toggle('nepal',c.code==='np');
  $('image-error').hidden=true;$('highlight').hidden=true;
  $('flag').alt='Mystery country flag. Reveal to hear its name.';
  $('flag').onload=()=>{$('flag-wrap').classList.remove('loading');};
  $('flag').onerror=()=>{$('flag-wrap').classList.remove('loading');$('image-error').hidden=false;};
  $('flag').src=`assets/flags/${c.code}.svg`;fitFlag();
  $('flag-wrap').setAttribute('role','button');$('flag-wrap').tabIndex=0;$('flag-wrap').setAttribute('aria-label','Reveal this flag');
  $('position').textContent=`${index+1} of ${queue.length}`;
  $('session-label').textContent=mode==='daily'?'Today’s little adventure':'Wander at your own pace';
  $('country-overline').textContent='LOOK CLOSELY. TAKE A GUESS.';
  $('country-name').textContent='Where could this be?';
  $('country-subtitle').textContent='Say it out loud, then find out together.';
  $('reveal').innerHTML='<span>Reveal the country</span><span aria-hidden="true">✦</span>';
  $('reveal').disabled=false;$('reveal').setAttribute('aria-label','Reveal the country and hear its name');
  $('before-reveal').hidden=false;$('after-reveal').hidden=true;
  $('main-hint').textContent='A little surprise awaits';
  $('previous').disabled=index===0;
  $('next').disabled=false;
  $('learning').classList.remove('selected');$('known').classList.remove('selected');
  $('learning').setAttribute('aria-pressed','false');$('known').setAttribute('aria-pressed','false');
  $('recall-note').textContent='Every little look helps it grow.';
  renderDots();buildClues();
}
async function reveal(){
  if(!ready)return;
  if(revealed){stopNarration();resetTourButton();await playFile('name',current().name);return;}
  revealed=true;const c=current();
  $('country-overline').textContent=c.region.toUpperCase();$('country-name').textContent=c.name;
  $('country-subtitle').textContent='Hello, '+c.name+'. Nice to meet you.';
  $('flag').alt=`Flag of ${c.name}`;$('flag-wrap').classList.add('revealed');
  $('flag-wrap').setAttribute('aria-label',`Show another detail on the flag of ${c.name}`);
  $('before-reveal').hidden=true;$('after-reveal').hidden=false;
  $('reveal').innerHTML='<span>Hear the name again</span><span aria-hidden="true">♪</span>';
  $('reveal').setAttribute('aria-label',`Hear ${c.name} again`);
  $('main-hint').textContent='Tap the flag for another clue';
  const today=dayKey();
  if(!progress.records[c.code])progress.records[c.code]={seen:true,stage:0,mastered:false,due:addDays(today,1)};
  progress.records[c.code].seen=true;
  if(!progress.days.includes(today))progress.days.push(today);
  const r=progress.records[c.code];
  if(r.lastRated===today){
    $(r.lastKnown?'known':'learning').classList.add('selected');
    $(r.lastKnown?'known':'learning').setAttribute('aria-pressed','true');
    $('recall-note').textContent='Today’s practice is saved. You can look again anytime.';
  }
  save();stopNarration();const token=sequence;
  await playFile('name',c.name);
  if(token!==sequence||!revealed)return;
  await delay(progress.sound?350:900);
  if(token===sequence&&revealed)narrateTour();
}
function setMode(next,code){
  mode=next;
  if(mode==='daily'){
    const today=dayKey();
    if(progress.daily?.date!==today)progress.daily=makeDaily(countries,progress,today);
    queue=[...progress.daily.codes];
    if(!queue.length){queue=countries.filter(c=>!progress.records[c.code]?.mastered).slice(0,6).map(c=>c.code);if(!queue.length)queue=countries.slice(0,6).map(c=>c.code);}
    index=Math.max(0,queue.findIndex(c=>!progress.daily.done.includes(c)));
  }else{queue=countries.map(c=>c.code);index=Math.max(0,queue.indexOf(code));}
  $('daily-mode').classList.toggle('active',mode==='daily');$('daily-mode').setAttribute('aria-pressed',String(mode==='daily'));
  $('explore-mode').classList.toggle('active',mode==='explore');$('explore-mode').setAttribute('aria-pressed',String(mode==='explore'));
  save();render();
}
function celebrate(){
  if(reducedMotion.matches)return;
  for(let i=0;i<18;i++){
    const leaf=document.createElement('span');leaf.className='petal';leaf.style.left=`${10+Math.random()*80}%`;
    leaf.style.top='5%';leaf.style.background=['#aec39a','#ebc771','#dba485','#8ba88b'][i%4];leaf.style.animationDelay=`${Math.random()*.3}s`;
    $('petals').append(leaf);setTimeout(()=>leaf.remove(),2300);
  }
}
function finish(){
  stopNarration();resetTourButton();
  const complete=progress.daily.done.length;
  $('finish-title').textContent=complete===queue.length?'Look at you grow.':'A little pause is lovely.';
  $('finish-text').textContent=complete===queue.length?`You practised ${complete} ${complete===1?'flag':'flags'} today. Your little world is growing.`:`You reached the end of today’s ${queue.length} flags. You can go back to reveal any you skipped.`;
  $('finish-dialog').showModal();if(complete===queue.length)celebrate();
}
function move(direction){
  if(!ready)return;
  if(mode==='daily'&&direction>0&&index===queue.length-1){finish();return;}
  index=mode==='explore'?(index+direction+queue.length)%queue.length:Math.max(0,Math.min(queue.length-1,index+direction));render();
}
function rate(known){
  if(!revealed)return;
  const code=current().code,today=dayKey();
  // The first encounter can record honest prior knowledge immediately.
  let record=progress.records[code];if(record.stage===0&&!record.lastRated)record={...record,due:today};
  progress.records[code]=rateRecord(record,known,today);
  $('learning').classList.toggle('selected',!known);$('known').classList.toggle('selected',known);
  $('learning').setAttribute('aria-pressed',String(!known));$('known').setAttribute('aria-pressed',String(known));
  $('recall-note').textContent=known?'Lovely! We’ll meet this flag again soon.':'That’s how learning starts. We’ll see it again tomorrow.';
  if(mode==='daily'&&!progress.daily.done.includes(code))progress.daily.done.push(code);
  save();renderDots();
  // Let the child choose Next; never interrupt the story with a modal.
}
function renderWorld(){
  const query=normalize($('search').value),region=$('continent').value;
  const list=countries.filter(c=>normalize(c.name).includes(query)&&(!region||c.region===region));
  $('country-grid').replaceChildren();
  for(const c of list){
    const r=progress.records[c.code],button=document.createElement('button');button.className='country-tile';
    const img=document.createElement('img');img.src=`assets/flags/${c.code}.svg`;img.alt='';img.loading='lazy';
    const name=document.createElement('span');name.textContent=c.name;
    const detail=document.createElement('small');detail.textContent=r?.mastered?'✳ Remembered':r?.seen?'🌱 Growing':'○ Waiting to meet';name.append(detail);
    button.append(img,name);button.addEventListener('click',()=>{$('world-dialog').close();setMode('explore',c.code);$('reveal').focus();});$('country-grid').append(button);
  }
  if(!list.length){const p=document.createElement('p');p.className='empty-state';p.textContent='No countries found. Try another name or continent.';$('country-grid').append(p);}
}
function openDialog(id){stopNarration();resetTourButton();$(id).showModal();}
$('reveal').addEventListener('click',reveal);
function tapFlag(){if(!ready)return;if(!revealed){reveal();return;}stopNarration();resetTourButton();const i=(activeClue+1)%current().clues.length;highlight(i);playFile(i,current().clues[i].text);}
$('flag-wrap').addEventListener('click',tapFlag);
$('flag-wrap').addEventListener('keydown',e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();e.stopPropagation();tapFlag();}});
$('previous').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));
$('daily-mode').addEventListener('click',()=>{if(ready)setMode('daily');});
$('explore-mode').addEventListener('click',()=>{if(ready)setMode('explore',current()?.code);});
$('learning').addEventListener('click',()=>rate(false));$('known').addEventListener('click',()=>rate(true));
$('tour').addEventListener('click',()=>{if($('tour').dataset.playing==='true'){stopNarration();resetTourButton();}else narrateTour();});
$('sound').addEventListener('click',()=>{
  if(!ready)return;progress.sound=!progress.sound;stopNarration();resetTourButton();
  $('sound').setAttribute('aria-pressed',String(progress.sound));$('sound').setAttribute('aria-label',progress.sound?'Turn sound off':'Turn sound on');
  if(revealed)$('main-hint').textContent=progress.sound?'Sound on · tap to listen':'Sound off';save();
});
$('parents').addEventListener('click',()=>{if(ready){updateCounts();openDialog('parent-dialog');}});
$('collection').addEventListener('click',()=>{if(ready){renderWorld();openDialog('world-dialog');}});
$('search').addEventListener('input',renderWorld);$('continent').addEventListener('change',renderWorld);
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('finish-explore').addEventListener('click',()=>{$('finish-dialog').close();setMode('explore',current()?.code);});
$('finish-close').addEventListener('click',()=>$('finish-dialog').close());
$('retry-image').addEventListener('click',()=>{$('image-error').hidden=true;$('flag').src=`assets/flags/${current().code}.svg?retry=${Date.now()}`;});
$('export-progress').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`flag-garden-progress-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('backup-status').textContent='Your progress backup is ready. Keep it somewhere safe.';
});
$('import-progress').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>1000000)throw Error('This file is too large for a progress backup.');
    const imported=validateProgress(JSON.parse(await file.text()),new Set(countries.map(c=>c.code)));
    // Merge without throwing away existing newer progress.
    for(const [code,r] of Object.entries(progress.records)){
      const other=imported.records[code];if(!other||(r.lastRated||'')>(other.lastRated||'')||((r.lastRated||'')===(other.lastRated||'')&&(r.stage||0)>(other.stage||0)))imported.records[code]=r;
    }
    imported.days=[...new Set([...imported.days,...progress.days])].sort();imported.start=[imported.start,progress.start].sort()[0];
    progress=imported;save();setMode('daily');$('sound').setAttribute('aria-pressed',String(progress.sound));$('sound').setAttribute('aria-label',progress.sound?'Turn sound off':'Turn sound on');
    $('backup-status').textContent='Progress restored. Your newer practice was kept too.';
  }catch(error){$('backup-status').textContent=error instanceof SyntaxError?'That file isn’t a valid progress backup.':error.message;}
  e.target.value='';
});
document.addEventListener('keydown',e=>{
  if(!ready||document.querySelector('dialog[open]')||e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='ArrowRight'){e.preventDefault();move(1);}
  if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
  if(e.code==='Space'&&!/BUTTON|A/.test(e.target.tagName)){e.preventDefault();reveal();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopNarration();resetTourButton();}});
addEventListener('resize',fitFlag);

async function init(){
  try{
    const response=await fetch('data.json');if(!response.ok)throw Error('Could not load the flags');
    countries=await response.json();byCode=new Map(countries.map(c=>[c.code,c]));
    let raw=null;try{raw=JSON.parse(localStorage.getItem(STORAGE));}catch{}
    try{progress=raw?validateProgress(raw,new Set(byCode.keys())):freshProgress(dayKey());}catch{progress=freshProgress(dayKey());$('status').textContent='Saved progress couldn’t be read. Restore a backup from For grown-ups if you have one.';}
    if(raw?.daily?.date===dayKey()&&Array.isArray(raw.daily.codes)&&raw.daily.codes.every(c=>byCode.has(c))&&Array.isArray(raw.daily.done))progress.daily={date:raw.daily.date,codes:[...new Set(raw.daily.codes)],done:raw.daily.done.filter(c=>raw.daily.codes.includes(c))};
    $('sound').setAttribute('aria-pressed',String(progress.sound));$('sound').setAttribute('aria-label',progress.sound?'Turn sound off':'Turn sound on');
    ready=true;setMode('daily');
  }catch{
    $('country-name').textContent='Our flags need a moment.';$('country-subtitle').textContent='Check your connection, then reload this page.';
    $('reveal').innerHTML='<span>Try again</span>';$('reveal').disabled=false;$('reveal').addEventListener('click',()=>location.reload(),{once:true});
    $('position').textContent='Not loaded';$('previous').disabled=true;$('next').disabled=true;
  }
}
init();
