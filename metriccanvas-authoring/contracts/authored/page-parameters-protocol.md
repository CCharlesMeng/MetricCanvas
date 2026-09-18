# Page parameter MCP / 1.0

The unified service exposes eight tools: the existing five plus
extract_page_parameters, apply_page_parameter_selection and resolve_page_parameters.
Their input schemas are generated from unified_content_mcp.py; arbitrary page JSON,
query bodies, baseline strings and dimension identities are not tool arguments.

Extraction reads a trusted root or same-turn candidate. VerifiedParameterContext must
prove the exact document has DQE verification evidence, not merely echo its digest.
It returns baseline, sourceSha256 and optional governed dimensionIdentities.
Selection rechecks that evidence; missing providers fail closed.

ParameterDependencies injects the trusted TS ParameterProgram and an immutable durable
ParameterRecordStore. Records bind the complete current-turn binding, a digest and
expiresAt (Unix seconds). Default TTL is 1800 seconds, configured by the host only,
maximum 86400. Expired, corrupted, cross-turn or cross-identity references are rejected.
Store retention/cleanup is host-owned; records contain sensitive full documents.

Process record kinds are extraction and instance, with distinct opaque refs. Choice IDs
are distinct from page parameter IDs. Model summaries omit input values and raw text;
text slots expose only locations and candidate associations. Text edits are limited to
returned slots: parameter choices identify a selected candidate; literal choices provide
a reviewed replacement. Full extraction and runtime documents stay in program storage.

apply returns metriccanvas.parameter-template, not an ordinary automatic-save envelope.
Its candidate and descendants carry a parameter_selection operation marker. Ordinary
AuthoringSubmissionCoordinator.finalize refuses them; existing explicit human publication
owns persistence. No new Java endpoint or strong operation lookup is introduced.

resolve returns metriccanvas.parameter-instance, with no authoring candidateRef. The
artifact is the stored instance record (ref, kind, binding, expiresAt, payload, sha256).
payload contains document, resolvedPage, effectiveInputs and optional candidateRef.
The trusted host consumes it through PageParameters.read_instance, rechecking the active
context and expiry. Platform ParameterInstancePort projects that checked record to a
temporary RuntimeView. Never route either parameter envelope through applyPreview,
ordinary final-candidate submission or saved-draft notifications.

Model output is modelSummary only; Relay must strip artifactEnvelope. resolved means
deterministic materialization, not DQE execution. Runtime/preview errors remain runtime
errors, and unknown saves retain the existing single-attempt policy.
