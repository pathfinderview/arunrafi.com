import test from 'node:test';
import assert from 'node:assert/strict';
import {pose,POS,radius,TAU} from './model.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
test('4 Hz produces eight beats per second',()=>{close(pose(1).cycles,4);close(pose(1).beats,8);close(pose(.25).cycles,1);});
test('the escape wheel, seconds wheel and minute wheel keep their specified periods',()=>{close(pose(3.75).escapeAngle,TAU);close(pose(60).fourthAngle,-TAU);close(pose(3600).centerAngle,-TAU);close(pose(28800).barrelAngle,TAU);});
test('each meshing pair meets at the sum of its pitch radii',()=>{for(const[a,b,n,p]of[['barrel','center',80,10],['center','third',64,8],['third','fourth',75,10],['fourth','escape',80,5]])close(Math.hypot(POS[a][0]-POS[b][0],POS[a][1]-POS[b][1]),radius(n)+radius(p));});
test('the model stops when the chosen reserve is exhausted',()=>{const empty=pose(40*3600,100);close(empty.reserve,0);assert.equal(empty.running,false);close(pose(41*3600,100).seconds,empty.seconds);});
