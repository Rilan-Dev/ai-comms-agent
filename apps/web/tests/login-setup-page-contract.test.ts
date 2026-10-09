import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const login = readFileSync(resolve(process.cwd(), "src/app/login/page.tsx"), "utf8");
const setup = readFileSync(resolve(process.cwd(), "src/app/setup/page.tsx"), "utf8");

test("login preserves the server authentication flow and safe local redirect handling", () => {
  assert.match(login, /fetch\("\/api\/auth\/login"/);
  assert.match(login, /next\.startsWith\("\/"\) && !next\.startsWith\("\/\/"\)/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /role="alert"/);
});

test("setup preserves bootstrap-secret and first-owner provisioning safeguards", () => {
  assert.match(setup, /fetch\("\/api\/auth\/bootstrap"/);
  assert.match(setup, /type="password" autoComplete="off" required/);
  assert.match(setup, /minLength=\{12\}/);
  assert.match(setup, /pattern="\[a-z0-9\]\[a-z0-9\\-\]\{2,62\}"/);
  assert.match(setup, /role="alert"/);
});

test("auth pages import Lucide icon names only once and keep responsive workspace styling", () => {
  assert.equal(login.split('import { ArrowRight, ShieldCheck } from "lucide-react";').length - 1, 1);
  assert.equal(setup.split('import { ArrowRight, CheckCircle2, KeyRound } from "lucide-react";').length - 1, 1);
  assert.match(login, /max-w-md/);
  assert.match(setup, /sm:grid-cols-2/);
});
