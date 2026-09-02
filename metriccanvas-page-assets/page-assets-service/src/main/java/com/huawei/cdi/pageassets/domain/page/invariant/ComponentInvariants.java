package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.document.DataSources;
import com.huawei.cdi.pageassets.domain.page.document.FieldContract;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 组件层面的不变式：数据槽、字段绑定、各组件专有规则与动作。 */
final class ComponentInvariants {
    private ComponentInvariants() {
    }

    /** 字段绑定解析结果：命中字段，或一条可读错误。 */
    record Resolved(JsonNode field, String fieldName, String error) {
        boolean failed() {
            return error != null;
        }
    }

    static Resolved resolveBinding(JsonNode page, JsonNode component, JsonNode binding) {
        String slot = binding.isTextual() ? "main" : Json.text(binding.get("data"));
        String fieldName = DataSources.fieldName(binding);
        JsonNode sourceIdNode = Json.get(Json.record(component.get("data")), slot);
        if (sourceIdNode == null) {
            return new Resolved(null, fieldName, "字段绑定引用了组件未声明的数据槽:" + slot);
        }
        String sourceId = sourceIdNode.asText();
        JsonNode source = Json.get(page.get("dataSources"), sourceId);
        if (source == null) {
            return new Resolved(null, fieldName, "字段绑定的数据槽 " + slot + " 指向未知数据源:" + sourceId);
        }
        JsonNode field = DataSources.resolveFields(source).get(fieldName);
        if (field == null) {
            return new Resolved(null, fieldName, "字段 " + fieldName + " 不在数据槽 " + slot + " 的数据源 " + sourceId + " 中");
        }
        return new Resolved(field, fieldName, null);
    }

    /** 基线里的 `check` 闭包：解析绑定、校验角色与 detail 类型、校验 match。 */
    static final class BindingCheck {
        private final JsonNode page;
        private final JsonNode component;
        private final List<TypedError> errors;

        BindingCheck(JsonNode page, JsonNode component, List<TypedError> errors) {
            this.page = page;
            this.component = component;
            this.errors = errors;
        }

        void check(JsonNode binding, String path) {
            check(binding, path, null, null);
        }

        void check(JsonNode binding, String path, String expectedRole) {
            check(binding, path, expectedRole, null);
        }

        void check(JsonNode binding, String path, String expectedRole, String allowedDetailType) {
            Resolved resolved = resolveBinding(page, component, binding);
            if (resolved.failed()) {
                errors.add(TypedError.schema(path, resolved.error()));
                return;
            }
            String role = DataSources.role(resolved.field());
            String type = DataSources.type(resolved.field());
            if (expectedRole != null && !expectedRole.equals(role)) {
                errors.add(TypedError.schema(path,
                        "字段 " + resolved.fieldName() + " 的 role 为 " + role + "，此处要求 " + expectedRole));
            } else if (expectedRole == null && "detail".equals(role) && !java.util.Objects.equals(type, allowedDetailType)) {
                errors.add(TypedError.schema(path, allowedDetailType == null
                        ? "嵌套明细字段 " + resolved.fieldName() + " 只能由显式支持 detail 的组件属性消费"
                        : "此组件属性只支持 " + allowedDetailType + " 类型的 detail 字段:" + resolved.fieldName()));
            }
            JsonNode match = binding.isTextual() ? null : binding.get("match");
            if (match != null) {
                String matchPath = path + "/match";
                var matchBinding = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
                matchBinding.set("data", binding.get("data"));
                matchBinding.set("field", match.get("field"));
                Resolved matched = resolveBinding(page, component, matchBinding);
                if (matched.failed()) {
                    errors.add(TypedError.schema(matchPath + "/field", matched.error()));
                } else {
                    if (!"dimension".equals(DataSources.role(matched.field()))) {
                        errors.add(TypedError.schema(matchPath + "/field",
                                "行匹配字段 " + matched.fieldName() + " 的 role 必须为 dimension"));
                    }
                    if (!FieldContract.matchesFieldValue(match.get("equals"), matched.field())) {
                        errors.add(TypedError.schema(matchPath + "/equals", "匹配值不符合字段 " + matched.fieldName()
                                + " 的类型 " + DataSources.type(matched.field())));
                    }
                }
            }
        }
    }

