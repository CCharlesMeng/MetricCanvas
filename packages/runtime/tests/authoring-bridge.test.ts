import { describe, expect, it } from 'vitest';
import {
  authoringRenderMessage,
  parseAuthoringHostMessage,
  parseAuthoringRuntimeMessage
} from '../src/authoring';

const document = {
  schemaVersion: '1.0',
  id: 'sales-overview',
  dataSources: {},
  sections: []
};

describe('统一运行时 authoring bridge', () => {
  it('只接受协议版本和会话标识匹配的未保存工作副本消息', () => {
    const message = authoringRenderMessage('session-1', document);

    expect(parseAuthoringHostMessage(message, 'session-1')).toEqual(message);
    expect(parseAuthoringHostMessage(message, 'session-2')).toBeNull();
    expect(
      parseAuthoringHostMessage({ ...message, version: 2 }, 'session-1')
    ).toBeNull();
  });

  it('把组件选择、移动、跨度和内容编辑解析为稳定结构化定位', () => {
    const messages = [
      {
        protocol: 'metriccanvas-authoring',
        version: 1,
        sessionId: 'session-1',
        type: 'ready'
      },
      {
        protocol: 'metriccanvas-authoring',
        version: 1,
        sessionId: 'session-1',
        type: 'intent',
        intent: {
          type: 'select_component',
          locator: { sectionId: 'overview', componentId: 'gmv' }
        }
      },
      {
        protocol: 'metriccanvas-authoring',
        version: 1,
        sessionId: 'session-1',
        type: 'intent',
        intent: {
          type: 'move_component',
          locator: { sectionId: 'overview', componentId: 'gmv' },
          before: { sectionId: 'overview', componentId: 'trend' }
        }
      },
      {
        protocol: 'metriccanvas-authoring',
        version: 1,
        sessionId: 'session-1',
        type: 'intent',
        intent: {
          type: 'edit_component',
          locator: { sectionId: 'overview', componentId: 'gmv' },
          edit: { title: '核心成交额', detail: '截至今日', span: 6 }
        }
      }
    ];

    expect(
      messages.map((message) => parseAuthoringRuntimeMessage(message, 'session-1'))
    ).toEqual(messages);
    expect(
      parseAuthoringRuntimeMessage(
        {
          ...messages[1],
          intent: {
            type: 'select_component',
            locator: { sectionId: '', componentId: 'gmv' }
          }
        },
        'session-1'
      )
    ).toBeNull();
  });
});
