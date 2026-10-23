import { compareOpinionRows, type MemberId, type OpinionRow, type SortRule } from './model';
import { previewError, type MemberReader } from './member-source';

interface Cursor { member: MemberId; rows: OpinionRow[]; index: number; consumed: number; totalCount: number; }
export interface MergeRequest {
  members: MemberId[]; sort: readonly SortRule[]; offset: number; limit: number; batchSize: number;
}

async function openCursor(member: MemberId, request: MergeRequest, read: MemberReader, signal: AbortSignal): Promise<Cursor> {
  const page = await read({ member, offset: 0, limit: request.batchSize, sort: request.sort }, signal);
  return { member, ...page, index: 0, consumed: 0 };
}

async function refill(cursor: Cursor, request: MergeRequest, read: MemberReader, signal: AbortSignal): Promise<void> {
  if (cursor.index < cursor.rows.length || cursor.consumed >= cursor.totalCount) return;
  const page = await read({ member: cursor.member, offset: cursor.consumed, limit: request.batchSize, sort: request.sort }, signal);
  if (page.totalCount !== cursor.totalCount || !page.rows.length) throw previewError('DQE_ROW_CONTRACT_ERROR', '合成分页结果不完整');
  cursor.rows = page.rows;
  cursor.index = 0;
}

function firstCursor(cursors: Cursor[], sort: readonly SortRule[]): Cursor | undefined {
  let first: Cursor | undefined;
  for (const cursor of cursors) {
    if (cursor.index >= cursor.rows.length) continue;
    if (!first || compareOpinionRows(cursor.rows[cursor.index]!, first.rows[first.index]!, sort) < 0) first = cursor;
  }
  return first;
}

/** Consumes only ordered pages; a cold deep jump scans the preceding prefix. */
export async function mergeOpinionPage(request: MergeRequest, read: MemberReader, signal: AbortSignal) {
  const cursors = await Promise.all(request.members.map(member => openCursor(member, request, read, signal)));
  const totalCount = cursors.reduce((sum, cursor) => sum + cursor.totalCount, 0);
  const rows: OpinionRow[] = [];
  for (let position = 0; position < request.offset + request.limit; position++) {
    signal.throwIfAborted();
    await Promise.all(cursors.map(cursor => refill(cursor, request, read, signal)));
    const next = firstCursor(cursors, request.sort);
    if (!next) break;
    if (position >= request.offset) rows.push(next.rows[next.index]!);
    next.index++;
    next.consumed++;
  }
  return { rows, totalCount };
}
