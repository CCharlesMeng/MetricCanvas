# Report date filters / Tiny OS picker / complete PDF: main delivery

Base: `e95086c988e5de3b93c00f949f662e083fa27ac3`.

This delivery is validated in an independent checkout containing only the reviewed report requirement and regenerated contracts. Unrelated IOC/allMissing and chart-axis working-tree changes are excluded.

## Scope

- Schema 6.13 report-header date controls, month/date point and range forms; extraction confirmation and manual editing create parameters, filters, bindings and header placement together.
- Shared Tiny OS date-picker presentation, including popovers and embedded ShadowRoot use.
- Per-instance `withExportView` prepares complete current-filter data, all section groups/tabs, charts and tables, removes controls and retains the applied report period. The host owns PDF encoding.
- Playground demonstrates a real local Chromium PDF download and preview. This is local synthetic-data evidence, not deployed Relay/DQE validation.

## Delivery maintenance

- Regenerate contract snapshots and public API snapshots from current source; retain source-driven bundles.
- Move static-export CSS into the components that own the affected markup; section visibility also belongs to RuntimeSection. DatePicker may style only its own `.mc-date-picker` namespace.
- Split authoring validation helpers without changing error semantics; pinned Radon 6.0.1 maximum complexity is 15 (limit 15).
- Update normalized-schema expectations to versionPolicy.current, the reference negative-witness count to 12, and narrow the money field before accessing defaultFormat.
- Correct the stale Platform port test to the existing fixed 5174 configuration; no development server behavior changes.

## Verified locally

- TypeScript: 189 files passed; 1645 tests passed, 5 skipped.
- Python authoring: 522 tests completed, zero failures/errors, 1 skipped; deterministic scripted scenarios passed, no real model calls.
- Full type checks: passed; Svelte 0 errors / 0 warnings.
- Product build, platform HTML microfrontend archive and package entry/declaration checks: passed.
- Page validation, contract freshness, bundle integrity (1767 digests), ADR index and complexity checks: passed.
- Final browser download: 8 A4 pages, all three 53-row tables (159 rows), chart and both content groups. PDF pages were rendered and inspected; date controls and paging controls absent, current period retained.

Logs and final PDF montage: [main-delivery evidence](evidence/main-delivery). Remote SHA and completed GitHub CI are reported separately after push.
