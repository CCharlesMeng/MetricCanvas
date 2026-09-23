# Platform authoring protocol 2.0

The target CLI is `metriccanvas-platform-content` / `metriccanvas_authoring.platform_server`.
The platform content server is the sole current authoring entrypoint. Historical candidate consumers are retired and are not runtime fallbacks.

## Trusted construction

`create_platform_server` takes governed data dependencies and explicit host providers:

- `current_turns`: existing authoring-turn/1.0 interface; actor/workspace/request/run/turn/page/capability and precise baseline remain host-owned.
- `store`: `read(namespace,key) -> (version,value)` and atomic `compare_and_swap(namespace,key,version,value)`. `SqlitePlatformState` supplies a durable local implementation and uses separate tables, preserving legacy records.
- `analysis_authorization.authorize(binding,request,dataContextVersion)`: host program returns the exact binding/request digest/version, `planConfirmed=true` and `modelEvidenceAllowed=true`. Neither flag is a model argument. The host ties approval to the user's confirmed scope and governs allowed evidence. No provider means no business query.
- `lifecycle_service`: `single_save` and `current_read` service with `current_match(identity, ref)`, plus `lifecycle_identities.current()`. No exact-read/lookup capability is required or inferred. `KnownLifecycleHttp` remains the known Java adapter; current reads reject a mismatching revision; atomic base revision checks at save remain remote responsibilities.
- `relay_preview.prepare(artifact)`: actual Relay adapter prepares the card and returns `status=ready`, the exact artifactRef and ref. It owns mapping to `compose_page_result` and card internals. This is a Python consumer interface, not a claim about a new remote API.
- Java raw semantic metadata: `METRICCANVAS_DATASET_DETAIL_BASE_URL` selects `JavaDatasetMetadataProvider` using the batch `query-dataset-from-lab` POST. The platform factory automatically shares it between SemanticCatalog and the executable DataContextPort. Authenticated actor/workspace scope is checked before and after HTTP; dataset IDs are trusted configuration, not model arguments. Discovery supports explicit partial coverage; executable projection requires complete metadata and explicit governance. Both use the same metadata/governance fingerprint as dataContextVersion. No discovery call invokes the proactive refresh endpoint.
- Optional `semantic_catalog`: `SemanticCatalog` projects selective raw Lab models from `provider.search(binding,query,limit)` and identity-matched `provider.detail(binding,source)`. Host providers may reuse still-valid semantic summaries. Physical SQL is never projected. Missing details stay unknown and are cached per scope/version.
- Optional `parameter_dependencies`: parameter program, immutable durable record store, exact-source verification provider and expiry clock. Parameter calls share the turn budget and fail closed when dependencies are absent.

Standalone startup without these providers fails closed. No manifest imports arbitrary code or manufactures authority. `METRICCANVAS_PROTOCOL_DISCOVERY=1` is an explicit tool-introspection mode only: it registers nine tools with unavailable business providers and must not be used to claim deployment readiness. Package-outside entrypoints call `bootstrap.readiness.platform_readiness` before serving. The report separates assembled providers, operation availability, an unchecked/valid/invalid current turn, connectivity and business acceptance. Startup requires the turn **provider**, never an already active user turn. Parameter dependencies are optional for create/edit.

### Host Adapter contract and failure vectors

The host creates one immutable binding for a user instruction and supplies it on **every** oneshot invocation. Required binding keys are `actorId`, `workspaceId`, `requestId`, `runId`, `turnId`, `pageId`, `capabilityVersion`, `contextRef`, mode/status/access and the exact creation baseline (`baseRef` and document digest for edit, null for new). `current_scope()` and `current_turn()` must derive from authenticated invocation context and agree on the seven scope keys; the model only receives `context_ref` as an assertion. A new instruction gets a new turn and contextRef. Cancelled, expired, switched-user or switched-page calls fail through `AuthoringTurnGate` before work. Do not mutate parent-process `os.environ` to convey concurrent identity; use invocation-local adapters or subprocess env mapping.

