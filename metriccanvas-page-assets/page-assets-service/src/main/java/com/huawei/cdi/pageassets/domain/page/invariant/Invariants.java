package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.document.DataSources;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 跨引用不变式的入口，作用于已通过结构校验并完成解析的 Page。顺序与 TypeScript 基线
 * `invariantErrors` 一致：筛选器 → 数据源 → 分区与组件 → 隐藏层级切换器 → 查询分页。
 */
public final class Invariants {
    private Invariants() {
    }

    public static List<TypedError> errors(JsonNode page) {
        List<TypedError> errors = new ArrayList<>();
        List<JsonNode> filters = new ArrayList<>();
        JsonNode filtersNode = page.get("filters");
        if (Json.isArray(filtersNode)) {
            filtersNode.forEach(filters::add);
        }
        Set<String> filterIds = new HashSet<>();
        Map<String, JsonNode> filtersById = new HashMap<>();
        for (int index = 0; index < filters.size(); index++) {
            JsonNode filter = filters.get(index);
            String id = Json.text(filter.get("id"));
            if (filterIds.contains(id)) {
                errors.add(TypedError.schema("/filters/" + index + "/id", "筛选器 id 重复:" + id));
            }
            filterIds.add(id);
            filtersById.put(id, filter);
            errors.addAll(FilterInvariants.declarationErrors(filter, "/filters/" + index));
        }
        errors.addAll(FilterInvariants.dependsOnErrors(filters, filtersById));

        for (Map.Entry<String, JsonNode> entry : Json.entries(page.get("dataSources"))) {
            String path = "/dataSources/" + JsonPointer.escape(entry.getKey());
            JsonNode dataSource = entry.getValue();
            errors.addAll(DataSourceInvariants.computeErrors(dataSource, path));
            if (DataSources.isInline(dataSource)) {
                errors.addAll(DataSourceInvariants.inlineRowErrors(dataSource, path));
            } else if (DataSources.isQuery(dataSource)) {
                errors.addAll(DataSourceInvariants.queryContractErrors(dataSource, path, filtersById));
            }
        }

        Set<String> sectionIds = new HashSet<>();
        Set<String> componentIds = new HashSet<>();
        JsonNode sections = page.get("sections");
        for (int sectionIndex = 0; sectionIndex < sections.size(); sectionIndex++) {
            JsonNode section = sections.get(sectionIndex);
            String sectionId = Json.text(section.get("id"));
            if (sectionIds.contains(sectionId)) {
                errors.add(TypedError.schema("/sections/" + sectionIndex + "/id", "section id 重复:" + sectionId));
            }
            sectionIds.add(sectionId);
            errors.addAll(SectionInvariants.layerErrors(section, sectionIndex));
            errors.addAll(SectionInvariants.columnTrackErrors(section, sectionIndex));

            ComponentWalk.walkComponents(section.get("components"), "/sections/" + sectionIndex + "/components",
                    (component, path) -> {
                        String componentId = Json.text(component.get("id"));
                        if (componentIds.contains(componentId)) {
                            errors.add(TypedError.schema(path + "/id", "component id 重复:" + componentId));
                        }
                        componentIds.add(componentId);
                        errors.addAll(ComponentInvariants.componentErrors(page, component, path, filterIds, filtersById));
                    });
        }
        errors.addAll(FilterInvariants.hiddenHierarchyPickerErrors(page, filters));
        errors.addAll(PaginationInvariants.errors(page));
        return errors;
    }
}
