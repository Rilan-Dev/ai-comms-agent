import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({
 query:vi.fn(),load:vi.fn(),save:vi.fn(),authorize:vi.fn(),origin:vi.fn(),
}));
vi.mock("@ai-comms-agent/db",()=>({
 query:m.query, parseCredentialsMasterKey:()=>Buffer.alloc(32),
 PostgresEmailAccountRepository:class{
   loadCredentials=m.load;saveCredentials=m.save;
 },
}));
vi.mock("@/lib/identity/authorization",()=>({
 authorize:m.authorize,authorizationErrorToResponse:(error:unknown)=>new Response(
 JSON.stringify({error:error instanceof Error?error.name:"error"}),{status:403}),
}));
vi.mock("@/lib/identity/repository",()=>({
 getIdentityAdapter:()=>({}),getIdentityRepository:()=>({}),
}));
vi.mock("@/lib/identity/local-auth",()=>({assertSameOrigin:m.origin}));
import {POST} from "../src/app/api/gmail/watch/route";

const org="11111111-1111-4111-8111-111111111111", account="22222222-2222-4222-8222-222222222222";
const request=()=>new Request("https://aca.starcitytechnical.com/api/gmail/watch",{
 method:"POST",headers:{"content-type":"application/json",origin:"https://aca.starcitytechnical.com"},
 body:JSON.stringify({organizationId:org,accountId:account}),
});
const envKeys=["DATABASE_URL","CREDENTIALS_MASTER_KEY","GMAIL_PUBSUB_TOPIC","GMAIL_PUBSUB_PUSH_AUDIENCE","GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT"];
const prev:Record<string,string|undefined>={};
beforeEach(()=>{
 vi.clearAllMocks();
 for(const k of envKeys)prev[k]=process.env[k];
 process.env.DATABASE_URL="test-only";
 process.env.CREDENTIALS_MASTER_KEY="test-key";
 process.env.GMAIL_PUBSUB_TOPIC="projects/qa-project/topics/gmail";
 process.env.GMAIL_PUBSUB_PUSH_AUDIENCE="https://aca.starcitytechnical.com/api/webhooks/gmail";
 process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT="gmail-qa@qa-project.iam.gserviceaccount.com";
 m.query.mockResolvedValue({rows:[{id:account,email_address:"test@example.com"}]});
 m.load.mockResolvedValue({credential_type:"oauth_token",access_token:"safe-qa-token",expires_at:new Date(Date.now()+3600e3).toISOString()});
 vi.stubGlobal("fetch",vi.fn(async (url:string)=>{
   if(url.includes("/profile"))return new Response(JSON.stringify({emailAddress:"test@example.com",historyId:"100"}),{status:200});
   if(url.includes("/watch"))return new Response(JSON.stringify({historyId:"200",expiration:String(Date.now()+6*24*3600e3)}),{status:200});
   throw Error("Unexpected outgoing request");
 }));
});
afterEach(()=>{vi.unstubAllGlobals();for(const k of envKeys){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k]!;}});

it("rejects absent OIDC setup before touching the mailbox or initiating a watch",async()=>{
 delete process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT;
 const response=await POST(request());
 expect(response.status).toBe(503);
 expect(m.query).not.toHaveBeenCalled();
 expect(fetch).not.toHaveBeenCalled();
});
it("requires same-origin mutation protections",async()=>{
 m.origin.mockImplementationOnce(()=>{throw new Error("wrong-origin")});
 const result=await POST(request());
 expect(result.status).toBe(403);
 expect(m.query).not.toHaveBeenCalled();
});
it("registers a watch with exact Gmail mailbox and records metadata without skipping unsynced history",async()=>{
 const response=await POST(request());
 expect(response.status).toBe(200);
 const result=await response.json();
 expect(result).toMatchObject({ok:true,pushEndpoint:"https://aca.starcitytechnical.com/api/webhooks/gmail"});
 expect(m.query).toHaveBeenCalledTimes(2);
 const [update,values]=m.query.mock.calls[1]!;
 expect(update).toContain("connection_config");
 expect(update).not.toContain("email_sync_states");
 expect(update).not.toContain("history_id");
 const metadata=JSON.parse(values[0]);
 expect(metadata.gmailWatchHistoryId).toBe("200");
 expect(metadata.gmailWatchExpiresAt).toBeTruthy();
 expect(values.slice(1)).toEqual([account,org]);
 expect(m.save).not.toHaveBeenCalled();
});
it("refuses an authenticated Google mailbox that differs from selected account",async()=>{
 (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
 new Response(JSON.stringify({emailAddress:"wrong@example.com"}),{status:200}));
 const response=await POST(request());
 expect(response.status).toBe(409);
 expect(m.query).toHaveBeenCalledTimes(1);
 expect(m.save).not.toHaveBeenCalled();
});
it("refreshes expired OAuth access, persists it and then registers the watch",async()=>{
 m.load.mockResolvedValueOnce({
 credential_type:"oauth_token",access_token:"expired",expires_at:"2000-01-01T00:00:00Z",
 oauth_client_id:"qa",oauth_client_secret:"qa-only-secret",refresh_token:"qa-refresh",
 });
 (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url:string)=>{
  if(url.includes("oauth2.googleapis.com/token"))return new Response(JSON.stringify({access_token:"new-qa-token",expires_in:3600}),{status:200});
  if(url.includes("/profile"))return new Response(JSON.stringify({emailAddress:"test@example.com",historyId:"100"}),{status:200});
  if(url.includes("/watch"))return new Response(JSON.stringify({historyId:"200",expiration:String(Date.now()+6*24*3600e3)}),{status:200});
  throw Error("Unexpected outgoing request");
 });
 const result=await POST(request());
 expect(result.status).toBe(200);
 expect(m.save).toHaveBeenCalledTimes(1);
 expect(m.save.mock.calls[0]![2]).toMatchObject({access_token:"new-qa-token",refresh_token:"qa-refresh"});
});
