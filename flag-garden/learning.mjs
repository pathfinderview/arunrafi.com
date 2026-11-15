export const INTERVALS = [1, 3, 7, 14, 30];
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day, n) {
  const date = new Date(day + 'T12:00:00'); date.setDate(date.getDate()+n); return dayKey(date);
}
export function freshProgress(today) { return {version:1,start:today,records:{},days:[],daily:null,sound:true}; }
export function rateRecord(record = {}, known, today) {
  const result = {...record,seen:true};
  // Repeated taps or practice on the same day must never manufacture recall.
  if (result.lastRated === today) {
    if (!known) return {...result,stage:0,mastered:false,due:addDays(today,1),lastKnown:false};
    return result;
  }
  const eligible = !result.due || result.due <= today;
  const stage = known ? (eligible ? Math.min((result.stage||0)+1,6) : (result.stage||0)) : 0;
  return {...result,stage,mastered:stage>=6,lastRated:today,lastKnown:known,
    due:addDays(today,known ? (INTERVALS[Math.max(0,stage-1)]||60) : 1)};
}
export function makeDaily(countries, progress, today) {
  const records=progress.records;
  const due=countries.filter(c=>records[c.code]?.seen && (!records[c.code].due || records[c.code].due<=today))
    .sort((a,b)=>(records[a.code].due||'').localeCompare(records[b.code].due||''));
  const newFlags=countries.filter(c=>!records[c.code]?.seen).slice(0,2);
  return {date:today,codes:[...newFlags,...due.slice(0,8-newFlags.length)].map(c=>c.code),done:[]};
}
export function validateProgress(input, codes) {
  if (!input || input.version!==1 || typeof input.records!=='object' || !input.records || Array.isArray(input.records)) throw Error('This is not a Flag Garden backup.');
  const validDay=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayKey(new Date(s+'T12:00:00'))===s;
  if(!validDay(input.start)) throw Error('The backup has an invalid start date.');
  const result=freshProgress(input.start); result.sound=input.sound!==false;
  result.days=Array.isArray(input.days)?[...new Set(input.days.filter(validDay))]:[];
  for(const [code,r] of Object.entries(input.records)) {
    if(!codes.has(code) || !r || typeof r!=='object') continue;
    if(!Number.isInteger(r.stage)||r.stage<0||r.stage>6||!validDay(r.due)) throw Error('The backup has invalid learning records.');
    result.records[code]={seen:!!r.seen,stage:r.stage,mastered:r.stage>=6,due:r.due,
      ...(validDay(r.lastRated)?{lastRated:r.lastRated}:{}),lastKnown:!!r.lastKnown};
  }
  return result;
}
