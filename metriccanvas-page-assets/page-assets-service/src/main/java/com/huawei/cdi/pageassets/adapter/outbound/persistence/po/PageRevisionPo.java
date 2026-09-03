package com.huawei.cdi.pageassets.adapter.outbound.persistence.po;

import java.time.Instant;

/** `t_pa_page_revision` 一行；`document` 是原样 JSON 文本，来源三列在 manual 时全为 NULL。 */
public record PageRevisionPo(
        String revisionId,
        String pageId,
        long revisionNumber,
        String baseRevisionId,
        String document,
        String contentHash,
        String dataContextVersion,
        String sourceType,
        String sourceSessionId,
        String sourceRunId,
        String sourceSkillVersion,
        String createdBy,
        Instant createdAt) {
}
