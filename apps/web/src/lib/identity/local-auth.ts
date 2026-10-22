import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { isTrustedRequestOrigin } from "./same-origin-policy";
import type { IdentityAdapter, User } from "@ai-comms-agent/shared";
import { asUserId } from "@ai-comms-agent/shared";
import { PostgresAuthRepository, PostgresIdentityRepository } from "@ai-comms-agent/db";

const scrypt = (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> => new Promise((resolve, reject) => { scryptCallback(password, salt, keylen, options, (error, derivedKey) => { if (error) reject(error); else resolve(derivedKey as Buffer); }); });
export const ACCESS_TOKEN_COOKIE = "aca-access-token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const LOCK_AFTER_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const DUMMY_HASH = "scrypt$32768$8$1$6163612d64756d6d792d73616c742d3136$ef91eeba24935b29ac13ef77e11d8d9faf8bee929cc686ff1f8681f384c3dd86fb25444d09e2b629013faa9005593af2348628c34072fee6dca0e5c1b0b33cc5";

export class LocalIdentityAdapter implements IdentityAdapter {
  private readonly identity = new PostgresIdentityRepository();
  private readonly auth = new PostgresAuthRepository();

  async resolveUser(request: Request): Promise<User | null> {
    const token = parseCookie(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
    if (!token) return null;
    const session = await this.auth.getActiveSession(hashSessionToken(token));
    if (!session) return null;
    const user = await this.identity.getUserById(asUserId(session.userId));
    if (!user || user.status !== "active") {
      await this.auth.revokeSession(session.tokenHash);
      return null;
    }
    await this.auth.touchSession(session.id);
    return user;
  }
}

export interface LoginResult {
  user: User;
  sessionToken: string;
  expiresAt: Date;
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validatePasswordForLogin(input.password);

  const auth = new PostgresAuthRepository();
  const identity = new PostgresIdentityRepository();
  const credential = await auth.getCredentialByEmail(email);
  const now = Date.now();

  if (credential?.lockedUntil && new Date(credential.lockedUntil).getTime() > now) {
    await auth.recordLoginAttempt({ subjectKey: email, succeeded: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
    throw new InvalidCredentialsError();
  }

  const passwordHash = credential?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(input.password, passwordHash);
  const user = credential ? await identity.getUserById(asUserId(credential.userId)) : null;

  if (!credential || !user || user.status !== "active" || !valid) {
    const failures = await auth.countRecentFailures(email, new Date(now - FAILURE_WINDOW_MS)) + 1;
    if (credential) {
      const lockedUntil = failures >= LOCK_AFTER_FAILURES ? new Date(now + LOCK_DURATION_MS) : null;
      await auth.setCredentialLock(credential.userId, failures, lockedUntil);
    }
    await auth.recordLoginAttempt({ subjectKey: email, succeeded: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
    throw new InvalidCredentialsError();
  }

  // Authentication is not sufficient for application access. The protected
  // application boundary also requires an active organization membership.
  // Refuse to mint a session when that authorization context is missing;
  // otherwise the browser reports a successful login and immediately falls
  // back to /login?reason=not_provisioned.
  const memberships = await identity.getMembershipsForUser(user.id);
  if (!memberships.some((item) => item.status === "active")) {
    await auth.recordLoginAttempt({ subjectKey: email, succeeded: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
    throw new AccountNotProvisionedError();
  }

  await auth.setCredentialLock(credential.userId, 0, null);
  await auth.recordLoginAttempt({ subjectKey: email, succeeded: true, ipAddress: input.ipAddress, userAgent: input.userAgent });

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000);
  await auth.createSession({
    userId: credential.userId,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return { user, sessionToken, expiresAt };
}

export async function setPassword(input: { userId: string; password: string }): Promise<void> {
  validatePasswordForCreation(input.password);
  const auth = new PostgresAuthRepository();
  await auth.upsertPassword(input.userId, await hashPasswordForStorage(input.password));
}

export async function changePassword(input: { userId: string; currentPassword: string; newPassword: string; currentSessionTokenHash: string }): Promise<void> {
  validatePasswordForCreation(input.newPassword);
  const auth = new PostgresAuthRepository();
  const credential = await auth.getCredentialByUserId(input.userId);
  if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) {
    throw new InvalidCredentialsError("Current password is incorrect.");
  }
  if (input.currentPassword === input.newPassword) {
    throw new ValidationError("New password must be different from the current password.");
  }
  await auth.upsertPassword(input.userId, await hashPasswordForStorage(input.newPassword));
  await auth.revokeAllUserSessionsExcept(input.userId, input.currentSessionTokenHash);
}

export function getSessionTokenHash(request: Request): string | null {
  const token = parseCookie(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
  return token ? hashSessionToken(token) : null;
}

export async function revokeCurrentSession(request: Request): Promise<void> {
  const token = parseCookie(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
  if (!token) return;
  await new PostgresAuthRepository().revokeSession(hashSessionToken(token));
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(email: string): void {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Enter a valid email address.");
  }
}

export function validatePasswordForLogin(password: string): void {
  if (typeof password !== "string" || password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError("Enter a valid password.");
  }
}

export function validatePasswordForCreation(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (/^[\s]+$/.test(password) || password.includes("\0")) {
    throw new ValidationError("Password contains invalid characters.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ValidationError("Password must contain lowercase, uppercase, and numeric characters.");
  }
}

export class ValidationError extends Error {
  readonly code = "validation_error";
}
export class InvalidCredentialsError extends Error {
  readonly code = "invalid_credentials";
  constructor(message = "Email or password is incorrect.") {
    super(message);
  }
}

export class AccountNotProvisionedError extends Error {
  readonly code = "account_not_provisioned";
  constructor(message = "Your account is not provisioned for an active organization workspace.") {
    super(message);
  }
}

export async function hashPasswordForStorage(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }) as Buffer;
  return `scrypt$32768$8$1$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  const saltHex = parts[4];
  const expectedHex = parts[5];
  if (!saltHex || !expectedHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || salt.length < 16 || expected.length !== 64) return false;
  try {
    const derived = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 }) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function normalizeIpAddress(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  return isIP(candidate) ? candidate : null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function assertSameOrigin(request: Request): void {
  if (!isTrustedRequestOrigin({
    origin: request.headers.get("origin"),
    expectedOrigin: process.env.APP_ORIGIN ?? null,
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    production: process.env.NODE_ENV === "production",
  })) {
    throw new ValidationError("Invalid request origin.");
  }
}
