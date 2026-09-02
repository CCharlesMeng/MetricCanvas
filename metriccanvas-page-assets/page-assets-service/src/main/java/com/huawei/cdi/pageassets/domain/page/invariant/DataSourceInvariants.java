package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.DataSources;
import com.huawei.cdi.pageassets.domain.page.document.FieldContract;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 页面数据源层面的不变式：受控计算阶段、inline 行契约、查询字段映射与筛选绑定。 */
final class DataSourceInvariants {
    private DataSourceInvariants() {
    }

    static List<TypedError> inlineRowErrors(JsonNode dataSource, String sourcePath) {
        if (!DataSources.isInline(dataSource)) {
            return List.of();
        }
        return rowContractErrors(Json.get(dataSource.get("source"), "rows"), DataSources.inputFields(dataSource),
                sourcePath + "/source/rows");
    }

    static List<TypedError> rowContractErrors(JsonNode rows, JsonNode fields, String rowsPath) {
        List<TypedError> errors = new ArrayList<>();
        for (FieldContract.RowIssue issue : FieldContract.validateContractRows(rows, fields)) {
            errors.add(rowContractError(issue, rowsPath));
        }
        return errors;
    }

    private static TypedError rowContractError(FieldContract.RowIssue issue, String rowsPath) {
        switch (issue.code()) {
            case "ROWS_NOT_ARRAY":
                return TypedError.schema(rowsPath, "数据行必须是数组");
            case "ROW_NOT_OBJECT":
                return TypedError.schema(rowsPath + "/" + issue.rowIndex(), "数据行必须是对象");
            default:
                break;
        }
        String fieldId = issue.fieldId();
        String fieldPath = rowsPath + "/" + issue.rowIndex() + "/" + JsonPointer.escape(fieldId);
        FieldContract.Violation violation = issue.violation();
        switch (issue.code()) {
            case "UNDECLARED_FIELD":
                return TypedError.schema(fieldPath, "行包含未声明字段:" + fieldId);
            case "MISSING_FIELD":
                return TypedError.schema(fieldPath, "行缺少字段:" + fieldId);
            case "NULL_NOT_ALLOWED":
                return TypedError.schema(fieldPath, "字段 " + fieldId + " 声明 nullable=false,不允许为 null");
            case "TYPE_MISMATCH":
                return TypedError.schema(fieldPath, "字段 " + fieldId + " 的值不符合类型 " + violation.expectedType());
            case "DETAIL_LIST_TOO_LARGE":
                return TypedError.schema(fieldPath, "嵌套明细字段 " + fieldId + " 最多允许 " + violation.maximum()
                        + " 项，实际 " + violation.actualLength() + " 项");
            case "SEMANTIC_HTML_TOO_LARGE":
                return TypedError.schema(fieldPath, "语义 HTML 字段 " + fieldId + " 最多允许 " + violation.maximum()
                        + " 字符，实际 " + violation.actualLength() + " 字符");
            case "DETAIL_ITEM_NOT_OBJECT":
                return TypedError.schema(fieldPath + "/" + violation.itemIndex(),
                        "嵌套明细字段 " + fieldId + " 的第 " + (violation.itemIndex() + 1) + " 项必须是对象");
            default:
                break;
        }
        String itemPath = fieldPath + "/" + violation.itemIndex() + "/" + JsonPointer.escape(violation.itemFieldId());
        return switch (issue.code()) {
            case "DETAIL_UNDECLARED_FIELD" -> TypedError.schema(itemPath, "嵌套明细项包含未声明字段:" + violation.itemFieldId());
            case "DETAIL_MISSING_FIELD" -> TypedError.schema(itemPath, "嵌套明细项缺少字段:" + violation.itemFieldId());
            case "DETAIL_NULL_NOT_ALLOWED" -> TypedError.schema(itemPath,
                    "嵌套明细项字段 " + violation.itemFieldId() + " 声明 nullable=false,不允许为 null");
            default -> TypedError.schema(itemPath,
                    "嵌套明细项字段 " + violation.itemFieldId() + " 的值不符合类型 " + violation.expectedType());
        };
    }

