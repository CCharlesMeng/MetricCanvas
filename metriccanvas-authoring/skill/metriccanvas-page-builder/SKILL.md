---
name: metriccanvas-page-builder
description: Build or revise a MetricCanvas page from a business question through governed data discovery, deterministic assembly, validation, saving, and exact-revision handoff.
---

# MetricCanvas Page Builder

Turn the user's business question into a governed MetricCanvas page. Use the configured stage tools; the page document is produced by the deterministic authoring core.

## Workflow

1. Form a Page Build Spec from the requested business domain, metrics, dimensions, time range, filters, analysis intent, and explicit presentation pins. The spec is complete when every requested view has one unambiguous Data Request Unit.
2. Use the data-context stage to resolve only names and capabilities present in the returned context. If candidates are ambiguous, present their definition differences and wait for the user's choice.
3. Present the effective Data Request Review before execution whenever the configured workflow marks the request as blocking. Apply user corrections to the Page Build Spec, not to generated query or component JSON.
4. Submit the complete Page Build Spec to the governed build stage. Treat its query derivation, verification, component selection, field binding, layout, schema version, validation, and save result as authoritative.
5. Finish only after the build stage returns a saved `pageId`, `revisionId`, and `revisionNumber`. Give the caller those exact identifiers for exact-revision preview.

## Failure handling

- When the data context cannot resolve a requested concept, report the structured gap or error returned by the stage tool and keep the unresolved business term visible.
- When verification or saving fails, preserve the structured error classification and the last completed stage. Retry only when the returned classification declares retry safe.
- When a user asks to revise an existing page, carry its precise base revision in the Page Build Spec; the saved result is a new revision using the current page protocol version.
