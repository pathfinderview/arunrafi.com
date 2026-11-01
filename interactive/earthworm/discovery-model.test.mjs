import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chamber,stepPose} from './discovery-model.js';
test('both muscle directions preserve volume across the full slider',()=>{for(const muscle of ['ring','length'])for(let i=0;i<=100;i++){const s=chamber(i/100,muscle);assert.ok(Math.abs(s.volume-1)<1e-12);assert.ok(s.length>0&&s.radius>0);}assert.ok(chamber(1).length>1);assert.ok(chamber(1,'length').length<1);});
test('a gripping step holds the rear on reach and the front on pull',()=>{const initial=stepPose(0),half=stepPose(.5),end=stepPose(1);assert.equal(initial.rear,half.rear);assert.equal(half.front,end.front);assert.equal(initial.length,end.length);assert.equal(initial.front-end.front,80);assert.equal(initial.rear-end.rear,80);});
test('without useful grip a full cycle returns to its starting place',()=>{const initial=stepPose(0,false),end=stepPose(1,false);assert.deepEqual({...initial,phase:'complete'},end);for(let i=0;i<=100;i++){const s=stepPose(i/100,false);assert.ok(Math.abs((s.front+s.rear)/2-460)<1e-10);}});
test('step position and radius remain finite and continuous',()=>{let last=stepPose(0);for(let i=1;i<=1000;i++){const s=stepPose(i/1000);assert.ok(Number.isFinite(s.radius));assert.ok(Math.abs(s.length*s.radius*s.radius-280*17*17)<1e-8);assert.ok(Math.abs(s.front-last.front)<1);assert.ok(Math.abs(s.rear-last.rear)<1);last=s;}});
