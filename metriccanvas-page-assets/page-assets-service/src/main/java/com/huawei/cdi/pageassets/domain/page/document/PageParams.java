package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 页面参数（ADR-0047）：页面打开时由 URL 确定、此后不可改变的具名输入。
 * 文本取值引用按形状识别（只含 `param` 与可选 `format` 的对象），作用域是文档中除
 * `dataSources` 以外的部分。
 */
public final class PageParams {
    private PageParams() {
    }

    public record TextValueReferenceUsage(String path, JsonNode reference) {
    }

    public static boolean isTextValueReference(JsonNode value) {
        if (!Json.isRecord(value) || !value.has("param")) {
            return false;
        }
        for (String key : Json.keys(value)) {
            if (!key.equals("param") && !key.equals("format")) {
                return false;
            }
        }
        JsonNode format = value.get("format");
        return Json.isString(value.get("param"))
                && (format == null || (Json.isString(format) && ValueFormats.isPreset(format.textValue())));
    }

    /** 文本取值的作用域：页面文档里除 `dataSources` 以外的部分（返回浅拷贝，不修改输入）。 */
    public static JsonNode textValueScope(JsonNode document) {
        if (!Json.isRecord(document)) {
            return document;
        }
        ObjectNode rest = ((ObjectNode) document).objectNode();
        for (String key : Json.keys(document)) {
            if (!key.equals("dataSources")) {
                rest.set(key, document.get(key));
            }
        }
        return rest;
    }

    public static List<TextValueReferenceUsage> collectTextValueReferences(JsonNode document) {
        List<TextValueReferenceUsage> usages = new ArrayList<>();
        visit(textValueScope(document), "", usages);
        return usages;
    }

    private static void visit(JsonNode value, String path, List<TextValueReferenceUsage> usages) {
        if (Json.isArray(value)) {
            for (int index = 0; index < value.size(); index++) {
                visit(value.get(index), path + "/" + index, usages);
            }
            return;
        }
        if (!Json.isRecord(value)) {
            return;
        }
        if (isTextValueReference(value)) {
            usages.add(new TextValueReferenceUsage(path, value));
            return;
        }
        for (Map.Entry<String, JsonNode> entry : Json.entries(value)) {
            visit(entry.getValue(), JsonPointer.child(path, entry.getKey()), usages);
        }
    }

    public static List<JsonNode> declarations(JsonNode document) {
        JsonNode params = Json.get(document, "params");
        List<JsonNode> result = new ArrayList<>();
        if (Json.isArray(params)) {
            params.forEach(result::add);
        }
        return result;
    }

    /** 页面参数的不变式判定。跑在结构校验之后、文本取值替换之前。 */
    public static List<TypedError> pageParamErrors(List<JsonNode> declarations, Set<String> filterIds,
                                                   JsonNode document) {
        List<TypedError> errors = new ArrayList<>();
        Map<String, JsonNode> byId = new HashMap<>();
        for (int index = 0; index < declarations.size(); index++) {
            JsonNode declaration = declarations.get(index);
            String path = "/params/" + index;
            String id = Json.text(declaration.get("id"));
            if (byId.containsKey(id)) {
                errors.add(TypedError.schema(path + "/id", "页面参数 id 重复:" + id));
            }
            byId.put(id, declaration);
            if (filterIds.contains(id)) {
                errors.add(TypedError.schema(path + "/id", "页面参数与筛选器同名:" + id + ";同一语义只能取一种形态"));
            }
            JsonNode defaultValue = declaration.get("default");
            String type = Json.text(declaration.get("type"));
            if (defaultValue != null && !matchesParamType(defaultValue, type)) {
                errors.add(TypedError.schema(path + "/default", "默认值不符合参数类型 " + type));
            }
        }

        Set<String> consumed = new HashSet<>();
        for (TextValueReferenceUsage usage : collectTextValueReferences(document)) {
            String param = usage.reference().get("param").textValue();
            JsonNode declaration = byId.get(param);
            if (declaration == null) {
                errors.add(TypedError.schema(usage.path() + "/param", "文本取值引用了未声明的页面参数:" + param));
                continue;
            }
            consumed.add(param);
            JsonNode format = usage.reference().get("format");
            String type = Json.text(declaration.get("type"));
            if (format != null && !ValueFormats.suitsParamType(format.textValue(), type)) {
                errors.add(TypedError.schema(usage.path() + "/format",
                        "格式 " + format.textValue() + " 与页面参数 " + param + " 的类型 " + type + " 不相容"));
            }
        }

        for (int index = 0; index < declarations.size(); index++) {
            String id = Json.text(declarations.get(index).get("id"));
            if (consumed.contains(id)) {
                continue;
            }
            errors.add(TypedError.schema("/params/" + index + "/id",
                    "页面参数 " + id + " 没有任何消费者;未被消费的参数通常意味着绑错了位置"));
        }
        return errors;
    }

    static boolean matchesParamType(JsonNode value, String type) {
        return switch (type == null ? "" : type) {
            case "string" -> Json.isString(value);
            case "number" -> Json.isNumber(value);
            case "boolean" -> Json.isBoolean(value);
            default -> false;
        };
    }
}
