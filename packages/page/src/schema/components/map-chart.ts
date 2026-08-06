import { z } from 'zod';
import { componentIdZ, componentLayoutZ, fieldBindingZ, mainDataZ } from '../primitives';
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
        title: z.string().optional(),
        nameField: fieldBindingZ,
        valueField: fieldBindingZ,
        map: z.enum(['china', 'world']),
        scatter: z.enum(['point', 'effect']).optional(),
        nameMap: z.record(z.string(), z.string()).optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'mapChartComponent' });

componentCatalogRegistry.add(mapChartComponentZ, {
  label: '地图',
  purpose: '展示国家或省级地域分布',
  chooseWhen: ['明确要求中国/世界地图，且地域名称能映射到地图'],
  dataShape: '地域名称 dimension 字段 + 一个 metric 数值字段',
  title: 'optional',
  defaultSpan: 8
});
