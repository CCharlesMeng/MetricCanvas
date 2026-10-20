import { visibilityShape } from '../condition';
import { z } from 'zod';
import {
  idZ,
  componentIdZ,
  componentLayoutZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

const exportButtonFields = {
  label: nonEmptyTextValueZ.optional(),
  filename: nonEmptyTextValueZ.optional()
};
const exportButtonZ = z.discriminatedUnion('format', [
  z.object({ format: z.literal('pdf'), ...exportButtonFields,
    scale: z.unknown().optional()
  }).strict(),
  z.object({ format: z.literal('png'), ...exportButtonFields,
    scale: z.unknown().optional()
  }).strict()
]);

export const reportHeaderComponentZ = z
  .object({
    id: componentIdZ,
    ...visibilityShape,
    type: z.literal('reportHeader'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: nonEmptyTextValueZ,
        filterIds: z.array(idZ).min(1).optional(),
        exportButtons: z.array(exportButtonZ).min(1).max(2).optional(),
        pdfExport: z.object({
          label: nonEmptyTextValueZ.optional(),
          filename: nonEmptyTextValueZ.optional()
        }).strict().optional(),
        pngExport: z.object({
          filename: nonEmptyTextValueZ.optional(),
          scale: z.unknown().optional()
        }).strict().optional(),
        subtitle: textValueZ.optional(),
        subtitleFormat: z.literal('semanticHtml').optional(),
        generatedBy: textValueZ.optional(),
        badge: textValueZ.optional(),
        asOf: z
          .object({ label: nonEmptyTextValueZ, value: nonEmptyTextValueZ })
          .strict()
          .optional(),
        tags: z.array(nonEmptyTextValueZ).optional(),
        variant: z.literal('projectDetail').optional(),
        decoration: z.literal('shortBar').optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'reportHeaderComponent' });

componentCatalogRegistry.add(reportHeaderComponentZ, {
  label: '报告页头',
  purpose: '表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML',
  chooseWhen: ['任何完整页面的开头'],
  dataShape: '不绑定页面数据源',
  authoringShape: { bindsData: false },
  title: 'required',
  defaultSpan: 12
});
