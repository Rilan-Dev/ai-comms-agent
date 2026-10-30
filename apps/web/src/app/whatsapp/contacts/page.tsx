import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {getAuthenticatedAppContext} from "@/lib/identity/repository";
import {RecipientDirectory} from "@/components/recipients/recipient-directory";
export const dynamic="force-dynamic";
export default async function WhatsAppContactsPage(){
  const store=await cookies(), token=store.get("aca-access-token")?.value;
  const headers=new Headers();
  if(token)headers.set("cookie","aca-access-token="+encodeURIComponent(token));
  const context=await getAuthenticatedAppContext(new Request("http://localhost",{headers}));
  if(!context)redirect("/login?next=%2Fwhatsapp%2Fcontacts");
  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10"><div className="mx-auto max-w-[1200px] space-y-6">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">WhatsApp Business</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Contacts &amp; recipients</h1>
      <p className="mt-2 text-sm text-muted-foreground">Select your private primary and secondary WhatsApp numbers, and manage other contacts used for approved messages and AI automations.</p>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="WhatsApp workspace navigation">
        <Link href="/whatsapp" className="inline-flex h-10 items-center rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-secondary">Phones &amp; messages</Link>
        <Link href="/whatsapp/contacts" aria-current="page" className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">WhatsApp contacts</Link>
      </nav>
    </header>
    <RecipientDirectory organizationId={context.organizationId}/>
    <p className="text-xs text-muted-foreground">Saving a contact never verifies number ownership or authorizes automatic sending. Existing Meta requirements and approval policies remain active.</p>
  </div></main>;
}
