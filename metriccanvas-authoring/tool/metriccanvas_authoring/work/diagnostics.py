"""Safe model-facing guidance; provider text and foreign identities stay private."""
from metriccanvas_authoring.diagnostics import safe_log
from contextvars import ContextVar
from uuid import uuid4

_stage = ContextVar("authoring_stage", default=None)
_GUIDANCE = {
    'RESULT_SCOPE_MISMATCH': ('引用无法在当前创作轮次读取。sources 的值直接使用本轮 query_data 返回的原始 resultRef；由集成程序核对轮次和共享存储。', 'check_current_turn_and_store', 'integration'),
    'RESULT_VERSION_STALE': ('结果对应的数据上下文已变化；保留已有页面，核对所需数据版本后仅重查受影响项。', 'refresh_affected_request', 'model'),
    'RESULT_VALIDATION_POLICY_CHANGED': ('结果的校验策略已改变；当前策略下重查受影响项。', 'refresh_affected_request', 'model'),
    'RESULT_NOT_READY': ('该结果尚未就绪；读取同一 resultRef 的状态，其他独立内容可继续。', 'read_result_status', 'model'),
    'COMPOSE_REQUEST_INVALID': ('页面组装请求的外层结构不合法；修正请求结构并复用已有 resultRef。', 'correct_request', 'model'),
    'QUERY_REQUEST_INVALID': ('查询批的外层结构不合法；修正请求结构，保留业务条件。', 'correct_request', 'model'),
    'OPERATION_INVALID': ('编辑操作不符合契约；按 operationId、字段位置和 constraint 修正该操作，保留其他独立操作。', 'correct_affected_input', 'model'),
    'WORK_BUSY': ('同轮操作正在进行；等待后读取工作稿状态。', 'read_work_status', 'model'),

    'TIME_GRANULARITY_UNSUPPORTED': ('时间粒度只支持 year、month、day；M 等价于 month。', 'correct_time_granularity', 'model'),
    'TIME_VALUE_PRECISION_INVALID': ('时间值必须匹配粒度：year 用 YYYY，month 用 YYYY-MM，day 用 YYYY-MM-DD；月和日可用同精度紧凑写法，不能截去日改变范围。', 'correct_time_precision', 'model'),
    'TIME_VALUE_CALENDAR_INVALID': ('时间值不是有效日历日期；核对年份、月份、月末及闰年。', 'correct_calendar_date', 'model'),
    'TIME_RANGE_REVERSED': ('开始时间晚于结束时间；按原始业务需求修正起止值。', 'correct_time_range', 'model'),
    'TIME_GRANULARITY_NOT_IN_DATA_CONTEXT': ('当前数据上下文未声明该粒度；核对可用粒度与原始需求。', 'check_time_capability', 'model'),
    'DATA_CONTEXT_NAME_NOT_FOUND': ('当前业务域未找到所选名称；核对规范名称、受治理别名及可见域候选，选择后重新授权。', 'check_governed_name', 'model'),
    'METRIC_NOT_IN_DATA_CONTEXT': ('当前业务域未找到该指标；核对精确名称或当前授权快照中的跨域候选，不自动改用派生指标。', 'check_governed_metric', 'model'),
    'TYPE_CHANGE_UNSUPPORTED': ('目标组件不能直接转换：需要支持的数据组件和唯一 main 数据槽。先读取该组件的实际类型与绑定。', 'inspect_component_binding', 'model'),
    'TYPE_CHANGE_COMPUTED_SOURCE_UNSUPPORTED': ('当前组件使用计算数据源，直接类型转换不支持此来源。', 'inspect_component_binding', 'model'),
    'TYPE_CHANGE_REQUIRES_ROW_EVIDENCE': ('转换需要行数证据；保留原组件并核对对应结果。', 'inspect_result_evidence', 'model'),
    'STRUCTURE_SOURCE_NOT_FOUND': ('指定来源不在本次可用来源中；使用本轮已授权结果对应的来源引用。', 'select_available_source', 'model'),
    'STRUCTURE_ROW_SELECTION_UNVERIFIED': ('无法证明行集合完整或匹配字段不是维度；核对完整结果与 totalCount。', 'inspect_result_coverage', 'model'),
    'STRUCTURE_ROW_SELECTION_AMBIGUOUS': ('指标卡需要唯一行或唯一维度匹配；当前匹配数不是一行。', 'correct_unique_match', 'model'),
    'STRUCTURE_CHANGE_FIELD_INVALID': ('变化字段必须已列入 fields、为 measure 且未被重复消费。', 'correct_change_field', 'model'),
    'STRUCTURE_CHANGE_RELATION_UNVERIFIED': ('变化字段与主指标的关系未被所选证据证实。', 'select_relation_evidence', 'model'),
    'STRUCTURE_CHANGE_UNIT_INVALID': ('变化字段需要 number 类型及 % 单位。', 'check_change_unit', 'model'),
    'DQE_ITEM_ERROR': ('执行服务返回条目失败；没有证据确定具体业务原因，请按关联调用检查服务。', 'inspect_execution_failure', 'integration'),
    'DQE_QUERY_REJECTED': ('执行服务拒绝该查询；核对服务诊断，保留原始业务范围。', 'inspect_execution_failure', 'integration'),
    'DQE_FORBIDDEN': ('执行服务拒绝访问；由集成方检查当前身份和授权。', 'check_execution_authorization', 'integration'),
}


