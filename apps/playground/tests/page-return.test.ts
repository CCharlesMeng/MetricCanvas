import {expect,it} from 'vitest';
import {playgroundPageIdentity,createPlaygroundPageReturn} from '../src/lib/page-return';
it('identifies exact saved pages independently from URL parameters',()=>{
 expect(playgroundPageIdentity(new URL('https://test/pages/detail?project=2'))).toBe('detail');
 expect(playgroundPageIdentity(new URL('https://test/pages/%E4%B8%AD%E6%96%87'))).toBe('中文');
 expect(playgroundPageIdentity(new URL('https://test/pages/%E0%A4'))).toBeUndefined();
 expect(playgroundPageIdentity(new URL('https://test/other/detail'))).toBeUndefined();
 expect(createPlaygroundPageReturn().current()).toBeUndefined();
});
