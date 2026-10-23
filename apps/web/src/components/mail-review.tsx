import type {ManualComposeSnapshot} from '@/lib/mail/manual-compose-review';

export function MailReview({sender,snapshot}:{sender:string;snapshot:ManualComposeSnapshot}){
 return <section aria-label="Exact saved email review" className="space-y-3 break-words rounded-lg border p-3 text-sm">
  <p><strong>From:</strong> {sender}</p>
  <p><strong>To:</strong> {snapshot.to.join(', ')}</p>
  {snapshot.cc.length>0?<p><strong>Cc:</strong> {snapshot.cc.join(', ')}</p>:null}
  {snapshot.bcc.length>0?<p><strong>Bcc:</strong> {snapshot.bcc.join(', ')}</p>:null}
  <p><strong>Subject:</strong> {snapshot.subject}</p>
  <div><p className="text-xs font-semibold">Exact persisted email body</p>
   <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-sans text-xs">{snapshot.bodyText}</pre>
  </div>
 </section>;
}
