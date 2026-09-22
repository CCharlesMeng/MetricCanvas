"""Keep technical query scope in the plan/query, not in automatic report prose."""


def refresh_scope(document, plan):
    """Remove only legacy reserved notes on v3 composition/revision.

    Business explanations are explicitly authored text/title/subtitle. Never
    delete those by keyword or infer metric periods from query time. Query and
    filter evidence stays in data sources and the trusted structure state.
    """
    for section in document['sections']:
        reserved = {'structure-scope-page', 'structure-scope-' + section['id']}
        section['components'] = [c for c in section['components'] if c['id'] not in reserved]
