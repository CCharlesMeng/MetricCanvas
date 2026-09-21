import iocDimensionValuesJson from '../fixtures/ioc-dimension-values.json';
import { findDimension, semanticSurface } from './semantic-surface';

export interface DimensionValueCandidate {
  value: string;
  label: string;
}

interface IocDimensionValuesFixture {
  dimensions: Record<
    string,
    {
      /** 级联的唯一上游维度;缺席表示该维度不接受任何约束。 */
      parent?: string;
      values: Array<{ value: string; label?: string; of?: string }>;
    }
  >;
}

/**
 * 只服务候选值端口的 IOC 维度闭集，真源是 `fixtures/ioc-dimension-values.json`。
 * 它不属于问数语义面，也不参与指标、业务域或 Schema 元数据投影；这样本地
 * 联调可验真，同时不虚构 IOC 指标口径。
 *
 * 放在夹具 JSON 而不是这里的字面量，是因为嵌入测试宿主要用纯 node 读同一份
 * 闭集回答候选值查询（ADR-0074 的隔离基线跑不了 TypeScript）。
 */
const iocFixture = iocDimensionValuesJson as IocDimensionValuesFixture;

const iocDimensionValues: Readonly<Record<string, readonly DimensionValueCandidate[]>> =
  Object.fromEntries(
    Object.entries(iocFixture.dimensions).map(([name, declaration]) => [
      name,
      declaration.values.map((entry) => candidate(entry.value, entry.label ?? entry.value))
    ])
  );

/** 该下游维度声明的上游维度;没有级联关系时返回 undefined。 */
export function parentDimensionOf(name: string): string | undefined {
  return Object.hasOwn(iocFixture.dimensions, name)
    ? iocFixture.dimensions[name]?.parent
    : undefined;
}

/**
 * 按上游取值收窄下游候选值。上游取值为空集合视作不约束;下游取值没有登记
 * 归属的一律落选,不当作"无从判断所以保留"。
 */
export function narrowByParent(
  name: string,
  candidates: readonly DimensionValueCandidate[],
  parentValues: readonly string[]
): readonly DimensionValueCandidate[] {
  if (parentValues.length === 0) return candidates;
  const owners = new Map(
    (Object.hasOwn(iocFixture.dimensions, name)
      ? iocFixture.dimensions[name]?.values ?? []
      : []
    ).flatMap((entry) => (entry.of === undefined ? [] : [[entry.value, entry.of] as const]))
  );
  const allowed = new Set(parentValues);
  return candidates.filter((item) => {
    const owner = owners.get(item.value);
    return owner !== undefined && allowed.has(owner);
  });
}

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