    static List<TypedError> componentErrors(JsonNode page, JsonNode component, String componentPath,
                                            Set<String> filterIds, Map<String, JsonNode> filtersById) {
        List<TypedError> errors = new ArrayList<>();
        JsonNode dataSources = page.get("dataSources");
        for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(component.get("data")))) {
            String sourceId = entry.getValue().asText();
            if (!dataSources.has(sourceId)) {
                errors.add(TypedError.schema(componentPath + "/data/" + JsonPointer.escape(entry.getKey()),
                        "数据槽 " + entry.getKey() + " 引用了未知数据源:" + sourceId));
            }
        }
        BindingCheck check = new BindingCheck(page, component, errors);
        JsonNode props = component.get("props");
        String type = Json.text(component.get("type"));
        switch (type == null ? "" : type) {
            case "reportHeader", "text", "compositeCard" -> {
            }
            case "aiSummary" -> aiSummaryErrors(page, props, componentPath, errors);
            case "metricCard" -> {
                boolean hasNavigate = hasNavigateAction(props.get("actions"));
                for (String rowsKey : List.of("rows", "secondaryRows")) {
                    JsonNode rows = props.get(rowsKey);
                    if (!Json.isArray(rows)) {
                        continue;
                    }
                    for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                        JsonNode link = rows.get(rowIndex).get("link");
                        if (link != null && link.isBoolean() && link.booleanValue() && !hasNavigate) {
                            errors.add(TypedError.schema(componentPath + "/props/" + rowsKey + "/" + rowIndex + "/link",
                                    "指标值链接必须至少声明一个 navigate 动作"));
                        }
                    }
                }
                JsonNode rows = props.get("rows");
                for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                    JsonNode row = rows.get(rowIndex);
                    check.check(row.get("valueField"), componentPath + "/props/rows/" + rowIndex + "/valueField", "measure");
                    JsonNode changes = row.get("changes");
                    if (Json.isArray(changes)) {
                        for (int changeIndex = 0; changeIndex < changes.size(); changeIndex++) {
                            check.check(changes.get(changeIndex).get("field"),
                                    componentPath + "/props/rows/" + rowIndex + "/changes/" + changeIndex + "/field", "measure");
                        }
                    }
                }
                if (FilterInvariants.truthy(props.get("progress"))) {
                    check.check(props.get("progress").get("valueField"), componentPath + "/props/progress/valueField", "measure");
                }
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "barChart" -> {
                check.check(props.get("categoryField"), componentPath + "/props/categoryField", "dimension");
                JsonNode series = props.get("series");
                for (int index = 0; index < series.size(); index++) {
                    check.check(series.get(index).get("field"), componentPath + "/props/series/" + index + "/field", "measure");
                }
                String sourceId = Json.text(Json.get(component.get("data"), "main"));
                JsonNode source = sourceId == null ? null : dataSources.get(sourceId);
                JsonNode initial = source == null ? null : Json.get(source.get("source"), "initial");
                if (source != null && DataSources.isQuery(source) && FilterInvariants.truthy(initial)) {
                    for (BarForecastBoundary.Issue issue : BarForecastBoundary.issues(props, initial.get("rows"),
                            Json.text(initial.get("capturedAt")))) {
                        errors.add(TypedError.schema("/dataSources/" + JsonPointer.escape(sourceId) + "/source/initial/rows/"
                                + issue.rowIndex() + "/" + JsonPointer.escape(issue.field()), issue.message()));
                    }
                }
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "lineChart" -> {
                check.check(props.get("xField"), componentPath + "/props/xField", "dimension");
                JsonNode series = props.get("series");
                for (int index = 0; index < series.size(); index++) {
                    check.check(series.get(index).get("field"), componentPath + "/props/series/" + index + "/field", "measure");
                }
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "pieChart" -> {
                check.check(props.get("categoryField"), componentPath + "/props/categoryField", "dimension");
                check.check(props.get("valueField"), componentPath + "/props/valueField", "measure");
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "table" -> {
                errors.addAll(tableDataErrors(page, component, componentPath));
                errors.addAll(tablePresentationErrors(page, component, componentPath));
                errors.addAll(tableErrors(props.get("columns"), componentPath, check, filtersById));
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "keyValuePanel" -> {
                JsonNode items = props.get("items");
                for (int index = 0; index < items.size(); index++) {
                    check.check(items.get(index).get("field"), componentPath + "/props/items/" + index + "/field");
                }
            }
            case "categoryBreakdown" -> {
                check.check(props.get("categoryField"), componentPath + "/props/categoryField", "dimension");
                JsonNode columns = props.get("columns");
                for (int index = 0; index < columns.size(); index++) {
                    check.check(columns.get(index).get("field"), componentPath + "/props/columns/" + index + "/field", "measure");
                }
                errors.addAll(categorySwatchErrors(page, component, componentPath));
            }
            case "fieldText" -> check.check(props.get("field"), componentPath + "/props/field", null, "semanticHtml");
            case "mapChart" -> {
                check.check(props.get("nameField"), componentPath + "/props/nameField", "dimension");
                check.check(props.get("valueField"), componentPath + "/props/valueField", "measure");
                JsonNode tooltipFields = props.get("tooltipFields");
                if (Json.isArray(tooltipFields)) {
                    for (int index = 0; index < tooltipFields.size(); index++) {
                        check.check(tooltipFields.get(index).get("field"),
                                componentPath + "/props/tooltipFields/" + index + "/field");
                    }
                }
                JsonNode pinned = props.get("pinnedSummary");
                if (FilterInvariants.truthy(pinned)) {
                    check.check(pinned.get("matchField"), componentPath + "/props/pinnedSummary/matchField", "dimension");
                    check.check(pinned.get("titleField"), componentPath + "/props/pinnedSummary/titleField", "dimension");
                    JsonNode fields = pinned.get("fields");
                    for (int index = 0; index < fields.size(); index++) {
                        check.check(fields.get(index).get("field"),
                                componentPath + "/props/pinnedSummary/fields/" + index + "/field");
                    }
                }
                errors.addAll(mapPinnedSummaryErrors(page, component, componentPath));
                errors.addAll(mapLegendErrors(component, componentPath));
                errors.addAll(mapHierarchyErrors(page, component, componentPath, check));
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "gauge" -> {
                check.check(props.get("valueField"), componentPath + "/props/valueField", "measure");
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "tabContainer" -> {
                Set<String> tabIds = new HashSet<>();
                JsonNode tabs = props.get("tabs");
                for (int tabIndex = 0; tabIndex < tabs.size(); tabIndex++) {
                    String tabId = Json.text(tabs.get(tabIndex).get("id"));
                    if (tabIds.contains(tabId)) {
                        errors.add(TypedError.schema(componentPath + "/props/tabs/" + tabIndex + "/id", "Tab id 重复:" + tabId));
                    }
                    tabIds.add(tabId);
                }
                JsonNode defaultTab = props.get("defaultTab");
                if (defaultTab != null && !tabIds.contains(defaultTab.asText())) {
                    errors.add(TypedError.schema(componentPath + "/props/defaultTab",
                            "defaultTab 不是已声明的 Tab:" + defaultTab.asText()));
                }
            }
            case "rankingCard" -> {
                check.check(props.get("nameField"), componentPath + "/props/nameField", "dimension");
                check.check(props.get("valueField"), componentPath + "/props/valueField", "measure");
                if (FilterInvariants.truthy(props.get("changeField"))) {
                    check.check(props.get("changeField"), componentPath + "/props/changeField", "measure");
                }
                errors.addAll(actionErrors(props.get("actions"), componentPath, page, component, filterIds, check));
            }
            case "rankingDetailCard" -> rankingDetailCardErrors(page, component, props, componentPath, check, errors);
            default -> {
            }
        }
        return errors;
    }

    private static void aiSummaryErrors(JsonNode page, JsonNode props, String componentPath, List<TypedError> errors) {
        Map<String, String> terms = new HashMap<>();
        for (Map.Entry<String, JsonNode> entry : Json.entries(props.get("relatedData"))) {
            String relatedId = entry.getKey();
            JsonNode related = entry.getValue();
            String relatedPath = componentPath + "/props/relatedData/" + JsonPointer.escape(relatedId);
            String sourceId = Json.text(related.get("source"));
            JsonNode source = Json.get(page.get("dataSources"), sourceId);
            if (source == null) {
                errors.add(TypedError.schema(relatedPath + "/source", "关联数据引用了未知数据源:" + sourceId));
                continue;
            }
            JsonNode fields = DataSources.resolveFields(source);
            Set<String> seen = new HashSet<>();
            JsonNode bindings = related.get("fields");
            for (int fieldIndex = 0; fieldIndex < bindings.size(); fieldIndex++) {
                JsonNode binding = bindings.get(fieldIndex);
                String fieldPath = relatedPath + "/fields/" + fieldIndex;
                String fieldId = Json.text(binding.get("field"));
                String term = Json.text(binding.get("term"));
                if (!fields.has(fieldId)) {
                    errors.add(TypedError.schema(fieldPath + "/field", "关联字段 " + fieldId + " 不在数据源 " + sourceId + " 中"));
                } else if ("detail".equals(DataSources.role(fields.get(fieldId)))) {
                    errors.add(TypedError.schema(fieldPath + "/field", "AI 总结暂不支持嵌套明细字段:" + fieldId));
                }
                if (seen.contains(fieldId)) {
                    errors.add(TypedError.schema(fieldPath + "/field", "关联字段重复:" + fieldId));
                }
                seen.add(fieldId);
                String previous = terms.get(fieldId);
                if (previous != null && !previous.equals(term)) {
                    errors.add(TypedError.schema(fieldPath + "/term", "关联字段 " + fieldId + " 的术语映射冲突:" + previous + "/" + term));
                } else {
                    terms.put(fieldId, term);
                }
            }
        }
    }

    private static void rankingDetailCardErrors(JsonNode page, JsonNode component, JsonNode props, String componentPath,
                                                BindingCheck check, List<TypedError> errors) {
        check.check(props.get("nameField"), componentPath + "/props/nameField", "dimension");
        check.check(props.get("valueField"), componentPath + "/props/valueField", "measure");
        if (FilterInvariants.truthy(props.get("changeField"))) {
            check.check(props.get("changeField"), componentPath + "/props/changeField", "measure");
        }
        JsonNode badgeFields = props.get("badgeFields");
        if (Json.isArray(badgeFields)) {
            for (int index = 0; index < badgeFields.size(); index++) {
                check.check(badgeFields.get(index), componentPath + "/props/badgeFields/" + index, "dimension");
            }
        }
        if (FilterInvariants.truthy(props.get("descriptionField"))) {
            check.check(props.get("descriptionField"), componentPath + "/props/descriptionField", "dimension");
        }
        JsonNode semantic = props.get("semanticDescriptionField");
        if (FilterInvariants.truthy(semantic)) {
            String path = componentPath + "/props/semanticDescriptionField";
            check.check(semantic, path, "detail");
            Resolved resolved = resolveBinding(page, component, semantic);
            if (!resolved.failed() && !"semanticHtml".equals(DataSources.type(resolved.field()))) {
                errors.add(TypedError.schema(path, "语义 HTML 说明必须绑定 semanticHtml 字段:" + resolved.fieldName()));
            }
        }
        JsonNode details = props.get("details");
        if (!FilterInvariants.truthy(details)) {
            return;
        }
        String detailsPath = componentPath + "/props/details";
        check.check(details.get("field"), detailsPath + "/field", "detail");
        Resolved resolved = resolveBinding(page, component, details.get("field"));
        if (resolved.failed()) {
            return;
        }
        if (!"recordList".equals(DataSources.type(resolved.field()))) {
            errors.add(TypedError.schema(detailsPath + "/field", "结构化明细必须绑定 recordList 字段:" + resolved.fieldName()));
            return;
        }
        JsonNode itemFields = Json.get(resolved.field().get("items"), "fields");
        String detailFieldName = resolved.fieldName();
        checkDetailItemField(itemFields, detailFieldName, Json.text(details.get("titleField")),
                detailsPath + "/titleField", "dimension", errors);
        if (FilterInvariants.truthy(details.get("valueField"))) {
            checkDetailItemField(itemFields, detailFieldName, Json.text(details.get("valueField").get("field")),
                    detailsPath + "/valueField/field", "measure", errors);
        }
        if (FilterInvariants.truthy(details.get("descriptionField"))) {
            checkDetailItemField(itemFields, detailFieldName, Json.text(details.get("descriptionField")),
                    detailsPath + "/descriptionField", "dimension", errors);
        }
    }

    private static void checkDetailItemField(JsonNode itemFields, String detailFieldName, String fieldName, String path,
                                             String expectedRole, List<TypedError> errors) {
        JsonNode field = itemFields.get(fieldName);
        if (field == null) {
            errors.add(TypedError.schema(path, "嵌套明细字段 " + detailFieldName + " 不包含项字段:" + fieldName));
        } else if (!expectedRole.equals(DataSources.role(field))) {
            errors.add(TypedError.schema(path,
                    "嵌套明细项字段 " + fieldName + " 的 role 为 " + DataSources.role(field) + "，此处要求 " + expectedRole));
        }
    }

    private static boolean hasNavigateAction(JsonNode actions) {
        if (!Json.isArray(actions)) {
            return false;
        }
        for (JsonNode action : actions) {
            if (action.has("navigate")) {
                return true;
            }
        }
        return false;
    }

    private static List<TypedError> tableDataErrors(JsonNode page, JsonNode component, String componentPath) {
        List<Map.Entry<String, JsonNode>> slots = Json.entries(component.get("data"));
        if (slots.size() <= 1) {
            return List.of();
        }
        JsonNode rowKey = component.get("props").get("rowKey");
        if (!FilterInvariants.truthy(rowKey)) {
            return List.of(TypedError.schema(componentPath + "/props/rowKey", "多数据槽表格必须声明 rowKey"));
        }
        String key = rowKey.asText();
        List<TypedError> errors = new ArrayList<>();
        String expectedType = null;
        for (Map.Entry<String, JsonNode> slot : slots) {
            String sourceId = slot.getValue().asText();
            JsonNode source = Json.get(page.get("dataSources"), sourceId);
            if (source == null) {
                continue;
            }
            JsonNode field = DataSources.resolveFields(source).get(key);
            String path = componentPath + "/data/" + JsonPointer.escape(slot.getKey());
            if (field == null) {
                errors.add(TypedError.schema(path, "数据槽 " + slot.getKey() + " 的数据源 " + sourceId + " 缺少 rowKey 字段:" + key));
                continue;
            }
            if (!"dimension".equals(DataSources.role(field))) {
                errors.add(TypedError.schema(path, "rowKey 字段 " + key + " 的 role 必须为 dimension"));
            }
            String type = DataSources.type(field);
            if (expectedType == null) {
                expectedType = type;
            } else if (!expectedType.equals(type)) {
                errors.add(TypedError.schema(path, "rowKey 字段 " + key + " 的类型必须一致:" + expectedType + "/" + type));
            }
        }
        return errors;
    }

    /**
     * 表格呈现能力的判定（ADR-0049）：行类别字段必须确由该数据源上的折叠算子写入，
     * mergeBy 必须是表格已声明的列字段。
     */
    private static List<TypedError> tablePresentationErrors(JsonNode page, JsonNode component, String componentPath) {
        List<TypedError> errors = new ArrayList<>();
        String mainId = Json.text(Json.get(component.get("data"), "main"));
        JsonNode source = mainId == null ? null : Json.get(page.get("dataSources"), mainId);
        if (source == null) {
            return errors;
        }
        JsonNode fields = DataSources.resolveFields(source);
        JsonNode props = component.get("props");
        JsonNode rowKindField = props.get("rowKindField");
        if (rowKindField != null) {
            String path = componentPath + "/props/rowKindField";
            String name = rowKindField.asText();
            if (!fields.has(name)) {
                errors.add(TypedError.schema(path, "行类别字段 " + name + " 不在数据源 " + mainId + " 中"));
            } else {
                boolean written = false;
                for (JsonNode operator : DataSources.compute(source)) {
                    if (DataSources.isFoldingOperator(operator)
                            && name.equals(Json.text(Json.get(operator.get("rowKind"), "field")))) {
                        written = true;
                        break;
                    }
                }
                if (!written) {
                    errors.add(TypedError.schema(path, "行类别字段 " + name + " 没有任何折叠算子写入；小计与合计由计算阶段产出，表格只识别不计算"));
                }
            }
        }
        JsonNode mergeBy = props.get("mergeBy");
        if (mergeBy != null) {
            List<String> leaves = new ArrayList<>();
            collectLeafFields(props.get("columns"), leaves);
            if (!leaves.contains(mergeBy.asText())) {
                errors.add(TypedError.schema(componentPath + "/props/mergeBy", "mergeBy 必须是表格已声明的列字段:" + mergeBy.asText()));
            }
        }
        return errors;
    }

    private static void collectLeafFields(JsonNode columns, List<String> leaves) {
        for (JsonNode column : columns) {
            if (isGroup(column)) {
                collectLeafFields(column.get("children"), leaves);
            } else {
                leaves.add(DataSources.fieldName(column.get("field")));
            }
        }
    }

    static boolean isGroup(JsonNode column) {
        return "group".equals(Json.text(column.get("kind")));
    }

    private static List<TypedError> tableErrors(JsonNode columns, String componentPath, BindingCheck check,
                                                Map<String, JsonNode> filters) {
        List<TypedError> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        visitTableColumns(columns, componentPath + "/props/columns", check, filters, seen, errors);
        return errors;
    }

    private static void visitTableColumns(JsonNode columns, String basePath, BindingCheck check,
                                          Map<String, JsonNode> filters, Set<String> seen, List<TypedError> errors) {
        for (int index = 0; index < columns.size(); index++) {
            JsonNode column = columns.get(index);
            String path = basePath + "/" + index;
            if (isGroup(column)) {
                visitTableColumns(column.get("children"), path + "/children", check, filters, seen, errors);
                continue;
            }
            check.check(column.get("field"), path + "/field", null, "semanticHtml");
            if (FilterInvariants.truthy(column.get("secondaryField"))) {
                check.check(column.get("secondaryField"), path + "/secondaryField");
            }
            if (FilterInvariants.truthy(column.get("badgeField"))) {
                check.check(column.get("badgeField"), path + "/badgeField");
            }
            JsonNode writes = Json.get(Json.record(column.get("selection")), "writes");
            for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(writes))) {
                String filterId = entry.getKey();
                JsonNode target = filters.get(filterId);
                String writePath = path + "/selection/writes/" + JsonPointer.escape(filterId);
                if (target == null) {
                    errors.add(TypedError.schema(writePath, "写入了未声明的筛选器:" + filterId));
                } else if (!"dimension".equals(Json.text(target.get("type")))) {
                    errors.add(TypedError.schema(writePath, "单元格选择只能写入 dimension 筛选器:" + filterId));
                }
                if (entry.getValue().has("field")) {
                    check.check(entry.getValue().get("field"), writePath + "/field");
                }
            }
            String key = bindingKey(column.get("field"));
            if (seen.contains(key)) {
                errors.add(TypedError.schema(path + "/field", "表格列字段绑定重复:" + key));
            }
            seen.add(key);
            if (FilterInvariants.truthy(column.get("filterable"))) {
                check.check(column.get("field"), path + "/filterable", "dimension");
            }
        }
    }

    private static String bindingKey(JsonNode binding) {
        return binding.isTextual()
                ? "main:" + binding.textValue()
                : Json.text(binding.get("data")) + ":" + Json.text(binding.get("field"));
    }

    /** 分类明细的「同色同序」判定（ADR-0053）：开启色点要求同页有饼图绑定同一个类别字段。 */
    private static List<TypedError> categorySwatchErrors(JsonNode page, JsonNode component, String componentPath) {
        JsonNode swatches = component.get("props").get("swatches");
        if (swatches == null || !swatches.isBoolean() || !swatches.booleanValue()) {
            return List.of();
        }
        String own = categoryDomainKey(page, component, component.get("props").get("categoryField"));
        if (own == null) {
            return List.of();
        }
        boolean[] shared = {false};
        ComponentWalk.walkDocument(page, (candidate, path) -> {
            if (!"pieChart".equals(Json.text(candidate.get("type")))) {
                return;
            }
            if (own.equals(categoryDomainKey(page, candidate, candidate.get("props").get("categoryField")))) {
                shared[0] = true;
            }
        });
        if (shared[0]) {
            return List.of();
        }
        return List.of(TypedError.schema(componentPath + "/props/swatches",
                "色点按类别取值取色，要求同页有饼图绑定同一个类别字段:" + own + " 没有配对的饼图；不需要与扇区同色时去掉 swatches"));
    }

    /** 类别域的同一性：同一个页面数据源上的同一个字段才算同一批类别取值。 */
    private static String categoryDomainKey(JsonNode page, JsonNode component, JsonNode binding) {
        Resolved resolved = resolveBinding(page, component, binding);
        if (resolved.failed()) {
            return null;
        }
        String slot = binding.isTextual() ? "main" : Json.text(binding.get("data"));
        JsonNode sourceId = Json.get(Json.record(component.get("data")), slot);
        return sourceId == null ? null : sourceId.asText() + "." + resolved.fieldName();
    }

    /** 分档图例是着色契约：下界必须严格递增。 */
    private static List<TypedError> mapLegendErrors(JsonNode component, String componentPath) {
        JsonNode bands = Json.get(Json.record(component.get("props").get("legend")), "bands");
        if (!FilterInvariants.truthy(bands)) {
            return List.of();
        }
        List<TypedError> errors = new ArrayList<>();
        for (int index = 1; index < bands.size(); index++) {
            JsonNode from = bands.get(index).get("from");
            JsonNode previous = bands.get(index - 1).get("from");
            if (from.decimalValue().compareTo(previous.decimalValue()) <= 0) {
                errors.add(TypedError.schema(componentPath + "/props/legend/bands/" + index + "/from",
                        "图例档位下界必须严格递增:第 " + (index + 1) + " 档 " + com.huawei.cdi.pageassets.domain.page.json.JsNumbers.toString(from)
                                + " 不大于第 " + index + " 档 " + com.huawei.cdi.pageassets.domain.page.json.JsNumbers.toString(previous)));
            }
        }
        return errors;
    }

    /** 固定地域摘要是 regionalOverview 形态的一部分；匹配值与重复标签也在协议层判定。 */
    private static List<TypedError> mapPinnedSummaryErrors(JsonNode page, JsonNode component, String componentPath) {
        JsonNode props = component.get("props");
        JsonNode summary = props.get("pinnedSummary");
        if (!FilterInvariants.truthy(summary)) {
            return List.of();
        }
        String path = componentPath + "/props/pinnedSummary";
        List<TypedError> errors = new ArrayList<>();
        if (!"regionalOverview".equals(Json.text(props.get("variant")))) {
            errors.add(TypedError.schema(path, "pinnedSummary 只能用于 variant: regionalOverview 的地图"));
        }
        Resolved matched = resolveBinding(page, component, summary.get("matchField"));
        if (!matched.failed() && !FieldContract.matchesFieldValue(summary.get("matchValue"), matched.field())) {
            errors.add(TypedError.schema(path + "/matchValue",
                    "匹配值不符合字段 " + matched.fieldName() + " 的类型 " + DataSources.type(matched.field())));
        }
        Set<String> labels = new HashSet<>();
        JsonNode fields = summary.get("fields");
        for (int index = 0; index < fields.size(); index++) {
            String label = jsString(fields.get(index).get("label"));
            if (labels.contains(label)) {
                errors.add(TypedError.schema(path + "/fields/" + index + "/label", "地域摘要字段标签重复:" + label));
            }
            labels.add(label);
        }
        return errors;
    }

    private static String jsString(JsonNode node) {
        if (node == null) {
            return "undefined";
        }
        if (node.isTextual()) {
            return node.textValue();
        }
        if (node.isNumber()) {
            return com.huawei.cdi.pageassets.domain.page.json.JsNumbers.toString(node);
        }
        if (node.isNull()) {
            return "null";
        }
        if (node.isBoolean()) {
            return String.valueOf(node.booleanValue());
        }
        return node.toString();
    }

    private static List<TypedError> mapHierarchyErrors(JsonNode page, JsonNode component, String componentPath,
                                                       BindingCheck check) {
        List<TypedError> errors = new ArrayList<>();
        JsonNode props = component.get("props");
        JsonNode filterIdNode = props.get("hierarchyFilter");
        if (filterIdNode == null) {
            if (FilterInvariants.truthy(props.get("levelField"))) {
                errors.add(TypedError.schema(componentPath + "/props/levelField", "levelField 只能与 hierarchyFilter 一起使用"));
            }
            if (FilterInvariants.truthy(props.get("parentField"))) {
                errors.add(TypedError.schema(componentPath + "/props/parentField", "parentField 只能与 hierarchyFilter 一起使用"));
            }
            if (FilterInvariants.truthy(props.get("levelMaps"))) {
                errors.add(TypedError.schema(componentPath + "/props/levelMaps", "levelMaps 只能与 hierarchyFilter 一起使用"));
            }
            return errors;
        }
        String filterId = filterIdNode.asText();
        JsonNode target = null;
        JsonNode filters = page.get("filters");
        if (Json.isArray(filters)) {
            for (JsonNode filter : filters) {
                if (filterId.equals(Json.text(filter.get("id")))) {
                    target = filter;
                    break;
                }
            }
        }
        if (target == null) {
            errors.add(TypedError.schema(componentPath + "/props/hierarchyFilter", "地图下钻引用了未声明的筛选器:" + filterId));
            return errors;
        }
        boolean dimension = "dimension".equals(Json.text(target.get("type")));
        JsonNode hierarchy = target.get("hierarchy");
        boolean hasHierarchy = FilterInvariants.truthy(hierarchy) && hierarchy.size() > 0;
        if (!dimension || !hasHierarchy) {
            errors.add(TypedError.schema(componentPath + "/props/hierarchyFilter",
                    "地图下钻目标必须是声明了 hierarchy 的维度筛选器:" + filterId));
        }
        if (FilterInvariants.truthy(props.get("levelField"))) {
            check.check(props.get("levelField"), componentPath + "/props/levelField", "dimension");
        }
        if (FilterInvariants.truthy(props.get("parentField"))) {
            check.check(props.get("parentField"), componentPath + "/props/parentField", "dimension");
        }
        if (FilterInvariants.truthy(props.get("codeField"))) {
            check.check(props.get("codeField"), componentPath + "/props/codeField", "dimension");
        }
        if (dimension && FilterInvariants.truthy(hierarchy) && FilterInvariants.truthy(props.get("levelMaps"))) {
            Set<String> levelIds = new HashSet<>();
            for (JsonNode level : hierarchy) {
                levelIds.add(Json.text(level.get("id")));
            }
            for (String levelId : Json.keys(props.get("levelMaps"))) {
                if (!levelIds.contains(levelId)) {
                    errors.add(TypedError.schema(componentPath + "/props/levelMaps/" + JsonPointer.escape(levelId),
                            "levelMaps 引用了筛选器 " + filterId + " 未声明的层级:" + levelId));
                }
            }
        }
        return errors;
    }

    static List<TypedError> actionErrors(JsonNode actions, String componentPath, JsonNode page, JsonNode component,
                                         Set<String> filterIds, BindingCheck check) {
        if (!FilterInvariants.truthy(actions)) {
            return List.of();
        }
        List<TypedError> errors = new ArrayList<>();
        if (!isLive(page, component)) {
            boolean hasNonNavigate = false;
            for (JsonNode action : actions) {
                if (!action.has("navigate")) {
                    hasNonNavigate = true;
                    break;
                }
            }
            if (hasNonNavigate) {
                errors.add(TypedError.schema(componentPath + "/props/actions",
                        "writeFilter 只允许绑定 query 数据源的组件；navigate 可以挂在 inline 组件上"));
            }
        }
        JsonNode filters = page.get("filters");
        for (int index = 0; index < actions.size(); index++) {
            JsonNode action = actions.get(index);
            String path = componentPath + "/props/actions/" + index;
            if (action.has("writeFilter")) {
                String filterId = action.get("writeFilter").asText();
                JsonNode target = null;
                if (Json.isArray(filters)) {
                    for (JsonNode filter : filters) {
                        if (filterId.equals(Json.text(filter.get("id")))) {
                            target = filter;
                            break;
                        }
                    }
                }
                if (target == null) {
                    errors.add(TypedError.schema(path + "/writeFilter", "回写了未声明的筛选器:" + filterId));
                } else if (!"dimension".equals(Json.text(target.get("type")))) {
                    errors.add(TypedError.schema(path + "/writeFilter", "回写目标必须是 dimension 筛选器:" + filterId));
                }
                check.check(action.get("field"), path + "/field", "dimension");
                continue;
            }
            JsonNode navigate = action.get("navigate");
            JsonNode carry = navigate.get("carryFilters");
            if (Json.isArray(carry)) {
                for (int filterIndex = 0; filterIndex < carry.size(); filterIndex++) {
                    String filterId = carry.get(filterIndex).asText();
                    if (!filterIds.contains(filterId)) {
                        errors.add(TypedError.schema(path + "/navigate/carryFilters/" + filterIndex,
                                "carryFilters 引用了未声明的筛选器:" + filterId));
                    }
                }
            }
            for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(navigate.get("setFilters")))) {
                check.check(entry.getValue(), path + "/navigate/setFilters/" + JsonPointer.escape(entry.getKey()), "dimension");
            }
            for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(navigate.get("setParams")))) {
                check.check(entry.getValue(), path + "/navigate/setParams/" + JsonPointer.escape(entry.getKey()));
            }
        }
        return errors;
    }

    /** `deriveComponentCapabilities(page, component).live`：组件任一数据槽指向 query 数据源。 */
    private static boolean isLive(JsonNode page, JsonNode component) {
        for (Map.Entry<String, JsonNode> entry : Json.entries(Json.record(component.get("data")))) {
            JsonNode source = Json.get(page.get("dataSources"), entry.getValue().asText());
            if (source != null && DataSources.isQuery(source)) {
                return true;
            }
        }
        return false;
    }
}
