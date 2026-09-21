"""Trusted process-scoped spool. Relay owns immutable inputs; credentials never persist."""
import json
import os
import re
import secrets
import stat
from pathlib import Path
from metriccanvas_authoring.application.lifecycle_ports import LifecycleError, LifecycleIdentity

TOKEN = re.compile(r'^[A-Za-z0-9_-]{16,128}$')
MAX_BYTES = 20 * 1024 * 1024


class InjectedLifecycleIdentity:
    """Deployment injects one user's identity per process; service verifies the token.

    This does not authenticate a user or turn the existing service account into one.
    Relay per-user injection remains an external integration requirement.
    """
    def __init__(self, environ=None):
        self.environ = os.environ if environ is None else environ

    def current(self):
        return LifecycleIdentity(self.environ.get('METRICCANVAS_OPERATOR_ID',''),
            self.environ.get('METRICCANVAS_WORKSPACE_ID',''), self.environ.get('METRICCANVAS_AUTH_TOKEN',''))


class FileLifecyclePrograms:
    def __init__(self, inputs: Path | None, outputs: Path | None):
        self.inputs, self.outputs = inputs, outputs

    def directory(self, path):
        if path is None:
            raise LifecycleError('PROGRAM_UNAVAILABLE')
        # Scope directories must be owned by this user and not group/world accessible.
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        mode = os.fstat(fd)
        if mode.st_uid != os.getuid() or stat.S_IMODE(mode.st_mode) & 0o077:
            os.close(fd)
            raise LifecycleError('FORBIDDEN')
        return fd

    async def load(self, token, identity):
        if not isinstance(token, str) or not TOKEN.fullmatch(token):
            raise LifecycleError('PROGRAM_TOKEN_INVALID')
        directory = self.directory(self.inputs)
        try:
            fd = os.open(token + '.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
            with os.fdopen(fd, 'rb') as source:
                metadata = os.fstat(source.fileno())
                if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid() or stat.S_IMODE(metadata.st_mode) & 0o077:
                    raise LifecycleError('FORBIDDEN')
                raw = source.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise LifecycleError('INVALID_REQUEST')
            value = json.loads(raw)
            if not isinstance(value, dict) or set(value) != {'actorId','workspaceId','request'}:
                raise LifecycleError('INVALID_REQUEST')
            if value['actorId'] != identity.actor_id or value['workspaceId'] != identity.workspace_id:
                raise LifecycleError('FORBIDDEN')
            return value['request']
        except FileNotFoundError:
            raise LifecycleError('PROGRAM_NOT_FOUND') from None
        except (OSError, ValueError, TypeError):
            raise LifecycleError('INVALID_REQUEST') from None
        finally:
            os.close(directory)

    async def store(self, value, identity):
        directory = self.directory(self.outputs)
        token = secrets.token_urlsafe(24)
        try:
            raw = json.dumps({'actorId':identity.actor_id, 'workspaceId':identity.workspace_id,
                'result':value}, ensure_ascii=False, allow_nan=False).encode()
            if len(raw) > MAX_BYTES:
                raise LifecycleError('INVALID_REQUEST')
            fd = os.open(token + '.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
            with os.fdopen(fd, 'wb') as target:
                target.write(raw)
                target.flush()
                os.fsync(target.fileno())
            return token
        finally:
            os.close(directory)
