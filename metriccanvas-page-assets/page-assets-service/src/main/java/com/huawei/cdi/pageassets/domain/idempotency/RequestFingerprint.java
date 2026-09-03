package com.huawei.cdi.pageassets.domain.idempotency;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.revision.ContentHash;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;

/**
 * 请求指纹：保存请求的**意图与内容**——`pageId`、`baseRevisionId`、`document`——规范化 JSON 的 sha256。
 * 同键同指纹原样重放，同键异指纹 `IDEMPOTENCY_CONFLICT`（ADR-0062 拒绝幂等盲重放）。
 *
 * <p>不进指纹的字段及原因：actorId 已在作用域里；`source`（sessionId / runId / skillVersion）是来源留痕，
 * Relay 每次工具调用可能是一次性子进程、重试时 sessionId 必然不同，若进指纹会让 ADR-0063 期望"命中幂等
 * 原样返回"的重试变成冲突（J4 纵切实跑出来的）；`dataContextVersion` 与 `pageIdConfirmed` 同理属于
 * 留痕 / 控制位，内容相同的重放没有理由被拒绝。首次成功保存记录的来源与版本即为该修订的留痕。
 */
public final class RequestFingerprint {
    private RequestFingerprint() {
    }

    public static String of(SaveRevisionCommand command) {
        ObjectNode shape = JsonNodeFactory.instance.objectNode();
        shape.put("pageId", command.pageId());
        shape.put("baseRevisionId", command.baseRevisionId());
        shape.set("document", command.document());
        return ContentHash.sha256(Json.canonical(shape));
    }
}
