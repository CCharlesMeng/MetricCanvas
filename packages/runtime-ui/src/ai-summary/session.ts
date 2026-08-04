import type { AiSummaryRequest, AiSummaryRequestInput } from './assemble-request';
import type { AiSummaryTransport } from './pangu-sse';

export type AiSummarySnapshot =
  | { status: 'loading' }
  | { status: 'streaming'; text: string }
  | { status: 'ready'; text: string }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } };

export interface AiSummarySession {
  subscribe(run: (snapshot: AiSummarySnapshot) => void): () => void;
  update(input: AiSummaryRequestInput): void;
  retry(): void;
  dispose(): void;
}

export function createAiSummarySession(transport: AiSummaryTransport): AiSummarySession {
  const subscribers = new Set<(snapshot: AiSummarySnapshot) => void>();
  let snapshot: AiSummarySnapshot = { status: 'loading' };
  let activeFingerprint: string | null = null;
  let lastReadyInput: Extract<AiSummaryRequestInput, { status: 'ready' }> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  let disposed = false;

  function publish(next: AiSummarySnapshot) {
    snapshot = next;
    for (const subscriber of subscribers) subscriber(snapshot);
  }

  function stop() {
    generation += 1;
    controller?.abort();
    controller = null;
  }

  function start(
    fingerprint: string,
    request: AiSummaryRequest,
    force = false
  ) {
    if (disposed || (!force && fingerprint === activeFingerprint)) return;
    stop();
    activeFingerprint = fingerprint;
    const ownGeneration = generation;
    const ownController = new AbortController();
    controller = ownController;
    publish({ status: 'loading' });
    void (async () => {
      let text = '';
      let finished = false;
      try {
        for await (const event of transport.stream(request, ownController.signal)) {
          if (disposed || ownGeneration !== generation || ownController.signal.aborted) return;
          if (event.type === 'delta') {
            text += event.text;
            publish({ status: 'streaming', text });
          } else {
            finished = true;
            break;
          }
        }
        if (disposed || ownGeneration !== generation || ownController.signal.aborted) return;
        if (!finished) throw new Error('AI 总结 SSE 流在 finish 事件前结束');
        if (!text.trim()) throw new Error('AI 总结 SSE 完成时没有生成内容');
        publish({ status: 'ready', text });
      } catch (cause) {
        if (disposed || ownGeneration !== generation || ownController.signal.aborted) return;
        publish({ status: 'error', error: { message: errorMessage(cause) } });
      } finally {
        if (ownGeneration === generation) controller = null;
      }
    })();
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      run(snapshot);
      return () => subscribers.delete(run);
    },
    update(input) {
      if (disposed) return;
      if (input.status === 'ready') {
        lastReadyInput = input;
        start(input.fingerprint, input.request);
        return;
      }
      stop();
      activeFingerprint = null;
      lastReadyInput = null;
      publish(input);
    },
    retry() {
      if (!lastReadyInput || disposed) return;
      start(lastReadyInput.fingerprint, lastReadyInput.request, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      subscribers.clear();
    }
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'AI 总结生成失败';
}
