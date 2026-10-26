/**
 * Reversible, request-local mapping between registered host tools and Sarvam
 * Chat Completion function identifiers. No provider-supplied identifier grants
 * permission: the host still performs its full policy, schema and audit checks.
 */
export function createSarvamToolBridge(hostNames: readonly string[]) {
  if (hostNames.length < 1 || hostNames.length > 32 || new Set(hostNames).size !== hostNames.length) {
    throw new Error("Sarvam tools must be a nonempty, non-duplicate registered set (max 32).");
  }
  const hostToProvider = new Map<string,string>();
  const providerToHost = new Map<string,string>();
  hostNames.forEach((name, index) => {
    if (!name.trim()) throw new Error("Invalid registered host tool name.");
    // Dotted host names are legal in the application registry, but provider
    // function identifiers use a conservative alphanumeric/underscore set.
    const alias = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 54) + "_" + index;
    hostToProvider.set(name, alias);
    providerToHost.set(alias, name);
  });
  return {
    toProvider(name: string): string {
      const alias = hostToProvider.get(name);
      if (!alias) throw new Error("Only registered host tool names can be sent to Sarvam.");
      return alias;
    },
    fromProvider(alias: string): string | null {
      return providerToHost.get(alias) ?? null;
    },
  };
}
