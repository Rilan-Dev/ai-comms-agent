/** Presentation guard only; model output never grants operation authority. */
export function isInternalChatPlanning(text:string):boolean{
 return /<\/?think(?:ing)?\b[^>]*>/i.test(text)
  || /\bNo new emails were provided by the user in this turn\b/i.test(text)
  || /\bMy instructions say\b/i.test(text)
  || /\bI should not hallucinate\b/i.test(text)
  || /\bLet's identify them correctly from context\b/i.test(text)
  || /\bWe need to inspect the system prompt\b/i.test(text)
  || /\bI should respond appropriately\b/i.test(text)
  || /\bI need to make sure I don't include other emails\b/i.test(text);
}
