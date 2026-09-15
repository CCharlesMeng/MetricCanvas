# Unified creation composition protocol 1.0

S6 extends only unified create_content_page(context_ref,title,request,layout). The legacy content factory remains unchanged. The public tool count remains five. request is an operations array (1–50) composed from the unique existing edit schemas and add-data-component schema; no page JSON, arbitrary props, source token, raw query or rows.

Allowed operation types: add_text, add_field_text, add_map_chart, add_tab_container, add_composite_card, add_ai_summary, add_data_component, set_component_layout, move_component. Unknown types fail explicitly. Each operation follows existing IDs, ordering, dependency and independent partial-success semantics. The actual published JSON Schema must expose precisely these operations.

The trusted active new/write binding supplies the page identity. Construct the existing empty main section and page-header reportHeader from title, execute the S5 unified scheduler, then apply existing creation layout policy only to the new result and validate the complete page. layout (report/dashboard) is the only page-shape input. Protect the generated page-header from layout/move operations; no successful request may remove or alter it. Explicit content ordering/span must survive creation layout. A fully failed/no-change request yields no candidate. Partial independent success may yield a candidate with accurate operation outcomes; a failed data group leaves no source/component and dependents skip.

Source mappings, full documents and source-description evidence stay on the program artifact/candidate channel. Same-batch field-dependent recipes require known valid field identities; unresolved references fail, never invent IDs. Unsupported explicitly requested component kinds fail, never silently substitute. Fixed main is the supported creation target; this slice does not introduce arbitrary section construction.

Existing-page mixed additions use edit_page and the same scheduler without creation layout transformation; untouched layout, data and manual properties remain. Candidate selection/submission/recovery remain unchanged.
