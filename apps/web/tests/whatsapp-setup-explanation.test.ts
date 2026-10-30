import {it,expect} from 'vitest';
import {explainWhatsAppSetup} from '../src/lib/chat/whatsapp-setup-explanation';
it('keeps a useful factual check if the provider is unavailable',async()=>{
 const result=await explainWhatsAppSetup(null,async()=>{throw Error('secret-token');});
 expect(result).toContain('Check again');expect(result).not.toContain('secret-token');
});
it('rejects invented delivery claims from a read-only explanation',async()=>{
 expect(await explainWhatsAppSetup(null,async()=>'I sent your WhatsApp message.')).not.toContain('I sent');
});
