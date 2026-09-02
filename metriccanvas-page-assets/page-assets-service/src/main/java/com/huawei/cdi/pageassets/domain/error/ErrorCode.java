package com.huawei.cdi.pageassets.domain.error;

/**
 * 稳定错误码闭集（ADR-0062）。`NOT_SUPPORTED` 由 consumer 侧 Adapter 对首批未开放能力返回，
 * 本 Module 自身不产生；列入是为了闭集只有一处定义。
 */
public enum ErrorCode {
    INVALID_PAGE,
    PAGE_ID_MISMATCH,
    PAGE_ID_CONFIRMATION_REQUIRED,
    PAGE_NOT_FOUND,
    REVISION_NOT_FOUND,
    REVISION_CONFLICT,
    IDEMPOTENCY_CONFLICT,
    NOT_SUPPORTED
}
