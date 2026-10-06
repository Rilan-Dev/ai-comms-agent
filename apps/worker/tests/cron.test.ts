import { describe, expect, it } from "vitest";
import { matchesCron, nextCronFire } from "../src/scheduling/cron";

describe("cron scheduler",()=>{
  it("matches a five-field cron in the requested timezone",()=>{
    const d=new Date("2026-10-06T09:30:00.000Z");
    expect(matchesCron("0 15 * * *",d,"Asia/Kolkata")).toBe(true);
  });
  it("finds the next matching minute",()=>{
    const d=new Date("2026-10-06T09:31:00.000Z");
    expect(nextCronFire("0 15 * * *",d,"Asia/Kolkata").toISOString()).toBe("2026-10-07T09:30:00.000Z");
  });
});
