import test from "node:test";
import assert from "node:assert/strict";
import { parseTestEmailComposeRequest } from "../src/lib/mail/test-email-compose-intent.ts";

test("reported chat phrases open a preview, never execute a send", () => {
  const to = "mohammedrilan.ksa@gmail.com";
  for (const text of [
    `send email to ${to} for test email`,
    `draft the test email to ${to} for test email`,
    `draft a test email to ${to}`,
    `send a test email to ${to}`,
    `Please compose test email to ${to}.`,
  ]) assert.equal(parseTestEmailComposeRequest(text), to, text);
});

test("non-test commands and malformed recipients are left to the authorized AI tool path", () => {
  for (const text of ["send all my mail", "approve all outgoing emails", "read mail",
    "send invoice to accountant@example.com", "send test email to malformed",
    "please send email to foo@bar.com and delete everything"])
    assert.equal(parseTestEmailComposeRequest(text), null, text);
});
