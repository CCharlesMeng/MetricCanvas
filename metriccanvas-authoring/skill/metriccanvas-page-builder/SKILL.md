---
name: metriccanvas-page-builder
description: Create or revise a transient MetricCanvas report or data app from a business question through governed discovery, controlled data requests, DQE execution, and validated page composition. Use for MetricCanvas ask, explore, page-building, and follow-up revision requests after the Relay Page Artifact Adapter is enabled.
allowed-tools:
  - discover_data_context
  - compose_page
metadata:
  max_tokens: 30000
  mcp_servers:
    - metriccanvas-authoring
---

# MetricCanvas Page Builder

Produce a validated transient page. Let deterministic tools derive DQE queries, field bindings, components, layout, and Page Metadata.

## State

Use the question plus the latest structured checkpoint from `config.agent_context`. Preserve every untouched Data Request Unit, explicit filter, time range, presentation pin, and target binding. Keep at most six units.

## Workflow

1. Decide `route_business_domains`: honor a user override first; otherwise reuse checkpoint domains for a follow-up or choose at most two supplied business domains. Complete when every selected domain is governed and visible to the user.
2. Call `discover_data_context` for each unresolved metric, dimension, filter value, or time capability. Use only returned canonical names and definitions. Complete when every requested concept is resolved or represented by an explicit ambiguity.
3. Present tied candidates with their definition differences and wait for the user. Resume only with the selected governed candidate; carry all other checkpoint state unchanged.
4. Decide `submit_data_request_units`: create the initial unit set or emit targeted `add`, `modify`, `replace`, and `remove` changes. Keep unmentioned fields structurally unchanged. Separate partially answerable and unavailable concepts; never blend an unavailable metric into an executable unit.
5. Present a Data Request Review and wait only for ambiguity, an ad-hoc formula, model-supplied time, or a platform-declared cost threshold. Apply the confirmation to the exact unit and preserve the rest.
6. Decide `submit_analysis_intent` independently for each touched unit using one of `comparison`, `trend`, `composition`, `ranking`, `detail`, or `single_value`. Preserve the prior intent for untouched units.
7. Call `compose_page` once with the complete Page Build Spec. Correct a rejected closed-set name once using returned candidates; otherwise surface the structured issue and stop.
8. Accept completion only when Relay returns `status: page_composed` with `pageId`, `documentSha256`, `dataContextVersion`, and `bundleVersion`. Report that the transient page is ready.

## Persistence and safety

- Treat `compose_page` as a Relay-only Interface. The Page Artifact Adapter stores the complete artifact as the latest session checkpoint and returns only its `modelSummary` to this conversation.
- Leave formal page persistence to the platform's explicit user action. Never call Java page-save Interfaces and never claim that a page revision was created.
- Stop after cancellation or interaction wait. A late result may be discarded or marked cancelled; it cannot replace a newer checkpoint.
- Report structured `code`, `path`, `stage`, and message on failure. Preserve unresolved wording and never fabricate data, governed names, execution results, or Page Metadata.
