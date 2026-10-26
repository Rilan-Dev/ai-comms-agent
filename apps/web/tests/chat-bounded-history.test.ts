import {describe,expect,it} from 'vitest';
import {boundedChatHistory} from '../src/lib/chat/bounded-history';

describe('bounded persisted chat history',()=>{
  it('omits an oversized old mail report while preserving complete recent turns',()=>{
    const recent=[{role:'user',content:'Which mailbox?'},{role:'assistant',content:'Use the assigned mailbox.'}];
    const history=[{role:'user',content:'Summarize all unread mail'},{role:'assistant',content:'private mail report '.repeat(15000)},...recent];
    const result=boundedChatHistory(history);
    expect(JSON.stringify(result).length).toBeLessThan(26000);
    expect(result.slice(-2)).toEqual(recent);
    expect(result[0]!.content).toMatch(/omitted.*retrieve/i);
    expect(history[1]!.content.length).toBeGreaterThan(200000);
  });
  it('retains short exact bodies and saved references without rewriting them',()=>{
    const history=[{role:'user',content:'Body: "  Héllo\n\nExact  "'},{role:'assistant',content:'Draft saved: 40000000-0000-4000-8000-000000000001'}];
    expect(boundedChatHistory(history)).toEqual(history);
  });
  it('does not carry older unrelated turns past a missing oversized latest turn',()=>{
    const result=boundedChatHistory([{role:'user',content:'Old recipient old@example.test'}, {role:'assistant',content:'Old draft'}, {role:'user',content:'Recent report'}, {role:'assistant',content:'large '.repeat(50000)}]);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).not.toContain('old@example.test');
    expect(result[0]!.content).toMatch(/approval/i);
  });
});
