package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;

/**
 * 组合卡的四条结构不变量（ADR-0053），在结构校验的接缝上判定、读的是原始文档：
 * 纯容器不承载 data / actions、至少一个子组件、不得嵌套容器、子组件在白名单内。
 * 白名单从嵌入的 Page Schema（`compositeCardChild` 判别联合）派生，不另抄一份。
 */
public final class CompositeCards {
    private CompositeCards() {
    }

    public static List<String> childTypesFromSchema(JsonNode schema) {
        List<String> types = new ArrayList<>();
        JsonNode union = schema.at("/definitions/compositeCardChild/oneOf");
        for (JsonNode branch : union) {
            String ref = Json.text(branch.get("$ref"));
            JsonNode target = ref == null ? branch : schema.at(ref.substring(1));
            String type = Json.text(target.at("/properties/type/const"));
            if (type != null) {
                types.add(type);
            }
        }
        if (types.isEmpty()) {
            throw new IllegalArgumentException("Page Schema 缺少 compositeCardChild 白名单");
        }
        return types;
    }

    public static List<TypedError> structureErrors(JsonNode document, List<String> childTypes) {
        List<TypedError> errors = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (!"compositeCard".equals(Json.text(component.get("type")))) {
                return;
            }
            if (component.has("data")) {
                errors.add(TypedError.schema(path + "/data",
                        "组合卡是纯容器，自己不承载数据，不得声明 data；数据由子组件各自声明"));
            }
            JsonNode props = Json.record(component.get("props"));
            if (Json.has(props, "actions")) {
                errors.add(TypedError.schema(path + "/props/actions",
                        "组合卡是纯容器，不承载交互，不得声明 actions；卡里哪个数字可点由那个数字所属的子组件自己声明"));
            }
            JsonNode children = Json.get(props, "components");
            if (!Json.isArray(children)) {
                return;
            }
            if (children.isEmpty()) {
                errors.add(TypedError.schema(path + "/props/components", "组合卡至少要有一个子组件"));
                return;
            }
            for (int index = 0; index < children.size(); index++) {
                String childType = Json.text(Json.get(Json.record(children.get(index)), "type"));
                if (childType == null) {
                    continue;
                }
                if (childType.equals("compositeCard") || childType.equals("tabContainer")) {
                    errors.add(TypedError.schema(path + "/props/components/" + index,
                            "组合卡内不得再嵌套容器组件:" + childType + "；页面树最深到「分区 → 组合卡 → 组件」三层"));
                    continue;
                }
                if (!childTypes.contains(childType)) {
                    errors.add(TypedError.schema(path + "/props/components/" + index,
                            "组合卡子组件不在白名单内:" + childType + "；当前只准入 " + String.join(" / ", childTypes)));
                }
            }
        });
        return errors;
    }
}