    static List<TypedError> queryContractErrors(JsonNode dataSource, String sourcePath, Map<String, JsonNode> filtersById) {
        List<TypedError> errors = new ArrayList<>();
        JsonNode source = dataSource.get("source");
        JsonNode query = source.get("query");
        JsonNode item = query.at("/body/dsl_list/0");
        List<String> dimensions = DataSources.stringArray(item.get("output_dims"));
        List<String> metrics = DataSources.dqeMetricNames(item.get("output_metrics"));
        Set<String> outputs = new LinkedHashSet<>(dimensions);
        outputs.addAll(metrics);
        Map<String, String> mapped = new HashMap<>();

        JsonNode initial = source.get("initial");
        if (FilterInvariants.truthy(initial)) {
            if (!Rfc3339.parses(Json.text(initial.get("capturedAt")))) {
                errors.add(TypedError.schema(sourcePath + "/source/initial/capturedAt", "capturedAt 必须是有效的 RFC 3339 日期时间"));
            }
            errors.addAll(rowContractErrors(initial.get("rows"), DataSources.inputFields(dataSource),
                    sourcePath + "/source/initial/rows"));
        }

        Set<String> produced = DataSources.computeOutputFields(DataSources.compute(dataSource));
        for (Map.Entry<String, JsonNode> entry : Json.entries(DataSources.fields(dataSource))) {
            String fieldId = entry.getKey();
            JsonNode definition = entry.getValue();
            if (!DataSources.hasQueryFieldMapping(definition)) {
                if (!produced.contains(fieldId)) {
                    errors.add(TypedError.queryMapping(sourcePath + "/fields/" + JsonPointer.escape(fieldId),
                            "页面字段 " + fieldId + " 既没有 queryField 映射，也不是计算阶段产出字段"));
                }
                continue;
            }
            String queryField = DataSources.queryField(definition);
            String path = sourcePath + "/fields/" + JsonPointer.escape(fieldId) + "/queryField";
            String previous = mapped.get(queryField);
            if (previous != null) {
                errors.add(TypedError.queryMapping(path, "queryField " + queryField + " 已映射到页面字段 " + previous));
            } else {
                mapped.put(queryField, fieldId);
            }
            String role = DataSources.role(definition);
            if (!outputs.contains(queryField)) {
                errors.add(TypedError.queryMapping(path, "queryField " + queryField + " 不在 DQE 输出字段中"));
            } else if ("detail".equals(role)) {
                if ("recordList".equals(DataSources.type(definition))) {
                    Map<String, String> itemMappings = new HashMap<>();
                    for (Map.Entry<String, JsonNode> itemEntry : Json.entries(Json.get(definition.get("items"), "fields"))) {
                        String itemQueryField = DataSources.queryField(itemEntry.getValue());
                        String itemPath = sourcePath + "/fields/" + JsonPointer.escape(fieldId) + "/items/fields/"
                                + JsonPointer.escape(itemEntry.getKey()) + "/queryField";
                        String previousItem = itemMappings.get(itemQueryField);
                        if (previousItem != null) {
                            errors.add(TypedError.queryMapping(itemPath,
                                    "嵌套明细 queryField " + itemQueryField + " 已映射到页面字段 " + previousItem));
                        } else {
                            itemMappings.put(itemQueryField, itemEntry.getKey());
                        }
                    }
                }
            } else if (dimensions.contains(queryField) && !"dimension".equals(role)) {
                errors.add(TypedError.queryMapping(sourcePath + "/fields/" + JsonPointer.escape(fieldId) + "/role",
                        "DQE 维度 " + queryField + " 的 role 必须为 dimension"));
            } else if (metrics.contains(queryField) && !"measure".equals(role)) {
                errors.add(TypedError.queryMapping(sourcePath + "/fields/" + JsonPointer.escape(fieldId) + "/role",
                        "DQE 度量 " + queryField + " 的 role 必须为 measure"));
            }
        }

        for (String output : outputs) {
            if (!mapped.containsKey(output)) {
                errors.add(TypedError.queryMapping(sourcePath + "/fields", "DQE 输出字段 " + output + " 缺少显式 queryField 映射"));
            }
        }

        JsonNode filterBindings = Json.record(query.get("filterBindings"));
        for (Map.Entry<String, JsonNode> entry : Json.entries(filterBindings)) {
            String filterId = entry.getKey();
            JsonNode filter = filtersById.get(filterId);
            String target = Json.text(Json.get(entry.getValue(), "target"));
            String path = sourcePath + "/source/query/filterBindings/" + JsonPointer.escape(filterId);
            if (filter == null) {
                errors.add(TypedError.filterBinding(path, "筛选绑定引用了未知筛选器:" + filterId));
            } else if ("time".equals(target) && !"timeRange".equals(Json.text(filter.get("type")))) {
                errors.add(TypedError.filterBinding(path, "time 目标必须绑定 timeRange 筛选器:" + filterId));
            } else if ("dimension".equals(target) && !"dimension".equals(Json.text(filter.get("type")))) {
                errors.add(TypedError.filterBinding(path, "dimension 目标必须绑定维度筛选器:" + filterId));
            }
        }
        return errors;
    }

