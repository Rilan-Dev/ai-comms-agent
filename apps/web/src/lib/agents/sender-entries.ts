/** Paste is a convenience parser, not an invented address/wildcard grammar.
 * Editing an existing entry preserves literal commas in its saved value. */
export function splitSenderEntries(value:string):string[]{return value.split(/[,\r\n]+/).map(entry=>entry.trim()).filter(Boolean);}
export function collectSenderEntries(form:FormData,name:'allowedSenders'|'blockedSenders'):string[]{
 return form.getAll(name).filter((value):value is string=>typeof value==='string').map(value=>value.trim()).filter(Boolean);
}
