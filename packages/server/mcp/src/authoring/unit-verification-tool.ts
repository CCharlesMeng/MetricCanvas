import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { valueFormatPresets } from '@metriccanvas/page';
import {
  createDataRequestUnitVerification,
  MAX_UNIT_EXECUTIONS_PER_RUN,
  type DataRequestUnitInput,
  type DataRequestUnitVerificationDependencies
} from './unit-verification';

/**
 * 创作期取数单元验真的 MCP 工具(ADR-0032)。工具只负责边界:
 * 输入结构校验与结果包装;清单校验、真实执行与四段失败分类
 * 都在 unit-verification 内完成,不感知 HTTP 与平台。
 */

export const EXECUTE_DATA_REQUEST_UNIT_TOOL = 'execute_data_request_unit';

const scalarQueryFieldSchema = z.object({
  queryField: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'datetime']),
  role: z.enum(['dimension', 'measure']),
  label: z.string().optional(),
  unit: z.string().optional(),
  nullable: z.boolean().optional(),
  defaultFormat: z.enum(valueFormatPresets).optional()
});

const queryFieldSchema = z.union([
  scalarQueryFieldSchema,
  z.object({
    queryField: z.string().min(1),
    type: z.literal('recordList'),
    role: z.literal('detail'),
    label: z.string().optional(),
    nullable: z.boolean().optional(),
    items: z.object({
      fields: z.record(z.string(), scalarQueryFieldSchema)
    })
  }),
  z.object({
    queryField: z.string().min(1),
    type: z.literal('semanticHtml'),
    role: z.literal('detail'),
    label: z.string().optional(),
    nullable: z.boolean().optional()
  })
]);

const dataRequestUnitSchema = z.object({
  dataSourceId: z.string().min(1),
  question: z.string().min(1).optional(),
  fields: z.record(z.string(), queryFieldSchema),
  query: z.object({
    language: z.literal('dqe'),
    body: z.object({
      dsl_list: z.tuple([z.record(z.string(), z.unknown())])
    }),
    filterBindings: z
      .record(
        z.string(),
        z.discriminatedUnion('target', [
          z.object({
            target: z.literal('dimension'),
            queryField: z.string().min(1)
          }),
          z.object({ target: z.literal('time') })
        ])
      )
      .optional()
  })
});

export function registerExecuteDataRequestUnitTool(
  server: McpServer,
  dependencies: DataRequestUnitVerificationDependencies
): void {
  const verify = createDataRequestUnitVerification(dependencies);
  server.registerTool(
    EXECUTE_DATA_REQUEST_UNIT_TOOL,
    {
      description:
        '对取数单元做创作期验真:先清单校验——指标名、维度名、维度取值与时间粒度必须取自数据上下文,' +
        '不在其内时拒绝并给出候选,不执行查询;自由生成的 formula 表达式必须携带问题原文留痕。' +
        '清单校验通过后真实执行查询定义,回传结果字段契约声明的输出字段与样例行,' +
        '不从样例行推断字段类型与语义。失败按发现、生成、执行、呈现四段分类。' +
        `单次运行最多真实执行 ${MAX_UNIT_EXECUTIONS_PER_RUN} 次,超限返回明确失败。`,
      inputSchema: dataRequestUnitSchema,
      annotations: { readOnlyHint: true }
    },
    async (unit) => {
      const result = await verify(unit as unknown as DataRequestUnitInput);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
        ...(result.ok ? {} : { isError: true })
      };
    }
  );
}
