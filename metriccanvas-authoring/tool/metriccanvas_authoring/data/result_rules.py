"""Pure result projection and scope/version checks over supplied facts.

Matching facts cannot establish authorization; the trusted caller owns their origin.
"""
from copy import deepcopy
from metriccanvas_authoring.data.metric_relations import relation_evidence
from metriccanvas_authoring.work.content_ports import ContentBaselineError


def check_result_record(record, binding, context_version, policy_identity, *, usable=True, allow_unready=False):
    if record is None or record['binding'] != binding:
        raise ContentBaselineError('RESULT_SCOPE_MISMATCH')
    if usable and record.get('validationPolicy') != policy_identity:
        raise ContentBaselineError('RESULT_VALIDATION_POLICY_CHANGED')
    if context_version != record['dataContextVersion']:
        raise ContentBaselineError('RESULT_VERSION_STALE')
    if usable and not allow_unready and record['status'] not in {'ready', 'empty'}:
        raise ContentBaselineError('RESULT_NOT_READY')
    return deepcopy(record)


def project_result_evidence(record, source_id=None, *, now):
    result = {'resultRef': record['resultRef'], 'dataSourceId': source_id or record['request']['dataSourceId'],
              'status': record['status'], 'scope': deepcopy(record['request']),
              'attempt': record.get('attempt', 1), 'retryCount': record.get('retryCount', 0),
              'executionFailures': deepcopy(record.get('executionFailures', []))}
    result.update(validationMode=record.get('validationMode', 'strict'),
        warnings=deepcopy(record.get('warnings', [])), normalizations=deepcopy(record.get('normalizations', [])))
    result['scope']['dataSourceId'] = result['dataSourceId']
    if record['status'] not in {'ready', 'empty'}:
        result['issues'] = deepcopy(record.get('issues', []))
        if 'domainCandidates' in record:
            result['domainCandidates'] = deepcopy(record['domainCandidates'])
        if record['status'] == 'pending':
            expired = record.get('expiresAt', float('inf')) < now
            result['issues'] = [{'code': 'QUERY_ATTEMPT_EXPIRED' if expired else 'RESULT_NOT_READY', 'path': '',
                                 'action': 'retry_original_request' if expired and record.get('attempt', 1) < 2 else 'check_execution_owner' if expired else 'read_result_status'}]
        return result
    fields = record['source']['fields']
    # Detail/HTML/recordList values stay in the program channel.
    def project_visible_fields():
        allowed = {key: field for key, field in fields.items() if field.get('role') in {'dimension', 'measure'} and field.get('type') not in {'recordList', 'semanticHtml'}}
        result['fields'] = {key: {k: deepcopy(v) for k, v in field.items() if k in {'label', 'role', 'type', 'unit', 'defaultFormat'}} for key, field in allowed.items()}
        result['rows'] = [{key: row.get(field.get('queryField', key)) for key, field in allowed.items()} for row in record['rows']]
        return allowed

    allowed = project_visible_fields()
    shown, returned, total = len(result['rows']), record['returnedCount'], record['totalCount']
    result['coverage'] = {'shownCount': shown, 'returnedCount': returned, 'totalCount': total,
                          'truncated': shown < returned or total is not None and returned < total,
                          'complete': total is not None and shown == returned == total,
                          'resultComplete': total is not None and returned == total,
                          'sampleTruncated': shown < returned,
                          'basis': 'returned rows; no ranking or aggregation inferred'}
    entries = relation_evidence(record.get('relations', []), allowed)
    result['relations'] = entries[:20]
    result['relationCoverage'] = {'status': record.get('relationStatus', 'unknown'),
        'shownCount': len(result['relations']), 'totalCount': len(entries), 'truncated': len(entries) > 20}
    result['capturedAt'] = record['capturedAt']
    return result
