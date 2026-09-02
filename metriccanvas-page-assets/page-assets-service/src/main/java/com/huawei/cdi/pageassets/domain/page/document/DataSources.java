package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 页面数据源与结果字段契约的读取辅助（data-source.ts / field.ts / compute.ts 的对应物）。 */
public final class DataSources {
    private DataSources() {
    }

    public static String sourceType(JsonNode dataSource) {
        return Json.text(Json.get(Json.get(dataSource, "source"), "type"));
    }

    public static boolean isInline(JsonNode dataSource) {
        return "inline".equals(sourceType(dataSource));
    }

    public static boolean isQuery(JsonNode dataSource) {
        return "query".equals(sourceType(dataSource));
    }

    public static JsonNode fields(JsonNode dataSource) {
        return Json.record(Json.get(dataSource, "fields"));
    }

    public static JsonNode compute(JsonNode dataSource) {
        JsonNode compute = Json.get(dataSource, "compute");
        return Json.isArray(compute) ? compute : JsonNodeFactory.instance.arrayNode();
    }

    /** `'queryField' in field && typeof field.queryField === 'string'` */
    public static boolean hasQueryFieldMapping(JsonNode field) {
        return Json.isString(Json.get(field, "queryField"));
    }

    public static String queryField(JsonNode field) {
        return Json.text(Json.get(field, "queryField"));
    }

    public static String role(JsonNode field) {
        return Json.text(Json.get(field, "role"));
    }

    public static String type(JsonNode field) {
        return Json.text(Json.get(field, "type"));
    }

    /** 字段绑定 / 字段引用 → 页面字段 id：字符串简写与对象形式的统一解包。 */
    public static String fieldName(JsonNode binding) {
        return binding.isTextual() ? binding.textValue() : Json.text(binding.get("field"));
    }

    /** 统一运行时向组件提供的字段契约：去掉外部查询字段名（含嵌套明细项）。 */
    public static ObjectNode resolveFields(JsonNode dataSource) {
        ObjectNode resolved = JsonNodeFactory.instance.objectNode();
        JsonNode fields = fields(dataSource);
        if (fields == null) {
            return resolved;
        }
        boolean inline = isInline(dataSource);
        for (Map.Entry<String, JsonNode> entry : Json.entries(fields)) {
            JsonNode definition = entry.getValue();
            if (inline || !hasQueryFieldMapping(definition)) {
                resolved.set(entry.getKey(), definition.deepCopy());
                continue;
            }
            ObjectNode field = definition.deepCopy();
            field.remove("queryField");
            if ("recordList".equals(type(definition))) {
                ObjectNode items = JsonNodeFactory.instance.objectNode();
                ObjectNode itemFields = JsonNodeFactory.instance.objectNode();
                for (Map.Entry<String, JsonNode> item : Json.entries(Json.get(Json.get(definition, "items"), "fields"))) {
                    ObjectNode itemField = item.getValue().deepCopy();
                    itemField.remove("queryField");
                    itemFields.set(item.getKey(), itemField);
                }
                items.set("fields", itemFields);
                field.set("items", items);
            }
            resolved.set(entry.getKey(), field);
        }
        return resolved;
    }

    public static boolean isFoldingOperator(JsonNode operator) {
        String op = Json.text(Json.get(operator, "op"));
        return "groupSubtotal".equals(op) || "grandTotal".equals(op);
    }

    /** 算子产出的页面字段 id（去重、保持首次出现顺序）。 */
    public static Set<String> computeOutputFields(JsonNode operators) {
        Set<String> outputs = new LinkedHashSet<>();
        for (JsonNode operator : operators) {
            String op = Json.text(Json.get(operator, "op"));
            switch (op == null ? "" : op) {
                case "ratio", "delta" -> outputs.add(Json.text(operator.get("output")));
                case "groupSubtotal", "grandTotal" -> outputs.add(Json.text(Json.get(operator.get("rowKind"), "field")));
                case "pivot" -> {
                    for (JsonNode column : operator.get("columns")) {
                        outputs.add(Json.text(column.get("output")));
                    }
                }
                default -> {
                }
            }
        }
        return outputs;
    }

    /** 算子的输入字段契约：结果字段契约减去算子产出字段。 */
    public static ObjectNode inputFields(JsonNode dataSource) {
        JsonNode fields = fields(dataSource);
        Set<String> produced = computeOutputFields(compute(dataSource));
        if (produced.isEmpty()) {
            return (ObjectNode) fields;
        }
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        for (Map.Entry<String, JsonNode> entry : Json.entries(fields)) {
            if (!produced.contains(entry.getKey())) {
                result.set(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    public static List<String> stringArray(JsonNode value) {
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        if (Json.isArray(value)) {
            for (JsonNode item : value) {
                if (item.isTextual()) {
                    result.add(item.textValue());
                }
            }
        }
        return result;
    }

    /** DQE `output_metrics` 里的名称：字符串项或带 `alias` 的对象项。 */
    public static List<String> dqeMetricNames(JsonNode value) {
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        if (!Json.isArray(value)) {
            return result;
        }
        for (JsonNode item : value) {
            if (item.isTextual()) {
                result.add(item.textValue());
            } else if (Json.isRecord(item) && Json.isString(item.get("alias"))) {
                result.add(item.get("alias").textValue());
            }
        }
        return result;
    }
}
