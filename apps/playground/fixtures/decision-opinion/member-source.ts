import { compareOpinionRows, createMemberRows, type MemberId, type OpinionRow, type SortRule } from './model';

export interface MemberRequest { member: MemberId; offset: number; limit: number; sort: readonly SortRule[]; }
export interface MemberPage { rows: OpinionRow[]; totalCount: number; }
export type MemberReader = (request: MemberRequest, signal: AbortSignal) => Promise<MemberPage>;
export interface PreviewOptions { generatedCount?: number; delayMs?: number; failMember?: string | null; }

export function previewError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function waitForRead(delayMs: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(previewError('DQE_CANCELLED', '演示查询已取消')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Two independent pageable mock endpoints. There is no real-network fallback. */
export function createMemberReader(options: PreviewOptions = {}) {
  const rows = {
    contract: createMemberRows('contract', options.generatedCount),
    commercial: createMemberRows('commercial', options.generatedCount)
  };
  const requests: MemberRequest[] = [];
  const read: MemberReader = async (request, signal) => {
    await waitForRead(options.delayMs ?? 8, signal);
    if (request.member === options.failMember) throw previewError('DQE_TIMEOUT', '合成来源超时');
    requests.push(structuredClone(request));
    if (requests.length > 500) requests.shift();
    const ordered = [...rows[request.member]].sort((a, b) => compareOpinionRows(a, b, request.sort));
    return { rows: ordered.slice(request.offset, request.offset + request.limit), totalCount: ordered.length };
  };
  return { read, requests };
}
