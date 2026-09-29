"""Safe model-facing guidance; provider text and foreign identities stay private."""
_GUIDANCE = {
    'RESULT_SCOPE_MISMATCH': ('引用无法在当前创作轮次读取。sources 的值直接使用本轮 query_data 返回的原始 resultRef；由集成程序核对轮次和共享存储。', 'check_current_turn_and_store', 'integration'),
    'RESULT_VERSION_STALE': ('结果对应的数据上下文已变化；保留已有页面，核对所需数据版本后仅重查受影响项。', 'refresh_affected_request', 'model'),
    'RESULT_VALIDATION_POLICY_CHANGED': ('结果的校验策略已改变；当前策略下重查受影响项。', 'refresh_affected_request', 'model'),
    'RESULT_NOT_READY': ('该结果尚未就绪；读取同一 resultRef 的状态，其他独立内容可继续。', 'read_result_status', 'model'),
    'COMPOSE_REQUEST_INVALID': ('页面组装请求的外层结构不合法；修正请求结构并复用已有 resultRef。', 'correct_request', 'model'),
    'QUERY_REQUEST_INVALID': ('查询批的外层结构不合法；修正请求结构，保留业务条件。', 'correct_request', 'model'),
    'WORK_BUSY': ('同轮操作正在进行；等待后读取工作稿状态。', 'read_work_status', 'model'),
}


def public_issue(error):
    result = {'code': error.code, 'path': getattr(error, 'path', '')}
    if error.code in _GUIDANCE:
        message, action, owner = _GUIDANCE[error.code]
        result.update(message=message, action=action, recoveryOwner=owner)
    return result


def timed_stage(name):
    """Fixed stage and duration only. Diagnostic failure never changes behavior."""
    import logging
    import time
    from functools import wraps
    logger = logging.getLogger(__name__)
    def decorate(method):
        @wraps(method)
        async def call(*args, **kwargs):
            started, succeeded = time.monotonic(), False
            try:
                value = await method(*args, **kwargs)
                succeeded = True
                return value
            finally:
                try:
                    logger.info('authoring stage=%s completed=%s elapsed_ms=%d',
                                name, succeeded, (time.monotonic() - started) * 1000)
                except Exception:
                    pass
        return call
    return decorate
