import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/voice/provider-relay-session.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source.slice(source.indexOf('function boundedText(')).replace('export async function', 'async function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

async function missingRelay(provider: 'sarvam' | 'elevenlabs') {
  const bindings = {
    process: { env: { DATABASE_URL: 'disposable-fixture' } },
    NextResponse: { json: Response.json.bind(Response) }, assertSameOrigin: () => {}, ensureDevSeed: async () => {},
    authorize: async () => ({ user: { id: 'user' } }), asOrganizationId: (id: string) => id,
    getIdentityAdapter: () => ({}), getIdentityRepository: () => ({}),
    PostgresAgentRepository: class { async get() { return { id: 'agent' }; } },
    getVoiceSessionForOrganization: async () => ({ user_id: 'user', agent_id: 'agent', status: 'starting', provider, voice_id: 'voice' }),
    mintVoiceRelayToken: () => ({ token: 'test-token', expiresAt: 'future' }), buildVoiceRelayUrl: () => null,
    authorizationErrorToResponse: (error: unknown) => { throw error; },
  };
  const start = new Function(...Object.keys(bindings), `${javascript}; return startVoiceRelaySession;`)(...Object.values(bindings));
  return start(new Request('https://example.test/api/voice/session', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: 'org', agentId: 'agent', sessionId: 'session' }) }), provider) as Promise<Response>;
}

describe('missing relay diagnostics', () => {
  it('does not offer a forbidden Sarvam REST speech fallback', async () => {
    const response = await missingRelay('sarvam');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('voice_relay_not_configured');
    expect(body.message).toContain('Sarvam live conversation requires');
    expect(body.message).toContain('WebSocket');
    expect(body.message).not.toContain('can use the utterance pipeline');
  });
  it('retains the explicitly supported ElevenLabs pipeline guidance', async () => {
    const response = await missingRelay('elevenlabs');
    expect(response.status).toBe(503);
    expect((await response.json()).message).toContain('utterance pipeline');
  });
});
