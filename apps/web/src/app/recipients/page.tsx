import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {getAuthenticatedAppContext} from "@/lib/identity/repository";
import {RecipientDirectory} from "@/components/recipients/recipient-directory";
export const dynamic="force-dynamic";
export default async function RecipientsPage(){
 const ctx=await getAuthenticatedAppContext(new Request("http://localhost",{headers:await headers()}));
 if(!ctx)redirect("/login?next=%2Frecipients");
 return <main className="mx-auto max-w-[1200px] space-y-6 p-5 sm:p-7 lg:p-10">
  <header><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automation workspace</p><h1 className="mt-2 text-3xl font-semibold">WhatsApp recipient directory</h1>
  <p className="mt-2 text-sm text-muted-foreground">Your private contact roles for AI prompts and scheduled messages.</p></header>
  <RecipientDirectory organizationId={ctx.organizationId}/>
 </main>;
}
