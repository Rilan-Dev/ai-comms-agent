import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../src/scheduling/scheduler-worker.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../src/agent/scheduled-agent-runtime.ts",import.meta.url),"utf8");
test("scheduler propagates its optional occurrence tool ceiling",()=>{
 assert.match(worker,/allowedToolNames:job\.params\.allowedTools/);
 assert.match(worker,/hasOwnProperty\.call\(job\.params,'allowedTools'\)/);
});
test("scope is validated, narrowed against active allowed tools and never grants permissions",()=>{
 assert.match(runtime,/narrowScheduledTools\(agentTools,args\.allowedToolNames\)/);
 assert.match(runtime,/permissions = \[\.\.\.new Set\(scopedTools\.map/);
 assert.match(runtime,/const availableTools=scopedTools\.filter/);
});
test("host execution additionally checks each model-requested function against the exact scope",()=>{
 assert.match(runtime,/availableTools\.some\(tool=>tool\.name===call\.name\)/);
 assert.match(runtime,/tool_not_in_schedule_scope/);
 assert.match(runtime,/!permittedCall/);
});
