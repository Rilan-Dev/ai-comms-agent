import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as ts from "typescript";

const path = new URL("../src/app/api/mail/actions/route.ts", import.meta.url);
const source = readFileSync(path, "utf8");

describe("FIX-01 mail approval route must be a compilable standalone TypeScript module", () => {
  const parsed = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (parsed as ts.SourceFile & { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];

  it("has no parser errors at any point, including the POST/PATCH boundary", () => {
    expect(diagnostics.map(item => {
      const position = parsed.getLineAndCharacterOfPosition(item.start ?? 0);
      return `${position.line + 1}:${position.character + 1} ${ts.flattenDiagnosticMessageText(item.messageText, " ")}`;
    })).toEqual([]);
  });

  it("keeps a closed recipient validator and three independent exported methods", () => {
    const functions = parsed.statements.filter(ts.isFunctionDeclaration);
    expect(functions.map(item => item.name?.text)).toEqual([
      "validRecipients", "POST", "PATCH", "GET",
    ]);
    const validator = functions[0];
    expect(validator?.body?.statements.some(statement => ts.isReturnStatement(statement))).toBe(true);
    for (const name of ["POST", "PATCH", "GET"]) {
      const handler = functions.find(item => item.name?.text === name);
      expect(handler?.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)).toBe(true);
      expect(handler?.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)).toBe(true);
    }
  });

  it("preserves same-origin guards, human approval and recipient validation", () => {
    expect(source).toContain("assertSameOrigin(request)");
    expect(source).toContain('permission: "email.write"');
    expect(source).toContain('permission: "organization.update"');
    expect(source).toContain("matchesManualComposeReview(snapshot, body.expectedSnapshot)");
    expect(source).toContain("const to = validRecipients(draft.to_recipients)");
    expect(source).toContain("decideEmailAction(");
    expect(source).not.toContain("sendDraft(");
  });
});
