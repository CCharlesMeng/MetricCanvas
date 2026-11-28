import { DqeGatewayError } from '@metriccanvas/data-execution/dqe';
import { afterEach, describe, expect, it, vi } from 'vitest';

const warnSpy = vi.hoisted(() => vi.fn());

vi.mock('@metriccanvas/data-execution/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@metriccanvas/data-execution/runtime')>();
  return {
    ...actual,
    debugWarn: (...args: unknown[]) => warnSpy(...args),
  };
});

import { classifyRuntimeError, warnRuntimeFallback } from '../src/runtime-errors';

describe('runtime-errors 运行时错误分类与告警', () => {
  afterEach(() => {
    warnSpy.mockReset();
  });

  it('将异步定稿/初始化上下文异常归类为 DATA_CONTEXT_ERROR 并记录 debugWarn', () => {
    const cause = new Error('finalization date out of declared range');
    const error = classifyRuntimeError(cause, '/filters', '定稿日期无法生成合法的时间默认值');

    expect(error).toEqual({
      type: 'DATA_CONTEXT_ERROR',
      path: '/filters',
      message: '定稿日期无法生成合法的时间默认值',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[MetricCanvas][DATA_CONTEXT_ERROR] /filters: 定稿日期无法生成合法的时间默认值',
      { cause },
    );
  });

  it('将 DqeGatewayError 归类为 DQE_EXECUTION_ERROR 并保留错误码、原始诊断与 debugWarn', () => {
    const cause = new DqeGatewayError('DQE_AUTH_REQUIRED', '需要登录后才能执行查询(401)');
    const error = classifyRuntimeError(cause, '/filters', '定稿日期无法生成合法的时间默认值');

    expect(error).toEqual({
      type: 'DQE_EXECUTION_ERROR',
      path: '/filters',
      message: '定稿日期无法生成合法的时间默认值（DQE_AUTH_REQUIRED: 需要登录后才能执行查询(401)）',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[MetricCanvas][DQE_EXECUTION_ERROR] /filters: 定稿日期无法生成合法的时间默认值',
      { code: 'DQE_AUTH_REQUIRED', cause },
    );
  });

  it('支持携带 DQE_* 错误码的普通结构化对象并保留诊断信息', () => {
    const cause = { code: 'DQE_TIMEOUT', message: 'DQE 请求超过 30000ms 未返回' };
    const error = classifyRuntimeError(
      cause,
      '/filters',
      '时间默认值或可信初始期间不符合声明精度和边界',
    );

    expect(error.type).toBe('DQE_EXECUTION_ERROR');
    expect(error.path).toBe('/filters');
    expect(error.message).toContain('DQE_TIMEOUT');
    expect(error.message).toContain('DQE 请求超过 30000ms 未返回');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warnRuntimeFallback 通过 debugWarn 输出结构化上下文，不静默吞没异常', () => {
    const cause = new Error('route resolver failed');
    warnRuntimeFallback('NAVIGATION_RESOLVE', '解析目标页面路由失败', {
      href: '/pages/target',
      cause,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[MetricCanvas][NAVIGATION_RESOLVE] 解析目标页面路由失败',
      { cause: { href: '/pages/target', cause } },
    );
  });
});
