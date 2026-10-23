import {describe,it,expect,vi} from 'vitest';
import {createScopedRequestLoader} from '../src/lib/streaming/scoped-request';
describe('scope-bound frontend responses',()=>{
 it('ignores a late response even if the transport ignores cancellation',async()=>{
  const loader=createScopedRequestLoader();let scope='first';let resolveFirst!:(value:string)=>void;
  const publish=vi.fn();const first=loader.load('first',()=>scope,()=>new Promise<string>(resolve=>{resolveFirst=resolve;}),publish);
  scope='second';await loader.load('second',()=>scope,async()=> 'current account',publish);
  resolveFirst('old account');await first;expect(publish.mock.calls).toEqual([[{value:'current account'}]]);
 });
 it('ignores a response after scope change before another load starts',async()=>{
  const loader=createScopedRequestLoader();let scope='first';let resolve!:(value:string)=>void;const publish=vi.fn();
  const pending=loader.load(scope,()=>scope,()=>new Promise<string>(accept=>{resolve=accept;}),publish);
  scope='second';resolve('old');await pending;expect(publish).not.toHaveBeenCalled();
 });
 it('reports a failed request distinctly and suppresses unmounted responses',async()=>{
  const loader=createScopedRequestLoader(),publish=vi.fn();await loader.load('a',()=> 'a',async()=>{throw new Error('offline');},publish);
  expect(publish).toHaveBeenCalledWith({error:expect.any(String)});publish.mockClear();
  let resolve!:(value:string)=>void;const pending=loader.load('a',()=> 'a',()=>new Promise<string>(accept=>{resolve=accept;}),publish);
  loader.invalidate();resolve('late');await pending;expect(publish).not.toHaveBeenCalled();
 });
});
