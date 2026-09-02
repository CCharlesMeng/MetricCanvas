package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 把 query 页面数据源中按角色分组的局部显式字段展开，按 queryField 将 DQE 原始内嵌初始行
 * 归一化为稳定页面字段，并把文本取值引用整值替换为字符串，最终解析为完整 Page。
 * 纯计算接缝：不修改输入。
 */
public final class Materializer {
    private Materializer() {
    }

    public record Materialized(JsonNode document, List<TypedError> errors) {
        public Materialized {
            errors = List.copyOf(errors);
        }
    }

    public static Materialized materialize(JsonNode input) {
        if (!Json.isRecord(input)) {
            return new Materialized(input, List.of());
        }
        ObjectNode cloned = (ObjectNode) Json.clone(input);
        List<JsonNode> declarations = PageParams.declarations(cloned);
        ObjectNode document = (ObjectNode) TextValues.resolve(cloned, TextValues.validationResolution(declarations));
        List<TypedError> errors = new ArrayList<>();

        JsonNode dataSources = Json.record(document.get("dataSources"));
        if (dataSources == null) {
            return new Materialized(document, errors);
        }
        for (Map.Entry<String, JsonNode> entry : Json.entries(dataSources)) {
            String sourceId = entry.getKey();
            JsonNode candidate = Json.record(entry.getValue());
            if (candidate == null || !DataSources.isQuery(candidate)) {
                continue;
            }
            JsonNode fields = candidate.get("fields");
            if (isGroupedQueryFields(fields)) {
                ObjectNode expanded = JsonNodeFactory.instance.objectNode();
                expandGroup(fields, "dimensions", "dimension", sourceId, expanded, errors);
                expandGroup(fields, "measures", "measure", sourceId, expanded, errors);
                ((ObjectNode) candidate).set("fields", expanded);
                fields = expanded;
            }
            JsonNode initial = Json.record(Json.get(candidate.get("source"), "initial"));
            if (initial == null) {
                continue;
            }
            QueryRows.Result normalized = QueryRows.normalize(initial.get("rows"), fields);
            if (normalized.ok()) {
                ((ObjectNode) initial).set("rows", normalized.rows());
            } else {
                for (QueryRows.Issue issue : normalized.issues()) {
                    errors.add(queryRowIssueError(sourceId, issue));
                }
            }
        }
        return new Materialized(document, errors);
    }

    private static void expandGroup(JsonNode grouped, String groupName, String role, String sourceId,
                                    ObjectNode expanded, List<TypedError> errors) {
        JsonNode group = Json.record(grouped.get(groupName));
        if (group == null) {
            return;
        }
        for (Map.Entry<String, JsonNode> entry : Json.entries(group)) {
            String fieldId = entry.getKey();
            JsonNode definition = entry.getValue();
            String path = "/dataSources/" + JsonPointer.escape(sourceId) + "/fields/" + groupName + "/"
                    + JsonPointer.escape(fieldId);
            if (expanded.has(fieldId)) {
                errors.add(TypedError.schema(path, "页面字段重复声明:" + fieldId));
                continue;
            }
            JsonNode label = definition.get("label");
            if (label != null && label.isTextual() && label.textValue().equals(fieldId)) {
                errors.add(TypedError.schema(path + "/label", "label 与字段 id 相同，应省略:" + fieldId));
            }
            ObjectNode field = definition.deepCopy();
            field.put("role", "money".equals(Json.text(definition.get("type"))) ? "measure" : role);
            expanded.set(fieldId, field);
        }
    }

    private static boolean isGroupedQueryFields(JsonNode value) {
        return Json.isRecord(value) && (value.has("dimensions") || value.has("measures"));
    }

    private static TypedError queryRowIssueError(String sourceId, QueryRows.Issue issue) {
        String rowsPath = "/dataSources/" + JsonPointer.escape(sourceId) + "/source/initial/rows";
        switch (issue.code()) {
            case "ROWS_NOT_ARRAY":
                return TypedError.schema(rowsPath, "DQE 内嵌初始行必须是数组");
            case "ROW_NOT_OBJECT":
                return TypedError.schema(rowsPath + "/" + issue.rowIndex(), "DQE 内嵌初始行必须是对象");
            default:
                break;
        }
        String fieldPath = rowsPath + "/" + issue.rowIndex() + "/" + JsonPointer.escape(issue.queryField());
        FieldContract.Violation violation = issue.violation();
        switch (issue.code()) {
            case "MISSING_QUERY_FIELD":
                return TypedError.schema(fieldPath, "DQE 内嵌初始行缺少映射字段:" + issue.queryField());
            case "NULL_NOT_ALLOWED":
                return TypedError.schema(fieldPath,
                        "DQE 字段 " + issue.queryField() + " 为 null，页面字段 " + issue.fieldId() + " 声明 nullable=false");
            case "TYPE_MISMATCH":
                return TypedError.schema(fieldPath, "DQE 字段 " + issue.queryField() + " 不符合页面字段 "
                        + issue.fieldId() + " 的类型 " + violation.expectedType());
            case "DETAIL_LIST_TOO_LARGE":
                return TypedError.schema(fieldPath, "DQE 嵌套明细字段 " + issue.queryField() + " 最多允许 "
                        + violation.maximum() + " 项，实际 " + violation.actualLength() + " 项");
            case "SEMANTIC_HTML_TOO_LARGE":
                return TypedError.schema(fieldPath, "DQE 语义 HTML 字段 " + issue.queryField() + " 最多允许 "
                        + violation.maximum() + " 字符，实际 " + violation.actualLength() + " 字符");
            case "DETAIL_ITEM_NOT_OBJECT":
                return TypedError.schema(fieldPath + "/" + issue.itemIndex(), "DQE 嵌套明细字段 "
                        + issue.queryField() + " 的第 " + (issue.itemIndex() + 1) + " 项必须是对象");
            case "MISSING_DETAIL_QUERY_FIELD":
                return TypedError.schema(fieldPath + "/" + issue.itemIndex() + "/" + JsonPointer.escape(issue.itemQueryField()),
                        "DQE 嵌套明细项缺少映射字段:" + issue.itemQueryField());
            default:
                break;
        }
        String itemField = issue.itemQueryField() != null ? issue.itemQueryField() : issue.itemFieldId();
        String itemPath = fieldPath + "/" + issue.itemIndex() + "/" + JsonPointer.escape(itemField);
        return switch (issue.code()) {
            case "DETAIL_UNDECLARED_FIELD" -> TypedError.schema(itemPath, "DQE 嵌套明细项包含未声明字段:" + itemField);
            case "DETAIL_MISSING_FIELD" -> TypedError.schema(itemPath, "DQE 嵌套明细项缺少字段:" + itemField);
            case "DETAIL_NULL_NOT_ALLOWED" -> TypedError.schema(itemPath, "DQE 嵌套明细字段 " + itemField
                    + " 为 null，页面字段 " + issue.itemFieldId() + " 声明 nullable=false");
            default -> TypedError.schema(itemPath, "DQE 嵌套明细字段 " + itemField + " 不符合页面字段 "
                    + issue.itemFieldId() + " 的类型 " + violation.expectedType());
        };
    }
}
