package com.huawei.cdi.pageassets.domain.revision;

/** `REVISION_CONFLICT` 只携带的当前最新修订标识（ADR-0062）。 */
public record RevisionRef(String revisionId, long revisionNumber) {
}
