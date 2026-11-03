import {expect, it} from 'vitest';
import type {BarChartProps} from '@metriccanvas/page/internal';
import {barOption} from '../src/components/bar-chart/options';

it('renders grouped actual/independent average bars with unchanged comparison lines',()=>{
  const rows=[{office:'甲',actual:20,average:15,mom:2,yoy:5},{office:'乙',actual:12,average:15,mom:-1,yoy:3}];
  const data={main:{snapshot:{status:'ready' as const,rows},fields:{office:{type:'string' as const,role:'dimension' as const},actual:{type:'number' as const,role:'measure' as const,unit:'%'},average:{type:'number' as const,role:'measure' as const,unit:'%'},mom:{type:'number' as const,role:'measure' as const,unit:'P'},yoy:{type:'number' as const,role:'measure' as const,unit:'P'}}}};
  const props:BarChartProps={categoryField:'office',dualAxis:true,series:[{field:'actual',kind:'bar',axis:'primary'},{field:'average',kind:'bar',axis:'primary'},{field:'mom',kind:'line',axis:'secondary'},{field:'yoy',kind:'line',axis:'secondary'}]};
  const option=barOption(data,props);
  expect(option.series).toMatchObject([{type:'bar',data:[20,12]},{type:'bar',data:[15,15]},{type:'line',data:[2,-1]},{type:'line',data:[5,3]}]);
});
