import { z } from 'zod';
import { fieldNameZ, idZ } from './primitives';

/**
 * 页面级筛选器声明。领域态 `FilterDeclaration`（`filter.ts`）与这里的
 * z.infer 结构一致，`Page.filters` 直接复用本模块的类型。
 */

const dimensionFilterZ = z
  .object({
    id: idZ,
    type: z.literal('dimension'),
    dimension: fieldNameZ,
    label: z.string().optional(),
    display: z.enum(['select', 'tabs', 'tree', 'search']).optional(),
    visible: z.boolean().optional(),
    default: z.array(z.string()).optional()
  })
  .meta({ id: 'dimensionFilter' });

const timeRangeValueZ = z
  .object({ from: z.string(), to: z.string() })
  .strict();

const timeRangeFilterZ = z
  .object({
    id: idZ,
    type: z.literal('timeRange'),
    label: z.string().optional(),
    precision: z.enum(['date', 'datetime']).optional(),
    visible: z.boolean().optional(),
    default: z.union([z.enum(['today', 'last7d', 'last30d', 'last90d']), timeRangeValueZ]).optional()
  })
  .meta({ id: 'timeRangeFilter' });

export const filterDeclarationZ = z
  .discriminatedUnion('type', [dimensionFilterZ, timeRangeFilterZ]);