`store.read(namespace,key)` returns `(version, JSON value)` or `(0,None)`. `compare_and_swap(namespace,key,expectedVersion,value)` atomically writes only when the version matches, including concurrent processes. The same turn must reach the same storage path and binding on each oneshot call. `SqlitePlatformState` is a reusable local implementation; its path must be shared, stable for the turn, private to the deployment scope and writable. Work, query references, budgets and frozen submissions persist between calls. A unique database filename alone does not provide cross-instance routing or failure recovery. Unknown save submissions remain in the store until an authorized check resolves them; session end never discards them unconditionally.

`analysis_authorization.authorize(binding, request, dataContextVersion)` reads a real host confirmation record and returns `{binding, requestSha256, dataContextVersion, planConfirmed, modelEvidenceAllowed}`. The tool checks exact binding, canonical request digest and version before DQE. The provider must set `planConfirmed` only if the record's confirmed scope includes **that exact request and version for that binding**; a boolean copied from a model argument is invalid. Missing confirmation returns `ANALYSIS_PLAN_NOT_CONFIRMED`; evidence disallowed returns `MODEL_EVIDENCE_UNAVAILABLE`. Changed request, version, identity or turn is a negative vector and must not reach DQE. These keys are audit echoes of a trusted decision, not a way for the model to grant itself authority.

`data_context.current()` supplies a validated data context snapshot and stable version; `dqe.execute(effectiveQuery)` returns normalized rows and counts for the matching definition. Ordinary results derive field IDs, types and names from that snapshot and DQE definition, then validate **all** returned rows, including those beyond the model sample. A time dimension selected at month level maps the observed `周期(month)` row key. Formula outputs use their DSL alias and permit null; unknown currency/percentage scale is not invented. An optional `source_description.describe(binding,version,effectiveQuery)` may supply actual output renaming or explicit scale/format facts, and remains bound to query SHA-256 and data-context version. It is not a mandatory new service. See [field source evidence](../../../docs/evidence/2026-09-23-authoring-result-field-sources.md) in the repository.

`lifecycle_identities.current()` returns the authenticated actor/workspace and credential for **this invocation**. `lifecycle_service.current_match(identity,ref)` reads the exact current resource for edits; `save(identity,frozenCommand)` performs one conditional draft save and returns an exact receipt or an unknown/rejected outcome. The existing `KnownLifecycleHttp` consumes the known Java interface. `relay_preview.prepare(artifact)` receives `{binding,operationId,artifactRef,ref,document,previewJson}` only after a verified save. It returns `{status:"ready",artifactRef,ref}` only after the program channel has accepted that exact artifact; mismatch is `RELAY_PREVIEW_MISMATCH`, missing adapter is `RELAY_PREVIEW_UNAVAILABLE`. `ready` reports Adapter acceptance, not front-end display. A failed handoff leaves the saved artifact and does not re-query or re-save. The host must use a program channel for the full artifact if it discards MCP `structuredContent`; child env variables cannot return payload to the parent.

Contract vectors to run against an internal Adapter: valid new and edit bindings; wrong actor, page, turn, contextRef or revision; confirmation for a different request/version; same-turn query then separate-process compose; concurrent CAS conflict; DQE missing field, null forbidden field and invalid 21st row; saved receipt then handoff rejection; unknown save then changed request. The expected outcomes are respectively the existing `CURRENT_TURN_*`/`CURRENT_PAGE_*`, `ANALYSIS_PLAN_NOT_CONFIRMED`, `WORK_VERSION_CONFLICT`, `SOURCE_ROW_*`, `RELAY_PREVIEW_MISMATCH` and `SAVE_RECONCILIATION_REQUIRED` families. The package-outside example is `metriccanvas-authoring/examples/platform-oneshot-host.py`; its host module deliberately remains an internal implementation task.

## Model and program channels

Nine tools: read_page_context, discover_data_context, query_data, compose_page, edit_page, page_metadata_emit_preview, extract_page_parameters, apply_page_parameter_selection and resolve_page_parameters. Tool input JSON Schemas are generated by FastMCP from `data/results.py`, `pages/referenced.py`, the parameter tool signatures and the authored page-edit/structure inputs. These code definitions are the input-schema maintenance source; tests validate the actual registered schema and Skill examples against it.

