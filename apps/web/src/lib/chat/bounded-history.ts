/** Persisted transcript stays intact. Only a contiguous suffix of complete
 * prior turns enters a new prompt; current requests and tool results are not
 * truncated here. Missing historical details must be retrieved or clarified. */
export function boundedChatHistory<T extends {role:string;content:string}>(history:T[]):Array<T|{role:'system';content:string}> {
  const turns:T[][]=[];
  for(const message of history){
    if(message.role==='user'||turns.length===0)turns.push([]);
    turns[turns.length-1]!.push(message);
  }
  const selected:T[][]=[];
  let bytes=0;
  for(let i=turns.length-1;i>=0;i--){
    const size=new TextEncoder().encode(JSON.stringify(turns[i])).byteLength;
    if(bytes+size>24000)break;
    selected.unshift(turns[i]!);bytes+=size;
  }
  const retained=selected.flat();
  if(retained.length===history.length)return retained;
  return [{role:'system',content:'Older conversation turns were omitted from this prompt to keep it within the model context budget. Retrieve current records with authorized tools when needed. Never infer missing recipients, exact draft bodies, source identities or approval from omitted history. Ask one concise clarification if a reference cannot be resolved. The saved transcript remains unchanged.'},...retained];
}
