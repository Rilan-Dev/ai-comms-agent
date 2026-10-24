import {beforeEach,expect,it,vi} from 'vitest';
import type {ReactElement,ReactNode} from 'react';
const state=vi.hoisted(()=>({index:0,recipients:'',fetch:vi.fn()}));
vi.mock('react',async()=>({...await vi.importActual<typeof import('react')>('react'),
 useState:(initial:unknown)=>{const index=state.index++;return [index===5?state.recipients:typeof initial==='function'?(initial as ()=>unknown)():initial,()=>{}];},
}));
import {ThreadClient} from '../src/app/mail/thread/[threadId]/thread-client';
function findButton(node:ReactNode):ReactElement<{onClick:()=>void}>|undefined{
 if(!node||typeof node!=='object'||!('props' in node))return;
 const element=node as ReactElement<{children?:ReactNode;onClick:()=>void}>;
 if(element.type==='button'&&element.props.children==='Request forward approval')return element;
 for(const child of Array.isArray(element.props.children)?element.props.children:[element.props.children]){
  const match=findButton(child);if(match)return match;
 }
}
beforeEach(()=>{state.index=0;state.fetch.mockReset().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',state.fetch);});
it.each([
 ['smtscontracting@gmail.com',['smtscontracting@gmail.com']],
 ['One@example.com, next@example.com\nnew@example.com',['one@example.com','next@example.com','new@example.com']],
])('preserves recipient letters and splits only real separators: %s',(input,expected)=>{
 state.recipients=input;
 const tree=ThreadClient({organizationId:'org',threadId:'thread',initialMessages:[{id:'source',email_account_id:'account'}]});
 const button=findButton(tree);expect(button).toBeDefined();button!.props.onClick();
 const request=JSON.parse(state.fetch.mock.calls[0]![1].body);
 expect(request.to).toEqual(expected);expect(request.actionType).toBe('forward_email');expect(request.messageId).toBe('source');
});
