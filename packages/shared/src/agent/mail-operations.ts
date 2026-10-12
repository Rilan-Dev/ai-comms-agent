/**
 * Public feature boundary for the shared email operation catalogue.
 * The catalogue is metadata only; host runtime handlers must enforce
 * tenant/account authorization, capability checks, policy and audit.
 */
export { EMAIL_TOOL_CATALOG, listEmailToolDescriptors } from "./intents";
export type { EmailToolDescriptor } from "./types";
