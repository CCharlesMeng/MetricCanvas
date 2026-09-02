package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.JsNumbers;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 文本取值的整值替换（ADR-0047）。引用解析为参数值的展示文本；引用的参数没有取值时，
 * 该属性视为未声明——对象属性被删除，数组中的该项被移除。
 *
 * <p>校验期代入：必需参数代入默认值或占位符，可选参数按缺席处理，这样「必填文本属性引用了
 * 可选参数」会在替换后的结构复检里直接暴露。
 */
public final class TextValues {
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private TextValues() {
    }

    /** 校验期取值：参数 id → 取值；缺席表示该参数在本次打开时没有取值。 */
    public static Map<String, JsonNode> validationResolution(List<JsonNode> declarations) {
        Map<String, JsonNode> values = new HashMap<>();
        for (JsonNode declaration : declarations) {
            JsonNode required = declaration.get("required");
            if (required == null || !required.asBoolean(false)) {
                continue;
            }
            JsonNode defaultValue = declaration.get("default");
            values.put(declaration.get("id").textValue(),
                    defaultValue != null ? defaultValue : placeholderFor(declaration));
        }
        return values;
    }

    private static JsonNode placeholderFor(JsonNode declaration) {
        String type = Json.text(declaration.get("type"));
        if ("number".equals(type)) {
            return NODES.numberNode(0);
        }
        if ("boolean".equals(type)) {
            return NODES.booleanNode(false);
        }
        JsonNode label = declaration.get("label");
        return label != null ? label : declaration.get("id");
    }

    /** 只替换 `textValueScope` 圈定的声明部分；`dataSources` 原样带回（挂在末尾，与基线一致）。 */
    public static JsonNode resolve(JsonNode document, Map<String, JsonNode> values) {
        if (!Json.isRecord(document)) {
            return document;
        }
        JsonNode resolved = visit(PageParams.textValueScope(document), values);
        ObjectNode result = (ObjectNode) resolved;
        if (document.has("dataSources")) {
            result.set("dataSources", document.get("dataSources"));
        }
        return result;
    }

    /** 返回 null 表示 ABSENT（属性视为未声明）。 */
    private static JsonNode visit(JsonNode value, Map<String, JsonNode> values) {
        if (Json.isArray(value)) {
            ArrayNode next = NODES.arrayNode();
            for (JsonNode item : value) {
                JsonNode resolved = visit(item, values);
                if (resolved != null) {
                    next.add(resolved);
                }
            }
            return next;
        }
        if (!Json.isRecord(value)) {
            return value;
        }
        if (PageParams.isTextValueReference(value)) {
            JsonNode resolved = values.get(value.get("param").textValue());
            return resolved == null ? null : NODES.textNode(format(resolved));
        }
        ObjectNode next = NODES.objectNode();
        for (Map.Entry<String, JsonNode> entry : Json.entries(value)) {
            JsonNode item = visit(entry.getValue(), values);
            if (item != null) {
                next.set(entry.getKey(), item);
            }
        }
        return next;
    }

    /** 缺省格式化只做字面量转字符串（`String(value)`）。 */
    private static String format(JsonNode value) {
        if (value.isTextual()) {
            return value.textValue();
        }
        if (value.isNumber()) {
            return JsNumbers.toString(value);
        }
        if (value.isBoolean()) {
            return String.valueOf(value.booleanValue());
        }
        return value.toString();
    }
}
