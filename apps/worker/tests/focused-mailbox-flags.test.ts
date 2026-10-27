import test from 'node:test';
import assert from 'node:assert/strict';
import {runFocusedMailboxFlagPass} from '../src/email/mailbox-sync-worker';
test('focused provider checks do no I/O while rollout is disabled',async()=>{
 const events:string[]=[];await runFocusedMailboxFlagPass(false,{list:async()=>{events.push('list');return [];},process:async()=>{events.push('process');}});assert.deepEqual(events,[]);
});
test('focused provider checks process one mailbox per pass and do not invoke ordinary ingestion',async()=>{
 const events:string[]=[];await runFocusedMailboxFlagPass(true,{list:async()=>['a','b'],process:async candidate=>{events.push(candidate);}});assert.deepEqual(events,['a']);
});
