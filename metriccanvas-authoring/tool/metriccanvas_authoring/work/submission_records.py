"""Invariants and legal transitions of the candidate-protocol submission record.

The submission use case, the recovery use case and the durable store all judge
the same record. Keeping the rules here lets the store own only atomicity and
persistence, and lets recovery re-check a record without reaching into another
use case. This is the compatibility protocol; the v2 work document in
``work.state`` has its own, deliberately narrower, single-save rules.
"""
import re

from metriccanvas_authoring.work.authoring_turns import TURN_VALIDATOR
from metriccanvas_authoring.application.lifecycle import VALIDATOR as COMMAND_VALIDATOR, valid_ref
from metriccanvas_authoring.application.lifecycle_ports import LifecycleError
from metriccanvas_authoring.canonical import canonical_sha256

RECORD_KEYS = {'candidateRef', 'rootBinding', 'operationId', 'command', 'programToken', 'status', 'result'}
SNAPSHOT_KEYS = {'formatVersion', 'recordVersion', 'commandSha256', 'record', 'control', 'saveReceipt', 'verificationState', 'previewState'}
CONTROL_KEYS = {'cancelRequested', 'attemptIds', 'maxAttempts', 'deadlineEpochMs'}
STATUSES = {'selected', 'sending', 'unknown', 'pending', 'saved', 'rejected', 'not-applied', 'unchanged'}
TERMINAL = {'saved', 'rejected', 'not-applied', 'unchanged'}
IMMUTABLE = ('candidateRef', 'rootBinding', 'operationId', 'command')
SCOPE_FIELDS = ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId')
FORMAT_VERSION = '1.0'


def check(condition, code):
    if not condition:
        raise LifecycleError(code)


def text(value):
    return isinstance(value, str) and bool(value) and len(value) <= 256


def scope_key(binding):
    return tuple(binding[field] for field in SCOPE_FIELDS)


def validate_record(record, binding, *, invalid, command_invalid=None):
    """Shape of one submission record and its agreement with the turn binding."""
    check(isinstance(record, dict) and set(record) == RECORD_KEYS, invalid)
    check(record['rootBinding'] == binding and text(record['candidateRef']), invalid)
    command = record['command']
    check(COMMAND_VALIDATOR.is_valid(command) and command['kind'] == 'save', command_invalid or invalid)
    context = command['context']
    check(context['operationId'] == record['operationId'] and
          context['actorId'] == binding['actorId'] and
          context['workspaceId'] == binding['workspaceId'] and
          context['origin'].get('runId') == binding['runId'], invalid)
    check(command['pageId'] == binding['pageId'] and command['base'] == binding['baseRef'], invalid)
    check(record['status'] in STATUSES, invalid)
    check(record['programToken'] is None or text(record['programToken']), invalid)
    check(record['result'] is None or isinstance(record['result'], dict), invalid)


def validate_terminal_result(record, *, invalid):
    """A terminal record carries the result it terminated with, and nothing looser."""
    if record['status'] not in TERMINAL:
        return
    result = record['result']
    check(isinstance(result, dict) and result.get('status') == record['status'] and
          result.get('candidateRef') == record['candidateRef'] and
          result.get('operationId') == record['operationId'], invalid)
    if record['status'] != 'saved':
        check('ref' not in result, invalid)
        return
    ref, base = result.get('ref'), record['command']['base']
    check(valid_ref(ref) and ref['pageId'] == record['command']['pageId'], invalid)
    check(base is None or ref['resourceId'] == base['resourceId'] and ref['revisionId'] != base['revisionId'], invalid)


def validate_scope(record, key, *, invalid):
    """The store key is the turn scope; a record may not be filed under another."""
    binding = record['rootBinding']
    check(TURN_VALIDATOR.is_valid(binding), invalid)
    check(scope_key(binding) == key, invalid)


