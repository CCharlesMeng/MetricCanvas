package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.CalendarValues;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 筛选器声明自身与级联关系的不变式。 */
final class FilterInvariants {
    private FilterInvariants() {
    }

    static List<TypedError> declarationErrors(JsonNode filter, String path) {
        List<TypedError> errors = new ArrayList<>();
        String type = Json.text(filter.get("type"));
        JsonNode defaultValue = filter.get("default");
        if ("timeRange".equals(type)) {
            if (defaultValue != null && !defaultValue.isTextual()) {
                if (CalendarValues.isTimeRangeValue(defaultValue)) {
                    String precision = Json.text(filter.get("precision"));
                    for (CalendarValues.RangeIssue issue : CalendarValues.validateCalendarTimeRange(
                            defaultValue.get("from"), defaultValue.get("to"), precision == null ? "date" : precision)) {
                        errors.add(TypedError.schema(
                                path + "/default" + (issue.field() == null ? "" : "/" + issue.field()), issue.message()));
                    }
                } else if (CalendarValues.isRelativeTimeExpression(defaultValue) && truthy(defaultValue.get("anchor"))) {
                    String issue = CalendarValues.validateTimePointValue(defaultValue.get("anchor"), "date");
                    if (issue != null) {
                        errors.add(TypedError.schema(path + "/default/anchor", issue));
                    }
                }
            }
        } else if ("timePoint".equals(type) && defaultValue != null) {
            String issue = CalendarValues.validateTimePointValue(defaultValue, Json.text(filter.get("granularity")));
            if (issue != null) {
                errors.add(TypedError.schema(path + "/default", issue));
            }
        } else if ("numberRange".equals(type) && truthy(defaultValue)) {
            JsonNode from = defaultValue.get("from");
            JsonNode to = defaultValue.get("to");
            if (from == null && to == null) {
                errors.add(TypedError.schema(path + "/default", "数值区间至少要有一端"));
            } else if (from != null && to != null && from.decimalValue().compareTo(to.decimalValue()) > 0) {
                errors.add(TypedError.schema(path + "/default", "数值区间 from 不得大于 to"));
            }
        } else if ("dimension".equals(type)) {
            JsonNode hierarchy = filter.get("hierarchy");
            int levels = Json.isArray(hierarchy) ? hierarchy.size() : 0;
            Set<String> levelIds = new HashSet<>();
            for (int levelIndex = 0; levelIndex < levels; levelIndex++) {
                String levelId = Json.text(Json.get(hierarchy.get(levelIndex), "id"));
                if (levelIds.contains(levelId)) {
                    errors.add(TypedError.schema(path + "/hierarchy/" + levelIndex + "/id", "层级 id 重复:" + levelId));
                }
                levelIds.add(levelId);
            }
            JsonNode defaultLevel = filter.get("defaultLevel");
            if (truthy(defaultLevel)) {
                if (levels == 0) {
                    errors.add(TypedError.schema(path + "/defaultLevel", "defaultLevel 只能用于声明了 hierarchy 的维度筛选器"));
                } else if (!levelIds.contains(defaultLevel.asText())) {
                    errors.add(TypedError.schema(path + "/defaultLevel", "defaultLevel 引用了未知层级:" + defaultLevel.asText()));
                }
            }
            if (truthy(filter.get("hierarchyPicker")) && levels == 0) {
                errors.add(TypedError.schema(path + "/hierarchyPicker", "hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器"));
            }
        }
        return errors;
    }

    static List<TypedError> dependsOnErrors(List<JsonNode> filters, Map<String, JsonNode> byId) {
        List<TypedError> errors = new ArrayList<>();
        for (int index = 0; index < filters.size(); index++) {
            JsonNode filter = filters.get(index);
            JsonNode dependsOn = filter.get("dependsOn");
            if (!"dimension".equals(Json.text(filter.get("type"))) || !truthy(dependsOn)) {
                continue;
            }
            String path = "/filters/" + index + "/dependsOn";
            String upstreamId = dependsOn.asText();
            String id = Json.text(filter.get("id"));
            if (upstreamId.equals(id)) {
                errors.add(TypedError.schema(path, "筛选器不能依赖自己"));
                continue;
            }
            JsonNode upstream = byId.get(upstreamId);
            if (upstream == null) {
                errors.add(TypedError.schema(path, "dependsOn 引用了未声明的筛选器:" + upstreamId));
                continue;
            }
            if (!"dimension".equals(Json.text(upstream.get("type")))) {
                errors.add(TypedError.schema(path, "级联上游必须是 dimension 筛选器:" + upstreamId));
                continue;
            }
            if (hasDependsOnCycle(id, byId)) {
                errors.add(TypedError.schema(path, "筛选器级联存在循环:" + id));
            }
        }
        return errors;
    }

    private static boolean hasDependsOnCycle(String startId, Map<String, JsonNode> byId) {
        Set<String> seen = new HashSet<>();
        String current = startId;
        while (truthyString(current)) {
            if (seen.contains(current)) {
                return true;
            }
            seen.add(current);
            JsonNode filter = byId.get(current);
            current = filter != null && "dimension".equals(Json.text(filter.get("type")))
                    ? Json.text(filter.get("dependsOn")) : null;
        }
        return false;
    }

    /** 隐藏层级切换器时，必须有地图承担下钻；否则用户没有任何切层入口。 */
    static List<TypedError> hiddenHierarchyPickerErrors(JsonNode page, List<JsonNode> filters) {
        Set<String> mapFilters = new HashSet<>();
        ComponentWalk.walkDocument(page, (component, path) -> {
            if ("mapChart".equals(Json.text(component.get("type")))) {
                JsonNode hierarchyFilter = Json.get(component.get("props"), "hierarchyFilter");
                if (truthy(hierarchyFilter)) {
                    mapFilters.add(hierarchyFilter.asText());
                }
            }
        });
        List<TypedError> errors = new ArrayList<>();
        for (int index = 0; index < filters.size(); index++) {
            JsonNode filter = filters.get(index);
            String id = Json.text(filter.get("id"));
            if ("dimension".equals(Json.text(filter.get("type")))
                    && "hidden".equals(Json.text(filter.get("hierarchyPicker")))
                    && !mapFilters.contains(id)) {
                errors.add(TypedError.schema("/filters/" + index + "/hierarchyPicker",
                        "隐藏层级切换器要求同页地图通过 hierarchyFilter 承担下钻:" + id));
            }
        }
        return errors;
    }

    /** JS 真值：null / undefined / "" / 0 / false 为假。 */
    static boolean truthy(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return false;
        }
        if (node.isBoolean()) {
            return node.booleanValue();
        }
        if (node.isNumber()) {
            return node.decimalValue().signum() != 0;
        }
        if (node.isTextual()) {
            return !node.textValue().isEmpty();
        }
        return true;
    }

    static boolean truthyString(String value) {
        return value != null && !value.isEmpty();
    }
}
