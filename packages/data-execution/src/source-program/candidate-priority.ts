import type { QueryRunner } from '../query-runner';
import { createUnionReader } from '../paged-union/execute';

/** Operational priority only: keep query identity, cache, cancellation and results shared. */
export function candidateQueryRunner(runner: QueryRunner, background = false): QueryRunner {
  if (!background) return runner;
  return { ...runner,
    run: (query, diagnostics, scope, signal) => runner.run(query, diagnostics, scope, signal, true),
    runCandidates: (request, diagnostics, scope, signal) => runner.runCandidates(request, diagnostics, scope, signal, true)
  };
}

export function candidateUnionReader(reader: ReturnType<typeof createUnionReader>, runner: QueryRunner, background = false) {
  return background ? createUnionReader(runner) : reader;
}
