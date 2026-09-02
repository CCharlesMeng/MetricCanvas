import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  idZ,
  mainDataZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

/**
 * 图例档位:一个标签配一个取值下界(含),上界由下一档的 `from` 隐含,
 * 最后一档开口向上。档位是分档着色的契约而不是一张图片——运行时按行
 * 的 `valueField` 落在哪一档取色阶的哪一级——因此下界进页面文档,
 * 具体颜色不进(ADR-0003)。
 */
const mapLegendBandZ = z
  .object({
    label: nonEmptyTextValueZ,
    from: z.number()
  })
  .strict()
  .meta({ id: 'mapLegendBand' });

const mapLegendZ = z
  .object({
    title: textValueZ.optional(),
    bands: z.array(mapLegendBandZ).min(2)
  })
  .strict()
  .meta({ id: 'mapLegend' });

const mapTooltipFieldZ = z
  .object({
    label: nonEmptyTextValueZ,
    field: fieldBindingZ
  })
  .strict()
  .meta({ id: 'mapTooltipField' });

const mapPinnedSummaryZ = z
  .object({
    matchField: fieldBindingZ,
    matchValue: z.union([z.string(), z.number()]),
    titleField: fieldBindingZ,
    fields: z.array(mapTooltipFieldZ).min(1).max(4)
  })
  .strict()
  .meta({ id: 'mapPinnedSummary' });

export const mapChartComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('mapChart'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        variant: z.literal('regionalOverview').optional(),
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
        /** 分档图例:一个标题加若干取值档位;缺省不画图例。 */
        legend: mapLegendZ.optional(),
        /** tooltip 在地域名与 valueField 之外追加的字段;每项一个标签与一个字段绑定。 */
        tooltipFields: z.array(mapTooltipFieldZ).min(1).optional(),
        /** 按稳定字段值固定展示一条地域摘要，不按显示名称或页面 id 分支。 */
        pinnedSummary: mapPinnedSummaryZ.optional(),
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
  authoringShape: {
    bindsData: true,
    dimensions: { min: 1, max: 1 },
    measures: { min: 1, max: 1 },
    requiresFieldSemantics: ['地域名称']
  },
  title: 'optional',
  defaultSpan: 8
});
