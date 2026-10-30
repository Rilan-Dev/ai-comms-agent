/**
 * Immutable per-occurrence ceiling. An explicit tool subset must already exist
 * in the agent's current policy; it cannot create new grants or registrations.
 */
export function narrowScheduledTools<T extends {name:string}>(
  agentTools:readonly T[], names?:unknown,
):{ok:true;tools:T[]}|{ok:false;reason:string}{
  if(names===undefined)return {ok:true,tools:[...agentTools]};
  if(!Array.isArray(names)||names.length===0||names.length>32||
    names.some(name=>typeof name!=='string'||!name.trim()||name.length>128)||
    new Set(names).size!==names.length){
    return {ok:false,reason:"The schedule has an invalid tool scope."};
  }
  const scoped=agentTools.filter(tool=>names.includes(tool.name));
  if(scoped.length!==names.length){
    return {ok:false,reason:"The schedule requests a tool that is no longer enabled for this agent."};
  }
  return {ok:true,tools:scoped};
}
