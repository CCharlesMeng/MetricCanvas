import { z } from 'zod';
import { componentIdZ, componentLayoutZ, idZ } from '../primitives';
import { visibilityShape } from '../condition';
import { componentCatalogRegistry } from '../registry';

export const filterGroupComponentZ = z.object({
  id: componentIdZ, type: z.literal('filterGroup'), layout: componentLayoutZ, ...visibilityShape,
  props: z.object({
    filterId: idZ,
    display: z.enum(['buttons','select']).optional(),
    align: z.enum(['left','right']).optional(),
    options: z.array(z.object({label:z.string().min(1).regex(/\S/),value:z.string().min(1)}).strict()).min(1).optional()
  }).strict()
}).strict().meta({id:'filterGroupComponent'});
componentCatalogRegistry.add(filterGroupComponentZ, {
  label:'独立筛选', purpose:'用固定单选按钮或数据源候选下拉控制一个或多个查询消费者',
  chooseWhen:['Dashboard 正文独立筛选，或组合卡内多个指标共用筛选'],
  dataShape:'通过 filterId 引用筛选声明及其候选来源，写入筛选状态；查询通过 filterBindings 消费',
  authoringShape:{bindsData:false}, title:'unsupported', defaultSpan:12
});
