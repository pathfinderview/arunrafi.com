import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {dayKey,addDays,freshProgress,rateRecord,makeDaily,validateProgress} from './learning.mjs';
const countries=JSON.parse(await readFile(new URL('data.json',import.meta.url)));
assert.equal(countries.length,195);assert.equal(new Set(countries.map(c=>c.code)).size,195);
for(const c of countries){
 assert.ok(c.name&&c.region&&c.ratio>0&&c.clues.length>=2);
 assert.ok((await stat(new URL(`assets/flags/${c.code}.svg`,import.meta.url))).size>100);
 for(const suffix of (process.env.SKIP_AUDIO ? [] : ['name',...c.clues.map((_,i)=>i)]))assert.ok((await stat(new URL(`assets/audio/${c.code}-${suffix}.mp3`,import.meta.url))).size>500);
 for(const clue of c.clues){const[x,y,w,h]=clue.box;assert.ok(clue.text&&x>=0&&y>=0&&w>0&&h>0&&x+w<=100.01&&y+h<=100.01,`${c.code} has invalid highlight`);}
}
const today='2026-11-15';
let r=rateRecord({},true,today);assert.equal(r.stage,1);assert.equal(r.due,'2026-11-16');
for(let i=0;i<10;i++)r=rateRecord(r,true,today);
assert.equal(r.stage,1,'Same-day taps must not advance recall');
r=rateRecord(r,true,'2026-11-16');assert.equal(r.stage,2);assert.equal(r.due,'2026-11-19');
r=rateRecord(r,true,'2026-11-17');assert.equal(r.stage,2,'Early practice must not advance recall');
assert.equal(r.due,'2026-11-19','Early practice must not postpone a due review');
for(const d of ['2026-11-20','2026-11-27','2026-12-11','2027-01-10'])r=rateRecord(r,true,d);
assert.equal(r.stage,6);assert.equal(r.mastered,true);
r=rateRecord(r,false,'2027-01-11');assert.equal(r.stage,0);assert.equal(r.mastered,false);assert.equal(r.due,'2027-01-12');
r=rateRecord(r,true,'2027-01-11');assert.equal(r.stage,0,'A same-day re-reveal must not erase forgetting');
let p=freshProgress(today);let daily=makeDaily(countries,p,today);assert.equal(daily.codes.length,2);assert.equal(daily.codes[0],'in');
p.records.in={seen:true,stage:0,due:addDays(today,1)};
daily=makeDaily(countries,p,today);assert.ok(!daily.codes.includes('in'),'Not due yet');
daily=makeDaily(countries,p,addDays(today,1));assert.ok(daily.codes.includes('in'),'Seen-only flags return for review');
assert.equal(addDays('2026-12-31',1),'2027-01-01');
assert.throws(()=>validateProgress({version:1,start:today,records:{in:{stage:99,due:today}}},new Set(['in'])));
assert.throws(()=>validateProgress({version:1,start:'2026-02-30',records:{}},new Set()));
assert.equal(validateProgress(p,new Set(countries.map(c=>c.code))).records.in.stage,0);
// Simulate daily successful practice: the 6-month plan must be feasible at its cap.
p=freshProgress(today);let discoveredDay=null,masteredDay=null;
for(let day=0;day<183;day++){
 const date=addDays(today,day);const d=makeDaily(countries,p,date);
 assert.ok(d.codes.length<=8);
 for(const code of d.codes)p.records[code]=rateRecord(p.records[code],true,date);
 if(!discoveredDay&&Object.keys(p.records).length===195)discoveredDay=day+1;
 if(Object.values(p.records).filter(r=>r.mastered).length===195){masteredDay=day+1;break;}
}
assert.equal(discoveredDay,98);assert.ok(masteredDay!==null&&masteredDay<=183,'Daily review capacity must support the six-month plan');
console.log(`PASS: 195 flags, 419 clues, ${process.env.SKIP_AUDIO?'audio checks deferred':'614 recordings'}; review timing, repeat taps, imports and six-month capacity. First pass: day ${discoveredDay}; perfect-recall completion: day ${masteredDay}.`);
