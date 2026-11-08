/** Cross-month aggregation uses stable page field IDs, independently of rendering. */
export interface PeriodAggregationCase {
  groupBy: string[];
  aggregations: Array<{ field: string; aggregate: 'sum' | 'avg' }>;
}

export interface PeriodAggregation {
  filterId: string;
  cases: { last12Months: PeriodAggregationCase };
}
