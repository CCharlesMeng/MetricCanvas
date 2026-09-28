"""Retry transient reads once; successful query records remain immutable."""
import asyncio
from metriccanvas_authoring.data.execution import DqeExecutionError, retry_safe_for_code


class RetryingDqe:
    def __init__(self, delegate, current):
        self.delegate, self.current = delegate, current
        self.retries = 0
        self.failures = []

    async def execute(self, query):
        for attempt in range(2):
            await self.current()
            try:
                return await self.delegate.execute(query)
            except DqeExecutionError as error:
                self.failures.append({'code': error.code, 'attempt': attempt + 1})
                if attempt or not retry_safe_for_code(error.code):
                    raise
                self.retries += 1
                await asyncio.sleep(.1)
