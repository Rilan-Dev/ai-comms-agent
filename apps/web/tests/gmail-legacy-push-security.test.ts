import {expect,it,vi} from "vitest";
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock("@ai-comms-agent/db",()=>({query}));
import {POST as oldPush} from "../src/app/api/gmail/push/route";
import {POST as securePush} from "../src/app/api/webhooks/gmail/route";
it("legacy Gmail push is the same authenticated handler as the canonical endpoint",async()=>{
 expect(oldPush).toBe(securePush);
 const request=new Request("https://aca.starcitytechnical.com/api/gmail/push",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({message:{data:Buffer.from(JSON.stringify({emailAddress:"protected@example.test",historyId:"999999999"})).toString("base64"),messageId:"test"}})
 });
 const response=await oldPush(request);
 expect(response.status).toBe(401);
 expect(query).not.toHaveBeenCalled();
});
