import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

const keyValueItemZ = z
  .object({
    label: nonEmptyTextValueZ,
    field: fieldBindingZ
  })
  .strict()
  .meta({ id: 'keyValueItem' });

export const keyValuePanelComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('keyValuePanel'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        /** 每行放几组键值；缺省三列。 */
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
        items: z.array(keyValueItemZ).min(1)
      })
      .strict()
  })
  .strict()
  .meta({ id: 'keyValuePanelComponent' });

componentCatalogRegistry.add(keyValuePanelComponentZ, {
  label: '信息面板',
  aliases: ['键值面板', '基本信息'],
  purpose: '把一条记录的若干字段按「标签：取值」逐项列出',
  chooseWhen: [
    '详情页的基本信息区：字段各不相同、每个字段只有一个取值、不需要逐行核对',
    '需要逐行核对或排序时改用明细表'
  ],
  dataShape: '单行记录；每项绑定一个 dimension 或 measure 字段',
  title: 'optional',
  defaultSpan: 12
});
