import {it,expect} from 'vitest';
import {whatsappAccountSummary} from '../src/lib/whatsapp/account-summary';
it('counts pending and blocked requests only for the selected phone',()=>{
 const actions=[{whatsapp_account_id:'one',status:'pending'},{whatsapp_account_id:'one',status:'requires_template'},{whatsapp_account_id:'two',status:'pending'}];
 expect(whatsappAccountSummary(actions,'one')).toEqual({pending:1,needsAttention:1});expect(whatsappAccountSummary(actions,'two')).toEqual({pending:1,needsAttention:0});
});
