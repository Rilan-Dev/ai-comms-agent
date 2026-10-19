import { test } from 'node:test';
import { stableBriefingItemId } from '../../../packages/db/src/briefings/identity';
import assert from 'node:assert/strict';
import { briefingPeriod, planBriefingBatches, routineSourceEligible } from '../../../packages/shared/src/briefings/selection';

test('first use defaults to seven days; five-day absence never narrows retained history', () => {
  const now='2026-10-18T12:00:00.000Z';
  assert.deepEqual(briefingPeriod(null,now,null),{start:'2026-10-11T12:00:00.000Z',end:now});
  assert.equal(briefingPeriod(null,now,'2026-10-01T12:00:00.000Z').start,'2026-10-01T12:00:00.000Z');
  assert.throws(()=>briefingPeriod({start:'2026-01-01T00:00:00Z',end:now},now,null),/90/);
  assert.throws(()=>briefingPeriod({start:now,end:'invalid'},now,null));
  assert.equal(briefingPeriod(null,'2026-10-18T12:00:00.123456Z',null).end,'2026-10-18T12:00:00.123456Z');
});
test('batch planning includes every source within both count and token bounds', () => {
  const sources=Array.from({length:5000},(_,i)=>({id:String(i),estimatedTokens:300}));
  const batches=planBriefingBatches(sources);
  assert.deepEqual(batches.flatMap(b=>b.sourceIds),sources.map(s=>s.id));
  assert.ok(batches.every(b=>b.sourceIds.length<=50 && b.estimatedTokens<=12000));
  assert.deepEqual(planBriefingBatches([{id:'oversized',estimatedTokens:18000}]),[{sourceIds:['oversized'],estimatedTokens:12000,partial:true}]);
});
test('item identity follows evidence and actions, not generation ordering or wording', () => {
  const sources=[{messageId:'m',contentRevision:'r'}];
  const a={sourceIds:['m'],suggestedAction:'reply',evidence:[{sourceId:'m',contentRevision:'r',start:1,end:4,supports:'summary'}]};
  assert.equal(stableBriefingItemId(a,sources),stableBriefingItemId({...a,title:'rewritten',id:'new-array-index'},sources));
  assert.notEqual(stableBriefingItemId(a,sources),stableBriefingItemId({...a,evidence:[{...a.evidence[0]!,start:5,end:8}]},sources));
  assert.notEqual(stableBriefingItemId(a,sources),stableBriefingItemId(a,[{messageId:'m',contentRevision:'new'}]));
});
test('routine coverage uses its own key, includes missed and late mail, preserves intentional overlap', () => {
  const period={start:'2026-10-17T00:00:00Z',end:'2026-10-18T00:00:00Z'};
  const source={messageId:'mail',contentRevision:'r',receivedAt:'2026-10-15T00:00:00Z'};
  const ctx={historyStart:'2026-10-10T00:00:00Z',completedSourceKeys:new Set<string>()};
  assert.equal(routineSourceEligible(source,period,'since_previous_occurrence',ctx),true);
  assert.equal(routineSourceEligible(source,period,'previous_24_hours',ctx),false);
  ctx.completedSourceKeys.add('mail:r');
  assert.equal(routineSourceEligible(source,period,'since_previous_occurrence',ctx),false);
  assert.equal(routineSourceEligible(source,period,'since_previous_occurrence',{...ctx,completedSourceKeys:new Set()}),true);
  assert.equal(routineSourceEligible({...source,receivedAt:period.start},period,'previous_24_hours',ctx),true);
  assert.equal(routineSourceEligible({...source,receivedAt:period.end},period,'previous_24_hours',ctx),false);
});
