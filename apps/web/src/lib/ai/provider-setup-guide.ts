/** Product presentation only. The API is the authority on provider/purpose
 * allowlists, keys, permissions, capabilities and supported model IDs. */
export type ProviderSetupArea = "chat" | "voice-chat" | "realtime" | "embedding";
export type ProviderSetupOption = { id:string; label:string; summary:string; details:string };
export const PROVIDER_SETUP_OPTIONS: Record<ProviderSetupArea,readonly ProviderSetupOption[]> = {
  chat:[
    {id:"openai",label:"OpenAI",summary:"General-purpose AI conversations",details:"Chat responses, drafting and tool-assisted agent tasks."},
    {id:"gemini",label:"Google Gemini",summary:"Google AI for chat",details:"Text generation and compatible agent conversations."},
    {id:"sarvam",label:"Sarvam AI",summary:"Indian-language AI chat",details:"Regional-language and multilingual conversations using supported Sarvam models."},
  ],
  "voice-chat":[
    {id:"elevenlabs",label:"ElevenLabs",summary:"Speech in and speech out",details:"Configure text-to-speech and speech-to-text separately. Voice chat needs both."},
    {id:"sarvam",label:"Sarvam AI",summary:"Bulbul speech + Saaras recognition",details:"Choose separate TTS and STT models for spoken conversations."},
  ],
  realtime:[
    {id:"openai",label:"OpenAI",summary:"OpenAI realtime speech",details:"Realtime model and credential; actual voice availability requires a working session."},
    {id:"gemini",label:"Google Gemini",summary:"Gemini Live conversation",details:"Streaming conversation when a supported realtime transport is configured."},
    {id:"sarvam",label:"Sarvam AI",summary:"Saaras streaming speech",details:"Streaming recognition with the authenticated host agent and speech pipeline. Not an independent AI agent."},
    {id:"elevenlabs",label:"ElevenLabs",summary:"Scribe streaming speech",details:"Streaming speech recognition + host agent; separate from ElevenLabs Conversational AI."},
  ],
  embedding:[
    {id:"openai",label:"OpenAI",summary:"Knowledge vector embeddings",details:"Vectorize documents for retrieval-augmented conversations."},
    {id:"gemini",label:"Google Gemini",summary:"Google embeddings",details:"Build embeddings for semantic retrieval with supported models."},
    {id:"tei",label:"Local TEI",summary:"Self-hosted embedding inference",details:"Advanced setup for an organization-managed inference endpoint. The backend still requires a saved credential."},
  ],
};
export type SavedProviderSetup = {
  provider:string; purpose:string; enabled:boolean; hasApiKey:boolean; model:string|null;
};
export type ProviderSetupStatus = {
  state:"not-configured"|"needs-setup"|"disabled"|"configured";
  label:string;
  detail:string;
  completed:number;
  total:number;
};
export function providerSetupStatus(rows:readonly SavedProviderSetup[],provider:string,purposes:readonly string[]):ProviderSetupStatus{
  const matches=purposes.map(p=>rows.find(row=>row.provider===provider&&row.purpose===p));
  const configured=matches.filter(row=>row?.hasApiKey&&row.model?.trim()&&row.enabled).length;
  const someSaved=matches.some(row=>Boolean(row?.hasApiKey)||Boolean(row?.model?.trim()));
  const disabled=matches.some(row=>Boolean(row?.hasApiKey)&&row?.enabled===false);
  const status=(state:ProviderSetupStatus["state"],label:string,detail:string):ProviderSetupStatus=>({
    state,label,detail,completed:configured,total:purposes.length,
  });
  if(!someSaved) return status("not-configured","Not configured","Add an API key, choose a supported model and save.");
  if(disabled) return status("disabled","Disabled","A saved capability is disabled; check each capability before use.");
  if(configured!==purposes.length) return status("needs-setup","Setup incomplete",`${configured} of ${purposes.length} required capabilities have an enabled key and saved model.`);
  return status("configured","Configured","Enabled key and model saved. Live provider access is not yet verified.");
}
