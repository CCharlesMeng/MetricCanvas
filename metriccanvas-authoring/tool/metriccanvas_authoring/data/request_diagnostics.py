"""Safe query diagnostics and public batch locations; no raw provider messages."""
from copy import deepcopy
from metriccanvas_authoring.data.time_range import time_issue
from metriccanvas_authoring.work.diagnostics import issue_details, schema_issues


def request_issues(item, schema):
    time = item.get('time')
    if isinstance(time, dict) and {'granularity', 'start', 'end'} <= time.keys():
        issue = time_issue(time, '/time')
        if issue:
            return [issue_details(**issue)]
    return schema_issues(schema, item, 'QUERY_ITEM_INVALID')


def query_issue(issue):
    path = issue.path.removeprefix('/units/0')
    result = issue_details(issue.code, path, stage=issue.stage)
    result.update(stage=issue.stage, candidates=list(issue.candidates)[:10], retrySafe=issue.retry_safe)
    if issue.path == '/dataContextVersion':
        result['pathScope'] = 'inputEnvelope'
    elif issue.stage == 'discovery':
        result['pathScope'] = 'dataContext'
    return result


def locate_results(results, normalizations):
    for index, result in enumerate(results):
        if 'resultRef' in result:
            result['normalizations'] = [deepcopy(n) for n in normalizations if n['path'].startswith(f'/requests/{index}/')]
        for issue in result.get('issues', []):
            if issue.get('pathScope', 'input') == 'input':
                issue['path'] = f'/requests/{index}' + issue.get('path', '')
                issue['pathScope'] = 'input'
    return results



def candidate_metric(schema, metric, matches):
    def text(value):
        return value[:512] if isinstance(value, str) else None
    return {'businessDomain': schema['name'], 'name': metric['name'], 'matchedNames': matches,
            'unit': text(metric.get('unit')), 'definition': text(metric.get('description')),
            'executionReadiness': 'not_checked', 'metricCompatibility': 'unknown'}


def domain_candidates(snapshot, request):
    """Exact names/governed aliases in the authorized snapshot, never fuzzy alternatives."""
    candidates = []
    for environment in snapshot['executionEnvironments']:
        for schema in environment['schemas']:
            if schema['name'] == request['businessDomain']:
                continue
            for metric in schema['metrics']:
                matches = [m['name'] for m in request['metrics'] if m['kind'] == 'metric'
                           and m['name'] in [metric['name'], *metric.get('aliases', [])]]
                if matches:
                    candidates.append(candidate_metric(schema, metric, matches))
    return {'items': candidates[:10], 'truncated': len(candidates) > 10,
            'snapshotComplete': not bool(snapshot.get('metadataCoverage'))}
