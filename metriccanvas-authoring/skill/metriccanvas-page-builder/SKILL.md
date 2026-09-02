---
name: metriccanvas-page-builder
description: Build or revise a MetricCanvas page from a business question through governed data discovery, deterministic assembly, validation, saving, and exact-revision handoff.
---

# MetricCanvas Page Builder

Turn the user's business question into a governed MetricCanvas page. Produce business semantics; let the deterministic Tool produce the DQE query and Page document.

## Workflow

1. Call `discover_data_context` for the requested business terms. Resolve every metric, dimension, time capability, and filter value from returned matches. Complete this step when each requested concept has one governed name or one explicit unresolved ambiguity.
2. For each ambiguity, show the definition differences and wait for the user's choice. Keep unresolved user wording visible; do not silently choose a near match.
3. Form one Page Build Spec from the resolved business domain, metrics, dimensions, time range, filters, analysis intent, and explicit presentation pins. Complete it when every requested view is represented by one unambiguous Data Request Unit.
4. Present the effective Data Request Review when the workflow requires confirmation. Apply corrections to the Page Build Spec.
5. Call `build_page` once with the complete spec and command envelope. On retry, preserve the same idempotency key for the same intended revision.
6. Finish only when `completedStages` includes `save` and `savedRevision` contains `pageId`, `revisionId`, and `revisionNumber`. Return those exact identifiers for exact-revision preview.

## Failure handling

- When discovery cannot resolve a requested concept, report the returned issue and keep the unresolved business term visible.
- When building fails, report each structured issue with its stage and the last `completedStages` entry. Retry only after correcting the business input or when the returned classification declares retry safe.
- When a user asks to revise an existing page, carry its precise base revision in the Page Build Spec; the saved result is a new revision using the current page protocol version.
