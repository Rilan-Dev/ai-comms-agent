import {describe,expect,it} from "vitest";
describe("recipient directory contract",()=>{
 it("retains explicit owner and organization scoping in queries and identity guards",async()=>{
  const {readFileSync}=await import("node:fs");
  const sql=readFileSync(new URL("../../../../supabase/migrations/0062_personal_whatsapp_recipients.sql",import.meta.url),"utf8");
  const route=readFileSync(new URL("../src/app/api/organizations/[orgId]/recipient-directory/route.ts",import.meta.url),"utf8");
  expect(sql).toContain("owner_user_id uuid NOT NULL");
  expect(sql).toContain("personal_whatsapp_recipients_personal_role_unique");
  expect(route).toContain("owner_user_id=$2");
  expect(route).toContain("assertSameOrigin(request)");
  expect(route).toContain('permission:"email.read"');
  expect(route).toContain('permission:"whatsapp.read"');
 });
});
