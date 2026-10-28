export type AgentInput = {
  name: string;
  slug: string;
  description: string;
};

export type AgentFieldErrors = Partial<Record<keyof AgentInput, string>>;

export type AgentValidationResult =
  | { ok: true; value: AgentInput; fieldErrors: Record<string, never> }
  | { ok: false; value: null; fieldErrors: AgentFieldErrors };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyAgentName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function nextAgentSlug(name:string,currentSlug:string,customized:boolean):string {
  return customized ? currentSlug : slugifyAgentName(name);
}

export function validateAgentInput(input: Partial<AgentInput>): AgentValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const fieldErrors: AgentFieldErrors = {};

  if (!name) fieldErrors.name = "Agent name is required.";
  else if (name.length > 120) fieldErrors.name = "Agent name must be 120 characters or fewer.";

  if (!slug) fieldErrors.slug = "Agent slug is required.";
  else if (slug.length > 80) fieldErrors.slug = "Agent slug must be 80 characters or fewer.";
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = "Use lowercase letters, numbers, and single hyphens.";

  if (description.length > 500) fieldErrors.description = "Description must be 500 characters or fewer.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, value: null, fieldErrors };
  }

  return {
    ok: true,
    value: { name, slug, description },
    fieldErrors: {},
  };
}


export type AgentVersionConfigValidation =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string };

export function validateAgentVersionConfig(input: unknown): AgentVersionConfigValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Version configuration must be a JSON object." };
  }
  try {
    const serialized = JSON.stringify(input);
    if (serialized.length > 100_000) return { ok: false, message: "Version configuration must be 100 KB or smaller." };
  } catch {
    return { ok: false, message: "Version configuration is not serializable." };
  }
  return { ok: true, value: input as Record<string, unknown> };
}

export type AgentPolicyInput = { securityPolicy:Record<string,unknown>; allowedTools:string[]; allowedSenders:string[]; blockedSenders:string[]; rateLimits:Record<string,unknown> };
export type AgentPolicyValidationResult = { ok:true; value:AgentPolicyInput } | { ok:false; fieldErrors:Record<string,string> };

export function validateAgentPolicyInput(input:Partial<Record<keyof AgentPolicyInput,unknown>>):AgentPolicyValidationResult {
  const fieldErrors:Record<string,string>={};
  const object=(key:keyof AgentPolicyInput)=>{const value=input[key]; if(value===undefined)return {}; if(!value||typeof value!=="object"||Array.isArray(value)) fieldErrors[String(key)]="Must be a JSON object."; return value as Record<string,unknown>;};
  const list=(key:keyof AgentPolicyInput)=>{const value=input[key]; if(value===undefined)return []; if(!Array.isArray(value)||value.some(item=>typeof item!=="string"||item.trim().length===0)) { fieldErrors[String(key)]="Must be a list of non-empty strings."; return []; } if(value.length>100) fieldErrors[String(key)]="Cannot contain more than 100 entries."; return value.map(item=>String(item).trim()).filter(Boolean);};
  const securityPolicy=object("securityPolicy"); const rateLimits=object("rateLimits"); const allowedTools=list("allowedTools"); const allowedSenders=list("allowedSenders"); const blockedSenders=list("blockedSenders");
  for(const [key,value] of Object.entries({securityPolicy,rateLimits})) { if(JSON.stringify(value).length>50_000) fieldErrors[key]="Configuration must be 50 KB or smaller."; }
  if(Object.keys(fieldErrors).length)return {ok:false,fieldErrors};
  return {ok:true,value:{securityPolicy,rateLimits,allowedTools,allowedSenders,blockedSenders}};
}
