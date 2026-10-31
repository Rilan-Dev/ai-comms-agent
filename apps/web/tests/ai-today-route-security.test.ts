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

it("only returns the current user scoped schedule; approvals are independent permission-gated",async()=>{
  const {GET}=await import("../src/app/api/ai-today/route");
  const response=await GET(request("&days=5&userId=another&source=all"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body=await response.json();
  expect(body.snapshot.windowDays).toBe(5);
  expect(body.snapshot.pendingEmailApprovals).toBeNull();
  expect(body.snapshot.pendingWhatsAppApprovals).toBeNull();
  expect(mocks.query).toHaveBeenCalledTimes(3);
  const [sources,sourceArgs]=mocks.query.mock.calls[0]!;
  expect(sourceArgs[0]).toBe(org);
  expect(sourceArgs).toHaveLength(3);
  expect(sources).toMatch(/m\.organization_id = \$1 AND a\.organization_id = \$1/);
  expect(sources).toMatch(/LIMIT 18/);
  const [schedules,scheduleArgs]=mocks.query.mock.calls[2]!;
  expect(schedules).toContain("created_by=$2");
  expect(scheduleArgs).toEqual([org,owner]);

  mocks.authorize.mockResolvedValue({user:{id:owner},permissions:new Set(["email.read","organization.update"])});
  mocks.query.mockClear();
  const granted=await GET(request());
  expect(granted.status).toBe(200);
  expect(mocks.query).toHaveBeenCalledTimes(4);
  expect(mocks.query.mock.calls[3]?.[1]).toEqual([org,owner]);
});
