import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

export const rankingCardComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('rankingCard'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        nameField: fieldBindingZ,
        valueField: fieldBindingZ,
        changeField: fieldBindingZ.optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'rankingCardComponent' });

componentCatalogRegistry.add(rankingCardComponentZ, {
  label: '排行卡',
  purpose: '突出 Top N 或按指标排序的类别',
  chooseWhen: ['排行、排名、Top N、领先/落后对象'],
  dataShape: '名称 dimension 字段 + 一个 metric 数值字段，查询应声明排序和限制',
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1, max: 1 }
  },
  title: 'optional',
  defaultSpan: 4
});
