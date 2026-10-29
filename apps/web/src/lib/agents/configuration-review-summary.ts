type Change = {path:string[];before:unknown;after:unknown};
const aiLabels:Record<string,string> = {
  systemPromptOverride:'system prompt',temperatureOverride:'temperature',maxTokensOverride:'response length',
  chatProvider:'chat provider',chatModel:'chat model',voiceChatProvider:'voice-chat provider',voiceChatVoiceId:'voice',
  voiceChatTtsModel:'voice output model',voiceChatSttModel:'voice input model',
  realtimeVoiceProviderOverride:'live voice provider',realtimeVoiceIdOverride:'live voice',
  realtimeSttModel:'live voice input model',realtimeTtsModel:'live voice output model',
  embeddingProvider:'embedding provider',embeddingModel:'embedding model',embeddingDimension:'embedding dimension',
};
const words=(value:string)=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._:]/g,' ').toLowerCase();
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** The server's reviewed diff is untouched; this only names its changes. */
export function describeConfigurationChange(change:Change):string {
  if(change.path[0]==='ai'){
    if(change.path.length>1)return `AI settings: ${aiLabels[change.path[1]!]??words(change.path[1]!)}`;
    const source=object(change.after)?change.after:object(change.before)?change.before:null;
    const fields=source?Object.keys(source).filter(key=>source[key]!==null&&source[key]!==undefined).map(key=>aiLabels[key]??words(key)):[];
    if(fields.length)return `AI settings: ${fields.slice(0,3).join(', ')}${fields.length>3?` and ${fields.length-3} more`:''}`;
    return 'AI settings';
  }
  const labels=change.path.map(words);
  if(labels[0])labels[0]=labels[0][0]!.toUpperCase()+labels[0].slice(1);
  return labels.join(' › ')||'Configuration change';
}
