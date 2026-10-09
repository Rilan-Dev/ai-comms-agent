import * as net from "node:net";
import * as tls from "node:tls";

type RedisUrl = { host: string; port: number; username?: string; password?: string; database: number; secure: boolean };

function parseRedisUrl(raw: string): RedisUrl {
  const url = new URL(raw);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") throw new Error("REDIS_URL must use redis:// or rediss://");
  const databaseText = url.pathname.replace(/^\//, "");
  const database = databaseText ? Number(databaseText) : 0;
  if (!url.hostname || !Number.isInteger(database) || database < 0) throw new Error("REDIS_URL contains an invalid host or database");
  return { host: url.hostname, port: Number(url.port || 6379), username: url.username ? decodeURIComponent(url.username) : undefined, password: url.password ? decodeURIComponent(url.password) : undefined, database, secure: url.protocol === "rediss:" };
}

function encodeCommand(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

async function redisCommand(url: RedisUrl, args: string[]): Promise<string> {
  const socket = url.secure ? tls.connect({ host: url.host, port: url.port, servername: url.host, rejectUnauthorized: true }) : net.createConnection({ host: url.host, port: url.port });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("Redis connection timeout")), 3000);
      const finish = (error?: Error) => { clearTimeout(timer); socket.off("error", onError); if (error) reject(error); else resolve(); };
      const onConnect = () => finish();
      const onError = (error: Error) => finish(error);
      if (url.secure) (socket as tls.TLSSocket).once("secureConnect", onConnect);
      else (socket as net.Socket).once("connect", onConnect);
      socket.once("error", onError);
    });
    const command = async (parts: string[]) => {
      socket.write(encodeCommand(parts));
      return new Promise<string>((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        const timer = setTimeout(() => finish(new Error("Redis command timeout")), 3000);
        const onData = (chunk: Buffer) => { buffer = Buffer.concat([buffer, chunk]); const end = buffer.indexOf("\r\n"); if (end < 0) return; const line = buffer.subarray(0, end).toString("utf8"); if (line.startsWith("-")) return finish(new Error("Redis command rejected: " + line.slice(1, 201))); finish(undefined, line); };
        const onError = (error: Error) => finish(error);
        const finish = (error?: Error, value?: string) => { clearTimeout(timer); socket.off("data", onData); socket.off("error", onError); if (error) reject(error); else resolve(value ?? ""); };
        socket.on("data", onData); socket.once("error", onError);
      });
    };
    if (url.password) await command(url.username ? ["AUTH", url.username, url.password] : ["AUTH", url.password]);
    if (url.database > 0) await command(["SELECT", String(url.database)]);
    return await command(args);
  } finally { socket.destroy(); }
}

export async function acquireRedisLease(rawUrl: string, key: string, token: string, ttlMs: number): Promise<boolean> {
  const response = await redisCommand(parseRedisUrl(rawUrl), ["SET", key, token, "NX", "PX", String(ttlMs)]);
  return response === "+OK";
}

export async function releaseRedisLease(rawUrl: string, key: string, token: string): Promise<void> {
  const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
  await redisCommand(parseRedisUrl(rawUrl), ["EVAL", script, "1", key, token]);
}
