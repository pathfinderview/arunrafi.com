// Dimensionless teaching models. These show constraints, not measured anatomy or forces.
export function chamber(contraction, muscle='ring') {
  const c=Math.max(0,Math.min(1,contraction));
  const length=muscle==='ring'?1/(1-.28*c)**2:1-.35*c;
  const radius=1/Math.sqrt(length);
  return {length,radius,volume:length*radius*radius};
}
const ease=t=>t*t*(3-2*t);
export function stepPose(progress,grip=true){
 const p=Math.max(0,Math.min(1,progress));
 const reach=p<.5?ease(p*2):1;
 const pull=p<.5?0:ease((p-.5)*2);
 const length=280+80*(reach-pull);
 // Two-anchor schematic: hold rear during extension; hold front during recovery.
 const front=grip?320-80*reach:460-length/2;
 return {front,rear:front+length,length,radius:17*Math.sqrt(280/length),advance:grip?80*pull:0,phase:p===1?'complete':p<.5?'reach':'pull'};
}
