import { redirect } from "next/navigation";

// Segment configuration must be defined locally for Next.js static analysis.
export const dynamic = "force-dynamic";

// The owner-requested landing experience is the existing Overview workspace.
// /chat remains the direct, independently navigable AI conversation screen.
export default function HomePage() {
  redirect("/overview");
}
