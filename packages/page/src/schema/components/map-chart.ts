import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  idZ,
  mainDataZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

export const mapChartComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('mapChart'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        nameField: fieldBindingZ,
        valueField: fieldBindingZ,
        map: z.enum(['china', 'world']),
        scatter: z.enum(['point', 'effect']).optional(),
        nameMap: z.record(z.string(), z.string()).optional(),
        /**
         * 层级维度筛选器 id。地图读它的当前层级决定底图与行集,
         * 中间级点击写回下一级,最深一级再走 actions.navigate。
         */
        hierarchyFilter: idZ.optional(),
        /** 行上标识「这行属于哪一级视图」的维度字段。 */
        levelField: fieldBindingZ.optional(),
        /** 行上指向父级取值的维度字段,用于收窄当前层级的行。 */
        parentField: fieldBindingZ.optional(),
        /** 点击时写入下一层级的维度字段;缺省取下一层的 dimension。 */
        codeField: fieldBindingZ.optional(),
        /** 各层级使用的底图;未列出的层级回落到 props.map。 */
        levelMaps: z.record(z.string(), z.enum(['china', 'world'])).optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'mapChartComponent' });

componentCatalogRegistry.add(mapChartComponentZ, {
  label: '地图',
  purpose: '展示国家或省级地域分布，可按层级维度筛选器做三级下钻',
  chooseWhen: ['明确要求中国/世界地图，且地域名称能映射到地图'],
  dataShape: '地域名称 dimension 字段 + 一个 metric 数值字段',
  title: 'optional',
  defaultSpan: 8
});
