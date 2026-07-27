import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@metriccanvas/agent-runner';
import { validatedAgentDocument } from '../src/lib/server/agent-events.server';

describe('Agent 事件工作副本提取', () => {
  it('不把校验失败的页面文档返回给工作台画布', () => {
    const invalidDocument = { schemaVersion: '1.0', id: '__pending__' };
    const events: AgentEvent[] = [
      {
        type: 'tool_finished',
        call: {
          id: 'validate-invalid',
          name: 'validate_page',
          input: { document: invalidDocument }
        },
        result: {
          structuredContent: {
            ok: true,
            valid: false,
            errors: [{ code: 'PAGE_ID_PLACEHOLDER', path: '/id' }]
          }
        }
      }
    ];

    expect(validatedAgentDocument(events)).toBeNull();
  });

  it('返回最近一次校验通过的页面文档', () => {
    const validDocument = { schemaVersion: '1.0', id: 'gmv-metric-card' };
    const events: AgentEvent[] = [
      {
        type: 'tool_finished',
        call: {
          id: 'validate-valid',
          name: 'validate_page',
          input: { document: validDocument }
        },
        result: {
          structuredContent: { ok: true, valid: true, errors: [] }
        }
      }
    ];

    expect(validatedAgentDocument(events)).toEqual(validDocument);
  });
});
