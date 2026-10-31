import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {CatchUpCards} from '../src/app/overview/catch-up-cards';
const item={id:'one',sourceIds:['message'],priority:'high' as const,title:'Please reply',summary:'Customer needs a delivery date.',reason:'They asked for a reply.',deadline:null,confidence:'supported' as const,suggestedAction:'reply' as const,evidence:[],representation:'complete' as const,snoozedUntil:null};
describe('business Overview catch-up cards',()=>{
  it('shows priority and concise action before optional explanation, without exposing raw email HTML',()=>{
    const html=renderToStaticMarkup(createElement(CatchUpCards,{items:[{...item,summary:'<script>mail</script>'}],reviewedItemIds:[],onReview:()=>{},onOpen:()=>{},busy:false}));
    expect(html).toContain('Needs your attention');expect(html).toContain('Mark reviewed');expect(html).toContain('<details');
    expect(html).not.toContain('<script>mail');expect(html).toContain('&lt;script&gt;');
  });
  it('does not offer uncertain, partial generation as completed review or auto-read',()=>{
    const html=renderToStaticMarkup(createElement(CatchUpCards,{items:[{...item,confidence:'uncertain',representation:'partial'}],reviewedItemIds:[],onReview:()=>{},onOpen:()=>{},busy:false}));
    expect(html).toContain('Open original');expect(html).not.toContain('Mark reviewed');expect(html).not.toContain('Mark read');
  });
  it('does not repeat explicitly reviewed items',()=>{
    const html=renderToStaticMarkup(createElement(CatchUpCards,{items:[item],reviewedItemIds:['one'],onReview:()=>{},onOpen:()=>{},busy:false}));
    expect(html).not.toContain('Please reply');expect(html).toContain('You’re caught up');
  });
});
