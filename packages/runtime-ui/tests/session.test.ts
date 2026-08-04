import { describe, expect, it, vi } from 'vitest';
import { createAiSummarySession, type AiSummarySnapshot } from '../src/ai-summary/session';

describe('AI 总结组件会话', () => {
  it('相同输入不重复生成，手动重试才重新调用', async () => {
    const stream = vi.fn(async function* () {
      yield { type: 'delta' as const, text: '完成' };
      yield { type: 'finish' as const };
    });
    const session = createAiSummarySession({ stream });
    let snapshot: AiSummarySnapshot = { status: 'loading' };
    session.subscribe((next) => (snapshot = next));
    const input = readyInput('same', 'A');

    session.update(input);
    await vi.waitFor(() => expect(snapshot).toEqual({ status: 'ready', text: '完成' }));
    session.update(input);
    expect(stream).toHaveBeenCalledTimes(1);
    session.retry();
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(2));
    session.dispose();
  });

  it('数据变化 Abort 旧流且旧代次不能覆盖新内容', async () => {
    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    let calls = 0;
    const stream = vi.fn(async function* (_request, signal: AbortSignal) {
      calls += 1;
      if (calls === 1) {
        yield { type: 'delta' as const, text: '旧' };
        await firstGate;
        expect(signal.aborted).toBe(true);
        yield { type: 'delta' as const, text: '迟到' };
        yield { type: 'finish' as const };
        return;
      }
      yield { type: 'delta' as const, text: '新' };
      yield { type: 'finish' as const };
    });
    const session = createAiSummarySession({ stream });
    let snapshot: AiSummarySnapshot = { status: 'loading' };
    session.subscribe((next) => (snapshot = next));

    session.update(readyInput('first', 'A'));
    await vi.waitFor(() => expect(snapshot).toEqual({ status: 'streaming', text: '旧' }));
    session.update(readyInput('second', 'B'));
    await vi.waitFor(() => expect(snapshot).toEqual({ status: 'ready', text: '新' }));
    releaseFirst();
    await Promise.resolve();
    expect(snapshot).toEqual({ status: 'ready', text: '新' });
    session.dispose();
  });

  it('空数据不调用 SSE', () => {
    const stream = vi.fn();
    const session = createAiSummarySession({ stream });
    let snapshot: AiSummarySnapshot = { status: 'loading' };
    session.subscribe((next) => (snapshot = next));
    session.update({ status: 'empty' });
    expect(snapshot).toEqual({ status: 'empty' });
    expect(stream).not.toHaveBeenCalled();
  });
});

function readyInput(fingerprint: string, office: string) {
  return {
    status: 'ready' as const,
    fingerprint,
    request: {
      promptTemplate: '只使用数据',
      datasets: [{ id: 'risk', question: '风险', data: { office: [office] } }],
      termMapping: { office: '代表处' }
    }
  };
}
