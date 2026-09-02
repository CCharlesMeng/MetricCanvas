package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.function.BiConsumer;

/**
 * 页面组件树遍历：内容分区顶层组件，以及两种容器内的子组件——Tab 容器的
 * {@code props.tabs[].component / components[]} 与组合卡的 {@code props.components[]}。
 * 校验与能力探测都走这一处；既可遍历原始文档，也可遍历解析产物（形状相同）。
 */
public final class ComponentWalk {
    private ComponentWalk() {
    }

    public static void walkDocument(JsonNode document, BiConsumer<JsonNode, String> visit) {
        JsonNode sections = Json.get(document, "sections");
        if (!Json.isArray(sections)) {
            return;
        }
        for (int sectionIndex = 0; sectionIndex < sections.size(); sectionIndex++) {
            walkSection(sections.get(sectionIndex), "/sections/" + sectionIndex + "/components", visit);
        }
    }

    public static void walkSection(JsonNode section, String basePath, BiConsumer<JsonNode, String> visit) {
        JsonNode components = Json.get(section, "components");
        walkComponents(components, basePath, visit);
    }

    public static void walkComponents(JsonNode components, String basePath, BiConsumer<JsonNode, String> visit) {
        if (!Json.isArray(components)) {
            return;
        }
        for (int index = 0; index < components.size(); index++) {
            visitTree(components.get(index), basePath + "/" + index, visit);
        }
    }

    private static void visitTree(JsonNode candidate, String path, BiConsumer<JsonNode, String> visit) {
        JsonNode component = Json.record(candidate);
        if (component == null) {
            return;
        }
        visit.accept(component, path);
        String type = Json.text(component.get("type"));
        JsonNode props = Json.record(component.get("props"));
        if ("tabContainer".equals(type)) {
            JsonNode tabs = Json.get(props, "tabs");
            if (!Json.isArray(tabs)) {
                return;
            }
            for (int tabIndex = 0; tabIndex < tabs.size(); tabIndex++) {
                JsonNode tab = Json.record(tabs.get(tabIndex));
                JsonNode single = Json.get(tab, "component");
                if (single != null && !single.isNull() && truthy(single)) {
                    visitTree(single, path + "/props/tabs/" + tabIndex + "/component", visit);
                    continue;
                }
                JsonNode children = Json.get(tab, "components");
                if (!Json.isArray(children)) {
                    continue;
                }
                for (int childIndex = 0; childIndex < children.size(); childIndex++) {
                    visitTree(children.get(childIndex),
                            path + "/props/tabs/" + tabIndex + "/components/" + childIndex, visit);
                }
            }
            return;
        }
        if ("compositeCard".equals(type)) {
            JsonNode children = Json.get(props, "components");
            if (!Json.isArray(children)) {
                return;
            }
            for (int childIndex = 0; childIndex < children.size(); childIndex++) {
                visitTree(children.get(childIndex), path + "/props/components/" + childIndex, visit);
            }
        }
    }

    /** JS 真值判断，只在 `tab.component` 这一处需要（基线写的是 `if (tab?.component)`）。 */
    private static boolean truthy(JsonNode node) {
        if (node.isBoolean()) {
            return node.booleanValue();
        }
        if (node.isNumber()) {
            return node.decimalValue().signum() != 0;
        }
        if (node.isTextual()) {
            return !node.textValue().isEmpty();
        }
        return !node.isNull();
    }
}
