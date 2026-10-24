/** Only allowlisted diagnostic fields may enter logs. Never return raw vendor,
 * SQL, credentials, request messages or arbitrary exception names. */
export function safeChatFailure(error: unknown): {
  category: 'provider_http' | 'network' | 'timeout' | 'empty_completion' | 'unknown';
  type: 'Error' | 'TypeError' | 'AbortError';
  provider?: 'sarvam' | 'openai' | 'gemini';
  httpStatus?: number;
} {
  const type = error instanceof Error && (error.name === 'TypeError' || error.name === 'AbortError') ? error.name : 'Error';
  const message = error instanceof Error ? error.message : '';
  const provider = /^(Sarvam|OpenAI|Gemini) tool request failed \(([45]\d\d)\):/.exec(message);
  if (provider) return {category:'provider_http',provider:provider[1]!.toLowerCase() as 'sarvam'|'openai'|'gemini',httpStatus:Number(provider[2]),type};
  if (type === 'AbortError') return {category:'timeout',type};
  if (type === 'TypeError' && message === 'fetch failed') return {category:'network',type};
  if (/^(?:AI provider returned an empty chat response\.|Provider returned an empty tool-call stream\.|The AI provider returned an empty response)/.test(message)) return {category:'empty_completion',type};
  return {category:'unknown',type};
}
