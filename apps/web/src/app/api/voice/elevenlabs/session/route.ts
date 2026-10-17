import { startVoiceRelaySession } from "@/lib/voice/provider-relay-session";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return startVoiceRelaySession(request, "elevenlabs"); }
