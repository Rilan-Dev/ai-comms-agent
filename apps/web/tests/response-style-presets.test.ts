import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {responseStylePresets,applyResponseStylePreset} from "../src/lib/agents/response-style-presets";

test("business style templates are visible and editable without replacing custom agent instructions",()=>{
 const original="You serve the ELV sales team. Use only approved tools and cite the inbox.";
 const styled=applyResponseStylePreset(original,"executive");
 assert.ok(styled.startsWith(original));
 assert.match(styled,/WHATSAPP:/);
 assert.match(styled,/CHAT:/);
 assert.match(styled,/EVIDENCE:/);
 assert.match(styled,/\*bold\*/);
 assert.doesNotMatch(styled,/Use (red|blue|green) fonts/);
 assert.equal((styled.match(/\[RESPONSE PRESENTATION — EDITABLE\]/g)||[]).length,1);
});
test("switching style replaces only its own section, with no duplicated headers or lost policy",()=>{
 const original="You must answer in English and never send email automatically.";
 const first=applyResponseStylePreset(original,"executive");
 const next=applyResponseStylePreset(first,"plain");
 assert.match(next,/Minimal formal/);
 assert.ok(next.startsWith(original));
 assert.doesNotMatch(next,/Executive business briefing/);
 assert.equal((next.match(/\[RESPONSE PRESENTATION — EDITABLE\]/g)||[]).length,1);
 assert.equal(applyResponseStylePreset(next,"plain"),next);
});
test("all presets specify supported WhatsApp formatting or plain-text behavior",()=>{
 assert.deepEqual(Object.keys(responseStylePresets),["executive","concise","plain"]);
 assert.match(responseStylePresets.executive.instructions,/single asterisk/);
 assert.match(responseStylePresets.plain.instructions,/Do not use emojis/);
});
test("agent UI exposes response preset editor and existing config workflow save",()=>{
 const src=readFileSync(new URL("../src/app/agents/[id]/agent-ai-settings-panel.tsx",import.meta.url),"utf8");
 assert.match(src,/applyResponseStylePreset\(base,selectedPresentation\)/);
 assert.match(src,/configurationEditor\?\.markDirty\('ai'\)/);
 assert.match(src,/configurationEditor\.save\('ai'/);
 assert.match(src,/Review the editable system prompt/);
});
