import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isNavigationPathActive } from "../src/lib/navigation-path.ts";

test("home navigation matches only the root and never every descendant", () => {
  assert.equal(isNavigationPathActive("/", "/"), true);
  assert.equal(isNavigationPathActive("/overview", "/"), false);
  assert.equal(isNavigationPathActive("/chat", "/"), false);
});

test("navigation highlights exact routes and real nested paths", () => {
  assert.equal(isNavigationPathActive("/overview", "/overview"), true);
  assert.equal(isNavigationPathActive("/chat", "/chat"), true);
  assert.equal(isNavigationPathActive("/chat/sessions/123", "/chat"), true);
  assert.equal(isNavigationPathActive("/mail/threads/abc", "/mail/threads"), true);
  assert.equal(isNavigationPathActive("/mail/drafts/new", "/mail/drafts"), true);
});

test("segment boundaries prevent sibling-prefix false positives", () => {
  assert.equal(isNavigationPathActive("/chatbot", "/chat"), false);
  assert.equal(isNavigationPathActive("/settings-extra", "/settings"), false);
  assert.equal(isNavigationPathActive("/mail/threads", "/mail/inbox"), false);
  assert.equal(isNavigationPathActive("/not-overview", "/overview"), false);
});

test("the as-const sidebar uses a string-typed path matcher, not an impossible '/' literal comparison", () => {
  const sidebar = readFileSync(new URL("../src/components/sidebar.tsx", import.meta.url), "utf8");
  assert.match(sidebar, /import \{ isNavigationPathActive \} from "@\/lib\/navigation-path"/);
  assert.match(sidebar, /isNavigationPathActive\(pathname, item\.href\)/);
  assert.match(sidebar, /isNavigationPathActive\(pathname, child\.href\)/);
  assert.doesNotMatch(sidebar, /item\.href !== "\/"/);
  assert.match(sidebar, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(sidebar, /aria-expanded=\{mailExpanded\}/);
  assert.match(sidebar, /href: "\/mail\/inbox"/);
});
