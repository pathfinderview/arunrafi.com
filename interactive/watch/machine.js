import * as T from 'three';
import {POS, radius, SPEC, TAU} from './model.js';

const metal=(color,roughness=.5)=>new T.MeshStandardMaterial({color,metalness:.7,roughness});
const MAT={gold:metal('#b68a35'),lightGold:metal('#ddbd79'),darkGold:metal('#9b804e'),steel:metal('#a7adb0',.47),dark:metal('#3d484c'),blue:metal('#315c77'),ruby:new T.MeshStandardMaterial({color:'#913e42',metalness:.2,roughness:.3}),plate:metal('#a5a8a0',.65),ring:metal('#737b7c',.48),paper:metal('#e3e2d8',.8)};
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(r,h,mat,parent,x=0,y=0,z=0,segments=48){const m=mesh(new T.CylinderGeometry(r,r,h,segments),mat,parent,x,y,z);m.rotation.x=Math.PI/2;return m;}
function ring(outer,inner,depth,mat,parent,z=0){const s=new T.Shape();s.absarc(0,0,outer,0,TAU,false);const h=new T.Path();h.absarc(0,0,inner,0,TAU,true);s.holes.push(h);return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:80}),mat,parent,0,0,z);}
function beam(a,b,width,depth,mat,parent,z=0){const mid=new T.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,z);const m=mesh(new T.BoxGeometry(Math.hypot(b[0]-a[0],b[1]-a[1]),width,depth),mat,parent,mid.x,mid.y,mid.z);m.rotation.z=Math.atan2(b[1]-a[1],b[0]-a[0]);return m;}
function screw(parent,x,y,z,size=.24){cylinder(size,.15,MAT.steel,parent,x,y,z,24);const slot=mesh(new T.BoxGeometry(size*1.45,.048,.018),MAT.dark,parent,x,y,z+.083);slot.rotation.z=(x+y)*.7;}
function jewel(parent,x,y,z){ring(.32,.14,.12,MAT.gold,parent,z).position.set(x,y,z);cylinder(.17,.12,MAT.ruby,parent,x,y,z+.02,24);}
function toothed(n,r,depth,mat,parent,phase=0,escape=false){
 const s=new T.Shape();const steps=escape?[[0,.91],[.28,.92],[.65,1.10],[.78,1.10],[.8,.90],[1,.91]]:[[0,.965],[.20,.965],[.34,1.025],[.66,1.025],[.80,.965],[1,.965]];
 for(let i=0;i<n;i++)for(const[f,m]of steps){const a=(i+f)*TAU/n+phase;const x=r*m*Math.cos(a),y=r*m*Math.sin(a);if(i===0&&f===0)s.moveTo(x,y);else s.lineTo(x,y);}
 s.closePath();const hole=new T.Path();hole.absarc(0,0,r*.73,0,TAU,true);s.holes.push(hole);
 mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,curveSegments:48}),mat,parent);
 cylinder(r*.19,depth+.05,mat,parent,0,0,depth/2);
 const count=escape?4:5;for(let i=0;i<count;i++){const a=i*TAU/count+phase;beam([0,0],[r*.84*Math.cos(a),r*.84*Math.sin(a)],r*.105,depth,mat,parent,depth/2);}
}
function spring(parent,outer,inner,turns,z,material,thickness=.025){
 const points=[];const count=600;for(let i=0;i<=count;i++){const u=i/count,a=u*turns*TAU,r=inner+(outer-inner)*u;points.push(new T.Vector3(r*Math.cos(a),r*Math.sin(a),z));}
 return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),600,thickness,4,false),material,parent);
}
export function createMachine(scene){
 const root=new T.Group();scene.add(root);
 const groups={case:new T.Group(),barrel:new T.Group(),train:new T.Group(),escape:new T.Group(),balance:new T.Group(),bridges:new T.Group(),dial:new T.Group()};Object.values(groups).forEach(g=>root.add(g));
 const parts=[];function pickable(g,key){g.traverse(o=>{if(o.isMesh){o.userData.part=key;parts.push(o);}});}
 // Main plate and a double-bezel case, dimensions in illustrative millimetres.
 cylinder(11.0,.55,MAT.plate,groups.case,0,0,-.45,100);
 ring(12.05,10.95,.65,MAT.ring,groups.case,-.65);ring(12.1,11.75,.18,MAT.steel,groups.case,.10);
 ring(11.46,11.18,.10,MAT.dark,groups.case,.24);
 for(let i=0;i<60;i++){const a=i*TAU/60;const m=mesh(new T.BoxGeometry(i%5===0?.10:.05,i%5===0?.52:.22,.03),i%5===0?MAT.lightGold:MAT.dark,groups.case,11.3*Math.sin(a),11.3*Math.cos(a),.4);m.rotation.z=-a;}
 // Jewels, a circular brushing pattern and tiny engraved dots.
 for(let j=1;j<15;j++)ring(j*.69,j*.69-.009,.005,MAT.steel,groups.case,-.161);
 for(const a of [.5,2.1,3.4,4.9])screw(groups.case,10.15*Math.cos(a),10.15*Math.sin(a),.3,.3);
 for(const y of [-8.7,8.7])for(const x of [-5.9,5.9]){const lug=mesh(new T.BoxGeometry(2.4,6.2,1.8),MAT.ring,groups.case,x,y,0);lug.rotation.z=Math.sign(x*y)*.12;screw(groups.case,x,y+Math.sign(y)*2.1,1.0,.27);}
 const crown=cylinder(1.12,1.8,MAT.steel,groups.case,13.1,0,.0,40);crown.rotation.z=Math.PI/2;
 const stem=cylinder(.33,2.3,MAT.dark,groups.case,11.6,0,.0,20);stem.rotation.z=Math.PI/2;
 for(let i=0;i<12;i++){const a=i*TAU/12;const m=mesh(new T.BoxGeometry(1.76,.09,.09),MAT.dark,groups.case,13.1,1.10*Math.sin(a),1.10*Math.cos(a));}
 // The going train: large wheels sit above the pinions they share an arbor with.
 const gears={};
 function wheel(name,key,n,z,pinionN,pinionZ,phase=0){const g=new T.Group();const p=POS[name];g.position.set(p[0],p[1],z);groups[key].add(g);toothed(n,radius(n),.16,name==='escape'?MAT.steel:MAT.gold,g,phase,name==='escape');
 if(pinionN){const pg=new T.Group();pg.position.z=pinionZ-z;g.add(pg);toothed(pinionN,radius(pinionN),.22,MAT.steel,pg,phase+.1);}
 cylinder(.13,z+1.0,MAT.steel,g,0,0,-z/2+.3,16);jewel(groups.case,p[0],p[1],-.03);cylinder(.18,.1,MAT.dark,g,0,0,.25,16);gears[name]=g;return g;}
 const barrel=wheel('barrel','barrel',80,.7);cylinder(2.98,.55,MAT.darkGold,barrel,0,0,-.3);ring(2.96,2.82,.42,MAT.gold,barrel,.15);const mainspring=spring(barrel,2.65,.35,5,.35,MAT.blue,.055);cylinder(.35,.65,MAT.steel,barrel,0,0,.3,24);screw(barrel,0,0,.75,.2);
 wheel('center','train',64,1.6,10,.7);wheel('third','train',75,2.5,8,1.6);wheel('fourth','train',80,3.4,10,2.5);
 // Escape wheel has deliberately long, visible teeth; tooth geometry is schematic.
 const escape=new T.Group();escape.position.set(...POS.escape,4.3);groups.escape.add(escape);toothed(15,1.48,.14,MAT.steel,escape,0,true);const ep=new T.Group();ep.position.z=-.9;escape.add(ep);toothed(5,radius(5),.23,MAT.gold,ep);cylinder(.12,5.2,MAT.steel,escape,0,0,-1.9,16);gears.escape=escape;jewel(groups.case,...POS.escape,0);
 // A fork, two ruby pallets and a visible balance roller. Contact surfaces are illustrative.
 const fork=new T.Group();fork.position.set(...POS.fork,4.3);groups.escape.add(fork);
 beam([0,0],[-2.64,0],.16,.17,MAT.dark,fork,.08);
 beam([-2.64,0],[-2.98,.31],.12,.17,MAT.dark,fork,.08);beam([-2.64,0],[-2.98,-.31],.12,.17,MAT.dark,fork,.08);
 beam([0,0],[2.4,.87],.18,.16,MAT.dark,fork,.08);beam([0,0],[2.4,-.87],.18,.16,MAT.dark,fork,.08);
 const pallets=[];for(const y of [-.87,.87])pallets.push(mesh(new T.BoxGeometry(.35,.38,.22),MAT.ruby,fork,2.4,y,.10));cylinder(.23,.3,MAT.steel,fork,0,0,.15,24);
 const balRoot=new T.Group();balRoot.position.set(...POS.balance,4.25);groups.balance.add(balRoot);const balance=new T.Group();balRoot.add(balance);
 ring(3.32,2.98,.24,MAT.gold,balance);for(let i=0;i<3;i++){const a=i*TAU/3;beam([0,0],[3.15*Math.cos(a),3.15*Math.sin(a)],.20,.14,MAT.gold,balance,.13);}
 for(let i=0;i<12;i++){const a=i*TAU/12;cylinder(.12,.16,MAT.darkGold,balance,3.18*Math.cos(a),3.18*Math.sin(a),.3,12);}
 cylinder(.24,.65,MAT.steel,balance,0,0,.15);cylinder(.13,.15,MAT.ruby,balance,.65,0,.38,16);
 const hair=spring(balRoot,2.55,.29,6,.58,MAT.blue,.022);
 const hairPosition=hair.geometry.attributes.position;
 const hairOriginal=new Float32Array(hairPosition.array);
 jewel(balRoot,0,0,.8);screw(balRoot,0,0,1.04,.23);
 // Separate, removable bridges with bearing jewels.
 for(const [x,y,angle,len] of [[-4.8,5.5,.12,7.3],[3.4,1.8,-.95,7.2],[-4,-4,.65,6.7]]){const g=new T.Group();g.position.set(x,y,5.2);g.rotation.z=angle;groups.bridges.add(g);mesh(new T.BoxGeometry(len,1.05,.38),MAT.plate,g);for(const sign of[-1,1]){cylinder(.67,.38,MAT.plate,g,sign*len/2,0,0);screw(g,sign*len/2,0,.27,.26);}jewel(g,0,0,.24);}
 // The optional dial lifts away from the exposed mechanism.
 cylinder(10.83,.25,MAT.paper,groups.dial,0,0,6.5,100);
 for(let i=0;i<60;i++){const a=i*TAU/60;const tick=mesh(new T.BoxGeometry(i%5===0?.14:.05,i%5===0?.80:.26,.035),MAT.dark,groups.dial,9.8*Math.sin(a),9.8*Math.cos(a),6.66);tick.rotation.z=-a;}
 const hands={};for(const[name,len,w,z,mat] of [['hour',5,.32,6.85,MAT.dark],['minute',7.5,.23,7.0,MAT.dark],['second',8.6,.055,7.18,MAT.blue]]){const g=new T.Group();g.position.z=z;groups.dial.add(g);mesh(new T.BoxGeometry(w,len,.08),mat,g,0,len*.42,0);hands[name]=g;}cylinder(.34,.15,MAT.gold,groups.dial,0,0,7.28);
 Object.entries(groups).forEach(([key,g])=>pickable(g,key));
 const originals=new Map();Object.values(groups).forEach(g=>g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();originals.set(o,{opacity:o.material.opacity,color:o.material.color.clone()});}}));
 function update(state,opts){
  for(const name of['barrel','center','third','fourth','escape'])gears[name].rotation.z=state[name+'Angle'];
  balance.rotation.z=state.balanceAngle;fork.rotation.z=state.forkAngle;
  hands.second.rotation.z=state.secondsAngle;hands.minute.rotation.z=state.minuteAngle-48*Math.PI/180;hands.hour.rotation.z=state.hourAngle-304*Math.PI/180;
  // Outer spring end stays anchored. Inner sections follow the balance; the tube
  // deforms from the same angle rather than an unrelated breathing animation.
  for(let i=0;i<hairPosition.count;i++){const x=hairOriginal[i*3],y=hairOriginal[i*3+1],r=Math.hypot(x,y);const weight=Math.max(0,Math.min(1,(2.60-r)/2.31));const a=state.balanceAngle*weight;hairPosition.setXYZ(i,x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),hairOriginal[i*3+2]);}hairPosition.needsUpdate=true;hair.geometry.computeVertexNormals();
  const explode=opts.explode;
  const offsets={case:[0,0,-1.4],barrel:[-1.2,.6,2.0],train:[.5,1,4.3],escape:[1.4,-.7,6.8],balance:[-1.2,-1.0,8.2],bridges:[0,0,12],dial:[0,0,15]};
  for(const[key,g]of Object.entries(groups)){
   const o=offsets[key];g.position.set(o[0]*explode,o[1]*explode,o[2]*explode);
   const selected=opts.part==='all'||key===opts.part||(opts.part==='escape'&&key==='balance');
   g.visible=Boolean((key==='dial'?opts.dial:key==='bridges'?(opts.bridges||explode>.1):true)&&(selected||key==='case'));
   g.traverse(m=>{if(!m.isMesh)return;let opacity=selected?1:.13;if(key==='case')opacity=opts.xray?.10:(opts.part==='all'?1:.16);if((key==='bridges'||key==='dial')&&opts.xray)opacity=.12;if(m.material.transparent!==(opacity<1)){m.material.transparent=opacity<1;m.material.needsUpdate=true;}m.material.opacity=opacity;m.material.depthWrite=opacity>.5;m.castShadow=opacity>.8;});
  }
  pallets.forEach((p,i)=>{p.material.emissive.set(state.impulse&&i===state.beats%2?'#852b1e':'#000000');p.material.emissiveIntensity=.4;});
 }
 return {root,groups,parts,update};
}
