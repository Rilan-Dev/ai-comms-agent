import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchBriefingWork} from '../src/briefings/dispatch';
const work={organizationId:'org',userId:'owner',agentId:'agent',manifestId:'manifest',language:'en'};
test('disabled briefing rollout performs no scan or provider call',async()=>{
  await dispatchBriefingWork(false,{list:async()=>{throw Error('scan');},process:async()=>{throw Error('provider');},failed:()=>{throw Error('error');}});
});
test('dispatch keeps persisted owner, agent and manifest scope together and isolates failure',async()=>{
  const calls:unknown[]=[];
  await dispatchBriefingWork(true,{list:async()=>[work,{...work,manifestId:'second',userId:'other'}],
    process:async item=>{calls.push(item);if(item.manifestId==='manifest')throw Error('revoked');},failed:item=>{calls.push(item.manifestId);}});
  assert.deepEqual(calls,[work,'manifest',{...work,manifestId:'second',userId:'other'}]);
});
test('one poll is bounded even if a candidate source returns too many manifests',async()=>{
  let count=0;
  await dispatchBriefingWork(true,{list:async()=>Array.from({length:100},()=>work),process:async()=>{count++;},failed:()=>{}});
  assert.equal(count,2);
});
