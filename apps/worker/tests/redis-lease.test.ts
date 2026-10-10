import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { acquireRedisLease, releaseRedisLease } from "../src/email/redis-lease";

function readCommand(buffer: Buffer): { args: string[]; consumed: number } | null {
  let offset = 0;
  const line = () => { const end = buffer.indexOf("\r\n", offset); if (end < 0) return null; const value = buffer.subarray(offset, end).toString("utf8"); offset = end + 2; return value; };
  const countLine = line();
  if (!countLine?.startsWith("*")) return null;
  const count = Number(countLine.slice(1));
  const args: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const lengthLine = line();
    if (!lengthLine?.startsWith("$")) return null;
    const length = Number(lengthLine.slice(1));
    if (buffer.length < offset + length + 2) return null;
    args.push(buffer.subarray(offset, offset + length).toString("utf8"));
    offset += length + 2;
  }
  return { args, consumed: offset };
}

async function withFakeRedis(handler: (args: string[]) => string, run: (url: string, commands: string[][]) => Promise<void>) {
  const commands: string[][] = [];
  const server = createServer((socket: Socket) => {
    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        const parsed = readCommand(buffer);
        if (!parsed) break;
        buffer = buffer.subarray(parsed.consumed);
        commands.push(parsed.args);
        socket.write(handler(parsed.args));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake Redis did not bind a TCP port");
  try { await run(`redis://127.0.0.1:${address.port}`, commands); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("Redis lease uses SET NX PX and returns false on contention", async () => {
  let first = true;
  await withFakeRedis(() => { if (first) { first = false; return "+OK\r\n"; } return "$-1\r\n"; }, async (url, commands) => {
    assert.equal(await acquireRedisLease(url, "mailbox:batch", "owner-token", 600000), true);
    assert.equal(await acquireRedisLease(url, "mailbox:batch", "other-token", 600000), false);
    assert.deepEqual(commands[0], ["SET", "mailbox:batch", "owner-token", "NX", "PX", "600000"]);
    assert.deepEqual(commands[1], ["SET", "mailbox:batch", "other-token", "NX", "PX", "600000"]);
  });
});

test("Redis lease release uses token-checked Lua so it cannot delete another owner", async () => {
  await withFakeRedis(() => ":1\r\n", async (url, commands) => {
    await releaseRedisLease(url, "mailbox:batch", "owner-token");
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.[0], "EVAL");
    assert.equal(commands[0]?.[2], "1");
    assert.equal(commands[0]?.[3], "mailbox:batch");
    assert.equal(commands[0]?.[4], "owner-token");
    assert.match(commands[0]?.[1] ?? "", /ARGV\[1\]/);
  });
});

test("Redis lease supports ACL username/password and selects the configured database", async () => {
  await withFakeRedis(() => "+OK\r\n", async (base, commands) => {
    const url = base.replace("redis://", "redis://worker:secret@").concat("/2");
    assert.equal(await acquireRedisLease(url, "mailbox:batch", "owner-token", 600000), true);
    assert.deepEqual(commands.map((args) => args[0]), ["AUTH", "SELECT", "SET"]);
    assert.deepEqual(commands[0], ["AUTH", "worker", "secret"]);
    assert.deepEqual(commands[1], ["SELECT", "2"]);
  });
});

test("Redis lease supports legacy password-only authentication", async () => {
  await withFakeRedis(() => "+OK\r\n", async (base, commands) => {
    const url = base.replace("redis://", "redis://:secret@");
    assert.equal(await acquireRedisLease(url, "mailbox:batch", "owner-token", 600000), true);
    assert.deepEqual(commands.map((args) => args[0]), ["AUTH", "SET"]);
    assert.deepEqual(commands[0], ["AUTH", "secret"]);
  });
});

test("Redis lease supports passwordless servers without sending AUTH", async () => {
  await withFakeRedis(() => "+OK\r\n", async (url, commands) => {
    assert.equal(await acquireRedisLease(url, "mailbox:batch", "owner-token", 600000), true);
    assert.deepEqual(commands, [["SET", "mailbox:batch", "owner-token", "NX", "PX", "600000"]]);
  });
});

test("Redis lease applies the optional key namespace consistently on acquire and release", async () => {
  const previous = process.env.REDIS_KEY_PREFIX;
  process.env.REDIS_KEY_PREFIX = "project-c";
  try {
    await withFakeRedis(() => "+OK\r\n", async (url, commands) => {
      await acquireRedisLease(url, "ai-comms-agent:mailbox-sync:batch", "owner-token", 600000);
      await releaseRedisLease(url, "ai-comms-agent:mailbox-sync:batch", "owner-token");
      assert.equal(commands[0]?.[1], "project-c:ai-comms-agent:mailbox-sync:batch");
      assert.equal(commands[1]?.[4], "project-c:ai-comms-agent:mailbox-sync:batch");
    });
  } finally {
    if (previous === undefined) delete process.env.REDIS_KEY_PREFIX;
    else process.env.REDIS_KEY_PREFIX = previous;
  }
});

test("Redis lease preserves a bounded server error for authentication and ACL diagnosis", async () => {
  await withFakeRedis(() => "-WRONGPASS invalid username-password pair or user is disabled\r\n", async (url) => {
    await assert.rejects(
      acquireRedisLease(url, "mailbox:batch", "owner-token", 600000),
      /Redis command rejected: WRONGPASS/,
    );
  });
});
