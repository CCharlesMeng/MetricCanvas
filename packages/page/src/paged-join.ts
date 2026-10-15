import type { z } from 'zod';
import type { pagedJoinSourceZ, pagedJoinDataSourceZ } from './schema/paged-join';
export type PagedJoinSource = z.infer<typeof pagedJoinSourceZ>;
export type PagedJoinMember = PagedJoinSource['members'][string];
export type PagedJoinDataSource = z.infer<typeof pagedJoinDataSourceZ> & { compute?: never };
