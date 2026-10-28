import {it,expect} from 'vitest';
import {validateChatEmailApproval} from '../src/lib/chat/inline-mail-approval';
it('reviews a pending reply using its exact server snapshot without requiring a draft',()=>{
 const action={id:'action',actionType:'reply_email',status:'pending_approval',draftId:null,emailAccountId:'account',expiresAt:null,senderAddress:'sender@example.test',recipientSnapshot:{to:['to@example.test'],cc:[],bcc:[],subject:'Re: test',bodyText:'Hello'}};
 expect(validateChatEmailApproval(action,{actionId:'action',draftId:null,accountId:'account',actionType:'reply_email'})?.recipientSnapshot.bodyText).toBe('Hello');
});
