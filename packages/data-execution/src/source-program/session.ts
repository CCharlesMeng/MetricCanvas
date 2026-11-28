import type { Page } from '@metriccanvas/page/internal';
import { createSourceCandidateSession } from '../source-candidates';
import {
  createCoreSourceProgram,
  defaultSourceView,
  type SourceProgram,
  type SourceProgramConfig,
  type SourceRead,
  type SourceUpdate,
} from './core';

export { defaultSourceView, type SourceProgram, type SourceRead, type SourceUpdate };

/** All execution policies are owned here; adapters own publication and lifecycle. */
export function createSourceProgram(page: Page, config: SourceProgramConfig): SourceProgram {
  const candidateSession =
    config.candidateSession ?? createSourceCandidateSession(page, config.gateway, config);
  return createCoreSourceProgram(page, {
    ...config,
    candidateSession,
    ownsCandidateSession: !config.candidateSession,
  });
}