def issue_details(code, path='', *, stage='generation'):
    message, action, owner = _GUIDANCE.get(code, (
        '该步骤未完成；按错误码和字段位置核对当前契约，保留原始业务范围。',
        'inspect_execution_failure' if stage == 'execution' else 'correct_affected_input',
        'integration' if stage == 'execution' else 'model'))
    return {'code': code, 'path': path, 'message': message, 'action': action, 'recoveryOwner': owner}


def pointer(parts):
    return ''.join('/' + str(part).replace('~', '~0').replace('/', '~1') for part in parts)


def schema_issues(schema, value, code, path=''):
    """Expose schema-owned expectations, never jsonschema messages containing values."""
    from jsonschema import Draft202012Validator
    # Select a known operation before validation so another variant cannot mask its field error.
    if isinstance(value, dict) and 'oneOf' in schema:
        branches = [s for s in schema['oneOf'] if s.get('properties', {}).get('type', {}).get('const') == value.get('type')]
        if len(branches) == 1:
            schema = branches[0]
    issues = []
    for error in Draft202012Validator(schema).iter_errors(value):
        issue = issue_details(code, path + pointer(error.absolute_path))
        issue['constraint'] = error.validator
        if error.validator == 'required':
            issue['expected'] = [key for key in error.validator_value if key not in error.instance][:20]
        elif error.validator in {'type', 'enum', 'const', 'pattern'}:
            issue['expected'] = error.validator_value
        issues.append(issue)
        if len(issues) == 10:
            break
    return issues


def public_issue(error):
    result = issue_details(error.code, getattr(error, 'path', ''), stage=getattr(error, 'stage', 'generation'))
    reason = getattr(error, 'reason', None)
    if reason is not None:
        result['reason'] = reason
    return result


def stage_context():
    return _stage.get() or {'traceId': None, 'spanId': None}


def timed_stage(name):
    """Safe correlation with task-local nesting; no arguments, rows or provider text."""
    import logging
    import time
    from functools import wraps
    logger = logging.getLogger(__name__)
    def decorate(method):
        @wraps(method)
        async def call(*args, **kwargs):
            parent = stage_context()
            span = {'traceId': parent['traceId'] or uuid4().hex, 'spanId': uuid4().hex}
            token = _stage.set(span)
            started, succeeded = time.monotonic(), False
            try:
                value = await method(*args, **kwargs)
                succeeded = True
                return value
            finally:
                _stage.reset(token)
                safe_log(logger, logging.INFO,
                         'authoring stage=%s trace_id=%s span_id=%s parent_span_id=%s started_monotonic=%f completed=%s elapsed_ms=%d',
                         name, span['traceId'], span['spanId'], parent['spanId'], started,
                         succeeded, (time.monotonic() - started) * 1000)
        return call
    return decorate
