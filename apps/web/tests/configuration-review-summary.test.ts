import {describe, expect, it} from 'vitest';
import {describeConfigurationChange} from '../src/lib/agents/configuration-review-summary';
describe('configuration review summaries',()=>{
 it('identifies newly set AI fields without listing inherited defaults',()=>{
  expect(describeConfigurationChange({path:['ai'],before:null,after:{chatModel:null,systemPromptOverride:'Brief and helpful',temperatureOverride:null}})).toBe('AI settings: system prompt');
 });
 it('describes a removed override without exposing its value',()=>{
  expect(describeConfigurationChange({path:['ai','systemPromptOverride'],before:'private text',after:null})).toBe('AI settings: system prompt');
 });
 it('keeps unknown areas identifiable for technical review',()=>{
  expect(describeConfigurationChange({path:['legacy','customThing'],before:1,after:2})).toBe('Legacy › custom thing');
 });
});
