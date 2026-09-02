package com.huawei.cdi.pageassets.domain.page;

/** 页面校验错误闭集，与 contracts/metriccanvas/page/error-types.json 一致；顺序即契约顺序。 */
public enum ErrorType {
    SCHEMA_ERROR,
    FIELD_CONTRACT_ERROR,
    QUERY_MAPPING_ERROR,
    FILTER_BINDING_ERROR,
    DQE_PROTOCOL_ERROR,
    DQE_EXECUTION_ERROR,
    DATA_CONTEXT_ERROR
}
