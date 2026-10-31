import {it,expect,vi,afterEach} from 'vitest';
import {withToolCompletionDeadline} from '../../../packages/agent-core/src/tool-completion-deadline';
afterEach(()=>vi.useRealTimers());
it('a stalled provider cannot keep a tool turn pending indefinitely',async()=>{
  vi.useFakeTimers();let signal:AbortSignal|undefined;
  const work=withToolCompletionDeadline(async value=>{signal=value;return new Promise<string>(()=>{});},undefined,50);
  const assertion=expect(work).rejects.toMatchObject({name:'AbortError'});
  await vi.advanceTimersByTimeAsync(51);await assertion;expect(signal?.aborted).toBe(true);
});
it('caller cancellation stops the request and an already canceled request does not call the provider',async()=>{
  const parent=new AbortController();let signal:AbortSignal|undefined;
  const work=withToolCompletionDeadline(async value=>{signal=value;return new Promise<string>(()=>{});},parent.signal);
  const assertion=expect(work).rejects.toMatchObject({name:'AbortError'});await Promise.resolve();parent.abort();await assertion;expect(signal?.aborted).toBe(true);
  const invoke=vi.fn();await expect(withToolCompletionDeadline(invoke,parent.signal)).rejects.toMatchObject({name:'AbortError'});expect(invoke).not.toHaveBeenCalled();
});
it('successful completion clears the deadline and does not abort the completed request',async()=>{
  vi.useFakeTimers();let signal:AbortSignal|undefined;
  expect(await withToolCompletionDeadline(async value=>{signal=value;return 'complete';},undefined,50)).toBe('complete');
  await vi.advanceTimersByTimeAsync(60);expect(signal?.aborted).toBe(false);expect(vi.getTimerCount()).toBe(0);
});
