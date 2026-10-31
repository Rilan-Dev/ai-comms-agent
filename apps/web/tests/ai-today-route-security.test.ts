import {beforeEach,afterEach,expect,it,vi} from "vitest";
import {ForbiddenError} from "@ai-comms-agent/shared";

const mocks=vi.hoisted(()=>({authorize:vi.fn(),query:vi.fn()}));
vi.mock("@ai-comms-agent/db",()=>({query:mocks.query}));
vi.mock("@/lib/identity/repository",()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock("@/lib/identity/authorization",async original=>({...await original<object>(),authorize:mocks.authorize}));

const org="10000000-0000-4000-8000-000000000001";
const owner="20000000-0000-4000-8000-000000000002";
const request=(suffix="")=>new Request(`https://localhost/api/ai-today?organizationId=${org}${suffix}`);

beforeEach(()=>{
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL","postgres://unit-test-not-used");
  mocks.authorize.mockResolvedValue({user:{id:owner},permissions:new Set(["organization.read","email.read"])});
  mocks.query.mockResolvedValue({rows:[]});
});
afterEach(()=>vi.unstubAllEnvs());

it("rejects absent email.read before any query, including possible cross-organization mail",async()=>{
  const {GET}=await import("../src/app/api/ai-today/route");
  mocks.authorize.mockRejectedValue(new ForbiddenError("missing_permission"));
  expect((await GET(request("&days=30"))).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});

it("rejects lookback abuse and invalid organization without querying private sources",async()=>{
  const {GET}=await import("../src/app/api/ai-today/route");
  expect((await GET(request("&days=365"))).status).toBe(422);
  expect((await GET(new Request("https://localhost/api/ai-today?organizationId=wrong"))).status).toBe(422);
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.query).not.toHaveBeenCalled();
});

it("returns no mail data without a personal grant; approvals and schedules stay separately scoped",async()=>{
  const {GET}=await import("../src/app/api/ai-today/route");
  const response=await GET(request("&days=5&userId=another&source=all"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body=await response.json();
  expect(body.snapshot).toMatchObject({windowDays:5,agentId:null,agents:[],connectedMailboxes:0,totalMatches:0,items:[]});
  expect(body.snapshot.pendingEmailApprovals).toBeNull();
  expect(mocks.query).toHaveBeenCalledTimes(2);
  expect(mocks.query.mock.calls[0]?.[0]).toContain("briefing_mailbox_grants");
  expect(mocks.query.mock.calls[0]?.[1]).toEqual([org,owner]);
  expect(mocks.query.mock.calls[1]?.[0]).toContain("created_by=$2");
  expect(mocks.query.mock.calls[1]?.[1]).toEqual([org,owner]);

  mocks.authorize.mockResolvedValue({user:{id:owner},permissions:new Set(["email.read","organization.update"])});
  mocks.query.mockClear();
  expect((await GET(request())).status).toBe(200);
  expect(mocks.query).toHaveBeenCalledTimes(3);
  expect(mocks.query.mock.calls[2]?.[1]).toEqual([org,owner]);
});

it("restricts sources, coverage and last-visit history to both user grant and active agent binding",async()=>{
  const agent="30000000-0000-4000-8000-000000000003";
  const mailbox="40000000-0000-4000-8000-000000000004";
  mocks.query.mockImplementation(async(sql:string,args:unknown[])=>{
    if(sql.includes("SELECT DISTINCT a.id AS agent_id"))
      return {rows:[{agent_id:agent,agent_name:"Finance",mailbox_id:mailbox}]};
    if(sql.includes("WITH scoped AS"))
      return {rows:[{id:"50000000-0000-4000-8000-000000000005",thread_id:"60000000-0000-4000-8000-000000000006",email_account_id:mailbox,account_email:"finance@example.test",from_address:"Sender",subject:"Invoice",snippet:"Follow up",received_at:"2026-10-30T00:00:00Z",is_read:false,action_required:true,is_starred:false,importance_score:null,action_deadline:null,matched_count:"1"}]};
    if(sql.includes("SELECT count(*) AS connected_mailboxes"))return {rows:[{connected_mailboxes:"2",last_sync_at:"2026-10-31T00:00:00Z",oldest_sync_at:"2026-10-29T00:00:00Z",unsynced_mailboxes:"1"}]};
    if(sql.includes("SELECT last_foreground_at"))return {rows:[{last_foreground_at:"2026-10-27T00:00:00Z"}]};
    return {rows:[]};
  });
  const {GET}=await import("../src/app/api/ai-today/route");
  const response=await GET(request("&days=7&agentId="+agent));
  expect(response.status).toBe(200);
  const body=await response.json();
  expect(body.snapshot).toMatchObject({agentId:agent,connectedMailboxes:2,unsyncedMailboxes:1,oldestSyncAt:"2026-10-29T00:00:00.000Z",totalMatches:1,lastVisitAt:"2026-10-27T00:00:00.000Z"});
  expect(body.snapshot.agents).toEqual([{id:agent,name:"Finance",mailboxCount:1}]);
  expect(body.snapshot.items[0].mailboxId).toBe(mailbox);
  expect(mocks.query).toHaveBeenCalledTimes(5);
  const [sourceSql,sourceArgs]=mocks.query.mock.calls[1]!;
  expect(sourceSql).toContain("m.organization_id = $1 AND a.organization_id = $1");
  expect(sourceSql).toContain("g.user_id=$2");
  expect(sourceSql).toContain("g.revoked_at IS NULL");
  expect(sourceSql).toContain("b.agent_id=$3");
  expect(sourceSql).toContain("scoped_agent.status='active'");
  expect(sourceSql).toContain("LIMIT 18");
  expect(sourceArgs.slice(0,3)).toEqual([org,owner,agent]);
  const [coverageSql,coverageArgs]=mocks.query.mock.calls[2]!;
  expect(coverageSql).toContain("briefing_mailbox_grants");
  expect(coverageArgs).toEqual([org,owner,agent]);
  expect(mocks.query.mock.calls[3]?.[1]).toEqual([org,owner,agent]);
  expect(mocks.query.mock.calls[4]?.[1]).toEqual([org,owner]);
  expect(mocks.query.mock.calls.map(call=>String(call[0])).join(" ")).not.toMatch(/UPDATE email_messages|INSERT INTO email_actions|whatsapp\.send/);
});

it("rejects a requested ungranted agent before touching mailbox messages or activity",async()=>{
  const {GET}=await import("../src/app/api/ai-today/route");
  mocks.query.mockResolvedValueOnce({rows:[{agent_id:"30000000-0000-4000-8000-000000000003",agent_name:"Allowed",mailbox_id:"40000000-0000-4000-8000-000000000004"}]});
  const response=await GET(request("&agentId=50000000-0000-4000-8000-000000000005"));
  expect(response.status).toBe(403);
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect((await GET(request("&agentId=not-a-uuid"))).status).toBe(422);
});
