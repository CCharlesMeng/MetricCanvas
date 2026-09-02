package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 结果字段契约校验：字段类型、nullable 语义、日期时间规则与明细约束的唯一实现。
 * inline 数据行校验与查询结果归一化都引用这里。错误只携带行号、字段名、分类与预期类型，
 * 不回显业务字段值。
 */
public final class FieldContract {
    public static final int MAX_DETAIL_RECORDS = 100;
    public static final int MAX_SEMANTIC_HTML_LENGTH = 64_000;
    private static final Pattern DATETIME = Pattern.compile(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:\\d{2})?$");

    private FieldContract() {
    }

    /**
     * 单个字段值违反契约的结构化描述。code 取值：NULL_NOT_ALLOWED / TYPE_MISMATCH /
     * DETAIL_LIST_TOO_LARGE / SEMANTIC_HTML_TOO_LARGE / DETAIL_ITEM_NOT_OBJECT / DETAIL_UNDECLARED_FIELD /
     * DETAIL_MISSING_FIELD / DETAIL_NULL_NOT_ALLOWED / DETAIL_TYPE_MISMATCH。
     */
    public record Violation(String code, String expectedType, Integer maximum, Integer actualLength,
                            Integer itemIndex, String itemFieldId) {
        static Violation of(String code, String expectedType) {
            return new Violation(code, expectedType, null, null, null, null);
        }

        static Violation tooLarge(String code, int maximum, int actualLength) {
            return new Violation(code, null, maximum, actualLength, null, null);
        }

        static Violation item(String code, int itemIndex, String itemFieldId, String expectedType) {
            return new Violation(code, expectedType, null, null, itemIndex, itemFieldId);
        }
    }

    /** 行集校验问题：行形状、字段集合与字段值契约。 */
    public record RowIssue(String code, Integer rowIndex, String fieldId, Violation violation) {
    }

    public static List<RowIssue> validateContractRows(JsonNode rows, JsonNode fields) {
        List<RowIssue> issues = new ArrayList<>();
        if (!Json.isArray(rows)) {
            issues.add(new RowIssue("ROWS_NOT_ARRAY", null, null, null));
            return issues;
        }
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            JsonNode row = rows.get(rowIndex);
            if (!Json.isRecord(row)) {
                issues.add(new RowIssue("ROW_NOT_OBJECT", rowIndex, null, null));
                continue;
            }
            for (String key : Json.keys(row)) {
                if (!fields.has(key)) {
                    issues.add(new RowIssue("UNDECLARED_FIELD", rowIndex, key, null));
                }
            }
            for (Map.Entry<String, JsonNode> entry : Json.entries(fields)) {
                String fieldId = entry.getKey();
                if (!row.has(fieldId)) {
                    issues.add(new RowIssue("MISSING_FIELD", rowIndex, fieldId, null));
                    continue;
                }
                for (Violation violation : violations(row.get(fieldId), entry.getValue())) {
                    issues.add(new RowIssue(violation.code(), rowIndex, fieldId, violation));
                }
            }
        }
        return issues;
    }

    /** 单个字段值对契约的全部违规；空列表表示符合契约。 */
    public static List<Violation> violations(JsonNode value, JsonNode field) {
        String type = Json.text(field.get("type"));
        if ("recordList".equals(type)) {
            return recordListViolations(value, field);
        }
        if ("semanticHtml".equals(type)) {
            return semanticHtmlViolations(value, field);
        }
        String verdict = scalarVerdict(value, field);
        if (verdict == null) {
            return List.of();
        }
        return List.of(Violation.of("null".equals(verdict) ? "NULL_NOT_ALLOWED" : "TYPE_MISMATCH", type));
    }

    public static boolean matchesFieldValue(JsonNode value, JsonNode field) {
        return violations(value, field).isEmpty();
    }

    private static boolean nullable(JsonNode field) {
        JsonNode nullable = field.get("nullable");
        return nullable == null || !(nullable.isBoolean() && !nullable.booleanValue());
    }

    private static List<Violation> recordListViolations(JsonNode value, JsonNode field) {
        if (value == null || value.isNull()) {
            return nullable(field) ? List.of() : List.of(Violation.of("NULL_NOT_ALLOWED", "recordList"));
        }
        if (!value.isArray()) {
            return List.of(Violation.of("TYPE_MISMATCH", "recordList"));
        }
        if (value.size() > MAX_DETAIL_RECORDS) {
            return List.of(Violation.tooLarge("DETAIL_LIST_TOO_LARGE", MAX_DETAIL_RECORDS, value.size()));
        }
        JsonNode itemFields = Json.get(Json.get(field, "items"), "fields");
        List<Violation> violations = new ArrayList<>();
        for (int itemIndex = 0; itemIndex < value.size(); itemIndex++) {
            JsonNode item = value.get(itemIndex);
            if (!Json.isRecord(item)) {
                violations.add(Violation.item("DETAIL_ITEM_NOT_OBJECT", itemIndex, null, null));
                continue;
            }
            for (String key : Json.keys(item)) {
                if (!itemFields.has(key)) {
                    violations.add(Violation.item("DETAIL_UNDECLARED_FIELD", itemIndex, key, null));
                }
            }
            for (Map.Entry<String, JsonNode> entry : Json.entries(itemFields)) {
                String itemFieldId = entry.getKey();
                if (!item.has(itemFieldId)) {
                    violations.add(Violation.item("DETAIL_MISSING_FIELD", itemIndex, itemFieldId, null));
                    continue;
                }
                String verdict = scalarVerdict(item.get(itemFieldId), entry.getValue());
                String itemType = Json.text(entry.getValue().get("type"));
                if ("null".equals(verdict)) {
                    violations.add(Violation.item("DETAIL_NULL_NOT_ALLOWED", itemIndex, itemFieldId, itemType));
                } else if ("type".equals(verdict)) {
                    violations.add(Violation.item("DETAIL_TYPE_MISMATCH", itemIndex, itemFieldId, itemType));
                }
            }
        }
        return violations;
    }

    private static List<Violation> semanticHtmlViolations(JsonNode value, JsonNode field) {
        if (value == null || value.isNull()) {
            return nullable(field) ? List.of() : List.of(Violation.of("NULL_NOT_ALLOWED", "semanticHtml"));
        }
        if (!value.isTextual()) {
            return List.of(Violation.of("TYPE_MISMATCH", "semanticHtml"));
        }
        int length = value.textValue().length();
        if (length > MAX_SEMANTIC_HTML_LENGTH) {
            return List.of(Violation.tooLarge("SEMANTIC_HTML_TOO_LARGE", MAX_SEMANTIC_HTML_LENGTH, length));
        }
        return List.of();
    }

    /** 返回 "null"（不允许为空）、"type"（类型不符）或 null（符合）。 */
    static String scalarVerdict(JsonNode value, JsonNode field) {
        if (value == null || value.isNull()) {
            return nullable(field) ? null : "null";
        }
        String type = Json.text(field.get("type"));
        if ("date".equals(type)) {
            return value.isTextual() && CalendarValues.isCalendarDate(value.textValue()) ? null : "type";
        }
        if ("datetime".equals(type)) {
            return value.isTextual() && DATETIME.matcher(value.textValue()).matches() ? null : "type";
        }
        if ("money".equals(type)) {
            return value.isNumber() ? null : "type";
        }
        boolean matches = switch (type == null ? "" : type) {
            case "string" -> value.isTextual();
            case "number" -> value.isNumber();
            case "boolean" -> value.isBoolean();
            default -> false;
        };
        return matches ? null : "type";
    }
}
