import type {
  PageLifecycle,
  RevisionReference,
  RevisionResult
} from '@metriccanvas/page-lifecycle';

type RuntimeRevisionServices =
  | {
      role: 'reader';
      lifecycle: Pick<PageLifecycle, 'getPublishedRevision'>;
    }
  | {
      role: 'authoring';
      lifecycle: Pick<PageLifecycle, 'getRevision'>;
    };

/** reader 只读已发布精确修订，authoring 才允许未发布预览。 */
export function readRuntimeRevision(
  services: RuntimeRevisionServices,
  reference: RevisionReference
): Promise<RevisionResult> {
  return services.role === 'reader'
    ? services.lifecycle.getPublishedRevision(reference)
    : services.lifecycle.getRevision(reference);
}
