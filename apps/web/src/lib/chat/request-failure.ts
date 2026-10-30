/** HTTP failures are not model answers. Never display raw response bodies. */
export function chatRequestFailure(status:number,payload:unknown){
 if(status===401)return {signInNeeded:true,message:'Your session expired. Sign in to continue. Your unsent message is back in the input below.'};
 if(status===403)return {signInNeeded:false,message:'Your current access does not allow this request. Review your assistant’s permissions before continuing.'};
 const reference=payload&&typeof payload==='object'&&'reference' in payload&&typeof payload.reference==='string'&&/^[a-f0-9-]{36}$/i.test(payload.reference)?payload.reference:null;
 return {signInNeeded:false,message:'The request could not be confirmed. Check its saved status before trying again.'+(reference?' Reference: '+reference:'')};
}
