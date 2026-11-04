"""Pure work-version decisions. The caller must authenticate facts and perform CAS."""
from copy import deepcopy
from metriccanvas_authoring.work.content_ports import ContentBaselineError


def _require(condition, code):
    if not condition:
        raise ContentBaselineError(code)


def reserve_work(work, expected_version, request_hash):
    failed_before_save = (work['lastResult'] or {}).get('status') == 'failed' and (work['lastResult'] or {}).get('saveStatus') == 'not_requested'
    if work['lastRequest'] == request_hash and not failed_before_save:
        return {'decision': 'reuse', 'work': deepcopy(work), 'result': deepcopy(work['lastResult'])}
    _require(work['active'] is None, 'WORK_BUSY')
    _require(work['lastResult'] is None or work['lastResult'].get('saveStatus') not in {'unknown', 'pending', 'rejected'}, 'SAVE_RECONCILIATION_REQUIRED')
    _require(work['workVersion'] == expected_version, 'WORK_VERSION_CONFLICT')
    candidate = deepcopy(work)
    candidate.pop('submission', None)
    candidate['active'] = request_hash
    return {'decision': 'reserve', 'work': candidate, 'result': None}


def finish_work(work, request_hash, result):
    _require(work['active'] == request_hash, 'WORK_VERSION_CONFLICT')
    candidate = deepcopy(work)
    candidate.update(active=None, lastRequest=request_hash, lastResult=deepcopy(result))
    return candidate
