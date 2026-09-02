package com.huawei.cdi.pageassets.application.port;

import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;

import java.time.Instant;
import java.util.Optional;

/** 幂等结果的出站 Port；保留 7 天，`purgeBefore` 供独立清理任务调用（J3）。 */
public interface IdempotencyRepository {

    Optional<IdempotencyRecord> find(IdempotencyScope scope);

    void save(IdempotencyRecord record);

    /** 删除 createdAt 早于 cutoff 的记录，返回条数。 */
    int purgeBefore(Instant cutoff);
}
