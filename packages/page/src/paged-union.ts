import type { z } from 'zod';
import type { pagedUnionDataSourceZ, pagedUnionSourceZ } from './schema/paged-union';
export type PagedUnionSource = z.infer<typeof pagedUnionSourceZ>;
export type PagedUnionMember = PagedUnionSource['members'][string];
export type PagedUnionDataSource = z.infer<typeof pagedUnionDataSourceZ> & { compute?: never };
