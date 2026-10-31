"""Public programmatic Interface and optional deterministic command adapter."""
import argparse
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True


def loading_issue():
    scripts = Path(__file__).resolve().parent
    caches = sorted(path.relative_to(scripts).as_posix() for path in scripts.rglob('*.pyc'))
    if caches:
        return {'code': 'CONTENT_BYTECODE_PRESENT', 'path': 'scripts', 'message': 'Bytecode caches can load a different code version.',
            'files': caches[:20], 'count': len(caches), 'truncated': len(caches) > 20,
            'action': 'Install the verified archive in a new empty directory and start a new process with bytecode writing disabled.'}
    for file in scripts.glob('mc_*.py'):
        module = sys.modules.get(file.stem)
        if module is not None and Path(getattr(module, '__file__', '') or '').resolve() != file:
            return {'code': 'CONTENT_MODULE_ORIGIN_MISMATCH', 'path': file.name,
                'message': 'A module from another MC installation is already loaded.',
                'action': 'Start a new process with only this verified installation on its module path.'}
    return None


class ContentLoadingError(ImportError):
    def __init__(self, diagnostic):
        super().__init__(diagnostic['code'] + ': ' + diagnostic['message'])
        self.issue = diagnostic


def configure_cli_streams():
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='strict')


def reject_loading(diagnostic):
    if __name__ != '__main__':
        raise ContentLoadingError(diagnostic)
    print(json.dumps({'status': 'invalid', 'issues': [diagnostic]}, ensure_ascii=False))
    sys.exit(1)


if __name__ == '__main__':
    configure_cli_streams()
_loading_issue = loading_issue()
if _loading_issue:
    reject_loading(_loading_issue)
try:
    from mc_resources import ContentError, diagnose_package, query_content, verify_package
except (ImportError, SyntaxError, UnicodeError, OSError):
    reject_loading({'code': 'CONTENT_ENTRY_UNAVAILABLE', 'path': 'scripts/mc_resources.py',
        'message': 'The installed MC entry modules could not be loaded.',
        'action': 'Reinstall the complete verified archive in a new empty directory and start a new process.'})


def preflight(operation='all', *, root=None):
    from mc_runtime import preflight as preflight_program
    return preflight_program(operation, root=root)


def compile_layout(envelope, *, root=None):
    from mc_runtime import require_compile_dependency
    require_compile_dependency()
    try:
        from mc_layout_compiler import compile_layout as compile_program
    except ImportError as error:
        raise ContentError('CONTENT_DEPENDENCY_UNAVAILABLE', 'jsonschema', 'The compilation dependency could not be loaded.',
            action='Reinstall scripts/requirements.txt with the caller Python interpreter.') from error
    return compile_program(envelope, root=root)


def inspect_assembly(document, specification, *, root=None, correlation=None):
    from mc_inspection import inspect_assembly as inspect_program
    return inspect_program(document, specification, root=root, correlation=correlation)



def inspect_artifact(artifact, specification, *, artifact_ref, binding, association, root=None):
    from mc_inspection import inspect_artifact as inspect_program
    return inspect_program(artifact, specification, artifact_ref=artifact_ref,
                           binding=binding, association=association, root=root)


def inspect_schema(document, *, root=None):
    from mc_inspection import inspect_schema as inspect_program
    return inspect_program(document, root=root)


def upgrade_page(input_file, output_directory=None, *, root=None, target=None):
    """Explicit file migration; the product CLI preserves bytes and refuses existing output."""
    from mc_runtime import run_node
    root, _ = verify_package(root)
    command = ['node', str(root / 'scripts/upgrade-page.mjs'), str(input_file)]
    if output_directory is not None:
        command.extend(['--out-dir', str(output_directory)])
    if target is not None:
        command.extend(['--target', target])
    return run_node(command[1:], timeout=60, failure_code='PAGE_UPGRADE_UNAVAILABLE', accept_report=True)


def evaluate(matrix, *, root=None):
    root, manifest = verify_package(root)
    checks = []
    for case in matrix['checks']:
        operation = case['operation']
        if operation == 'compile':
            result = compile_layout(case['input'], root=root)
        elif operation == 'inspect':
            result = inspect_assembly(case['input']['document'], case['input']['inspectionSpec'], root=root)
        else:
            checks.append({'id': case['id'], 'status': 'not_run', 'reason': 'No deployment receipt or supported local operation provided'})
            continue
        checks.append({'id': case['id'], 'status': 'passed' if result['status'] == case['expectedStatus'] else 'failed', 'result': result})
    return {'testedContent': {key: manifest[key] for key in ('contentVersion', 'contentSha256', 'alignedWith')},
        'environment': 'local-deterministic', 'checks': checks,
        'conclusion': {'passed': sum(c['status'] == 'passed' for c in checks), 'failed': sum(c['status'] == 'failed' for c in checks),
            'not_run': sum(c['status'] == 'not_run' for c in checks)},
        'adoptionPolicy': 'caller-owned; no approval, exemption or activation is performed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['query', 'compile', 'inspect', 'schema', 'upgrade', 'evaluate', 'verify', 'diagnose', 'preflight'])
    parser.add_argument('--capability', choices=['all', 'verify', 'compile', 'schema', 'upgrade', 'knowledge'], default='all')
    parser.add_argument('--input', help='JSON input file, or stdin when omitted')
    parser.add_argument('--topic')
    parser.add_argument('--key', default='')
    parser.add_argument('--root')
    parser.add_argument('--options', default='{}')
    parser.add_argument('--out-dir')
    parser.add_argument('--target')
    args = parser.parse_args()
    try:
        if args.operation == 'diagnose':
            result = diagnose_package(args.root)
        elif args.operation == 'preflight':
            result = preflight(args.capability, root=args.root)
        elif args.operation == 'verify':
            _, result = verify_package(args.root)
            result = {key: value for key, value in result.items() if key != 'files'}
        elif args.operation == 'query':
            result = query_content(args.topic, args.key, json.loads(args.options), root=args.root)
        elif args.operation == 'upgrade':
            if not args.input:
                raise ContentError('UPGRADE_INPUT_REQUIRED')
            result = upgrade_page(args.input, args.out_dir, root=args.root, target=args.target)
        else:
            value = json.loads(Path(args.input).read_text(encoding='utf-8') if args.input else sys.stdin.read())
            operations = {'compile': lambda: compile_layout(value, root=args.root),
                'inspect': lambda: inspect_assembly(value['document'], value['inspectionSpec'], root=args.root, correlation=value.get('correlation')),
                'schema': lambda: inspect_schema(value, root=args.root),
                'evaluate': lambda: evaluate(value, root=args.root)}
            result = operations[args.operation]()
        print(json.dumps(result, ensure_ascii=False))
        return int(args.operation in {'diagnose', 'preflight'} and result['status'] != 'ok')
    except (ContentError, ValueError, KeyError, OSError) as error:
        print(json.dumps({'status': 'invalid', 'issues': [error.issue if isinstance(error, ContentError) else {'code': 'INPUT_INVALID', 'message': str(error)}]}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())
