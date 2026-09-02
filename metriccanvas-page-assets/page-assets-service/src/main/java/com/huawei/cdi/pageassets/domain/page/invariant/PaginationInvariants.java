package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.document.DataSources;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 表格分页模式与页面数据源引用关系的不变式。 */
final class PaginationInvariants {
    private PaginationInvariants() {
    }

    static List<TypedError> errors(JsonNode page) {
        List<TypedError> errors = new ArrayList<>();
        Map<String, List<String>> references = new HashMap<>();
        List<String[]> queryTables = new ArrayList<>();
        JsonNode dataSources = page.get("dataSources");

        ComponentWalk.walkDocument(page, (component, componentPath) -> {
            for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(component.get("data")))) {
                references.computeIfAbsent(entry.getValue().asText(), key -> new ArrayList<>())
                        .add(componentPath + "/data/" + JsonPointer.escape(entry.getKey()));
            }
            String type = Json.text(component.get("type"));
            JsonNode props = component.get("props");
            if ("aiSummary".equals(type)) {
                for (Map.Entry<String, JsonNode> entry : Json.entries(props.get("relatedData"))) {
                    references.computeIfAbsent(Json.text(entry.getValue().get("source")), key -> new ArrayList<>())
                            .add(componentPath + "/props/relatedData/" + JsonPointer.escape(entry.getKey()) + "/source");
                }
            }
            if (!"table".equals(type)) {
                return;
            }
            JsonNode pagination = props.get("pagination");
            String mode = Json.text(Json.get(pagination, "mode"));
            String sourceId = Json.text(Json.get(component.get("data"), "main"));
            JsonNode source = sourceId == null ? null : dataSources.get(sourceId);
            String sourceType = source == null ? null : DataSources.sourceType(source);
            if ("local".equals(mode) && !"inline".equals(sourceType)) {
                errors.add(TypedError.schema(componentPath + "/props/pagination/mode",
                        "pagination.mode='local' 只允许绑定 inline 数据源:" + sourceId));
            }
            if (!"query".equals(mode)) {
                return;
            }
            if (!"query".equals(sourceType)) {
                errors.add(TypedError.schema(componentPath + "/props/pagination/mode",
                        "pagination.mode='query' 只允许绑定 query 数据源:" + sourceId));
                return;
            }
            queryTables.add(new String[] {sourceId, componentPath});
            JsonNode item = source.at("/source/query/body/dsl_list/0");
            JsonNode order = Json.record(item.get("order"));
            JsonNode offset = Json.get(order, "offset");
            String dslPath = "/dataSources/" + JsonPointer.escape(sourceId) + "/source/query/body/dsl_list/0/order";
            if (order == null || offset == null || !Json.isNumber(offset) || offset.decimalValue().signum() != 0) {
                errors.add(TypedError.schema(dslPath + "/offset", "查询分页要求 DQE order.offset 为 0"));
            }
            JsonNode limit = Json.get(order, "limit");
            boolean validLimit = limit != null && Json.isInteger(limit) && limit.decimalValue().signum() > 0;
            if (order == null || !validLimit) {
                errors.add(TypedError.schema(dslPath + "/limit", "查询分页要求 DQE order.limit 为正整数"));
            }
            JsonNode initial = Json.get(source.get("source"), "initial");
            if (FilterInvariants.truthy(initial)) {
                JsonNode totalCount = initial.get("totalCount");
                String initialPath = "/dataSources/" + JsonPointer.escape(sourceId) + "/source/initial";
                if (totalCount == null) {
                    errors.add(TypedError.schema(initialPath + "/totalCount", "查询分页的内嵌初始行必须声明 totalCount"));
                } else if (order != null && limit != null && Json.isInteger(limit)) {
                    BigDecimal expected = limit.decimalValue().min(totalCount.decimalValue());
                    if (BigDecimal.valueOf(initial.get("rows").size()).compareTo(expected) != 0) {
                        errors.add(TypedError.schema(initialPath + "/rows", "查询分页的内嵌初始行必须是完整第一页"));
                    }
                }
            }
            rejectQueryTableViewColumns(props.get("columns"), componentPath + "/props/columns", errors);
        });

        for (String[] table : queryTables) {
            List<String> usages = references.getOrDefault(table[0], List.of());
            if (usages.size() != 1) {
                errors.add(TypedError.schema(table[1] + "/data/main",
                        "查询分页表格必须独占页面数据源 " + table[0] + "，当前引用 " + usages.size() + " 次"));
            }
        }
        return errors;
    }

    private static void rejectQueryTableViewColumns(JsonNode columns, String basePath, List<TypedError> errors) {
        for (int index = 0; index < columns.size(); index++) {
            JsonNode column = columns.get(index);
            String path = basePath + "/" + index;
            if (ComponentInvariants.isGroup(column)) {
                rejectQueryTableViewColumns(column.get("children"), path + "/children", errors);
                continue;
            }
            if (FilterInvariants.truthy(column.get("sortable"))) {
                errors.add(TypedError.schema(path + "/sortable", "查询分页暂不支持排序"));
            }
            if (FilterInvariants.truthy(column.get("filterable"))) {
                errors.add(TypedError.schema(path + "/filterable", "查询分页暂不支持表头筛选"));
            }
        }
    }
}
