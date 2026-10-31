import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {aiTodayBriefingChatHref,aiTodayChatHref,projectAiTodaySource,suggestedAiTodayDays,type AiTodaySnapshot} from "../src/lib/ai-today/snapshot";
import {AiTodaySnapshotView} from "../src/app/overview/ai-today";

const m=vi.hoisted(()=>({authorize:vi.fn(),origin:vi.fn(),record:vi.fn()}));
vi.mock("@/lib/identity/repository",()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock("@/lib/identity/authorization",async original=>({...await original<object>(),authorize:m.authorize}));
vi.mock("@/lib/identity/local-auth",()=>({assertSameOrigin:m.origin}));
vi.mock("@ai-comms-agent/db",()=>({recordForegroundActivity:m.record}));
const organizationId="10000000-0000-4000-8000-000000000001";
const agentId="20000000-0000-4000-8000-000000000002";
const userId="30000000-0000-4000-8000-000000000003";
const messageId="40000000-0000-4000-8000-000000000004";
const visit=(body:unknown)=>new Request("http://localhost/api/ai-today/visit",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":"http://localhost"},body:JSON.stringify(body)
});
beforeEach(()=>{vi.resetAllMocks();m.authorize.mockResolvedValue({user:{id:userId}});});
afterEach(()=>vi.unstubAllEnvs());

describe("personal AI Today foreground access",()=>{
  it("records the verified logged-in actor only via the canonical grant-checked database helper",async()=>{
    const {POST}=await import("../src/app/api/ai-today/visit/route");
    const response=await POST(visit({organizationId,agentId}));
    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(m.authorize).toHaveBeenCalledOnce();
    expect(m.record).toHaveBeenCalledOnce();
    expect(m.record).toHaveBeenCalledWith({organizationId,userId,agentId});
  });
  it("refuses forged identifiers, privilege escalation and wrong-origin requests before a DB write",async()=>{
    const {POST}=await import("../src/app/api/ai-today/visit/route");
    for(const body of [
      {organizationId,agentId,userId:"another"},
      {organizationId,agentId,last_foreground_at:"2020-01-01"},
      {organizationId:"not-uuid",agentId},
      {organizationId,agentId:"not-uuid"}
    ])expect((await POST(visit(body))).status).toBe(422);
    m.origin.mockImplementation(()=>{throw Error("cross origin");});
    expect((await POST(visit({organizationId,agentId}))).status).toBe(403);
    expect(m.record).not.toHaveBeenCalled();
  });
  it("does not record visits when authorization fails or the canonical grant is revoked",async()=>{
    const {POST}=await import("../src/app/api/ai-today/visit/route");
    m.authorize.mockRejectedValueOnce(new Error("authorization failure"));
    expect((await POST(visit({organizationId,agentId}))).status).not.toBe(204);
    expect(m.record).not.toHaveBeenCalled();
    m.record.mockRejectedValueOnce(new Error("briefing grant revoked"));
    expect((await POST(visit({organizationId,agentId}))).status).not.toBe(204);
  });
});

describe("returning owner catch-up window",()=>{
  const asOf="2026-10-31T00:00:00Z";
  it("extends only a recorded absence up to the supported 30-day cap",()=>{
    expect(suggestedAiTodayDays(null,asOf)).toBe(5);
    expect(suggestedAiTodayDays("invalid",asOf)).toBe(5);
    expect(suggestedAiTodayDays("2026-10-30T00:00:00Z",asOf)).toBe(5);
    expect(suggestedAiTodayDays("2026-10-25T00:00:00Z",asOf)).toBe(7);
    expect(suggestedAiTodayDays("2026-10-20T00:00:00Z",asOf)).toBe(30);
    expect(suggestedAiTodayDays("2026-09-01T00:00:00Z",asOf)).toBe(30);
    expect(suggestedAiTodayDays("2026-11-01T00:00:00Z",asOf)).toBe(5);
  });
});

describe("personal Chat handoff is bounded, review-only and source-limited",()=>{
  const row={id:messageId,thread_id:"50000000-0000-4000-8000-000000000005",email_account_id:"60000000-0000-4000-8000-000000000006",account_email:"finance@example.test",from_address:"Private Sender",subject:"Secret payroll",snippet:"Sensitive contract",received_at:"2026-10-30T00:00:00Z",is_read:false,action_required:true,is_starred:false,importance_score:null,action_deadline:null};
  const snapshot:AiTodaySnapshot={windowDays:5,asOf:"2026-10-31T00:00:00Z",agentId,agents:[{id:agentId,name:"Finance",mailboxCount:1}],lastVisitAt:"2026-10-20T00:00:00Z",connectedMailboxes:1,lastSyncAt:null,totalMatches:20,items:[projectAiTodaySource(row)],pendingEmailApprovals:0,pendingWhatsAppApprovals:0,schedules:[]};
  it("sends only opaque IDs to Chat, demands new evidence, and prohibits sending",()=>{
    const target=new URL(aiTodayBriefingChatHref(snapshot),"https://localhost");
    expect(target.pathname).toBe("/chat");
    expect(target.searchParams.get("agentId")).toBe(agentId);
    expect(target.searchParams.get("run")).toBe("1");
    const prompt=target.searchParams.get("prompt")??"";
    expect(prompt).toContain(messageId);
    expect(prompt).toContain("20 matched items");
    expect(prompt).toContain("Do not send");
    expect(prompt).toContain("Verify every source");
    expect(target.search).not.toContain("Secret payroll");
    expect(target.search).not.toContain("Private Sender");
    expect(aiTodayChatHref(messageId,agentId)).toContain("agentId="+agentId);
    expect(aiTodayBriefingChatHref({...snapshot,agentId:null})).toBe("/chat");
    expect(aiTodayBriefingChatHref({...snapshot,items:[]})).toBe("/chat");
  });
  it("shows grant-scoped assistant and visit metadata without rendering confidential markup",()=>{
    const html=renderToStaticMarkup(createElement(AiTodaySnapshotView,{snapshot}));
    expect(html).toContain("Previous visit");
    expect(html).toContain("Prepare an AI briefing in Chat");
    expect(html).toContain("finance@example.test");
    expect(html).toContain("only from mailboxes both granted");
    expect(html).not.toContain("No matching");
  });
});
