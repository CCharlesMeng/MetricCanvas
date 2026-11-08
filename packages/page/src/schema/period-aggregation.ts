import { z } from 'zod';
import { fieldNameZ, idZ } from './primitives';

const aggregationCaseZ = z.object({
  groupBy: z.array(fieldNameZ).meta({ uniqueItems: true }),
  aggregations: z.array(z.object({
    field: fieldNameZ,
    aggregate: z.enum(['sum', 'avg']).describe('sum 累加有效月值，avg 对有效月值取算术平均；空值及缺月不补零')
  }).strict()).min(1).describe('逐字段的显式跨月聚合规则，必须覆盖全部查询数值度量且不得重复')
}).strict();

export const periodAggregationZ = z.object({
  filterId: idZ,
  cases: z.object({ last12Months: aggregationCaseZ.describe('所选期间为近一年时，按业务维度聚合已应用的十二个完整月') }).strict()
}).strict().meta({ id: 'periodAggregation' });
