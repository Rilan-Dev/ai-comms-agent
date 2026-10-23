/** A late response must never populate another account or conversation. */
export function createScopedRequestLoader(){
 let version=0;
 let controller:AbortController|null=null;
 return {
  invalidate(){version++;controller?.abort();controller=null;},
  async load<T>(scope:string,currentScope:()=>string,request:(signal:AbortSignal)=>Promise<T>,publish:(result:{value:T}|{error:string})=>void){
   controller?.abort();controller=new AbortController();
   const ticket=++version,signal=controller.signal;
   const current=()=>ticket===version&&!signal.aborted&&scope===currentScope();
   try {const value=await request(signal);if(current())publish({value});}
   catch{if(current())publish({error:'Could not load the current status. Refresh to try again.'});}
  },
 };
}

export async function readJsonWithTimeout<T>(url:string,signal?:AbortSignal):Promise<T>{
 const timeout=AbortSignal.timeout(15000);
 const response=await fetch(url,{cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});
 if(!response.ok)throw new Error('Status unavailable');
 return await response.json() as T;
}
