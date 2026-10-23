import {describe,it,expect} from 'vitest';
import {formatWorkspaceTimestamp} from '../src/lib/workspace-timestamp';
describe('stable server and client timestamps',()=>{
 it('uses the same explicit UTC label across timezone offsets and render times',()=>{
  expect(formatWorkspaceTimestamp('2026-10-24T00:00:00+05:30')).toBe('2026-10-23 18:30:00 UTC');
  expect(formatWorkspaceTimestamp('2026-10-23T18:30:00Z',true)).toBe('2026-10-23');
 });
 it.each([null,undefined,'invalid date'])('handles missing or invalid evidence %s',value=>expect(formatWorkspaceTimestamp(value)).toBe('No date'));
});
