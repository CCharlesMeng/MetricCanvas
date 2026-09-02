package com.huawei.cdi.pageassets.domain.revision;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Objects;

/**
 * 保存命令（ADR-0062 请求体）。`actorId` 不在命令里：它来自 `X-Operator-Id`，属于幂等作用域而不是请求指纹。
 */
public record SaveRevisionCommand(
        String pageId,
        String baseRevisionId,
        JsonNode document,
        String idempotencyKey,
        boolean pageIdConfirmed,
        RevisionSource source,
        String dataContextVersion) {

    public SaveRevisionCommand {
        Objects.requireNonNull(pageId, "pageId");
        Objects.requireNonNull(document, "document");
        Objects.requireNonNull(idempotencyKey, "idempotencyKey");
        Objects.requireNonNull(source, "source");
        if (idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("idempotencyKey 不能为空");
        }
    }
}
