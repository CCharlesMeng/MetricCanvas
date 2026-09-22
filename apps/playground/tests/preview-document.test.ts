import { describe, expect, it, vi } from 'vitest';
import { parsePage, validate } from '@metriccanvas/page';
import {
  DEFAULT_PREVIEW_PAGE,
  DEFAULT_PREVIEW_JSON,
  parsePreviewDocument
} from '../src/lib/preview-document';

describe('Page JSON 即时预览文档', () => {
  it('默认预览使用页面试验场内部最小示例并通过 v4 校验', () => {
    expect(DEFAULT_PREVIEW_PAGE.id).toBe('playground-preview-example');
    expect(validate(DEFAULT_PREVIEW_PAGE)).toEqual([]);

    const parsed = parsePage(DEFAULT_PREVIEW_PAGE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.page.sections).toHaveLength(1);
    expect(parsed.page.sections[0]?.components.map((component) => component.type)).toEqual([
      'reportHeader',
      'text'
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
      document: { id: 'playground-preview-example' }
    });
  });
});

it('旧页面预览只向后续流程交规范文档，保留文本引用及数据', () => {
  const { layout: _layout, ...content } = DEFAULT_PREVIEW_PAGE;
  const input = { ...content, schemaVersion: '6.5', layoutForm: 'dashboard' };
  const result = parsePreviewDocument(JSON.stringify(input), validate);
  expect(result).toMatchObject({ status: 'valid', document: { ...content, schemaVersion: '6.5', layout: 'dashboard' } });
  if (result.status === 'valid') expect(result.document).not.toHaveProperty('layoutForm');
});

it.each(['5.0', '5.1', '5.2', '5.3', '5.4'])('%s 页面可由页面试验场预览，并规范化为 6.x 运行态文档', (schemaVersion) => {
  const { layout: _layout, ...content } = DEFAULT_PREVIEW_PAGE;
  const result = parsePreviewDocument(
    JSON.stringify({ ...content, schemaVersion }),
    validate
  );
  expect(result).toMatchObject({
    status: 'valid',
    document: { ...content, schemaVersion: '6.11', layout: 'report' }
  });
});
