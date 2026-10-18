import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_PERMISSIONS } from '@ai-comms-agent/shared';
const configPath = '../src/lib/briefings/config';

describe('private briefing boundary', () => {
  it('limits grant administration to owners/admins', () => {
    expect(SYSTEM_ROLE_PERMISSIONS.owner).toContain('briefing.access.manage');
    expect(SYSTEM_ROLE_PERMISSIONS.admin).toContain('briefing.access.manage');
    expect(SYSTEM_ROLE_PERMISSIONS.member).not.toContain('briefing.access.manage');
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).not.toContain('briefing.access.manage');
  });
  it('requires explicit server-side flag', async () => {
    const { briefingsEnabled } = await import(configPath);
    expect(briefingsEnabled({})).toBe(false);
    expect(briefingsEnabled({ BRIEFINGS_ENABLED: 'true' })).toBe(true);
    expect(briefingsEnabled({ NEXT_PUBLIC_BRIEFINGS_ENABLED: 'true' })).toBe(false);
  });
});
