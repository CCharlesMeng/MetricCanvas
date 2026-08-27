import { findDimension, semanticSurface } from './semantic-surface';

export interface DimensionValueCandidate {
  value: string;
  label: string;
}

/**
 * 只服务候选值端口的 IOC 维度闭集。它不属于问数语义面，也不参与指标、
 * 业务域或 Schema 元数据投影；这样本地联调可验真，同时不虚构 IOC 指标口径。
 */
const iocDimensionValues: Readonly<Record<string, readonly DimensionValueCandidate[]>> = {
  'cloud-class': [candidate('公有云')],
  'project-initiation-level': ['L1', 'L2', 'L3', 'L4'].map((value) => candidate(value)),
  'geo-pc-code': [
    candidate('R05', '欧洲'),
    candidate('TBD-APAC', '亚太'),
    candidate('TBD-NAF', '北部非洲'),
    candidate('TBD-MECA', '中东中亚'),
    candidate('R99', '中国'),
    candidate('TBD-LATAM', '拉美'),
    candidate('TBD-SAF', '南部非洲'),
    candidate('TBD-RU', '俄罗斯')
  ],
  'region-dept-code': [
    candidate('CN-BJ', '北京'),
    candidate('CN-SH', '上海'),
    candidate('CN-GD', '广东')
  ],
  'rep-office-code': [
    candidate('SH-01', '上海代表处'),
    candidate('BJ-01', '北京代表处'),
    candidate('GD-01', '广东代表处'),
    candidate('SZ-01', '深圳代表处'),
    candidate('HZ-01', '杭州代表处'),
    candidate('CD-01', '成都代表处'),
    candidate('SG-01', '新加坡代表处'),
    candidate('TJ-01', '天津代表处')
  ]
};

export function dimensionValuesFor(
  name: string
): readonly DimensionValueCandidate[] | undefined {
  const semanticValues = semanticSurface.flatMap(
    (domain) =>
      (findDimension(domain, name)?.values ?? []).map((value) => candidate(value))
  );
  const iocValues = Object.hasOwn(iocDimensionValues, name)
    ? iocDimensionValues[name] ?? []
    : [];
  const values = new Map<string, DimensionValueCandidate>();
  for (const item of [...semanticValues, ...iocValues]) {
    if (!values.has(item.value)) values.set(item.value, item);
  }
  return values.size > 0 ? [...values.values()] : undefined;
}

function candidate(value: string, label: string = value): DimensionValueCandidate {
  return { value, label };
}
