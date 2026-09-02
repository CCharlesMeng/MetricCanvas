package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 使用查询字段映射把 DQE 原始结果归一化为稳定页面字段。字段类型、nullable 与日期时间规则
 * 全部委托 {@link FieldContract}，本类只负责映射。
 */
public final class QueryRows {
    private QueryRows() {
    }

    /**
     * code 取值：ROWS_NOT_ARRAY / ROW_NOT_OBJECT / MISSING_QUERY_FIELD / MISSING_DETAIL_QUERY_FIELD，
     * 或 {@link FieldContract.Violation} 的分类并附映射上下文（queryField / itemQueryField）。
     */
    public record Issue(String code, Integer rowIndex, String fieldId, String queryField, Integer itemIndex,
                        String itemFieldId, String itemQueryField, FieldContract.Violation violation) {
    }

    public record Result(ArrayNode rows, List<Issue> issues) {
        public Result {
            issues = List.copyOf(issues);
        }

        public boolean ok() {
            return issues.isEmpty();
        }
    }

    public static Result normalize(JsonNode value, JsonNode fieldMappings) {
        List<Issue> issues = new ArrayList<>();
        ArrayNode rows = JsonNodeFactory.instance.arrayNode();
        if (!Json.isArray(value)) {
            issues.add(new Issue("ROWS_NOT_ARRAY", null, null, null, null, null, null, null));
            return new Result(rows, issues);
        }
        for (int rowIndex = 0; rowIndex < value.size(); rowIndex++) {
            JsonNode rawRow = value.get(rowIndex);
            if (!Json.isRecord(rawRow)) {
                issues.add(new Issue("ROW_NOT_OBJECT", rowIndex, null, null, null, null, null, null));
                continue;
            }
            ObjectNode row = JsonNodeFactory.instance.objectNode();
            for (Map.Entry<String, JsonNode> entry : Json.entries(fieldMappings)) {
                String fieldId = entry.getKey();
                JsonNode mapping = entry.getValue();
                if (!DataSources.hasQueryFieldMapping(mapping)) {
                    continue;
                }
                String queryField = DataSources.queryField(mapping);
                if (!rawRow.has(queryField)) {
                    issues.add(new Issue("MISSING_QUERY_FIELD", rowIndex, fieldId, queryField, null, null, null, null));
                    continue;
                }
                JsonNode raw = rawRow.get(queryField);
                Mapped mapped = "recordList".equals(DataSources.type(mapping))
                        ? mapDetailItems(raw, mapping, rowIndex, fieldId)
                        : new Mapped(raw, List.of(), Set.of());
                issues.addAll(mapped.issues);

                List<FieldContract.Violation> violations = new ArrayList<>();
                for (FieldContract.Violation violation : FieldContract.violations(mapped.value, mapping)) {
                    if ("DETAIL_MISSING_FIELD".equals(violation.code())
                            && mapped.misses.contains(violation.itemIndex() + ":" + violation.itemFieldId())) {
                        continue;
                    }
                    violations.add(violation);
                }
                if (violations.isEmpty() && mapped.issues.isEmpty()) {
                    row.set(fieldId, mapped.value);
                }
                for (FieldContract.Violation violation : violations) {
                    String itemQueryField = null;
                    if (violation.itemFieldId() != null && "recordList".equals(DataSources.type(mapping))) {
                        JsonNode itemMapping = Json.get(Json.get(Json.get(mapping, "items"), "fields"), violation.itemFieldId());
                        itemQueryField = DataSources.queryField(itemMapping);
                    }
                    issues.add(new Issue(violation.code(), rowIndex, fieldId, queryField, violation.itemIndex(),
                            violation.itemFieldId(), itemQueryField, violation));
                }
            }
            rows.add(row);
        }
        return new Result(rows, issues);
    }

    private record Mapped(JsonNode value, List<Issue> issues, Set<String> misses) {
    }

    /** 把嵌套明细的项按项级查询字段映射改写为稳定项字段；未映射的 DQE 追加字段就地丢弃。 */
    private static Mapped mapDetailItems(JsonNode value, JsonNode mapping, int rowIndex, String fieldId) {
        if (!Json.isArray(value)) {
            return new Mapped(value, List.of(), Set.of());
        }
        List<Issue> issues = new ArrayList<>();
        Set<String> misses = new HashSet<>();
        ArrayNode items = JsonNodeFactory.instance.arrayNode();
        JsonNode itemMappings = Json.get(Json.get(mapping, "items"), "fields");
        String queryField = DataSources.queryField(mapping);
        for (int itemIndex = 0; itemIndex < value.size(); itemIndex++) {
            JsonNode rawItem = value.get(itemIndex);
            if (!Json.isRecord(rawItem)) {
                items.add(rawItem);
                continue;
            }
            ObjectNode record = JsonNodeFactory.instance.objectNode();
            for (Map.Entry<String, JsonNode> entry : Json.entries(itemMappings)) {
                String itemFieldId = entry.getKey();
                String itemQueryField = DataSources.queryField(entry.getValue());
                if (!rawItem.has(itemQueryField)) {
                    misses.add(itemIndex + ":" + itemFieldId);
                    issues.add(new Issue("MISSING_DETAIL_QUERY_FIELD", rowIndex, fieldId, queryField, itemIndex,
                            itemFieldId, itemQueryField, null));
                    continue;
                }
                record.set(itemFieldId, rawItem.get(itemQueryField));
            }
            items.add(record);
        }
        return new Mapped(items, issues, misses);
    }
}
