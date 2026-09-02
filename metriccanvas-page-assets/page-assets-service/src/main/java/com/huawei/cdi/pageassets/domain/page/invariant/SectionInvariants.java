package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** 内容分区的叠放层与列轨不变式。 */
final class SectionInvariants {
    private static final Pattern TOP_LEVEL = Pattern.compile("^/sections/\\d+/components/\\d+$");

    private SectionInvariants() {
    }

    /** 自定义列轨只改变分区顶层网格；backdrop 铺底不占轨，其余顶层组件不得跨出轨数。 */
    static List<TypedError> columnTrackErrors(JsonNode section, int sectionIndex) {
        List<TypedError> errors = new ArrayList<>();
        JsonNode tracks = section.get("columnTracks");
        if (tracks == null) {
            return errors;
        }
        int columnCount = tracks.size();
        JsonNode components = section.get("components");
        for (int index = 0; index < components.size(); index++) {
            JsonNode component = components.get(index);
            JsonNode layout = component.get("layout");
            boolean backdrop = "backdrop".equals(Json.text(Json.get(layout, "layer")));
            JsonNode span = Json.get(layout, "span");
            if (!backdrop && span != null && span.decimalValue().compareTo(java.math.BigDecimal.valueOf(columnCount)) > 0) {
                errors.add(TypedError.schema("/sections/" + sectionIndex + "/components/" + index + "/layout/span",
                        "内容分区 " + Json.text(section.get("id")) + " 声明了 " + columnCount + " 条列轨，组件 "
                                + Json.text(component.get("id")) + " 的 span 不能超过 " + columnCount));
            }
        }
        return errors;
    }

    /**
     * 叠放层是分区内的层次声明：backdrop 只能出现在分区顶层、一个分区最多一个、
     * 分区必须还有别的组件叠在它上面，且分区必须使用 container: plain。
     */
    static List<TypedError> layerErrors(JsonNode section, int sectionIndex) {
        List<TypedError> errors = new ArrayList<>();
        String basePath = "/sections/" + sectionIndex + "/components";
        ComponentWalk.walkComponents(section.get("components"), basePath, (component, path) -> {
            if (!Json.has(Json.record(component.get("layout")), "layer")) {
                return;
            }
            if (!TOP_LEVEL.matcher(path).matches()) {
                errors.add(TypedError.schema(path + "/layout/layer", "layout.layer 只能声明在内容分区的顶层组件上"));
            }
        });

        JsonNode components = section.get("components");
        List<Integer> backdrops = new ArrayList<>();
        for (int index = 0; index < components.size(); index++) {
            if ("backdrop".equals(Json.text(Json.get(components.get(index).get("layout"), "layer")))) {
                backdrops.add(index);
            }
        }
        if (backdrops.isEmpty()) {
            return errors;
        }
        String sectionId = Json.text(section.get("id"));
        if (backdrops.size() > 1) {
            for (int index : backdrops) {
                errors.add(TypedError.schema(basePath + "/" + index + "/layout/layer",
                        "内容分区 " + sectionId + " 声明了 " + backdrops.size() + " 个 backdrop，最多允许一个"));
            }
        }
        if (components.size() == backdrops.size()) {
            errors.add(TypedError.schema("/sections/" + sectionIndex + "/components",
                    "内容分区 " + sectionId + " 只有 backdrop 组件，没有可叠放其上的组件"));
        }
        String container = Json.text(section.get("container"));
        if (!"plain".equals(container)) {
            errors.add(TypedError.schema("/sections/" + sectionIndex + "/container",
                    "声明 backdrop 的内容分区必须使用 container: plain，当前为 " + (container == null ? "缺省" : container)));
        }
        return errors;
    }
}
