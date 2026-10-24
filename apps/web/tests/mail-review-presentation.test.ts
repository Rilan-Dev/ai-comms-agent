import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MailReview} from '../src/components/mail-review';
describe('shared exact mail review',()=>{
 it('shows the sender, all recipient fields and exact body as inert text',()=>{
  const html=renderToStaticMarkup(createElement(MailReview,{sender:'sender@example.com',snapshot:{to:['to@example.com'],cc:['cc@example.com'],bcc:['bcc@example.com'],subject:'QA subject',bodyText:'  Exact\n<script>private text</script>  '}}));
  for(const text of ['sender@example.com','to@example.com','cc@example.com','bcc@example.com','QA subject','  Exact\n&lt;script&gt;private text&lt;/script&gt;  '])expect(html).toContain(text);
  expect(html).not.toContain('<script>');
 });
});
