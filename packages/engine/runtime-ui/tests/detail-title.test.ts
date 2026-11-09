import { describe, expect, it } from 'vitest';
import { detailTitle } from '../src/detail-title';

describe('detail titles', () => {
  it('joins row fields and literal text in declaration order, preserving zero and false', () => {
    expect(detailTitle({surface:'modal', fields:[], title:{parts:[{field:'region'},' / ',{field:'score',format:'number-1'},' / ',{field:'enabled'}]}},
      {region:'合成地区部',score:0,enabled:false})).toBe('合成地区部 / 0 / false');
  });
  it('shows missing values, renders literal markup as text and preserves legacy fallback', () => {
    expect(detailTitle({surface:'modal',fields:[],title:{parts:['<b>',{field:'missing'},'</b>']}},{})).toBe('<b>--</b>');
    expect(detailTitle({surface:'drawer',fields:[],titleField:'name'},{name:'旧标题'})).toBe('旧标题');
    expect(detailTitle({surface:'modal',fields:[]},{},'组件标题')).toBe('组件标题');
    expect(detailTitle({surface:'modal',fields:[],title:'固定标题'},{})).toBe('固定标题');
  });
});
