package com.huawei.cdi.pageassets.domain.page;

/**
 * 契约定义的校验错误：`type` 取错误闭集，`path` 是定位到文档的 JSON Pointer。
 * `INVALID_PAGE` 的 details 逐条携带它（ADR-0062）。
 */
public record TypedError(ErrorType type, String path, String message) {
    public static TypedError schema(String path, String message) {
        return new TypedError(ErrorType.SCHEMA_ERROR, path, message);
    }

    public static TypedError queryMapping(String path, String message) {
        return new TypedError(ErrorType.QUERY_MAPPING_ERROR, path, message);
    }

    public static TypedError filterBinding(String path, String message) {
        return new TypedError(ErrorType.FILTER_BINDING_ERROR, path, message);
    }
}
