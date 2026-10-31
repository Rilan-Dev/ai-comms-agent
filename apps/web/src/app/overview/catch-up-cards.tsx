import type {BriefingItem} from '@ai-comms-agent/shared';
const groups=[{priority:'high',label:'Needs your attention',emoji:'🔴'},{priority:'medium',label:'Worth a look',emoji:'🟡'},{priority:'low',label:'For later',emoji:'⚪'}] as const;
export function CatchUpCards({items,reviewedItemIds,onReview,onOpen,busy,completeSelection=true}:{items:BriefingItem[];reviewedItemIds:string[];onReview:(id:string)=>void;onOpen:(item:BriefingItem)=>void;busy:boolean;completeSelection?:boolean}){
  const remaining=items.filter(item=>!reviewedItemIds.includes(item.id));
  if(!remaining.length)return <div role="status" className="rounded-lg border border-border bg-card p-5"><p className="font-medium">{completeSelection?'✓ You’re caught up':'You’ve reviewed the available items'}</p><p className="mt-1 text-sm text-muted-foreground">{completeSelection?'No unreviewed items in this completed selection.':'More emails are being prepared. This selection is not complete yet.'}</p></div>;
  return <div className="space-y-5">{groups.map(group=>{
    const selected=remaining.filter(item=>item.priority===group.priority);if(!selected.length)return null;
    return <section key={group.priority} aria-label={group.label} className="space-y-3">
      <h3 className="text-sm font-semibold"><span aria-hidden="true">{group.emoji} </span>{group.label} <span className="font-normal text-muted-foreground">({selected.length})</span></h3>
      {selected.map(item=><article key={item.id} className="rounded-lg border border-border bg-card p-4">
        <h4 className="font-medium">{item.title}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
        {item.deadline&&<p className="mt-2 text-sm font-medium">Due: {item.deadline}</p>}
        {(item.representation==='partial'||item.confidence==='uncertain')&&<p className="mt-2 text-xs text-muted-foreground">Check the original before deciding.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={()=>onOpen(item)} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">Open original</button>
          {item.representation==='complete'&&item.confidence==='supported'&&<button type="button" onClick={()=>onReview(item.id)} disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">Mark reviewed</button>}
        </div>
        <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Why it matters</summary><p className="mt-2 leading-5">{item.reason}</p></details>
      </article>)}
    </section>;
  })}</div>;
}
