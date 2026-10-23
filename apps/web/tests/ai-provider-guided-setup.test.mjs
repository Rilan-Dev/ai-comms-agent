import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { providerSetupStatus, PROVIDER_SETUP_OPTIONS } from "../src/lib/ai/provider-setup-guide.ts";

const shared=readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url),"utf8");
const page=readFileSync(new URL("../src/app/settings/ai-provider-setup/page.tsx", import.meta.url),"utf8");

test("each setup category has only compatible providers with clear capability labels",()=>{
  assert.deepEqual(PROVIDER_SETUP_OPTIONS.chat.map(x=>x.id),["openai","gemini","sarvam"]);
  assert.deepEqual(PROVIDER_SETUP_OPTIONS["voice-chat"].map(x=>x.id),["elevenlabs","sarvam"]);
  assert.deepEqual(PROVIDER_SETUP_OPTIONS.realtime.map(x=>x.id),["openai","gemini","sarvam","elevenlabs"]);
  assert.deepEqual(PROVIDER_SETUP_OPTIONS.embedding.map(x=>x.id),["openai","gemini","tei"]);
  for(const options of Object.values(PROVIDER_SETUP_OPTIONS)) {
    assert.ok(options.every(x=>x.label && x.summary && x.details));
    assert.equal(options.length,new Set(options.map(x=>x.id)).size);
  }
});

test("status checks credentials, enabled state AND saved model per required capability",()=>{
  const one={provider:"elevenlabs",purpose:"tts",model:"eleven_multilingual_v2",hasApiKey:true,enabled:true};
  const two={provider:"elevenlabs",purpose:"stt",model:"scribe_v2",hasApiKey:true,enabled:true};
  assert.equal(providerSetupStatus([], "elevenlabs",["tts","stt"]).state,"not-configured");
  assert.equal(providerSetupStatus([one],"elevenlabs",["tts","stt"]).state,"needs-setup");
  assert.equal(providerSetupStatus([one,{...two,model:null}],"elevenlabs",["tts","stt"]).state,"needs-setup");
  assert.equal(providerSetupStatus([one,{...two,enabled:false}],"elevenlabs",["tts","stt"]).state,"disabled");
  assert.equal(providerSetupStatus([one,two],"elevenlabs",["tts","stt"]).state,"configured");
  assert.equal(providerSetupStatus([{...one,model:""}],"elevenlabs",["tts"]).state,"needs-setup");
  assert.equal(providerSetupStatus([{...one,hasApiKey:false}],"elevenlabs",["tts"]).state,"needs-setup");
  assert.equal(providerSetupStatus([{...one,enabled:false}],"elevenlabs",["tts"]).label,"Disabled");
});

test("provider selection uses accessible separate cards and no redundant vendor dropdown",()=>{
  assert.match(shared,/aria-pressed=\{p === provider\}/);
  assert.match(shared,/onClick=\{\(\) => chooseProvider\(p\)\}/);
  assert.doesNotMatch(shared,/onChange=\{\(e\) => chooseProvider\(e\.target\.value\)\}/);
  assert.doesNotMatch(shared,/<option key=\{p\} value=\{p\}>/);
  assert.match(shared,/Choose a provider to configure/);
  assert.match(shared,/Provider setup guide/);
  assert.match(shared,/No provider is selected/);
  assert.match(shared,/const organizationReady = Boolean\(organizationId\) && loadedOrganizationId === organizationId && !loading/);
  assert.match(shared,/setApiKey\(""\)/);
});

test("never carry unsaved credentials across category, vendor or tenant changes",()=>{
  const providerSwitch=shared.slice(shared.indexOf("function chooseProvider(next: string)"),shared.indexOf("async function saveProvider()"));
  assert.match(providerSwitch,/setApiKey\(""\)/);
  assert.match(providerSwitch,/setModel\(""\)/);
  assert.match(providerSwitch,/setSttModel\(""\)/);
  assert.match(shared,/\[organizationId\]/);
  assert.match(shared,/setLoadedOrganizationId\(""\)/);
  assert.match(shared,/new AbortController\(\)/);
  assert.match(shared,/currentOrganizationId\.current !== organizationId/);
  assert.match(shared,/voiceCredentialSaveError\(/);
  assert.match(shared,/onReuseSavedRealtimeKey=\{canReuseRealtimeKey/);
});

test("settings page distinguishes four jobs; saved key never promises live availability",()=>{
  assert.match(page,/Chat & writing/);
  assert.match(page,/Voice pipeline/);
  assert.match(page,/Live voice/);
  assert.match(page,/Knowledge search/);
  assert.match(shared,/Model options are fetched from the provider's live API/);
  assert.match(shared,/availability is confirmed when a session connects/);
  assert.match(shared,/encrypted_api_key/);
});
