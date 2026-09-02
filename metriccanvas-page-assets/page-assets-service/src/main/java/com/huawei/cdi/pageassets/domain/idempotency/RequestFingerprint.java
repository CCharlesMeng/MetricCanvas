package com.huawei.cdi.pageassets.domain.idempotency;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.revision.ContentHash;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;

/**
 * 请求指纹：保存请求体全部业务字段的规范化 JSON 的 sha256。同键同指纹原样重放，同键异指纹
 * `IDEMPOTENCY_CONFLICT`（ADR-0062 拒绝幂等盲重放）。actorId 已在作用域里，不重复进指纹。
 */
public final class RequestFingerprint {
    private RequestFingerprint() {
    }

    public static String of(SaveRevisionCommand command) {
        ObjectNode shape = JsonNodeFactory.instance.objectNode();
        shape.put("pageId", command.pageId());
        shape.put("baseRevisionId", command.baseRevisionId());
        shape.set("document", command.document());
        shape.put("pageIdConfirmed", command.pageIdConfirmed());
        shape.set("source", sourceNode(command.source()));
        shape.put("dataContextVersion", command.dataContextVersion());
        return ContentHash.sha256(Json.canonical(shape));
    }

    private static ObjectNode sourceNode(RevisionSource source) {
        ObjectNode node = JsonNodeFactory.instance.objectNode();
        node.put("type", source.type());
        if (source instanceof RevisionSource.Relay relay) {
            node.put("sessionId", relay.sessionId());
            node.put("runId", relay.runId());
            node.put("skillVersion", relay.skillVersion());
        }
        return node;
    }
}