def validate_snapshot(snapshot, key, *, invalid, unsupported):
    """Durable envelope around one record: attempt control, receipt and states."""
    check(isinstance(snapshot, dict) and set(snapshot) == SNAPSHOT_KEYS, invalid)
    check(snapshot['formatVersion'] == FORMAT_VERSION, unsupported)
    check(type(snapshot['recordVersion']) is int and snapshot['recordVersion'] >= 1, invalid)
    record = snapshot['record']
    validate_scope(record, key, invalid=invalid)
    validate_record(record, record['rootBinding'], invalid=invalid)
    check(snapshot['commandSha256'] == canonical_sha256(record['command']), invalid)
    control = snapshot['control']
    check(isinstance(control, dict) and set(control) == CONTROL_KEYS, invalid)
    check(type(control['cancelRequested']) is bool and type(control['maxAttempts']) is int and control['maxAttempts'] > 0, invalid)
    check(control['deadlineEpochMs'] is None or type(control['deadlineEpochMs']) is int and control['deadlineEpochMs'] >= 0, invalid)
    attempts = control['attemptIds']
    check(isinstance(attempts, list) and all(text(v) for v in attempts) and
          len(attempts) == len(set(attempts)) and len(attempts) <= control['maxAttempts'], invalid)
    check(snapshot['verificationState'] in {'pending', 'verified'}, invalid)
    check(snapshot['previewState'] in {'not-requested', 'failed', 'ready'}, invalid)
    receipt = snapshot['saveReceipt']
    check(receipt is None or isinstance(receipt, dict), invalid)
    if receipt is not None:
        check(receipt.get('operationId') == record['operationId'] and receipt.get('status') == 'saved', invalid)
        ref = receipt.get('ref')
        check(valid_ref(ref) and ref['pageId'] == record['rootBinding']['pageId'], invalid)
        check('base' in receipt and receipt['base'] == record['command']['base'], invalid)
        check(isinstance(receipt.get('contentHash'), str) and re.fullmatch('[a-f0-9]{64}', receipt['contentHash']), invalid)
        check(text(receipt.get('canonicalization')), invalid)
        check(type(receipt.get('revisionNumber')) is int and receipt['revisionNumber'] > 0, invalid)
    check(snapshot['verificationState'] != 'verified' or receipt is not None, invalid)


def validate_transition(old, new, *, compatibility=False):
    """Which snapshot changes a stored record may take; storage only enforces it."""
    before, after = old['record'], new['record']
    check(all(before[field] == after[field] for field in IMMUTABLE) and
          old['commandSha256'] == new['commandSha256'], 'EXECUTION_IMMUTABLE')
    check(before['programToken'] is None or before['programToken'] == after['programToken'], 'EXECUTION_IMMUTABLE')
    if before['status'] in TERMINAL:
        retry = (not compatibility and before['status'] == 'not-applied' and after['status'] == 'sending'
                 and not new['control']['cancelRequested']
                 and isinstance(before['result'], dict) and before['result'].get('retrySafe') is True)
        evidence = (not compatibility and before['status'] == 'not-applied'
                    and after['status'] in {'not-applied', 'pending', 'unknown', 'saved', 'rejected'})
        check(retry or evidence or (after['status'] == before['status'] and after['result'] == before['result']), 'EXECUTION_TERMINAL')
    control, updated = old['control'], new['control']
    check(control['maxAttempts'] == updated['maxAttempts'] and
          control['deadlineEpochMs'] == updated['deadlineEpochMs'], 'EXECUTION_IMMUTABLE')
    check(not control['cancelRequested'] or updated['cancelRequested'], 'EXECUTION_CONTROL_REGRESSION')
    check(updated['attemptIds'][:len(control['attemptIds'])] == control['attemptIds'], 'EXECUTION_CONTROL_REGRESSION')
    check(old['saveReceipt'] is None or old['saveReceipt'] == new['saveReceipt'], 'EXECUTION_RECEIPT_IMMUTABLE')
    check(old['verificationState'] != 'verified' or new['verificationState'] == 'verified', 'EXECUTION_VERIFICATION_REGRESSION')
    if new['saveReceipt'] is not None:
        check(after['status'] not in {'selected', 'sending', 'rejected', 'not-applied', 'unchanged'}, 'EXECUTION_RECEIPT_IMMUTABLE')
