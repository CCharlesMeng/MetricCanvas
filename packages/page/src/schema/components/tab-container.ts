import { z } from 'zod';
import { componentIdZ, componentLayoutZ, idZ, nonEmptyTextValueZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';
import { tableComponentZ } from './table';

const tabItemZ = z
  .object({
    id: idZ,
    label: nonEmptyTextValueZ,
    component: tableComponentZ
  })
  .strict()
  .meta({ id: 'tabItem' });

/**
 * Tab 容器:卡内切换,每个 Tab 当前只允许一张表。
 * 子组件不参加内容分区 12 列栅格,宽度跟随容器。
 */
export const tabContainerComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('tabContainer'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: textValueZ.optional(),
        defaultTab: idZ.optional(),
        tabs: z.array(tabItemZ).min(1)
      })
      .strict()
  })
  .strict()
  .meta({ id: 'tabContainerComponent' });

componentCatalogRegistry.add(tabContainerComponentZ, {
  label: 'Tab 容器',
  aliases: ['页签', '选项卡'],
  purpose: '在同一卡位切换多张表格,不占用额外栅格行',
  chooseWhen: ['概览 / TOP / 丢单这类互斥表格需要共用一块区域'],
  dataShape: '不绑定页面数据源；每个 Tab 内的表格自己声明数据槽',
  title: 'optional',
  defaultSpan: 4
});
