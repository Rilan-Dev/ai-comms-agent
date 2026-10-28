import {describe,expect,it} from 'vitest';
import {continuationForSavedMessage,continuationForTurn} from '../src/lib/chat/mail-whatsapp-continuation';

const id='10000000-0000-4000-8000-000000000001';
const checkpoint={kind:'mail_whatsapp_review',version:1,creatorId:'user',agentId:'agent',expiresAt:'2030-01-01T00:00:00.000Z'};
describe('saved WhatsApp review continuation',()=>{
 it('offers only an unexpired original checkpoint to its creator',()=>{
  expect(continuationForSavedMessage({id,role:'assistant',contentJson:checkpoint},'user','agent',Date.parse('2029-01-01'))).toBe(id);
  expect(continuationForSavedMessage({id,role:'assistant',contentJson:checkpoint},'other','agent',Date.parse('2029-01-01'))).toBeNull();
  expect(continuationForSavedMessage({id,role:'assistant',contentJson:checkpoint},'user','other',Date.parse('2029-01-01'))).toBeNull();
  expect(continuationForSavedMessage({id,role:'assistant',contentJson:checkpoint},'user','agent',Date.parse('2031-01-01'))).toBeNull();
  expect(continuationForSavedMessage({id,role:'user',contentJson:checkpoint},'user','agent',Date.parse('2029-01-01'))).toBeNull();
 });
 it('never offers a continuation when an outcome was already recorded',()=>{
  expect(continuationForSavedMessage({id,role:'assistant',contentJson:{...checkpoint,operation:{state:'outcome_unknown'}}},'user','agent',Date.parse('2029-01-01'))).toBeNull();
 });
 it('only offers an unfinished checkpoint returned by the host turn',()=>{
  expect(continuationForTurn({checkpointRef:id,operation:null,needsRefresh:false})).toBe(id);
  expect(continuationForTurn({checkpointRef:id,operation:{state:'pending_approval'},needsRefresh:false})).toBeNull();
  expect(continuationForTurn({checkpointRef:id,operation:null,needsRefresh:true})).toBeNull();
  expect(continuationForTurn({checkpointRef:'not-a-checkpoint',operation:null,needsRefresh:false})).toBeNull();
 });
});
