import {expect,it} from 'vitest';
import {chatRequestFailure} from '../src/lib/chat/request-failure';
it('treats an expired session as sign-in recovery, not uncertain sending',()=>{
 const failure=chatRequestFailure(401,{message:'Authentication required',token:'secret'});
 expect(failure.signInNeeded).toBe(true);expect(failure.message).toContain('Sign in');expect(failure.message).not.toContain('secret');
});
it('does not display raw provider, database or HTML error responses',()=>{
 for(const payload of [{message:'SQL password secret'},'<html>secret</html>',null])expect(chatRequestFailure(500,payload).message).not.toContain('secret');
});