Only modelSummary is model-visible. Query evidence is explicitly authorized, capped by rows and encoded bytes, includes actual request scope, fields, raw numeric values, capture time when supplied, returned/total/shown counts and conservative completeness. Full source queries, raw responses, SQL, detail/HTML payloads, credentials, document and previewJson stay in program storage. Empty, zero and failed results differ. Identical failed requests do not re-execute.

Result references bind the complete trusted context and data-context version. Cross-scope/version reads fail; appearance changes reuse references. A result reference is not a long-lived query asset.

## Work, save and recovery

`edit_page` requires `page_id`, which must equal the trusted turn pageId; it is a target assertion, never authorization. `read_page_context` and each non-replayed mutation verify the stored work base against Java current_match: resource/page/revision must match and the persisted definition must equal the work baseline (query initial rows excluded). Missing current-read capability fails closed. Stale content is never silently rebased; the host reads the current resource and establishes a new turn. Same-turn successful saves supply the new base for subsequent checks. The host resolves pageId to the authorized current resource before preparing the turn; the known HTTP adapter reads by resourceId.

There is one current work record per trusted turn. Mutations require expected_version, reserve work atomically, freeze the next document/base/operationId and persist the submission before calling the remote service once. Duplicate requests return the recorded result. Parallel requests fail competition checks. Late results are not delivered to a changed turn. Valid partial edits save; unchanged, all-failed and invalid pages do not save.

Work records own complete frozen commands; recovery never reads candidates. `PlatformAuthoring.recover(context_ref)` is a program-only inspection/reconciliation method. A sending record without a verified receipt remains unknown; recovery never resends. An interrupted generation before submission remains explicitly blocked instead of assuming it is safe to write. The old candidate storage, submission and recovery implementation is deleted; existing database files are not automatically migrated or erased.

Parameter extraction binds the exact work/source and verification evidence. Selection checks the extraction's work version and atomically rejects competing changes, then produces an immutable temporary template without changing or saving the work document. Templates and instances bind identity/turn, digest and expiry. `PageParameters.read_template` and `read_instance` are trusted host-only reads; template publication still requires explicit human confirmation. No page candidate reference or candidate store participates. See [parameter protocol](page-parameters-protocol.md).

A successful receipt must match operation, page, base, resource, new revision, draft status and definition. draftId equals ref.resourceId; pageId and revisionId remain distinct. Further edits in the same turn use the verified saved ref as the next base. Local digests do not replace Java concurrency control.

## Delivery

`document` strips query initial rows and is the persisted definition; static inline data remains definition content. `previewJson` includes only matching initial data. A saved artifact retains binding, operationId, ref and an exact artifactRef. page_metadata_emit_preview cannot select a generic most-recent result. Preview failure cannot trigger another save or query.

After preview ready the model emits these literal markers:

```
{{RESPONSE_START}}
{{PAGE_METADATA_PREVIEW_JSON}}
```

Relay replaces them through its actual integration. Plan confirmation is not publication. Existing publication routing and dimension selection are unchanged. Ordinary ask/explore keeps its separate non-saving entrypoint.

## Evidence boundary

Local tests and fixture model runs validate this consumer contract. Real Relay injection/replacement, production Lab identity/detail mapping and Java response compatibility require the deployment-owned implementations and cannot be certified by local fakes.

## Query relation evidence

Optional `ComposePageDependencies.metric_relations` resolves trusted metadata/user-recorded relations for the current binding, dataContextVersion and businessDomain. QueryResults freezes only relations matching the executed fields, period/granularity and returned object scope. Public evidence projects relation fields to query field IDs, exposes at most 20 items with relationCoverage, and applies the same byte budget. Composition and add_result_component use only the referenced stored relations; missing authority rejects the component. No relation provider is reloaded during rendering, save or preview.

The old unified composition/structureRevision pipeline and add_data_component request contract are retired. Ordinary Ask/Explore has only discovery and save-free compose; the old build_page/Java strong-save path cannot be selected by environment configuration.
