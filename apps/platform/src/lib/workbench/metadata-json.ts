export type ClipboardWriter = (value: string) => Promise<void>;

export interface MetadataInitialSource {
  id: string;
  emptyRows: boolean;
}

/** 只枚举当前确实携带内嵌初始行的查询页面数据源。 */
export function metadataInitialSources(
  document: Record<string, unknown>
): MetadataInitialSource[] {
  const dataSources = recordOf(document.dataSources);
  if (!dataSources) return [];
  const sources: MetadataInitialSource[] = [];
  for (const [id, value] of Object.entries(dataSources)) {
    const dataSource = recordOf(value);
    const source = recordOf(dataSource?.source);
    if (!source || source.type !== 'query' || !Object.hasOwn(source, 'initial')) {
      continue;
    }
    const initial = recordOf(source.initial);
    sources.push({
      id,
      emptyRows: Array.isArray(initial?.rows) && initial.rows.length === 0
    });
  }
  return sources;
}

/**
 * 页面文档的只读序列化投影：query initial 默认排除，按页面数据源 id
 * 显式保留；静态页面数据源和所有其他字段不变，输入文档不被修改。
 */
export function formatMetadataJson(
  document: Record<string, unknown>,
  includedInitialSourceIds: ReadonlySet<string> = new Set()
): string {
  const projection: Record<string, unknown> = JSON.parse(JSON.stringify(document));
  const dataSources = recordOf(projection.dataSources);
  if (dataSources) {
    for (const [id, value] of Object.entries(dataSources)) {
      const dataSource = recordOf(value);
      const source = recordOf(dataSource?.source);
      if (
        source?.type === 'query' &&
        Object.hasOwn(source, 'initial') &&
        !includedInitialSourceIds.has(id)
      ) {
        delete source.initial;
      }
    }
  }
  return JSON.stringify(projection, null, 2);
}

/** 复制调用只消费抽屉已经展示的字符串，保证展示与剪贴板逐字同源。 */
export async function copyMetadataJson(
  formattedDocument: string,
  writeText: ClipboardWriter = (value) => navigator.clipboard.writeText(value)
): Promise<void> {
  await writeText(formattedDocument);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
