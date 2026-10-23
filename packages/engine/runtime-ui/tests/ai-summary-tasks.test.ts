import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiSummaryTaskSession } from '../src/ai-summary/runtime/session';
import { summaryContent } from '../src/ai-summary/view/content';
import type { AiSummaryGenerationInput } from '../src/ai-summary/runtime/input';
import type { AiSummarySnapshot } from '../src/ai-summary';

function input(key: string, owner = 'report/revenue'): AiSummaryGenerationInput {
  return { key, owner, question: key, contextInfo: { pageId: 'report', pageRevision: 'r1',
    componentId: owner, sectionIds: [], timeFilters: {}, dataSources: [] } };
}
function deferred() {
  let resolve!: (text: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { promise, resolve };
}
afterEach(() => vi.useRealTimers());

describe('Report summary application tasks', () => {
  it('keeps switched-away work, isolates late results and reuses it after remount', async () => {
    vi.useFakeTimers();
    const old = deferred(), current = deferred();
    const generate = vi.fn((question: string) => question === 'September' ? old.promise : current.promise);
    const session = createAiSummaryTaskSession({ generate, throttleMs: 0 });
    let shown: AiSummarySnapshot = { status: 'loading' };
    const stop = session.watch(input('September'), next => { shown = next; });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    session.watch(input('October'), next => { shown = next; });
    await vi.advanceTimersByTimeAsync(0);
    current.resolve('十月结论');
    await vi.advanceTimersByTimeAsync(0);
    old.resolve('九月结论');
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toMatchObject({ status: 'ready', text: '十月结论' });
    session.watch(input('September'), next => { shown = next; });
    expect(shown).toMatchObject({ status: 'ready', text: '九月结论' });
    expect(generate).toHaveBeenCalledTimes(2);
    session.dispose();
  });

  it('coalesces running input and throttles latest queued input per region', async () => {
    vi.useFakeTimers();
    const gate = deferred();
    const generate = vi.fn((_question: string) => gate.promise);
    const session = createAiSummaryTaskSession({ generate, throttleMs: 1000, concurrency: 2 });
    const stop = session.watch(input('A'), () => {});
    await vi.advanceTimersByTimeAsync(0);
    session.watch(input('A'), () => {});
    stop();
    session.watch(input('B'), () => {});
    session.watch(input('C'), () => {});
    await vi.advanceTimersByTimeAsync(999);
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(generate.mock.calls.map(call => call[0])).toEqual(['A', 'C']);
    gate.resolve('完成');
    await vi.advanceTimersByTimeAsync(0);
    session.dispose();
  });

  it('limits concurrency across independent summaries without sharing their results', async () => {
    vi.useFakeTimers();
    const gates = [deferred(), deferred(), deferred()];
    let call = 0;
    const generate = vi.fn(() => gates[call++]!.promise);
    const session = createAiSummaryTaskSession({ generate, concurrency: 2, throttleMs: 0 });
    for (const owner of ['income', 'customers', 'risk']) session.watch(input(owner, owner), () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(2);
    gates[0]!.resolve('收入结论');
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(3);
    gates[1]!.resolve('客户结论'); gates[2]!.resolve('风险结论');
    await vi.advanceTimersByTimeAsync(0);
    session.dispose();
  });

  it('drops an obsolete queued period when returning to an already cached period', async () => {
    vi.useFakeTimers();
    const generate = vi.fn(async () => '已完成正文');
    const session = createAiSummaryTaskSession({ generate, throttleMs: 1000 });
    session.watch(input('A'), () => {});
    await vi.advanceTimersByTimeAsync(0);
    session.watch(input('B'), () => {});
    session.watch(input('A'), () => {});
    await vi.advanceTimersByTimeAsync(1000);
    expect(generate).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it('freezes inputs and retries failures only on an explicit retry', async () => {
    vi.useFakeTimers();
    const generate = vi.fn().mockRejectedValueOnce(new Error('云宝连接失败')).mockResolvedValue('重试结论');
    const session = createAiSummaryTaskSession({ generate, throttleMs: 0 });
    const request = input('retry');
    let state: AiSummarySnapshot = { status: 'loading' };
    session.watch(request, next => { state = next; });
    request.contextInfo.pageId = 'mutated';
    await vi.advanceTimersByTimeAsync(0);
    expect(generate.mock.calls[0]![1].pageId).toBe('report');
    expect(state).toMatchObject({ status: 'error', error: { message: '云宝连接失败' } });
    session.watch(input('retry'), () => {});
    expect(generate).toHaveBeenCalledTimes(1);
    session.watch(input('retry'), next => { state = next; }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(state).toMatchObject({ status: 'ready', text: '重试结论' });
    session.dispose();
  });

  it('expires unobserved completed results while preserving active work', async () => {
    vi.useFakeTimers();
    const generate = vi.fn(async () => '结果');
    const session = createAiSummaryTaskSession({ generate, ttlMs: 100, maxEntries: 1, throttleMs: 0 });
    const stop = session.watch(input('old'), () => {});
    await vi.advanceTimersByTimeAsync(0); stop();
    await vi.advanceTimersByTimeAsync(101);
    session.watch(input('old'), () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(2);
    session.dispose();
  });

  it('uses an exact initial input without making a network request', () => {
    const generate = vi.fn();
    const session = createAiSummaryTaskSession({ generate });
    let state: AiSummarySnapshot = { status: 'loading' };
    session.watch({ ...input('initial'), initialBody: '<p>后端首屏正文</p>' }, next => { state = next; });
    expect(state).toMatchObject({ status: 'ready', text: '<p>后端首屏正文</p>' });
    expect(generate).not.toHaveBeenCalled();
    session.dispose();
  });
});

describe('summary HTML tolerance', () => {
  it('keeps valid semantic HTML and falls back to readable text for malformed structure', () => {
    expect(summaryContent('<p><strong>增长</strong></p>').format).toBe('semanticHtml');
    expect(summaryContent('<h2 style="color:red">增长</h2><p><strong>未闭合')).toEqual({
      status: 'ready', format: 'text', text: '增长\n未闭合'
    });
    expect(summaryContent('金额 < 3 且 > 0').text).toBe('金额 < 3 且 > 0');
  });
  it('never executes or exposes scripts, resources or event attributes during fallback', () => {
    const result = summaryContent('<p onclick="alert(1)">结论 &amp; 数据</p><script>alert(1)</script><img src="/secret">');
    expect(result).toEqual({ status: 'ready', format: 'text', text: '结论 & 数据' });
    expect(() => summaryContent('  ')).toThrow('没有返回正文');
  });
});
