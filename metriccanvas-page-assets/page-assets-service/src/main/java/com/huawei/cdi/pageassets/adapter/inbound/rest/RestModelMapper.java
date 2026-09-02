package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.application.PageCatalogPage;
import com.huawei.cdi.pageassets.domain.error.ErrorDetails;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.domain.revision.RevisionRef;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;
import com.huawei.cdi.pageassets.model.InvalidPageDetails;
import com.huawei.cdi.pageassets.model.LatestRevisionRef;
import com.huawei.cdi.pageassets.model.PageList;
import com.huawei.cdi.pageassets.model.PageListItem;
import com.huawei.cdi.pageassets.model.RevisionConflictDetails;
import com.huawei.cdi.pageassets.model.RevisionSummary;
import com.huawei.cdi.pageassets.model.SavePageRevisionRequest;
import com.huawei.cdi.pageassets.model.ValidationError;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;

/**
 * codegen model 与领域对象之间的映射。文档在传输层是 `Object`（Jackson 的 Map/List 树），
 * 进领域前转成 Jackson 树；响应里原样返回保存时的文档。
 */
public final class RestModelMapper {
    private final ObjectMapper mapper;

    public RestModelMapper(ObjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public SaveRevisionCommand toCommand(String pageId, SavePageRevisionRequest request) {
        JsonNode document = mapper.valueToTree(request.getDocument());
        return new SaveRevisionCommand(
                pageId,
                request.getBaseRevisionId(),
                document,
                request.getIdempotencyKey(),
                Boolean.TRUE.equals(request.isPageIdConfirmed()),
                toSource(request.getSource()),
                request.getDataContextVersion());
    }

    static RevisionSource toSource(com.huawei.cdi.pageassets.model.RevisionSource source) {
        if (source == null || source.getType() == null) {
            throw new InvalidRequestException("source.type 必须是 relay 或 manual");
        }
        switch (source.getType()) {
            case RELAY -> {
                if (source.getSkillVersion() == null || source.getSkillVersion().isBlank()) {
                    throw new InvalidRequestException("source.type 为 relay 时必须携带 skillVersion");
                }
                return RevisionSource.relay(source.getSessionId(), source.getRunId(), source.getSkillVersion());
            }
            case MANUAL -> {
                if (source.getSessionId() != null || source.getRunId() != null || source.getSkillVersion() != null) {
                    throw new InvalidRequestException("source.type 为 manual 时不得携带 sessionId / runId / skillVersion");
                }
                return RevisionSource.manual();
            }
            default -> throw new InvalidRequestException("source.type 必须是 relay 或 manual");
        }
    }

    public com.huawei.cdi.pageassets.model.PageRevision toModel(PageRevision revision) {
        return new com.huawei.cdi.pageassets.model.PageRevision()
                .revisionId(revision.revisionId())
                .revisionNumber(revision.revisionNumber())
                .pageId(revision.pageId())
                .baseRevisionId(revision.baseRevisionId())
                .document(mapper.convertValue(revision.document(), Object.class))
                .contentHash(revision.contentHash())
                .dataContextVersion(revision.dataContextVersion())
                .source(toModel(revision.source()))
                .createdBy(revision.createdBy())
                .createdAt(utc(revision.createdAt()));
    }

    static com.huawei.cdi.pageassets.model.RevisionSource toModel(RevisionSource source) {
        com.huawei.cdi.pageassets.model.RevisionSource model = new com.huawei.cdi.pageassets.model.RevisionSource();
        if (source instanceof RevisionSource.Relay relay) {
            return model.type(com.huawei.cdi.pageassets.model.RevisionSource.TypeEnum.RELAY)
                    .sessionId(relay.sessionId())
                    .runId(relay.runId())
                    .skillVersion(relay.skillVersion());
        }
        return model.type(com.huawei.cdi.pageassets.model.RevisionSource.TypeEnum.MANUAL);
    }

    public PageList toModel(PageCatalogPage page) {
        PageList list = new PageList().nextAfter(page.nextAfter());
        for (PageHead head : page.pages()) {
            list.addPagesItem(new PageListItem()
                    .pageId(head.pageId())
                    .latestRevision(new RevisionSummary()
                            .revisionId(head.latestRevisionId())
                            .revisionNumber(head.latestRevisionNumber())
                            .createdAt(utc(head.latestCreatedAt()))));
        }
        return list;
    }

    public Object toModel(ErrorDetails details) {
        if (details instanceof ErrorDetails.InvalidPage invalid) {
            InvalidPageDetails model = new InvalidPageDetails();
            for (TypedError error : invalid.errors()) {
                model.addErrorsItem(new ValidationError()
                        .type(error.type().name())
                        .path(error.path())
                        .message(error.message()));
            }
            return model;
        }
        if (details instanceof ErrorDetails.RevisionConflict conflict) {
            RevisionRef latest = conflict.currentLatest();
            return new RevisionConflictDetails().currentLatest(latest == null ? null
                    : new LatestRevisionRef().revisionId(latest.revisionId()).revisionNumber(latest.revisionNumber()));
        }
        return null;
    }

    static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
