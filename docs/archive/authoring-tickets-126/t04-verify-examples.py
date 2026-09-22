"""Validate proposal examples, not a service implementation or provider conformance test."""
import hashlib
import json
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def check(path):
    data = json.loads(path.read_text())
    assert data['evidenceClass'] == 'local-proposal-only'
    seen_ids = set()
    checks = 0
    for case in data['cases']:
        assert case['id'] not in seen_ids
        seen_ids.add(case['id'])
        saves = {}
        publications = {}
        for s in case['steps']:
            op, req, res, expected = (s[k] for k in ('operation', 'request', 'response', 'expected'))
            decision = expected['decision']
            if op == 'saveDraft':
                key = req['context']['operationId']
                if res['status'] == 'saved':
                    assert res['operationId'] == key
                    assert res['contentHash'] == digest(req['document'])
                    assert res['ref']['pageId'] == req['pageId'] == req['document']['id']
                    assert res['base'] == req['base']
                    if key in saves:
                        assert saves[key] == (canonical(req), canonical(res))
                        assert expected['newRevisions'] == 0
                    saves[key] = (canonical(req), canonical(res))
                elif res['status'] == 'unknown':
                    assert 'ref' not in res and decision == 'wait'
                    assert expected['replaceCanvas'] is False
                elif res.get('code') == 'IDEMPOTENCY_CONFLICT':
                    assert key in saves and saves[key][0] != canonical(req)
                    assert expected['newRevisions'] == 0
                elif res.get('code') == 'REVISION_CONFLICT':
                    assert req['base'] != res['current'] and expected['preserveLocal']
                else:
                    raise AssertionError('Unrecognized save case')
            elif op == 'getOperationResult':
                assert req['operationId'] == res['operationId'] and expected['newRevisions'] == 0
            elif op == 'readRevision':
                valid = req == res['ref'] and res['contentHash'] == digest(res['document'])
                assert valid == (decision == 'accept')
                assert expected['replaceCanvas'] == valid
            elif op == 'prepareCandidate':
                assert req['source'] == res['ref']['source']
                assert res['validation']['valid'] and res['contentHash'] == digest(res['document'])
            elif op == 'reviseCandidate':
                assert res['ref']['source'] == req['ref']['source']
                assert res['ref']['candidateVersion'] != req['ref']['candidateVersion']
                assert res['retainDimensionValues'] == req['corrections']['retainDimensionValues']
                assert res['validation']['valid'] and expected['oldConfirmationInvalidated']
            elif op == 'confirmPublish':
                if decision == 'accept':
                    assert req['confirmation']['candidate'] == req['ref']
                    assert req['confirmation']['source'] == res['template']['source'] == req['ref']['source']
                    key = req['operationId']
                    assert expected['newTemplates'] == (0 if key in publications else 1)
                    if key in publications:
                        assert publications[key] == canonical(res)
                    publications[key] = canonical(res)
                else:
                    assert expected['newTemplates'] == 0
                    p = case['preconditions']
                    code = res['code']
                    assert {
                        'CONFIRMATION_REQUIRED': req['confirmation'] is None,
                        'CANDIDATE_EXPIRED': p['serverNow'] >= '2026-09-14T10:15:00Z',
                        'CANDIDATE_CHANGED': p['currentCandidateVersion'] != req['ref']['candidateVersion'],
                        'REVISION_CONFLICT': p['currentHead'] != req['ref']['source'],
                        'LEASE_EXPIRED': not p['leaseValid'],
                    }[code]
            elif op == 'execute':
                if res.get('code') == 'NO_ACCESS_SCOPE':
                    assert decision == 'reject' and expected['queryCalls'] == 0
                else:
                    sources = res['dataSources']
                    valid = (req['target'] == res['target'] and req['operationId'] == res['operationId']
                             and set(sources) == set(res['document']['dataSources']))
                    errors = 0
                    snapshots = {}
                    for key, item in sources.items():
                        valid &= item['conditionKey'] == res['conditionKey']
                        if item['status'] == 'error':
                            valid &= 'rows' not in item and 'error' in item
                            errors += 1
                            snapshots[key] = 'error'
                        else:
                            valid &= 'error' not in item and isinstance(item.get('rows'), list)
                            snapshots[key] = 'ready' if item.get('rows') else 'empty'
                    valid &= res['status'] == ('partial' if errors else 'success')
                    assert bool(valid) == (decision == 'accept')
                    if valid:
                        assert snapshots == expected['snapshots']
                    else:
                        assert expected['replaceCanvas'] is False
            else:
                raise AssertionError(op)
            checks += 1
    assert len(seen_ids) == 21
    print(f'{len(seen_ids)} proposal scenarios / {checks} steps internally consistent; no service called')


if __name__ == '__main__':
    check(Path(__file__).with_name('t04-contract-examples.json'))