    /**
     * 受控计算阶段的判定（ADR-0046）：算子输入字段存在且角色相容、产出字段已在结果字段契约中
     * 声明且不来自外部响应、折叠类算子的可折叠声明齐全、产出字段之间不重名。
     */
    static List<TypedError> computeErrors(JsonNode dataSource, String sourcePath) {
        JsonNode operators = DataSources.compute(dataSource);
        if (operators.isEmpty()) {
            return List.of();
        }
        List<TypedError> errors = new ArrayList<>();
        JsonNode fields = DataSources.fields(dataSource);
        Set<String> produced = new HashSet<>();
        Set<String> rowKindFields = new LinkedHashSet<>();

        class Checks {
            JsonNode declared(String fieldId, String path, String expectedRole) {
                JsonNode field = fields.get(fieldId);
                if (field == null) {
                    errors.add(TypedError.schema(path, "算子引用了未声明的字段:" + fieldId));
                    return null;
                }
                if (expectedRole != null && !expectedRole.equals(DataSources.role(field))) {
                    errors.add(TypedError.schema(path,
                            "字段 " + fieldId + " 的 role 为 " + DataSources.role(field) + "，此处要求 " + expectedRole));
                }
                return field;
            }

            void numericInput(String fieldId, String path) {
                JsonNode field = declared(fieldId, path, "measure");
                String type = field == null ? null : DataSources.type(field);
                if (field != null && !"number".equals(type) && !"money".equals(type)) {
                    errors.add(TypedError.schema(path, "字段 " + fieldId + " 的类型 " + type + " 不能参与数值算子"));
                }
            }

            void output(String fieldId, String path, String expectedRole) {
                if (produced.contains(fieldId)) {
                    errors.add(TypedError.schema(path, "算子产出字段重复:" + fieldId));
                }
                produced.add(fieldId);
                JsonNode field = declared(fieldId, path, expectedRole);
                if (field != null && field.has("queryField")) {
                    errors.add(TypedError.schema(path, "算子产出字段 " + fieldId + " 不来自外部响应，不得声明 queryField"));
                }
            }

            void collapsibleMeasures(JsonNode measures, String path) {
                for (int index = 0; index < measures.size(); index++) {
                    String fieldId = measures.get(index).textValue();
                    String measurePath = path + "/" + index;
                    JsonNode field = declared(fieldId, measurePath, "measure");
                    if (field != null && "measure".equals(DataSources.role(field))
                            && !(Json.isBoolean(field.get("collapsible")) && field.get("collapsible").booleanValue())) {
                        errors.add(TypedError.schema(measurePath, "折叠算子只能作用于显式声明 collapsible 的度量字段:" + fieldId));
                    }
                }
            }

            void rowKind(JsonNode mark, String path) {
                String fieldId = Json.text(mark.get("field"));
                rowKindFields.add(fieldId);
                JsonNode field = declared(fieldId, path + "/field", "dimension");
                if (field != null && !"string".equals(DataSources.type(field))) {
                    errors.add(TypedError.schema(path + "/field", "行类别字段 " + fieldId + " 必须是 string 类型"));
                }
                if (field != null && Json.isBoolean(field.get("nullable")) && !field.get("nullable").booleanValue()) {
                    errors.add(TypedError.schema(path + "/field", "行类别字段 " + fieldId + " 在明细行上没有取值，必须允许为空"));
                }
            }
        }
        Checks checks = new Checks();

        for (int index = 0; index < operators.size(); index++) {
            JsonNode operator = operators.get(index);
            String path = sourcePath + "/compute/" + index;
            switch (Json.text(operator.get("op"))) {
                case "ratio" -> {
                    checks.numericInput(Json.text(operator.get("numerator")), path + "/numerator");
                    checks.numericInput(Json.text(operator.get("denominator")), path + "/denominator");
                    checks.output(Json.text(operator.get("output")), path + "/output", "measure");
                }
                case "delta" -> {
                    checks.numericInput(Json.text(operator.get("minuend")), path + "/minuend");
                    checks.numericInput(Json.text(operator.get("subtrahend")), path + "/subtrahend");
                    checks.output(Json.text(operator.get("output")), path + "/output", "measure");
                }
                case "groupSubtotal" -> {
                    checks.declared(Json.text(operator.get("groupBy")), path + "/groupBy", "dimension");
                    checks.collapsibleMeasures(operator.get("measures"), path + "/measures");
                    checks.rowKind(operator.get("rowKind"), path + "/rowKind");
                }
                case "grandTotal" -> {
                    checks.collapsibleMeasures(operator.get("measures"), path + "/measures");
                    checks.rowKind(operator.get("rowKind"), path + "/rowKind");
                    checks.declared(Json.text(Json.get(operator.get("label"), "field")), path + "/label/field", "dimension");
                }
                case "pivot" -> {
                    checks.declared(Json.text(operator.get("categoryField")), path + "/categoryField", "dimension");
                    checks.declared(Json.text(operator.get("valueField")), path + "/valueField", "measure");
                    JsonNode keyFields = operator.get("keyFields");
                    if (Json.isArray(keyFields)) {
                        for (int keyIndex = 0; keyIndex < keyFields.size(); keyIndex++) {
                            checks.declared(keyFields.get(keyIndex).textValue(), path + "/keyFields/" + keyIndex, "dimension");
                        }
                    }
                    Set<String> categories = new HashSet<>();
                    JsonNode columns = operator.get("columns");
                    for (int columnIndex = 0; columnIndex < columns.size(); columnIndex++) {
                        JsonNode column = columns.get(columnIndex);
                        String columnPath = path + "/columns/" + columnIndex;
                        checks.output(Json.text(column.get("output")), columnPath + "/output", "measure");
                        JsonNode values = column.get("categories");
                        for (int categoryIndex = 0; categoryIndex < values.size(); categoryIndex++) {
                            String category = values.get(categoryIndex).textValue();
                            if (categories.contains(category)) {
                                errors.add(TypedError.schema(columnPath + "/categories/" + categoryIndex,
                                        "类别取值已映射到其它目标列:" + category));
                            }
                            categories.add(category);
                        }
                    }
                }
                default -> {
                }
            }
        }

        // 行类别字段由多个折叠算子共同写入，不算重复产出；这里补回它的产出身份。
        produced.addAll(rowKindFields);

        JsonNode rows = null;
        String rowsPath = null;
        JsonNode source = dataSource.get("source");
        if (DataSources.isInline(dataSource)) {
            rows = source.get("rows");
            rowsPath = sourcePath + "/source/rows";
        } else if (FilterInvariants.truthy(source.get("initial"))) {
            rows = source.get("initial").get("rows");
            rowsPath = sourcePath + "/source/initial/rows";
        }
        if (rows != null) {
            for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                for (String fieldId : Json.keys(rows.get(rowIndex))) {
                    if (!produced.contains(fieldId)) {
                        continue;
                    }
                    errors.add(TypedError.schema(rowsPath + "/" + rowIndex + "/" + JsonPointer.escape(fieldId),
                            "算子产出字段 " + fieldId + " 不得出现在数据行中，它由计算阶段产出"));
                }
            }
        }
        return errors;
    }
}
