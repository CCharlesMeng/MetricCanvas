import { describe, expect, it, vi } from 'vitest';
import { parsePage, validate, versionPolicy } from '@metriccanvas/page';
import {
  DEFAULT_PREVIEW_PAGE,
  DEFAULT_PREVIEW_JSON,
  parsePreviewDocument
} from '../src/lib/preview-document';

describe('Page JSON 即时预览文档', () => {
  it('默认预览使用 Tokens 月报并通过页面校验', () => {
    expect(DEFAULT_PREVIEW_PAGE.id).toBe('new-page');
    expect(validate(DEFAULT_PREVIEW_PAGE)).toEqual([]);

    const parsed = parsePage(DEFAULT_PREVIEW_PAGE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.page.sections).toHaveLength(5);
    expect(parsed.page.sections[0]?.components.map((component) => component.type)).toEqual([
      'reportHeader'
    ]);
  });

  it('JSON 解析成功后调用 validator，并返回契约错误', () => {
    const validator = vi.fn(validate);
    const result = parsePreviewDocument('{"schemaVersion":"1.0"}', validator);

    expect(validator).toHaveBeenCalledOnce();
    expect(result.status).toBe('contract-error');
  });

  it('语法错误不会调用 validator，也不会抛出异常', () => {
    const validator = vi.fn(validate);
    const result = parsePreviewDocument('{"schemaVersion":', validator);

    expect(validator).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'syntax-error' });
  });

  it('默认 JSON 可直接通过即时预览入口', () => {
    expect(parsePreviewDocument(DEFAULT_PREVIEW_JSON, validate)).toMatchObject({
      status: 'valid',
      document: { id: 'new-page' }
    });
  });
});

const legacyPreviewPage = {
  "schemaVersion": "6.5",
  "id": "playground-preview-example",
  "meta": {
    "description": "页面试验场 JSON 即时预览的内部最小示例"
  },
  "dataSources": {},
  "sections": [
    {
      "id": "preview",
      "components": [
        {
          "id": "header",
          "type": "reportHeader",
          "layout": {
            "span": 12
          },
          "props": {
            "title": "MetricCanvas 页面预览",
            "subtitle": "编辑左侧 JSON，并在此查看统一运行时结果"
          }
        },
        {
          "id": "guidance",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "title": "声明式页面",
            "body": "默认示例仅用于演示 Schema 4.0 的编辑与校验，不代表任何正式页面。"
          }
        }
      ]
    }
  ],
  "layout": "report"
};

it('旧页面预览只向后续流程交规范文档，保留文本引用及数据', () => {
  const { layout: _layout, ...content } = legacyPreviewPage;
  const input = { ...content, schemaVersion: '6.5', layoutForm: 'dashboard' };
  const result = parsePreviewDocument(JSON.stringify(input), validate);
  expect(result).toMatchObject({ status: 'valid', document: { ...content, schemaVersion: '6.5', layout: 'dashboard' } });
  if (result.status === 'valid') expect(result.document).not.toHaveProperty('layoutForm');
});

it.each(['5.0', '5.1', '5.2', '5.3', '5.4'])('%s 页面可由页面试验场预览，并规范化为 6.x 运行态文档', (schemaVersion) => {
  const { layout: _layout, ...content } = legacyPreviewPage;
  const result = parsePreviewDocument(
    JSON.stringify({ ...content, schemaVersion }),
    validate
  );
  expect(result).toMatchObject({
    status: 'valid',
    document: { ...content, schemaVersion: versionPolicy.current, layout: 'report' }
  });
});
