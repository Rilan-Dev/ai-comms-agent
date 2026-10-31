import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReadState} from '../src/email/read-state-reconciliation';

const page={messages:[{providerMessageId:'INBOX:12',messageIdHeader:'<one@test>'}]};
const flag={provider_message_id:'INBOX:12',message_id_header:'<one@test>',is_read:true,is_starred:false,is_draft:false,is_outbound:false};
function fixture(flags:unknown= [flag]){
  const events:string[]=[];let result:unknown;
  return {events,get result(){return result;},deps:{
    prepare:async()=>page,fetchFlags:async()=>flags,
    withLease:async(_page:unknown,work:()=>Promise<void>)=>work(),
    refetch:async(id:string)=>{events.push(`refetch:${id}`);return '<replacement@test>';},
    remove:async(ids:string[])=>{events.push(`remove:${ids.join(',')}`);},
    complete:async(_page:unknown,value:unknown)=>{events.push('complete');result=value;},
  }};
}
test('read state consumes read-only metadata and commits complete coverage',async()=>{
  const f=fixture();await reconcileReadState(f.deps,false);assert.deepEqual(f.events,['complete']);
  assert.deepEqual(f.result,{flags:[flag],missing:[],refetched:[]});
});
test('only successful metadata absence allows deletion',async()=>{
  const f=fixture([]);await reconcileReadState(f.deps,false);assert.deepEqual(f.events,['remove:INBOX:12','complete']);
  const failed=fixture();failed.deps.fetchFlags=async()=>{throw Error('offline');};
  await assert.rejects(reconcileReadState(failed.deps,false),/offline/);assert.deepEqual(failed.events,[]);
});
test('invalid or substituted metadata never causes deletion or cursor publication',async()=>{
  for(const flags of [[flag,flag],[{...flag,provider_message_id:'OTHER:1'}],[{...flag,is_read:'yes'}],null]){
    const f=fixture(flags);await assert.rejects(reconcileReadState(f.deps,false));assert.deepEqual(f.events,[]);
  }
});
test('UID reuse refetches canonical content and does not overwrite it with stale flags',async()=>{
  const f=fixture([{...flag,message_id_header:'<replacement@test>'}]);await reconcileReadState(f.deps,true);
  assert.deepEqual(f.events,['refetch:INBOX:12','complete']);
  assert.deepEqual(f.result,{flags:[],missing:[],refetched:[{providerMessageId:'INBOX:12',messageIdHeader:'<replacement@test>'}]});
});
test('failed canonical refetch cannot publish coverage',async()=>{
  const f=fixture([{...flag,message_id_header:null}]);f.deps.refetch=async()=>{throw Error('refetch failed');};
  await assert.rejects(reconcileReadState(f.deps,true),/refetch failed/);assert.deepEqual(f.events,[]);
});
test('a replaced lease prevents refetch and deletion side effects',async()=>{
  const f=fixture([]);f.deps.withLease=async()=>{throw Error('lease changed');};
  await assert.rejects(reconcileReadState(f.deps,true),/lease changed/);assert.deepEqual(f.events,[]);
});
test('only the last committed keyset page reports completed coverage',async()=>{
  const f=fixture();
  assert.equal(await reconcileReadState({...f.deps,prepare:async()=>({...page,nextCursor:'next'})},false),'pending');
  assert.equal(await reconcileReadState(f.deps,false),'completed');
  const unavailable=fixture();
  assert.equal(await reconcileReadState({...unavailable.deps,prepare:async()=>null},false),'unavailable');
  assert.deepEqual(unavailable.events,[]);
});
test('disabled rollout does not read metadata or alter existing mailbox read controls',async()=>{
  const f=fixture();f.deps.prepare=async()=>{throw Error('No work allowed while rollout is off');};
  assert.equal(await reconcileReadState(f.deps,false,false),'unavailable');assert.deepEqual(f.events,[]);
});
