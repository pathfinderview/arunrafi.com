// Educational kinematic model. Dimensions/tooth counts describe this model,
// not a commercial calibre. One time coordinate drives every moving part.
export const TAU = Math.PI * 2;
export const SPEC = {hz:4, amplitude:270, escapeTeeth:15, reserveHours:40, module:0.085,
  teeth:{barrel:80,centerPinion:10,center:64,thirdPinion:8,third:75,fourthPinion:10,fourth:80,escapePinion:5}};
export const radius = teeth => teeth * SPEC.module / 2;
const add=(p,d,a)=>[p[0]+d*Math.cos(a),p[1]+d*Math.sin(a)];
const barrel=[-5,4];
const center=add(barrel,radius(80)+radius(10),0);
const third=add(center,radius(64)+radius(8),-35*Math.PI/180);
const fourth=add(third,radius(75)+radius(10),-50*Math.PI/180);
const escape=add(fourth,radius(80)+radius(5),-95*Math.PI/180);
export const POS={barrel,center,third,fourth,escape,balance:[-3.9,-4.0],fork:[-.4,-4.0]};
export function pose(seconds,wind=100){
  const duration=wind/100*SPEC.reserveHours*3600;
  const t=Math.min(Math.max(0,seconds),duration);
  const cycles=t*SPEC.hz;
  const beats=cycles*2;
  const n=Math.floor(beats),phase=beats-n;
  // Each half-swing unlocks half an escape-wheel tooth. The brief advance
  // is deliberately widened in time to make the release visible in slow motion.
  const u=Math.min(1,phase/.18),smooth=u*u*(3-2*u);
  const release=n+smooth;
  const escapeAngle=release*TAU/(SPEC.escapeTeeth*2);
  const fourthAngle=-escapeAngle/(80/5);
  const thirdAngle=-fourthAngle/(75/10);
  const centerAngle=-thirdAngle/(64/8);
  const barrelAngle=-centerAngle/(80/10);
  const balanceAngle=Math.sin(cycles*TAU)*SPEC.amplitude*Math.PI/180;
  const side=n%2===0?1:-1;
  return {seconds:t,beats:n,phase,cycles,balanceAngle,
    forkAngle:side*(.13-.26*smooth),escapeAngle,fourthAngle,thirdAngle,centerAngle,barrelAngle,
    secondsAngle:fourthAngle,minuteAngle:centerAngle,hourAngle:centerAngle/12,
    impulse:phase<.18,reserve:Math.max(0,wind/100*SPEC.reserveHours-t/3600),running:t<duration};
}
