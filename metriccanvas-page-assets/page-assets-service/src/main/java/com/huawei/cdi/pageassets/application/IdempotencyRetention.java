package com.huawei.cdi.pageassets.application;

import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

/**
 * 幂等结果保留 7 天（ADR-0062）：过期后同键保存不再重放而是当作新请求判定。清理只删记录，不动修订。
 * 调度是适配器的事（`IdempotencyPurgeTask`），这里只定义"什么算过期"。
 */
public final class IdempotencyRetention {
    private final IdempotencyRepository idempotency;
    private final Clock clock;

    public IdempotencyRetention(IdempotencyRepository idempotency, Clock clock) {
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** 删除已过保留期的记录，返回条数。 */
    public int purgeExpired() {
        Instant cutoff = clock.instant().minus(IdempotencyRecord.RETENTION);
        return idempotency.purgeBefore(cutoff);
    }
}
