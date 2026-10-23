import {describe,it,expect} from 'vitest';
import {selectComposeSender} from '../src/lib/mail/compose-identity';

describe('explicit From selection',()=>{
 it('offers no implicit sender when no account is available',()=>expect(selectComposeSender([])).toBe(''));
 it('selects the single scoped sender',()=>expect(selectComposeSender([{id:'bound-account'}])).toBe('bound-account'));
 it('requires a choice when more than one scoped sender is available',()=>expect(selectComposeSender([{id:'first'},{id:'second'}])).toBe(''));
});
