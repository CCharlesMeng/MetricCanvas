package com.huawei.cdi.pageassets.domain.page.schema;

import com.fasterxml.jackson.databind.JsonNode;

/** 结构校验的原始错误，形状对齐 ajv 的 ErrorObject（instancePath / keyword / message / params）。 */
public record SchemaError(String instancePath, String keyword, String message, JsonNode params) {
}
