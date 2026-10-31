import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({list:vi.fn(),create:vi.fn(),status:vi.fn(),complete:vi.fn(),fail:vi.fn(),dispatch:vi.fn()}));
vi.mock("@ai-comms-agent/db",()=>({
 listActiveAutomationRules:mocks.list,createAutomationRun:mocks.create,
 getAutomationRunStatus:mocks.status,completeAutomationRun:mocks.complete,failAutomationRun:mocks.fail
}));
vi.mock("../../worker/src/agent/execution-dispatcher",()=>({dispatchAgentExecution:mocks.dispatch}));
import {evaluateAutomationEvent} from "../../worker/src/automation/automation-engine";
const org="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("DATABASE_URL","test-only");
 mocks.list.mockResolvedValue([{id:"rule",agentId:"agent",organizationId:org,trigger:{event:"email.received"},conditions:{},actions:[{type:"send_whatsapp"}]}]);
 mocks.create.mockResolvedValue(null);
});
for(const status of ["running","failed",null] as const)it("does not report a collided "+String(status)+" automation as successful",async()=>{
 mocks.status.mockResolvedValue(status);
 const r=await evaluateAutomationEvent({organizationId:org,type:"email.received",payload:{eventId:"stable"}});
 expect(r).toEqual({matched:1,started:0,failed:1});
 expect(mocks.dispatch).not.toHaveBeenCalled();
 expect(mocks.status).toHaveBeenCalledWith("rule","email.received:stable");
});
it("completed existing run remains idempotent and does not replay the action",async()=>{
 mocks.status.mockResolvedValue("completed");
 const r=await evaluateAutomationEvent({organizationId:org,type:"email.received",payload:{eventId:"stable"}});
 expect(r).toEqual({matched:1,started:0,failed:0});
 expect(mocks.dispatch).not.toHaveBeenCalled();
});
