import { z } from 'zod';
import { componentIdZ, componentLayoutZ, nonEmptyTextValueZ } from '../primitives';
import { interactionShape } from '../condition';
import { componentActionZ } from '../actions';
import { componentCatalogRegistry } from '../registry';
export const buttonComponentZ = z.object({
  id: componentIdZ, type: z.literal('button'), layout: componentLayoutZ, ...interactionShape,
  props: z.object({ label: nonEmptyTextValueZ, action: componentActionZ }).strict()
}).strict().meta({ id: 'buttonComponent' });
componentCatalogRegistry.add(buttonComponentZ, {
  label: '按钮', purpose: '执行受控导航、详情或筛选动作', chooseWhen: ['独立操作入口'],
  dataShape: '不绑定数据源', authoringShape: { bindsData: false }, title: 'unsupported', defaultSpan: 3
});
