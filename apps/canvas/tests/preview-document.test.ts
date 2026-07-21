import { describe, expect, it, vi } from 'vitest';
import { validate, type Page } from '@metriccanvas/page';
import {
  DEFAULT_PREVIEW_JSON,
  parsePreviewDocument
} from '../src/lib/preview-document';

describe('Page JSON 即时预览文档', () => {
  it('内置示例通过当前契约，并且只包含 inline 数据和无交互组件', () => {
    const result = parsePreviewDocument(DEFAULT_PREVIEW_JSON, validate);

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;

    const page = result.document as Page;
    expect(
      page.sections.flatMap((section) => section.components.map((component) => component.type))
    ).toEqual(['reportHeader', 'metricCard', 'lineChart']);
    expect(Object.values(page.dataSources).every((source) => source.source.type === 'inline')).toBe(
      true
    );
    expect(page.filters).toBeUndefined();
    expect(
      page.sections
        .flatMap((section) => section.components)
        .every((component) => !('actions' in component.props))
    ).toBe(true);
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
});
