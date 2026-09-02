package com.huawei.cdi.pageassets.adapter.outbound.persistence.po;

import java.time.Instant;

/** `t_pa_idempotency` 一行：作用域三列为主键，其余是 J2 落地记录定下的五列中的指纹、页面、修订与时间。 */
public record IdempotencyPo(
        String operation,
        String actorId,
        String idempotencyKey,
        String fingerprint,
        String pageId,
        String revisionId,
        Instant createdAt) {
}
