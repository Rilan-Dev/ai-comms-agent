import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const source = readFileSync(resolve(__dirname, "../src/scheduling/scheduler-worker.ts"), "utf8");

test("scheduled execution success is audit-correlated to its durable run", () => {
  assert.match(source, /eventType:"schedule\.execution\.completed"/);
  assert.match(source, /targetType:"scheduled_run"/);
  assert.match(source, /targetId:job\.runId/);
  assert.match(source, /correlationId:job\.runId/);
});

test("scheduled execution failures are audit-correlated and fail closed", () => {
  assert.match(source, /eventType:"schedule\.execution\.failed"/);
  assert.match(source, /correlationId:job\.runId/);
  assert.match(source, /await failScheduledJobRun\(job\.runId/);
});


test("post-execution audit failures do not reclassify completed scheduled runs", () => {
  const helperStart = source.indexOf("async function recordScheduleAudit(");
  const workerStart = source.indexOf("export async function processScheduledJobs");
  assert.ok(helperStart >= 0 && workerStart > helperStart);
  const helper = source.slice(helperStart, workerStart);
  assert.match(helper, /try\s*\{\s*await recordAuditEvent\(event\)/);
  assert.match(helper, /catch\s*\(/);
  assert.match(helper, /console\.error\(/);
  const worker = source.slice(workerStart);
  assert.doesNotMatch(worker, /await recordAuditEvent\(/);
  const persisted = worker.indexOf("await completeScheduledJobRun(job.runId");
  const counted = worker.indexOf("completed+=1", persisted);
  const optionalAudit = worker.indexOf("await recordScheduleAudit(", persisted);
  assert.ok(persisted >= 0 && counted > persisted && optionalAudit > counted);
});


test("schedule advancement errors after a durable run do not record a second failed execution", () => {
  const worker = source.slice(source.indexOf("export async function processScheduledJobs"));
  const settled = worker.indexOf("await completeScheduledJobRun(job.runId");
  const advanceTry = worker.indexOf("try {\n        const next=job.cron", settled);
  const guardedAdvance = worker.indexOf("await advanceScheduledJob(job.id,job.organizationId,job.nextFireAt,", advanceTry);
  const advanceCatch = worker.indexOf("} catch (advanceError) {", guardedAdvance);
  const failureCatch = worker.indexOf("}catch(error){", advanceCatch);
  assert.ok(settled >= 0 && advanceTry > settled && guardedAdvance > advanceTry && advanceCatch > guardedAdvance);
  assert.ok(failureCatch > advanceCatch);
  assert.match(worker.slice(advanceCatch, failureCatch), /console\.error\(/);
});
