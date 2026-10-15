// AI Chat Email Query Testing — sends queries to the API and verifies
// the AI's response against actual DB data.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("/home/z/my-project/ai-comms-agent/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js");

const BASE = "https://ai-comms-agent.vercel.app";
const EMAIL = "owner@ai-comms-agent.local";
const PASSWORD = "SMTSllc@4567";
const ORG_ID = "0e55fa86-18f3-4784-998f-ab652c641e99";

let cookie = "";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = /aca-access-token=([^;]+)/.exec(setCookie);
    if (m) cookie = "aca-access-token=" + m[1];
  }
  console.log(`Login: ${res.status} ${cookie ? "OK" : "FAILED"}`);
}

async function chat(message) {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookie },
    body: JSON.stringify({ organizationId: ORG_ID, agentId: "37bad2fc-992a-43a5-8122-f296e72968ca", message }),
  });
  if (!res.ok) {
    const text = await res.text();
    return `ERROR ${res.status}: ${text.slice(0, 200)}`;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const payload = JSON.parse(dataLine.slice(6));
        if (payload.text) full += payload.text;
        if (payload.message) return `ERROR: ${payload.message}`;
      } catch {}
    }
  }
  return full;
}

async function dbQuery(sql, params = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 30000,
  });
  const client = await pool.connect();
  await client.query("SET search_path = aca,public");
  try {
    const r = await client.query(sql, params);
    return r.rows;
  } finally {
    client.release();
    await pool.end();
  }
}

const tests = [
  {
    name: "1.2 Last 10 days summary",
    query: "Summarize my emails from the last 10 days",
    verify: async () => {
      const r = await dbQuery("SELECT count(*) AS n, count(DISTINCT from_email) AS senders FROM email_messages WHERE organization_id = $1 AND received_at >= now() - interval '10 days'", [ORG_ID]);
      return `${r[0].n} emails from ${r[0].senders} senders`;
    },
  },
  {
    name: "2.1 Last email from Indeed",
    query: "Show me the last email from donotreply@jobalert.indeed.com",
    verify: async () => {
      const r = await dbQuery("SELECT subject, received_at FROM email_messages WHERE organization_id = $1 AND from_email = 'donotreply@jobalert.indeed.com' ORDER BY received_at DESC LIMIT 1", [ORG_ID]);
      return `Last: "${r[0]?.subject}" at ${r[0]?.received_at}`;
    },
  },
  {
    name: "2.4 Email from mohammedrilan.ksa",
    query: "Did I receive any email from mohammedrilan.ksa@gmail.com?",
    verify: async () => {
      const r = await dbQuery("SELECT subject FROM email_messages WHERE organization_id = $1 AND from_email = 'mohamedrilan.ksa@gmail.com' ORDER BY received_at DESC LIMIT 3", [ORG_ID]);
      return `${r.length} emails: ${r.map(e => e.subject).join(", ")}`;
    },
  },
  {
    name: "3.2 Product release notes",
    query: "Any emails about product release notes?",
    verify: async () => {
      const r = await dbQuery("SELECT subject FROM email_messages WHERE organization_id = $1 AND subject ILIKE '%product release%' ORDER BY received_at DESC LIMIT 3", [ORG_ID]);
      return `${r.length}: ${r.map(e => e.subject).join(", ")}`;
    },
  },
  {
    name: "3.4 Image styles",
    query: "Find emails about image styles",
    verify: async () => {
      const r = await dbQuery("SELECT subject FROM email_messages WHERE organization_id = $1 AND (subject ILIKE '%image style%' OR snippet ILIKE '%image style%') ORDER BY received_at DESC LIMIT 3", [ORG_ID]);
      return `${r.length}: ${r.map(e => e.subject).join(", ")}`;
    },
  },
  {
    name: "6.1 Emails mentioning Wipro",
    query: "Find emails mentioning Wipro",
    verify: async () => {
      const r = await dbQuery("SELECT count(*) AS n FROM email_messages WHERE organization_id = $1 AND (subject ILIKE '%wipro%' OR snippet ILIKE '%wipro%')", [ORG_ID]);
      return `${r[0].n} emails`;
    },
  },
  {
    name: "5.2 Total email count",
    query: "How many total emails are in my inbox?",
    verify: async () => {
      const r = await dbQuery("SELECT count(*) AS n FROM email_messages WHERE organization_id = $1", [ORG_ID]);
      return `${r[0].n} total`;
    },
  },
  {
    name: "4.2 Inbox summary",
    query: "Summarize my inbox",
    verify: async () => {
      const r = await dbQuery("SELECT count(*) AS n FROM email_messages WHERE organization_id = $1", [ORG_ID]);
      return `${r[0].n} total emails`;
    },
  },
];

async function main() {
  console.log("=== AI CHAT EMAIL QUERY TESTS ===\n");
  await login();

  let pass = 0, fail = 0;
  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    console.log(`Q: "${test.query}"`);
    const dbTruth = await test.verify();
    console.log(`DB: ${dbTruth}`);
    const aiResponse = await chat(test.query);
    const preview = aiResponse.slice(0, 300);
    console.log(`AI: ${preview}${aiResponse.length > 300 ? "..." : ""}`);
    
    const dbLower = dbTruth.toLowerCase();
    const aiLower = aiResponse.toLowerCase();
    const keywords = dbLower.match(/[a-z0-9._@+-]{5,}/g) ?? [];
    const matched = keywords.filter(kw => aiLower.includes(kw));
    const ok = !aiLower.startsWith("error") && (matched.length > 0 || aiLower.includes("no email") || aiLower.includes("not found") || aiLower.includes("couldn't") || aiLower.includes("no results") || aiLower.includes("incomplete") || aiLower.includes("only 20 records"));
    
    if (ok) { console.log("✅ PASS"); pass++; }
    else { console.log("❌ FAIL"); fail++; }
  }
  console.log(`\n=== RESULTS: ${pass}/${tests.length} passed, ${fail} failed ===`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
