/**
 * Shared host tool registry.
 * Registration never grants access; handlers/runtime must still authorize each call.
 */
import type { Tool } from "./types";

export type AgentToolAllowlist = (agentId: string) => readonly string[] | null;
export interface ToolValidationResult { valid: boolean; errors?: string[]; }
type Schema = Record<string, unknown>;

function validateValue(value: unknown, schema: Schema, path: string, errors: string[]): void {
  const type = schema.type;
  if (type === "string") {
    if (typeof value !== "string") { errors.push(`${path} must be a string`); return; }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) errors.push(`${path} is too long`);
    if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) errors.push(`${path} is not an allowed value`);
    if (schema.format === "date-time" && (!Number.isFinite(Date.parse(value)) || !/[Tt]/.test(value))) errors.push(`${path} must be an ISO date-time`);
    return;
  }
  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (type === "integer" && !Number.isInteger(value))) { errors.push(`${path} must be a ${type}`); return; }
    if (typeof schema.minimum === "number" && value < schema.minimum) errors.push(`${path} is below the minimum`);
    if (typeof schema.maximum === "number" && value > schema.maximum) errors.push(`${path} exceeds the maximum`);
    return;
  }
  if (type === "boolean") { if (typeof value !== "boolean") errors.push(`${path} must be a boolean`); return; }
  if (type === "array") {
    if (!Array.isArray(value)) { errors.push(`${path} must be an array`); return; }
    if (typeof schema.minItems === "number" && value.length < schema.minItems) errors.push(`${path} has too few items`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) errors.push(`${path} has too many items`);
    const itemSchema = schema.items && typeof schema.items === "object" ? schema.items as Schema : undefined;
    if (itemSchema) value.forEach((item, index) => validateValue(item, itemSchema, `${path}[${index}]`, errors));
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) errors.push(`${path} is not an allowed value`);
}

function validateObject(input: unknown, schema: Schema): ToolValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, errors: ["input must be an object"] };
  if (schema.type !== "object") return { valid: false, errors: ["tool schema must describe an object"] };
  const value = input as Record<string, unknown>;
  const properties = schema.properties && typeof schema.properties === "object" ? schema.properties as Record<string, Schema> : {};
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
  for (const key of required) if (!(key in value)) errors.push(`${key} is required`);
  if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in properties)) errors.push(`${key} is not allowed`);
  for (const [key, propertySchema] of Object.entries(properties)) if (key in value) validateValue(value[key], propertySchema, key, errors);
  return errors.length ? { valid: false, errors } : { valid: true };
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  constructor(private readonly allowedToolsForAgent: AgentToolAllowlist) {}

  register(tool: Tool): void {
    if (!tool.name.trim()) throw new Error("Tool name is required.");
    if (!tool.required_permission.trim()) throw new Error(`Tool ${tool.name} must declare a permission.`);
    if (this.tools.has(tool.name)) throw new Error(`Tool ${tool.name} is already registered.`);
    if (!tool.input_schema || typeof tool.input_schema !== "object" || tool.input_schema.type !== "object") {
      throw new Error(`Tool ${tool.name} must provide an object input schema.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | null { return this.tools.get(name) ?? null; }
  list(domain?: Tool["domain"]): Tool[] { return [...this.tools.values()].filter((tool) => !domain || tool.domain === domain); }

  /** Missing allowlist configuration means no tools are discoverable for this agent. */
  listForAgent(agentId: string): Tool[] {
    const allowed = this.allowedToolsForAgent(agentId);
    if (!allowed) return [];
    const allowset = new Set(allowed);
    return this.list().filter((tool) => allowset.has(tool.name));
  }


  validate(toolName: string, input: unknown): ToolValidationResult {
    const tool = this.get(toolName);
    if (!tool) return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    return validateObject(input, tool.input_schema);
  }
}
