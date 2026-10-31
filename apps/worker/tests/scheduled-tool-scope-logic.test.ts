import test from "node:test";
import assert from "node:assert/strict";
import {narrowScheduledTools} from "../src/agent/scheduled-tool-scope";

const policyTools=[{name:"email.accounts.list",permission:"email.read"},{name:"email.search",permission:"email.read"},
  {name:"whatsapp.send",permission:"whatsapp.send"},{name:"email.send.request",permission:"email.send"}];
test("no occurrence subset preserves ordinary scheduled tools",()=>{
  const result=narrowScheduledTools(policyTools);
  assert.equal(result.ok,true);
  if(result.ok) assert.deepEqual(result.tools,policyTools);
});
test("an explicit digest subset removes email writing and preserves policy order",()=>{
  const result=narrowScheduledTools(policyTools,["whatsapp.send","email.search","email.accounts.list"]);
  assert.equal(result.ok,true);
  if(result.ok)assert.deepEqual(result.tools.map(tool=>tool.name),
    ["email.accounts.list","email.search","whatsapp.send"]);
  assert.equal(policyTools.length,4,"existing policy remains unchanged");
});
test("empty, malformed, repeated, unknown and revoked names all fail closed",()=>{
  for(const names of [[],null,123,"email.search",[null],["email.search","email.search"],
    ["whatsapp.send","email.passwords.export"],Array(33).fill("email.search")]){
    const result=narrowScheduledTools(policyTools,names);
    assert.equal(result.ok,false,JSON.stringify(names));
  }
});
