"""Host-configured subprocess adapter. No shell or model-supplied command/path."""
import asyncio
import json


class SubprocessParameterProgram:
    def __init__(self, command: tuple[str, ...], *, cwd: str, timeout_seconds=20, max_bytes=20*1024*1024):
        if not command or timeout_seconds <= 0 or max_bytes <= 0:
            raise ValueError('Invalid parameter program configuration')
        self.command, self.cwd, self.timeout, self.max_bytes = command, cwd, timeout_seconds, max_bytes

    async def prepare(self, request):
        payload = json.dumps(request, allow_nan=False).encode()
        if len(payload) > self.max_bytes: raise ValueError('Parameter input too large')
        process = await asyncio.create_subprocess_exec(*self.command, cwd=self.cwd,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        async def exchange():
            async def write():
                process.stdin.write(payload)
                await process.stdin.drain()
                process.stdin.close()
            writer = asyncio.create_task(write())
            chunks, total = [], 0
            try:
                while chunk := await process.stdout.read(65536):
                    total += len(chunk)
                    if total > self.max_bytes: raise ValueError('Parameter output too large')
                    chunks.append(chunk)
                await writer
                await process.wait()
                if process.returncode: raise ValueError('Parameter process failed')
                return json.loads(b''.join(chunks))
            finally:
                if not writer.done(): writer.cancel()
                await asyncio.gather(writer, return_exceptions=True)
        try:
            return await asyncio.wait_for(exchange(), self.timeout)
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()
