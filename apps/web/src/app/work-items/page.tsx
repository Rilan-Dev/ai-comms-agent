import {headers} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {getAuthenticatedAppContext} from "@/lib/identity/repository";
import {BusinessWorkQueue} from "@/components/business/work-queue";
export const dynamic="force-dynamic";
export default async function WorkItemsPage(){
 const context=await getAuthenticatedAppContext(new Request("http://localhost",{headers:await headers()}));
 if(!context)redirect("/login?next=%2Fwork-items");
 return <main className="min-h-full bg-background p-5 sm:p-8"><div className="mx-auto max-w-[1200px] space-y-6">
   <header><p className="text-xs font-semibold uppercase tracking-wide text-primary">AI Communications Agent</p>
    <h1 className="mt-2 text-3xl font-semibold">Business work items</h1>
    <p className="mt-2 text-sm text-muted-foreground">Follow customer enquiries and service requests from their first message through assigned, reviewed completion.</p>
    <Link href="/scheduled" className="mt-3 inline-flex rounded-lg border px-3 py-2 text-sm">Scheduled AI Agent &amp; Event automations</Link>
   </header>
   <BusinessWorkQueue organizationId={context.organizationId}/>
 </div></main>;
}
