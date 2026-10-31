import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ImapSmtpAdapter,readImapResponse} from '../src/email/imap-smtp-adapter';

type Snapshot={provider_message_id:string;message_id_header:string|null;is_read:boolean;is_starred:boolean;is_draft:boolean;is_outbound:boolean};
const fetched=(uid:number,flags:string,identity:string)=>{const header=`Message-ID: ${identity}\r\n\r\n`;return `* 1 FETCH (UID ${uid} FLAGS (${flags}) BODY[HEADER.FIELDS (MESSAGE-ID)] {${Buffer.byteLength(header)}}\r\n${header}\r\n)`;};
function fixture(response:string[]){
  const adapter=new ImapSmtpAdapter();const commands:string[]=[];
  const stub=adapter as unknown as {ensureConnected:()=>unknown;command:(value:string)=>Promise<string[]>;getMessageFlags:(ids:string[])=>Promise<Snapshot[]>};
  stub.ensureConnected=()=>({imap:{}});
  stub.command=async value=>{commands.push(value);if(value.startsWith('SELECT '))return ['* OK [UIDVALIDITY 124]'];if(value.startsWith('UID FETCH '))return response;throw Error('Unexpected body retrieval');};
  return {adapter:stub,commands};
}
test('existing IMAP UIDs refresh Seen and Flagged using headers and flags without MIME bodies',async()=>{
  const {adapter,commands}=fixture([fetched(12,'\\Seen \\Flagged','<one@test>'),fetched(13,'','<two@test>')]);
  assert.deepEqual(await adapter.getMessageFlags(['INBOX:12','INBOX:13']),[
    {provider_message_id:'INBOX:12',message_id_header:'<one@test>',is_read:true,is_starred:true,is_draft:false,is_outbound:false},
    {provider_message_id:'INBOX:13',message_id_header:'<two@test>',is_read:false,is_starred:false,is_draft:false,is_outbound:false},
  ]);
  assert.deepEqual(commands,['SELECT "INBOX"','UID FETCH 12,13 (UID FLAGS BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])']);
});
test('a reused UID reports its current RFC identity rather than assuming the former message',async()=>{
  const {adapter}=fixture([fetched(12,'\\Seen','<replacement@test>')]);
  assert.equal((await adapter.getMessageFlags(['INBOX:12']))[0]?.message_id_header,'<replacement@test>');
});
test('successful empty FETCH is distinct from malformed metadata and transport failure',async()=>{
  assert.deepEqual(await fixture([]).adapter.getMessageFlags(['INBOX:12']),[]);
  await assert.rejects(fixture(['* 1 FETCH (UID 12 BODY[HEADER.FIELDS (MESSAGE-ID)] {0}',')']).adapter.getMessageFlags(['INBOX:12']),/flags/i);
  const {adapter}=fixture([]);adapter.command=async()=>{throw Error('Connection lost');};
  await assert.rejects(adapter.getMessageFlags(['INBOX:12']),/Connection lost/);
});
test('metadata reads are bounded, reject invalid UID syntax before I/O and preserve colons in folder names',async()=>{
  const {adapter,commands}=fixture([]);
  await assert.rejects(adapter.getMessageFlags(Array.from({length:201},(_,i)=>`INBOX:${i+1}`)),/200|bound/i);
  await assert.rejects(adapter.getMessageFlags(['INBOX:12 STORE 1:* +FLAGS (\\Seen)']),/identifier|UID/i);
  assert.deepEqual(commands,[]);
  await adapter.getMessageFlags(['Project:A:12']);
  assert.equal(commands[0],'SELECT "Project:A"');
});
test('metadata literals are rejected before oversized header payloads are read',async()=>{
  const reader={socket:new EventEmitter() as never,buffer:Buffer.from('* 1 FETCH (BODY[HEADER.FIELDS (MESSAGE-ID)] {65537}\r\n')};
  const bounded=readImapResponse as (reader:Parameters<typeof readImapResponse>[0],timeout:number,limit:number)=>Promise<string>;
  await assert.rejects(bounded(reader,5,65536),/metadata safety limit/);
});
