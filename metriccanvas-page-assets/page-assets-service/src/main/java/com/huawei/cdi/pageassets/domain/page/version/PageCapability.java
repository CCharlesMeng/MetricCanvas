package com.huawei.cdi.pageassets.domain.page.version;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.function.Function;

/**
 * 一项页面能力：由哪个次版本引入，以及文档中使用它的位置（JSON Pointer，空表示未使用）。
 * 能力探测按结构读取**原始文档**，因为文本取值引用在解析接缝会被整值替换掉。
 */
public record PageCapability(String id, int minor, String description, Function<JsonNode, List<String>> usage) {
    public List<String> usedAt(JsonNode document) {
        return usage.apply(document);
    }
}
