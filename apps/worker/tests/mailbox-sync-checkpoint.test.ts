import assert from "node:assert/strict";
import test from "node:test";
import {
  successfullyPersistedMessageIds,
  unavailableMessageIds,
} from "../src/email/mailbox-sync-checkpoint.ts";

test("only acknowledges message IDs whose database persistence succeeded", () => {
  const messages = [
    { id: "saved-1", message: { subject: "Persisted" } },
    { id: "failed-1", message: { subject: "DB write failed" } },
    { id: "missing-1", message: null },
    { id: "saved-2", message: { subject: "Persisted too" } },
  ];

  assert.deepEqual(
    successfullyPersistedMessageIds(messages, [true, false, false, true]),
    ["saved-1", "saved-2"],
  );
  assert.deepEqual(unavailableMessageIds(messages), ["missing-1"]);
});

test("a persistence failure stays pending instead of being treated as a successful sync", () => {
  const messages = [{ id: "retry-me", message: { subject: "Must retry" } }];

  assert.deepEqual(successfullyPersistedMessageIds(messages, [false]), []);
  assert.deepEqual(unavailableMessageIds(messages), []);
});
