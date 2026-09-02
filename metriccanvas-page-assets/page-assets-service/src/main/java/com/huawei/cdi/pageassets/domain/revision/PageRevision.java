package com.huawei.cdi.pageassets.domain.revision;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Objects;

/**
 * 不可变页面修订（ADR-0062）。`document` 是保存时提交的原样文档；`contentHash` 是其规范化 JSON 的 sha256；
 * `revisionNumber` 在页面内线性递增；`createdAt` 为 UTC 毫秒精度。
 */
public record PageRevision(
        String revisionId,
        long revisionNumber,
        String pageId,
        String baseRevisionId,
        JsonNode document,
        String contentHash,
        String dataContextVersion,
        RevisionSource source,
        String createdBy,
        Instant createdAt) {

    public PageRevision {
        Objects.requireNonNull(revisionId, "revisionId");
        Objects.requireNonNull(pageId, "pageId");
        Objects.requireNonNull(document, "document");
        Objects.requireNonNull(contentHash, "contentHash");
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        if (revisionNumber < 1) {
            throw new IllegalArgumentException("revisionNumber 从 1 开始");
        }
    }

    public RevisionRef ref() {
        return new RevisionRef(revisionId, revisionNumber);
    }

    public PageHead head() {
        return new PageHead(pageId, revisionId, revisionNumber, createdAt);
    }
}
