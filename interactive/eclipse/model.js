export const C={earth:6371,moon:1737.4,sun:695700,au:149597870};
export const radians=d=>d*Math.PI/180;
export const degrees=r=>r*180/Math.PI;
export function moonPosition({phase=0,distance=360000,tilt=5.145,node=0}){
 const a=radians(phase-node),n=radians(node),i=radians(tilt);
 const x=-Math.cos(a),y=Math.sin(a)*Math.cos(i),z=Math.sin(a)*Math.sin(i);
 return [distance*(x*Math.cos(n)+y*Math.sin(n)),distance*(-x*Math.sin(n)+y*Math.cos(n)),distance*z];
}
export function observerPosition(site=0){const a=radians(site);return [-C.earth*Math.cos(a),C.earth*Math.sin(a),0];}
export function coverage(sun,moon,separation){
 const a=sun,b=moon,d=Math.abs(separation);
 if(d>=a+b)return 0;
 if(d<=Math.abs(a-b))return Math.min(1,b*b/(a*a));
 const clamp=x=>Math.max(-1,Math.min(1,x));
 const area=a*a*Math.acos(clamp((d*d+a*a-b*b)/(2*d*a)))+b*b*Math.acos(clamp((d*d+b*b-a*a)/(2*d*b)))-.5*Math.sqrt(Math.max(0,(-d+a+b)*(d+a-b)*(d-a+b)*(d+a+b)));
 return Math.max(0,Math.min(1,area/(Math.PI*a*a)));
}
export function sky(state){
 const p=observerPosition(state.site),m=moonPosition(state),mv=m.map((x,i)=>x-p[i]),sv=[-C.au-p[0],-p[1],-p[2]],md=Math.hypot(...mv),sd=Math.hypot(...sv);
 const dot=mv.reduce((s,x,i)=>s+x*sv[i],0)/(md*sd),sep=Math.acos(Math.max(-1,Math.min(1,dot)));
 const sr=Math.asin(C.sun/sd),mr=Math.asin(C.moon/md),obscured=coverage(sr,mr,sep);
 const dx=Math.atan2(mv[1],-mv[0])-Math.atan2(sv[1],-sv[0]);const dy=Math.atan2(mv[2],Math.hypot(mv[0],mv[1]));
 return {sunRadius:sr,moonRadius:mr,separation:sep,dx,dy,obscured,type:sep>=sr+mr?'No eclipse':mr>=sr&&sep<=mr-sr?'Total eclipse':mr<sr&&sep<=sr-mr?'Annular eclipse':'Partial eclipse',moon:m,observer:p};
}
export function shadowLength(){return C.moon*(C.au-360000)/(C.sun-C.moon);}
