import type { AiSummaryProps, FieldValue } from '@metriccanvas/page';
import type { PageDataSnapshots } from '@metriccanvas/runtime';

export interface AiSummaryDataset {
  id: string;
  question: string;
  data: Record<string, FieldValue[]>;
}

export interface AiSummaryRequest {
  title?: string;
  promptTemplate: string;
  datasets: AiSummaryDataset[];
  termMapping: Record<string, string>;
}

export type AiSummaryRequestInput =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: { message: string } }
  | { status: 'ready'; fingerprint: string; request: AiSummaryRequest };

/**
 * 从页面数据快照中只选择 relatedData 明示的字段。这个函数是页面数据离开
 * 浏览器前的最后一道白名单边界，不会隐式附带整行或其他页面数据源。
 */
export function assembleAiSummaryRequest(
  props: AiSummaryProps,
  snapshots: PageDataSnapshots
): AiSummaryRequestInput {
  const relatedEntries = Object.entries(props.relatedData);
  const relatedSnapshots = relatedEntries.map(([, related]) => snapshots.get(related.source));
  const failed = relatedSnapshots.find(
    (snapshot) => snapshot?.status === 'error'
  );
  if (failed?.status === 'error') return { status: 'error', error: failed.error };
  if (relatedSnapshots.some((snapshot) => !snapshot || snapshot.status === 'loading')) {
    return { status: 'loading' };
  }
  if (
    relatedSnapshots.some(
      (snapshot) => snapshot?.status === 'empty' ||
        (snapshot?.status === 'ready' && snapshot.rows.length === 0)
    )
  ) {
    return { status: 'empty' };
  }

  const termMapping: Record<string, string> = {};
  const datasets: AiSummaryDataset[] = relatedEntries.map(([id, related]) => {
    const snapshot = snapshots.get(related.source);
    if (snapshot?.status !== 'ready') {
      throw new Error(`关联数据 ${related.source} 尚未就绪`);
    }
    const data = Object.fromEntries(
      related.fields.map(({ field, term }) => {
        termMapping[field] = term;
        return [field, snapshot.rows.map((row) => row[field] ?? null)];
      })
    );
    return { id, question: related.description, data };
  });
  const request: AiSummaryRequest = {
    ...(props.title ? { title: props.title } : {}),
    promptTemplate: props.promptTemplate,
    datasets,
    termMapping
  };
  return { status: 'ready', request, fingerprint: JSON.stringify(request) };
}
