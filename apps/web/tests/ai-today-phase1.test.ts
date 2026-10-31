import {describe,expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseAiTodayDays,projectAiTodaySource,buildAiTodayWindow,aiTodayChatHref} from "../src/lib/ai-today/snapshot";
import {AiTodaySnapshotView} from "../src/app/overview/ai-today";

describe("Phase 1: source-grounded executive command center",()=>{
  it("bounds catch-up to explicit 1, 5, 7 or 30 day windows",()=>{
    expect(parseAiTodayDays(null)).toBe(5);
    for(const day of [1,5,7,30]) expect(parseAiTodayDays(String(day))).toBe(day);
    for(const input of ["0","31","999","1.5","NaN","5 days","-1"]) expect(()=>parseAiTodayDays(input)).toThrow();
    expect(buildAiTodayWindow(5,new Date("2026-10-31T12:00:00Z"))).toEqual({from:"2026-10-26T12:00:00.000Z",to:"2026-10-31T12:00:00.000Z"});
  });

  it("makes importance traceable only to persisted flags, never invented AI conclusions",()=>{
    const row={id:"m1",thread_id:"t1",email_account_id:"a1",account_email:"sales@example.test",subject:"<script>alert(1)</script>",snippet:"Please review the quote\nsoon",from_address:"Client",received_at:new Date("2026-10-30T12:00:00Z"),is_read:false,action_required:true,is_starred:false,importance_score:10,action_deadline:null};
    const projected=projectAiTodaySource(row);
    expect(projected).toMatchObject({messageId:"m1",threadId:"t1",priority:"action_required",actionRequired:true,isRead:false});
    expect(projected.snippet).toContain("Please review");
    expect(projectAiTodaySource({...row,action_required:false,is_starred:true}).priority).toBe("starred");
    expect(projectAiTodaySource({...row,action_required:false,is_starred:false,importance_score:0}).priority).toBe("unread");
    expect(projectAiTodaySource({...row,action_required:false,is_starred:false,importance_score:0.8}).priority).toBe("important");
    const html=renderToStaticMarkup(createElement(AiTodaySnapshotView,{snapshot:{windowDays:5,asOf:"2026-10-31T12:00:00Z",connectedMailboxes:1,lastSyncAt:null,totalMatches:1,items:[projected],pendingEmailApprovals:0,pendingWhatsAppApprovals:0,schedules:[]}}));
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("/mail/thread/t1");
    expect(html).toContain("Source-backed");
    expect(html).not.toContain("AI-generated summary");
  });

  it("one-click Chat handoff uses only a validated opaque source ID and never sends",()=>{
    const messageId="10000000-0000-4000-8000-000000000005";
    const target=aiTodayChatHref(messageId);
    const url=new URL(target,"https://localhost");
    expect(url.pathname).toBe("/chat");
    expect(url.searchParams.get("run")).toBe("1");
    expect(url.searchParams.get("prompt")).toContain(messageId);
    expect(url.searchParams.get("prompt")).toContain("Do not send any message");
    expect(aiTodayChatHref("not-a-real-id")).toBe("/chat");
    expect(target).not.toContain("sender@example.test");
  });

  it("keeps private content and retrieval strictly permissioned and bounded",()=>{
    const route=readFileSync(resolve(__dirname,"../src/app/api/ai-today/route.ts"),"utf8");
    expect(route).toContain('permission: "email.read"');
    expect(route.indexOf("await authorize(")).toBeLessThan(route.indexOf("await query<"));
    expect(route).toContain("m.organization_id = $1");
    expect(route).toContain("a.organization_id = $1");
    expect(route).toContain("a.deleted_at IS NULL");
    expect(route).toContain("m.is_draft = false");
    expect(route).toContain("m.is_read = false");
    expect(route).toContain("LIMIT 18");
    expect(route).toContain("created_by=$2");
    expect(route).toContain("access.approvals");
    expect(route).toContain("Cache-Control");
    expect(route).not.toContain("UPDATE email_messages");
    expect(route).not.toContain("INSERT INTO email_actions");
  });
});
