import { z } from 'zod';
import { componentIdZ, componentLayoutZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';

export const reportHeaderComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('reportHeader'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        generatedBy: z.string().optional(),
        badge: z.string().optional(),
        asOf: z
          .object({ label: z.string().min(1), value: z.string().min(1) })
          .strict()
          .optional(),
        tags: z.array(z.string().min(1)).optional(),
        decoration: z.literal('shortBar').optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'reportHeaderComponent' });

componentCatalogRegistry.add(reportHeaderComponentZ, {
  label: '报告页头',
  purpose: '表达页面标题、说明、时间点与标签',
  chooseWhen: ['任何完整看板页面的开头'],
  dataShape: '不绑定页面数据源',
  title: 'required',
  defaultSpan: 12
});
