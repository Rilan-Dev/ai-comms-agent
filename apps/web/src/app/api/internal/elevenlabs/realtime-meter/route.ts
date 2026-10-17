import { meterVoiceRelay } from "@/lib/voice/provider-relay-init";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return meterVoiceRelay(request, "elevenlabs"); }
