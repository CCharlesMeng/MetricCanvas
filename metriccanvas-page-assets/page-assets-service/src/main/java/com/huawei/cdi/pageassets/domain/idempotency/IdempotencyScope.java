package com.huawei.cdi.pageassets.domain.idempotency;

import java.util.Objects;

/** 幂等键作用域 `(operation, actorId, idempotencyKey)`（ADR-0062）。 */
public record IdempotencyScope(String operation, String actorId, String idempotencyKey) {
    public static final String SAVE_PAGE_REVISION = "savePageRevision";

    public IdempotencyScope {
        Objects.requireNonNull(operation, "operation");
        Objects.requireNonNull(actorId, "actorId");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey");
    }

    public static IdempotencyScope savePageRevision(String actorId, String idempotencyKey) {
        return new IdempotencyScope(SAVE_PAGE_REVISION, actorId, idempotencyKey);
    }

    /** 会话锁名：MySQL `GET_LOCK` 名字上限 64 字符，因此取作用域的 sha256 前缀而不是原文。 */
    public String lockName() {
        return "pa:idem:" + com.huawei.cdi.pageassets.domain.revision.ContentHash
                .sha256(operation + "\u0000" + actorId + "\u0000" + idempotencyKey).substring(0, 40);
    }
}
