import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const run=readFileSync(new URL("../src/agent/scheduled-agent-runtime.ts",import.meta.url),"utf8");
const worker=readFileSync(new URL("../src/scheduling/scheduler-worker.ts",import.meta.url),"utf8");
const fallback=readFileSync(new URL("../src/agent/scheduled-digest-fallback-runtime.ts",import.meta.url),"utf8");
test("fallback is passed only for explicitly configured schedules and cannot replace ordinary model use",()=>{
 assert.match(worker,/hasOwnProperty\.call\(job\.params,'fallback'\)/);
 assert.match(run,/parseDigestFallback\(args\.fallback\)/);
 assert.match(run,/if\(fallback && isEligibleDigestProviderFailure\(error\)/);
});
test("fallback never calls an agent's tool that is not in this run's current allowlist",()=>{
 assert.match(fallback,/needed\.some\(name=>!args\.availableTools\.some/);
 assert.match(fallback,/invokeEmailReadTool\(args\.emailRuntime/);
 assert.match(fallback,/invokeWhatsAppTool\(args\.whatsappRuntime/);
});
test("fallback checks durable action correlation and previous WhatsApp calls to refuse duplicate sends",()=>{
 assert.match(fallback,/whatsapp_send_actions WHERE organization_id=\$1 AND correlation_id=\$2/);
 assert.match(fallback,/action\.rows\.length\|\|calls\.some\(call=>call\.name==="whatsapp.send"\)/);
});
