import {describe,expect,it} from 'vitest';
import {resolveInitialSearch} from '../src/initial-search';

const query=(explicit:string|undefined,search='',hash='')=>new URLSearchParams(resolveInitialSearch(explicit,{search,hash}));

describe('embed URL input precedence',()=>{
  it.each(['account-name=explicit','?account-name=explicit'])('explicit input %s overrides the URL',explicit=>{
    expect(query(explicit,'?account-name=outer','#/detail?account-name=hash').get('account-name')).toBe('explicit');
  });
  it('an explicit empty string or question mark suppresses inheritance',()=>{
    expect(resolveInitialSearch('',{search:'?account-name=outer',hash:'#/detail?account-name=hash'})).toBe('');
    expect(resolveInitialSearch('?',{search:'?account-name=outer',hash:''})).toBe('');
  });
  it('reads and decodes a browser query once',()=>{
    expect(query(undefined,'?account-name='+encodeURIComponent('合成+账号&=%20')).get('account-name')).toBe('合成+账号&=%20');
  });
  it.each(['#/detail?account-name=hash','#!/detail?account-name=hash'])('reads route query %s',hash=>{
    expect(query(undefined,'?tenant=x&account-name=outer',hash).get('account-name')).toBe('hash');
    expect(query(undefined,'?tenant=x',hash).get('tenant')).toBe('x');
  });
  it('preserves repeated route values and removes all overridden outer values',()=>{
    const value=query(undefined,'?regions=old&regions=older&keep=1','#/detail?regions=EU&regions=NA');
    expect(value.getAll('regions')).toEqual(['EU','NA']);expect(value.get('keep')).toBe('1');
  });
  it('preserves explicit empty route values for required-input validation',()=>{
    expect(query(undefined,'?account-name=outer','#/detail?account-name=').getAll('account-name')).toEqual(['']);
  });
  it.each(['#section?account-name=wrong','#account-name=wrong','#/detail',''])('ignores non-query fragment %s',hash=>{
    expect(query(undefined,'?account-name=outer',hash).get('account-name')).toBe('outer');
  });
  it('does not turn an anchor suffix into parameter content',()=>{
    expect(query(undefined,'','#/detail?account-name=hash#section').get('account-name')).toBe('hash');
  });
  it('returns empty input when the URL has no query',()=>expect(resolveInitialSearch(undefined,{search:'',hash:''})).toBe(''));
});
