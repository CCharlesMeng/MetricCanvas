"""UTF-8 subprocess boundary and capability-specific environment checks."""
import importlib
import json
import shutil
import subprocess
import sys

from mc_resources import ContentError, diagnose_package, package_root


def run_node(arguments, value=None, *, timeout=30, failure_code='CONTENT_RUNTIME_UNAVAILABLE', accept_report=False):
    try:
        result = subprocess.run(['node', *arguments], input=json.dumps(value, ensure_ascii=False) if value is not None else None,
            capture_output=True, encoding='utf-8', errors='strict', timeout=timeout, check=False)
    except subprocess.TimeoutExpired as error:
        raise ContentError('CONTENT_RUNTIME_TIMEOUT', message='The Node operation timed out.', timeoutSeconds=timeout,
            action='Stop this operation and retry with the same verified package after checking the runtime.') from error
    except OSError as error:
        raise ContentError('CONTENT_RUNTIME_UNAVAILABLE', message='Node could not be started.',
            action='Install Node.js 22+ and check the PATH used by this Python process.') from error
    except UnicodeError as error:
        raise ContentError('CONTENT_RUNTIME_OUTPUT_INVALID', message='Node did not return UTF-8 text.',
            action='Check the Node executable and use the verified package.') from error
    if result.returncode and not accept_report:
        raise ContentError(failure_code, message='The Node operation failed.', exitCode=result.returncode,
            action='Check the requested operation and runtime; keep package verification enabled.')
    try:
        report = json.loads(result.stdout)
    except (ValueError, TypeError) as error:
        raise ContentError('CONTENT_RUNTIME_OUTPUT_INVALID', message='Node did not return a JSON report.', exitCode=result.returncode,
            action='Check the runtime and reinstall the verified package if necessary.') from error
    if result.returncode and (not isinstance(report, dict) or report.get('ok') is not False):
        raise ContentError(failure_code, message='Node failed without a rejection report.', exitCode=result.returncode)
    return report


def require_compile_dependency():
    try:
        importlib.import_module('jsonschema')
    except ImportError as error:
        raise ContentError('CONTENT_DEPENDENCY_UNAVAILABLE', 'jsonschema', 'Page compilation requires jsonschema.',
            action='Install scripts/requirements.txt with the same Python interpreter used by the caller.') from error


def compile_dependency_check():
    try:
        require_compile_dependency()
        return {'status': 'ok'}
    except ContentError as error:
        return {'status': 'not_run', **error.issue}


def node_check():
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, encoding='utf-8', timeout=10, check=False)
        version = result.stdout.strip()
        if result.returncode or int(version.lstrip('v').split('.')[0]) < 22:
            raise ValueError('unsupported Node version')
        return {'status': 'ok', 'version': version, 'executable': shutil.which('node')}
    except (OSError, ValueError, UnicodeError, subprocess.TimeoutExpired):
        return {'status': 'not_run', 'code': 'CONTENT_RUNTIME_UNAVAILABLE', 'action': 'Install Node.js 22+ and check the caller PATH.'}


def preflight(operation='all', *, root=None):
    if operation not in {'all', 'verify', 'compile', 'schema', 'upgrade', 'knowledge'}:
        raise ContentError('QUERY_ARGUMENTS_INVALID', 'operation')
    installation = diagnose_package(root)
    checks = {'installation': installation, 'python': {'status': 'ok' if sys.version_info >= (3, 12) else 'not_run',
        'version': sys.version.split()[0], 'executable': sys.executable}}
    if operation in {'all', 'compile'}:
        checks['compileDependency'] = compile_dependency_check()
    if operation in {'all', 'schema', 'upgrade', 'knowledge'}:
        checks['node'] = node_check()
    return {'status': 'ok' if all(check['status'] == 'ok' for check in checks.values()) else 'not_run',
        'operation': operation, 'root': str(package_root(root)), 'checks': checks,
        'scope': 'local installation and operation dependencies; not Relay registration, DQE, save or deployment'}
