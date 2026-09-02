package com.huawei.cdi.pageassets.domain.page;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** 解析结果：成功时携带解析后的 Page（已展开分组字段、归一化内嵌行、替换文本取值），失败时携带全部错误。 */
public record PageParseResult(boolean ok, JsonNode page, List<TypedError> errors) {
    public PageParseResult {
        errors = List.copyOf(errors);
    }

    public static PageParseResult success(JsonNode page) {
        return new PageParseResult(true, page, List.of());
    }

    public static PageParseResult failure(List<TypedError> errors) {
        return new PageParseResult(false, null, List.copyOf(errors));
    }
}
