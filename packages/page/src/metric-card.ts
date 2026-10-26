import type { MetricCardProps } from './page';
import type { TypedError } from './errors';

/** 主次指标形态的基数约束；既有指标卡分支保持原有行数语义。 */
export function metricCardShapeErrors(props: MetricCardProps, path: string): TypedError[] {
  if (props.variant !== 'primaryDetail' || props.rows.length === 1) return [];
  return [{
    type: 'SCHEMA_ERROR', path: `${path}/props/rows`,
    message: 'primaryDetail 指标卡必须且只能声明一个主指标；次级指标放入 secondaryRows'
  }];
}
