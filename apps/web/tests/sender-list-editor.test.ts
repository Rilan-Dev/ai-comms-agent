import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {SenderListEditor} from '../src/app/agents/[id]/sender-list-editor';
it('renders editable saved entries, purposeful labels and a saveable pending input',()=>{
 const html=renderToStaticMarkup(createElement(SenderListEditor,{name:'allowedSenders',label:'Allowed senders',initialEntries:['literal, preserved','other']}));
 expect(html).toContain('value="literal, preserved"');expect(html.match(/name="allowedSenders"/g)).toHaveLength(3);
 expect(html).toContain('aria-label="Allowed senders entry 1"');expect(html).toContain('Remove allowed senders entry 1');expect(html).toContain('New allowed senders entry');expect(html).toContain('2 of 100 entries');
});
it('keeps all100 saved entries and disables only adding more',()=>{
 const html=renderToStaticMarkup(createElement(SenderListEditor,{name:'blockedSenders',label:'Blocked senders',initialEntries:Array.from({length:100},(_,i)=>`entry-${i}`)}));
 expect(html).toContain('value="entry-99"');expect(html).toContain('100 of 100 entries');expect(html).toMatch(/aria-label="New blocked senders entry"[^>]*disabled=""/);
});
