import { z } from 'zod';
import { versionPolicy } from './version';
import { pageDocumentSchemaZ } from './schema/page';

/**
 * 结构校验的单一真源已经是 `./schema/`（Zod 4）。这里只做两件手写 JSON
 * Schema 时代遗留、Zod 无法在 `toJSONSchema` 里直接表达的收尾：
 *  - `$id` 是文档级标识，不是某个子 schema 的 `.meta({id})`，需要显式补上。
 *  - draft-7 输出默认没有顶层 `definitions` 键时 ajv 仍可编译，但为了和历史
 *    消费方（`metriccanvas://page/schema` 资源）保持同样的可读结构，这里不做
 *    额外改写，直接使用 Zod 的产出。
 */
const generated = z.toJSONSchema(pageDocumentSchemaZ, { target: 'draft-7' });

export const pageSchema = {
  ...generated,
  $id: `https://metriccanvas/page/v${versionPolicy.current}`
} as const;
