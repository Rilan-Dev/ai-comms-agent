/** Only these fixed read-only reports may run from an Overview link. */
export const READ_ONLY_CHAT_SHORTCUTS=[
 'How many unread emails do I have?',
 'Summarize my unread emails',
 'Summarize my emails from the last 24 hours',
] as const;
export function resolveChatAutoRunPrompt(value:unknown):string{
 if(typeof value!=='string')return '';
 const prompt=value.trim();
 return READ_ONLY_CHAT_SHORTCUTS.some(allowed=>allowed===prompt)?prompt:'';
}
