import { redirect } from "next/navigation";

/**
 * Keep one canonical agent-creation flow so its organization context,
 * slug validation, persistence and notifications cannot drift between routes.
 */
export default function NewAgentPage() {
  redirect("/agents#new-agent");
}
