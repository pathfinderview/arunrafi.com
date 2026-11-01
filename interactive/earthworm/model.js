// Illustrative travelling contraction wave, not a force or locomotion solver.
export const COUNT=76;
export function segment(i,t){
 const u=i/(COUNT-1), wave=Math.sin(u*Math.PI*5-t*2.3);
 const length=0.235*(1+0.23*wave);
 return {length,radius:0.48/Math.sqrt(length/0.235),gripping:wave<-.25};
}
export function body(t){let x=0;return Array.from({length:COUNT},(_,i)=>{const s=segment(i,t);const p={...s,x:x+s.length/2};x+=s.length;return p;}).map((s,i,a)=>({...s,x:s.x-a.at(-1).x/2,y:Math.sin(i/75*5+t*.25)*.32}));}
