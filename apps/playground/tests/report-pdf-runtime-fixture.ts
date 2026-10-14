import { mount, unmount } from 'svelte';
import RuntimeView from '../../../packages/engine/runtime-ui/src/RuntimeView.svelte';
import type { PreparedExportView } from '@metriccanvas/engine/ui/types';
import { downloadReportPdf } from '../src/lib/report-pdf-client';

/** Browser-only entry: exercises the actual runtime, row alignment and prepared export boundary. */
export function mountPdfRuntimeFixture(target: HTMLElement, document: unknown) {
  const runtime = mount(RuntimeView, { target, props: { document } });
  return {
    dispose: () => unmount(runtime),
    export: (consume: (view: HTMLElement) => void) => runtime.withExportView(async ({ target: view, signal }: PreparedExportView) => {
      consume(view);
      return downloadReportPdf(view, signal, 'runtime-fidelity.pdf');
    })
  };
}
