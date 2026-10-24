# Page parameter workflow

The platform service exposes nine tools, including extract_page_parameters,
apply_page_parameter_selection and resolve_page_parameters. Their schemas come from
entrypoints/mcp/platform_mcp.py. No model argument carries a page, query, identity,
verification baseline or endpoint.

Extraction reads the current TurnState document, an exact saved artifact_ref, or a
same-turn template artifact. VerifiedParameterContext proves the exact document has
DQE evidence. Selection rechecks this evidence, the source document and work version.
A compare-and-swap rejects concurrent changes before preparing a template. Missing
providers fail closed. Shared TurnState call and elapsed-time budgets apply.

ParameterDependencies injects the trusted ParameterProgram and durable immutable
ParameterRecordStore. Extraction, template and instance records contain ref, kind,
binding, expiresAt, payload and sha256. Cross-identity, cross-turn, expired and tampered
records are rejected. Retention of sensitive records belongs to the host.

Selection returns metriccanvas.parameter-template. payload.document is the unfilled
template; sourceArtifactRef and sourceWorkVersion identify its source.
modelSummary.artifact_ref identifies the template record. It does not update/save the
work, invoke DraftSaver or publish. Explicit human publication remains separate.
PageParameters.read_template provides an exact scoped host-only read for that workflow;
it does not issue publication authority or expose another model tool.
There is no candidate store, parent-candidate chain or final-candidate coordinator.

Resolution accepts artifact_ref or current work and returns a
metriccanvas.parameter-instance record. payload contains document, resolvedPage,
effectiveInputs and artifactRef. It neither queries data nor saves assets.
PageParameters.read_instance rechecks the turn and expiry before handing the instance
to the temporary runtime channel. Do not route it through draft-preview/save events.

Relay sends only modelSummary to the model. Full documents and values stay in the
program channel. Parameter candidate_id is a selection key, not a page candidate
reference or a persistent template ID.
