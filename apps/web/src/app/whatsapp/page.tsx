import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import WhatsAppClient from "./whatsapp-client";

export default async function WhatsAppPage() {
  // Match the authenticated shell's identity boundary. Never fall back to the
  // seeded development organization when rendering a real messaging surface.
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("aca-access-token")?.value;
  const authHeaders = new Headers();
  if (accessToken) authHeaders.set("cookie", `aca-access-token=${encodeURIComponent(accessToken)}`);
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: authHeaders }));
  if (!context) redirect("/login?reason=not_provisioned");

  return <WhatsAppClient organizationId={context.organizationId} />;
}
