package com.huawei.cdi.pageassets.adapter.outbound.persistence.po;

import java.time.Instant;

/** `t_pa_page` 一行：latest 指针。`createTime` / `updateTime` 是公司审计列惯例，取修订创建时刻而非数据库时钟。 */
public record PagePo(
        String pageId,
        String latestRevisionId,
        long latestRevisionNumber,
        Instant latestCreatedAt,
        Instant createTime,
        Instant updateTime) {
}
