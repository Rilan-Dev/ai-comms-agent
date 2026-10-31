/** Compatibility endpoint for older Gmail Pub/Sub subscriptions.
 * Both URLs execute the exact authenticated, cursor-safe receiver. */
import { POST as authenticatedPush } from "../../webhooks/gmail/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = authenticatedPush;
