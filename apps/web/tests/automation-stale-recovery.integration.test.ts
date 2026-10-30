import {beforeAll,afterAll,expect,it} from "vitest";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {recoverStaleAutomationRuns,completeAutomationRun,failAutomationRun,getAutomationRunStatus,createAutomationRun} from "../../../packages/db/src/automation/repository";
import {closePostgresPool} from "../../../packages/db/src/client";

const url=process.env.ACA_TEST_DATABASE_URL;
const safe=!!url && /^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:55439\/aca_repair_test$/.test(url);
const pg=createRequire(new URL("../../../packages/db/package.json",import.meta.url))("pg");
const client=new pg.Client({connectionString:url});
beforeAll(async()=>{
 if(!safe) return;
 process.env.DATABASE_URL=url!;
 await client.connect();
 await client.query("DROP SCHEMA IF EXISTS aca CASCADE; CREATE SCHEMA aca");
 await client.query("CREATE TABLE aca.automation_rules (id uuid PRIMARY KEY,organization_id uuid NOT NULL,status text NOT NULL)");
 await client.query("CREATE TABLE aca.automation_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),automation_rule_id uuid NOT NULL,organization_id uuid,trigger_event_key text,status text NOT NULL,triggered_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,result jsonb,error text)");
 await client.query("CREATE UNIQUE INDEX qa_auto_key ON aca.automation_runs(automation_rule_id,trigger_event_key) WHERE trigger_event_key IS NOT NULL");
});
afterAll(async()=>{if(client){await closePostgresPool();await client.end();}});
it.skipIf(!safe)("marks stale legacy rows uncertain, never replays, and fences late completion",async()=>{
 const rule=randomUUID(),org=randomUUID();
 await client.query("INSERT INTO aca.automation_rules(id,organization_id,status) VALUES($1,$2,'active')",[rule,org]);
 const prior=await client.query<{id:string}>("INSERT INTO aca.automation_runs(automation_rule_id,organization_id,trigger_event_key,status,result,created_at) VALUES ($1,$2,'email.received:stable','running','{}',now()-interval '35 minutes') RETURNING id",[rule,org]);
 const runId=prior.rows[0]!.id;
 const live=await client.query<{id:string}>("INSERT INTO aca.automation_runs(automation_rule_id,organization_id,trigger_event_key,status,result,created_at) VALUES ($1,$2,'email.received:current','running','{}',now()) RETURNING id",[rule,org]);
 expect(await getAutomationRunStatus(rule,"email.received:stable")).toBe("running");
 const recovered=await recoverStaleAutomationRuns();
 expect(recovered.map(x=>x.id)).toContain(runId);
 const row=await client.query("SELECT status,result,error FROM aca.automation_runs WHERE id=$1",[runId]);
 expect(row.rows[0].status).toBe("failed");
 expect(row.rows[0].result).toMatchObject({manualVerificationRequired:true,downstreamOutcomeUnknown:true,recoveredStaleExecution:true});
 expect(row.rows[0].error).toMatch(/unknown/i);
 expect(await completeAutomationRun(runId,{status:"completed"})).toBe(false);
 expect(await failAutomationRun(runId,"late failure")).toBe(false);
 expect(await getAutomationRunStatus(rule,"email.received:stable")).toBe("failed");
 expect((await client.query("SELECT status FROM aca.automation_runs WHERE id=$1",[live.rows[0]!.id])).rows[0].status).toBe("running");
 expect(await createAutomationRun(rule,org,{}, "email.received:stable")).toBeNull();
 expect(await recoverStaleAutomationRuns()).toEqual([]);
});

it.skipIf(!safe)("backfills legacy tenant/start fields and makes the DB contract mandatory",async()=>{
 const rule=randomUUID(),org=randomUUID();
 await client.query("INSERT INTO aca.automation_rules(id,organization_id,status) VALUES($1,$2,'active')",[rule,org]);
 const inserted=await client.query("INSERT INTO aca.automation_runs(automation_rule_id,organization_id,status,result,created_at) VALUES($1,NULL,'completed','{}',now()-interval '1 day') RETURNING id",[rule]);
 const migration=readFileSync(new URL("../../../supabase/migrations/0065_automation_run_recovery_contract.sql",import.meta.url),"utf8");
 await client.query("SET search_path=aca,public");
 await client.query(migration);
 const row=await client.query("SELECT organization_id,started_at FROM aca.automation_runs WHERE id=$1",[inserted.rows[0].id]);
 expect(row.rows[0].organization_id).toBe(org);
 expect(row.rows[0].started_at).toBeTruthy();
 await expect(client.query("INSERT INTO aca.automation_runs(automation_rule_id,organization_id,status,result) VALUES($1,NULL,'running','{}')",[rule])).rejects.toMatchObject({code:"23502"});
});
