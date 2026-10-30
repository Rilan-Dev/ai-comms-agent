import {describe,it,expect} from "vitest";
// Source-level guard: this test checks the two runtime execution paths expand
// references before handing instructions to any privileged agent tooling.
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const source=(path:string)=>readFileSync(new URL(path,root),"utf8");
describe("account mentions in AI execution",()=>{
 it("rejects stale saved WhatsApp recipients rather than silently falling back",()=>{
  const resolver=source("../../packages/db/src/automation/mention-resolver.ts");
  expect(resolver).toContain("owner_user_id=$2");
  expect(resolver).toContain("deleted_at IS NULL");
  expect(resolver).toContain('status=\\'active\\'');
  expect(resolver).toContain("The mentioned WhatsApp sending account is unavailable or disconnected.");
 });
 it("expands mentions inside interactive chat and scheduled worker, without changing send grants",()=>{
  expect(source("src/app/api/chat/stream/route.ts")).toContain("expandAuthorizedMentions({organizationId,userId:subject.user.id,text:content})");
  expect(source("../../apps/worker/src/agent/scheduled-agent-runtime.ts")).toContain("expandAuthorizedMentions({organizationId:args.organizationId");
 });
});
