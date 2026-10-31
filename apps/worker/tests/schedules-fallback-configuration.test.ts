import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateScheduleFallback} from "../src/agent/schedules-tool-runtime";

test("schedules accept explicit deterministic fallback, reject invalid configs, and allow explicit opt-out",()=>{
 const opt={mode:"deterministic_whatsapp_digest",lookbackHours:24,recipientPhone:"+919629534701"};
 assert.deepEqual(validateScheduleFallback(opt),{valid:true,value:opt});
 assert.deepEqual(validateScheduleFallback({mode:"none"}),{valid:true,value:null});
 assert.deepEqual(validateScheduleFallback(undefined),{valid:true,value:null});
 for(const value of [{mode:"none",recipientPhone:"+919629534701"},{mode:"deterministic_whatsapp_digest"},
   {mode:"deterministic_whatsapp_digest",lookbackHours:24,recipientPhone:"not-a-number"}]){
   assert.equal(validateScheduleFallback(value).valid,false);
 }
});
test("chat-accessible schedule create/update schemas expose the explicit fallback option",()=>{
 const src=readFileSync(new URL("../src/agent/schedules-tool-runtime.ts",import.meta.url),"utf8");
 assert.equal((src.match(/fallback: fallbackSchema,/g)||[]).length,2);
 assert.match(src,/params: \{ task: input\.task\.trim\(\)\.slice\(0, 4000\),/);
 assert.match(src,/selectedFallback\.value\?\{fallback:selectedFallback\.value,allowedTools:DIGEST_ALLOWED_TOOLS\}/);
});
test("editing task or timing preserves existing fallback, scoped tools and unrelated params",()=>{
 const src=readFileSync(new URL("../src/agent/schedules-tool-runtime.ts",import.meta.url),"utf8");
 assert.match(src,/input\.fallback===undefined\?existing\.params\?\.fallback:input\.fallback/);
 assert.match(src,/\{\.\.\.existing\.params,task:nextTask\}/);
 assert.match(src,/if\(input\.fallback!==undefined\)/);
 assert.match(src,/else delete updatedParams\.fallback/);
 assert.match(src,/params: updatedParams/);
});
