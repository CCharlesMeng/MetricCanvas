package com.huawei.cdi.pageassets.domain.idempotency;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * 幂等结果：只记成功保存。重放时按 `(pageId, revisionId)` 取回不可变修订原样返回，不另存响应体。
 * 保留 7 天，由独立清理任务回收（J3）。
 */
public record IdempotencyRecord(
        IdempotencyScope scope,
        String fingerprint,
        String pageId,
        String revisionId,
        Instant createdAt) {

    public static final Duration RETENTION = Duration.ofDays(7);

    public IdempotencyRecord {
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(fingerprint, "fingerprint");
        Objects.requireNonNull(pageId, "pageId");
        Objects.requireNonNull(revisionId, "revisionId");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    public boolean matches(String otherFingerprint) {
        return fingerprint.equals(otherFingerprint);
    }

    public boolean expiredAt(Instant now) {
        return !now.isBefore(createdAt.plus(RETENTION));
    }
}
