package com.huawei.cdi.pageassets.adapter.outbound.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.IdempotencyPo;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.PagePo;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.PageRevisionPo;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;

import java.io.UncheckedIOException;
import java.util.Objects;

/**
 * 行 ↔ 领域对象。文档以原样 JSON 文本入库（键序保持提交顺序，MEDIUMTEXT 不是 JSON 列），读出时重新解析为树；
 * `contentHash` 存的是保存时算好的值，不在读路径重算。来源按 `source_type` 判别。
 */
final class PersistenceRows {
    private static final String SOURCE_RELAY = "relay";
    private static final String SOURCE_MANUAL = "manual";

    private final ObjectMapper json;

    PersistenceRows(ObjectMapper json) {
        this.json = Objects.requireNonNull(json, "json");
    }

    PageHead toHead(PagePo row) {
        return new PageHead(row.pageId(), row.latestRevisionId(), row.latestRevisionNumber(), row.latestCreatedAt());
    }

    PagePo toRow(PageHead head) {
        return new PagePo(head.pageId(), head.latestRevisionId(), head.latestRevisionNumber(),
                head.latestCreatedAt(), head.latestCreatedAt(), head.latestCreatedAt());
    }

    PageRevision toRevision(PageRevisionPo row) {
        return new PageRevision(
                row.revisionId(),
                row.revisionNumber(),
                row.pageId(),
                row.baseRevisionId(),
                parseDocument(row),
                row.contentHash(),
                row.dataContextVersion(),
                toSource(row),
                row.createdBy(),
                row.createdAt());
    }

    PageRevisionPo toRow(PageRevision revision) {
        RevisionSource source = revision.source();
        String sessionId = null;
        String runId = null;
        String skillVersion = null;
        if (source instanceof RevisionSource.Relay relay) {
            sessionId = relay.sessionId();
            runId = relay.runId();
            skillVersion = relay.skillVersion();
        }
        return new PageRevisionPo(
                revision.revisionId(),
                revision.pageId(),
                revision.revisionNumber(),
                revision.baseRevisionId(),
                writeDocument(revision.document()),
                revision.contentHash(),
                revision.dataContextVersion(),
                source.type(),
                sessionId,
                runId,
                skillVersion,
                revision.createdBy(),
                revision.createdAt());
    }

    IdempotencyRecord toRecord(IdempotencyPo row) {
        return new IdempotencyRecord(
                new IdempotencyScope(row.operation(), row.actorId(), row.idempotencyKey()),
                row.fingerprint(),
                row.pageId(),
                row.revisionId(),
                row.createdAt());
    }

    IdempotencyPo toRow(IdempotencyRecord record) {
        IdempotencyScope scope = record.scope();
        return new IdempotencyPo(scope.operation(), scope.actorId(), scope.idempotencyKey(),
                record.fingerprint(), record.pageId(), record.revisionId(), record.createdAt());
    }

    private static RevisionSource toSource(PageRevisionPo row) {
        return switch (row.sourceType()) {
            case SOURCE_RELAY -> RevisionSource.relay(row.sourceSessionId(), row.sourceRunId(), row.sourceSkillVersion());
            case SOURCE_MANUAL -> RevisionSource.manual();
            default -> throw new IllegalStateException(
                    "t_pa_page_revision.source_type 未知:" + row.sourceType() + " (" + row.revisionId() + ")");
        };
    }

    private JsonNode parseDocument(PageRevisionPo row) {
        try {
            return json.readTree(row.document());
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException("t_pa_page_revision.document 不是合法 JSON:" + row.revisionId(), e);
        }
    }

    private String writeDocument(JsonNode document) {
        try {
            return json.writeValueAsString(document);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException("页面文档序列化失败", e);
        }
    }
}
