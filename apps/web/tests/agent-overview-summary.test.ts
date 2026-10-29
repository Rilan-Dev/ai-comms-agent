import {describe, expect, it} from 'vitest';
import {summarizeAgentOverview, summarizeDeployment} from '../src/lib/agents/overview-summary';

describe('agent overview saved configuration', () => {
  it('does not call an active agent live without a recorded deployment', () => {
    expect(summarizeDeployment('active', null)).toBe('Not deployed');
    expect(summarizeDeployment('active', 'deployment-id')).toBe('Deployed');
    expect(summarizeDeployment('paused', 'deployment-id')).toBe('Paused');
  });
  it('describes assignments without claiming that providers are connected', () => {
    const result = summarizeAgentOverview({mailboxCount: 2, readableMailboxCount: 2, whatsappAssigned: true, policyExists: true, mailReadEnabled: true});
    expect(result.mailboxes).toBe('2 assigned');
    expect(result.whatsapp).toBe('Assigned');
    expect(result.policy).toBe('Saved');
    expect(result.showMailSetup).toBe(false);
  });
  it('points to setup when assignments or policy are missing', () => {
    const result = summarizeAgentOverview({mailboxCount: 0, readableMailboxCount: 0, whatsappAssigned: false, policyExists: false, mailReadEnabled: false});
    expect(result.mailboxes).toBe('Not assigned');
    expect(result.whatsapp).toBe('Not assigned');
    expect(result.policy).toBe('Missing');
    expect(result.showMailSetup).toBe(true);
  });
  it('keeps mail setup available if either a mailbox or mail-read capability is missing', () => {
    expect(summarizeAgentOverview({mailboxCount: 1, readableMailboxCount: 1, whatsappAssigned: false, policyExists: true, mailReadEnabled: false}).showMailSetup).toBe(true);
    expect(summarizeAgentOverview({mailboxCount: 1, readableMailboxCount: 0, whatsappAssigned: false, policyExists: true, mailReadEnabled: true}).showMailSetup).toBe(true);
  });
});
