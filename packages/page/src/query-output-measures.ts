type JsonRecord = Record<string, unknown>;

/** 页面数值语义由显式字段契约决定，不从 DQE 投影位置或样例值推断。 */
export function isNumericMeasure(field: { type?: unknown; role?: unknown }): boolean {
  return field.role === 'measure' && (field.type === 'number' || field.type === 'money');
}

/** 原始文档能力探测：覆盖平铺/分组字段及普通/静态分支查询。 */
export function hasNumericDimensionMeasure(value: unknown): boolean {
  const source = record(record(value)?.source);
  if (source?.type !== 'query') return false;
  const query=record(source.query),fields=record(record(value)?.fields);
  const outputs = dimensionOutputs(query);
  return branchDimensionMeasure(fields,query) || measureFields(fields).some(field =>
    isNumericMeasure(field) && typeof field.queryField === 'string' && outputs.has(field.queryField)
  );
}

function branchDimensionMeasure(fields:JsonRecord|undefined,query:JsonRecord|undefined):boolean {
  for(const leaf of Object.values(record(record(query?.queryModes)?.cases)??{})){
    const branch=record(leaf),outputs=dimensionOutputs(branch);
    if(Object.entries(record(branch?.fieldMappings)??{}).some(([id,name])=>
      typeof name==='string'&&outputs.has(name)&&isNumericMeasure(record(fields?.[id])??{})
    ))return true;
  }
  return false;
}

function dimensionOutputs(query: JsonRecord | undefined): Set<string> {
  const leaves = [query,
    ...Object.values(record(record(query?.queryModes)?.cases) ?? {}),
    ...Object.values(record(record(query?.timeModes)?.cases) ?? {})];
  const names = new Set<string>();
  for (const leaf of leaves) {
    const items = record(record(leaf)?.body)?.dsl_list;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      for (const name of dimensionNames(item)) names.add(name);
    }
  }
  return names;
}

function dimensionNames(item: unknown): string[] {
  const value = record(item);
  if (!Array.isArray(value?.output_dims)) return [];
  const period = record(record(value.filter)?.time)?.period;
  return value.output_dims.filter((name): name is string => typeof name === 'string')
    .flatMap(name => typeof period === 'string' ? [name, `${name}(${period})`] : [name]);
}

function measureFields(fields: JsonRecord | undefined): JsonRecord[] {
  if (!fields) return [];
  if (Object.hasOwn(fields, 'dimensions') || Object.hasOwn(fields, 'measures')) {
    return Object.values(record(fields.measures) ?? {}).map(field => ({ ...record(field), role: 'measure' }));
  }
  return Object.values(fields).flatMap(field => {
    const definition = record(field);
    return definition ? [definition] : [];
  });
}

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : undefined;
}
