import test from "node:test";
import assert from "node:assert/strict";
import { fetchGeminiToolWithRetry, waitForGeminiRetry } from "../src/gemini-tool-retry.ts";

const transient = (status, headers={}) => new Response("provider-demand", {status, headers});

test("503, 503, 200 retries the same provider-only decision", async () => {
  const calls=[], delays=[];
  const response=await fetchGeminiToolWithRetry(async()=> {
    calls.push("model-only");
    return calls.length<3?transient(503):Response.json({ok:true});
  },new AbortController().signal,async ms=>{delays.push(ms);});
  assert.equal(response.status,200);
  assert.equal(calls.length,3);
  assert.deepEqual(delays,[700,1400]);
});

test("429 Retry-After respects the cap", async()=>{
  let count=0;const delays=[];
  const response=await fetchGeminiToolWithRetry(async()=>++count===1?
    transient(429,{"retry-after":"120"}):Response.json({ok:true}),
    new AbortController().signal,async ms=>{delays.push(ms);});
  assert.equal(response.status,200);
  assert.deepEqual(delays,[6000]);
});

test("exhausted 503 fails after only four provider requests", async()=>{
  let count=0;
  await assert.rejects(()=>fetchGeminiToolWithRetry(async()=> {
    count++;return transient(503);
  },new AbortController().signal,async()=>{}),/Gemini tool request failed \(503\)/);
  assert.equal(count,4);
});

test("400, 401, 403, 404, 422 are never retried",async()=>{
  for(const code of [400,401,403,404,422]){
    let calls=0;
    await assert.rejects(()=>fetchGeminiToolWithRetry(async()=>{
      calls++;return transient(code);
    },new AbortController().signal,async()=>{throw Error("unexpected wait");}),e=>e.message.includes("failed ("+code+")"));
    assert.equal(calls,1);
  }
});

test("abort before a call or during backoff prevents another request",async()=>{
  const stopped=new AbortController();stopped.abort();
  let calls=0;
  await assert.rejects(()=>fetchGeminiToolWithRetry(async()=>{calls++;return transient(503);},stopped.signal),{name:"AbortError"});
  assert.equal(calls,0);
  const active=new AbortController();
  await assert.rejects(()=>fetchGeminiToolWithRetry(async()=>{calls++;return transient(503);},
    active.signal,async()=>{active.abort();await waitForGeminiRetry(1,active.signal);}),{name:"AbortError"});
  assert.equal(calls,1);
});
