import { z } from 'zod';
import { visibilityShape } from '../condition';
import { componentIdZ, componentLayoutZ } from '../primitives';
import { iocHeaderZ } from '../ioc-header';
import { componentCatalogRegistry } from '../registry';

export const iocHeaderComponentZ = z.object({
  id: componentIdZ, ...visibilityShape, type: z.literal('iocHeader'),
  layout: componentLayoutZ, props: iocHeaderZ
}).strict().meta({id:'iocHeaderComponent'});

componentCatalogRegistry.add(iocHeaderComponentZ, {
  label:'IOC 页头', aliases:['IocHeader','公共页头','页面页头'],
  purpose:'页面身份、返回和页级筛选；位于首分区首组件并占满分区宽度',
  chooseWhen:['IOC 页面页头；沿用页级筛选及查询绑定，跟随所在分区显隐'],
  dataShape:'不绑定页面数据源', authoringShape:{bindsData:false}, title:'optional', defaultSpan:12
});
