const aborted=(message:string)=>{const error=new Error(message);error.name='AbortError';return error;};
/** Bound the whole completion, including a stalled streaming body. A late
 * provider result is discarded, never replayed as an executable tool call. */
export async function withToolCompletionDeadline<T>(work:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,timeoutMs=60_000):Promise<T>{
  if(!Number.isFinite(timeoutMs)||timeoutMs<1)throw new Error('Invalid tool completion deadline');
  if(parent?.aborted)throw aborted('The tool request was canceled.');
  const controller=new AbortController();let reject!: (error:Error)=>void;
  const failure=new Promise<never>((_resolve,fail)=>{reject=fail;});
  const stop=(message:string)=>{controller.abort();reject(aborted(message));};
  const cancel=()=>stop('The tool request was canceled.');
  parent?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>stop('The AI provider did not complete a tool response before the deadline.'),timeoutMs);
  try{
    return await Promise.race([Promise.resolve().then(()=>{
      if(controller.signal.aborted)throw aborted('The tool request was canceled.');
      return work(controller.signal);
    }),failure]);
  }finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel);}
}
