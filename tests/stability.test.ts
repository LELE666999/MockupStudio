import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../types.ts';
import {historySnapshot,restoreHistory} from '../utils/history.ts';
import {exportSizing} from '../utils/exportSizing.ts';
test('undo keeps media-bearing archives out of snapshots and preserves latest archive list',()=>{
 const state=getInitialState();state.savedProjects=[{id:'a',name:'large archive',timestamp:0,data:{},assets:{video:'x'.repeat(1_000_000)}}] as any;
 const snap=historySnapshot(state);assert.equal(snap.savedProjects.length,0);assert.ok(JSON.stringify(snap).length<10000);
 state.models[0].bodyColor='#ff0000';assert.notEqual(snap.models[0].bodyColor,state.models[0].bodyColor);
 assert.equal(restoreHistory(snap,state).savedProjects,state.savedProjects);
});
test('export resolution is independent of preview viewport and bounded at 3840 long edge',()=>{
 for(const [w,h] of [[400,800],[1600,900],[600,600]])for(const quality of ['1080p','4k'] as const){
  const {dpr,longEdge}=exportSizing(w,h,quality);assert.equal(Math.max(w,h)*dpr,longEdge);assert.ok(longEdge<=(quality==='4k'?3840:1920));assert.ok(Math.min(w,h)*dpr<=(quality==='4k'?2160:1080));
 }
 assert.throws(()=>exportSizing(0,800,'1080p'));
});
