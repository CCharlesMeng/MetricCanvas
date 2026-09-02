package com.huawei.cdi.pageassets.domain.page.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * 在 Jackson 树上复现 TypeScript 基线依赖的 JavaScript 语义：对象键的枚举顺序、
 * `typeof` 判定、深相等与数字转字符串。校验器的每一处遍历都必须经这里，
 * 否则错误顺序会与共享 conformance 向量不一致。
 */
public final class Json {
    private Json() {
    }

    /** `typeof value === 'object' && value !== null && !Array.isArray(value)`。 */
    public static boolean isRecord(JsonNode node) {
        return node != null && node.isObject();
    }

    /** 属性存在即视为已声明（`value[key] !== undefined`，null 也算存在）。 */
    public static boolean has(JsonNode node, String key) {
        return isRecord(node) && node.has(key);
    }

    /** 缺席属性统一返回 null，调用方不必区分 MissingNode 与缺键。 */
    public static JsonNode get(JsonNode node, String key) {
        if (!isRecord(node)) {
            return null;
        }
        return node.get(key);
    }

    public static JsonNode record(JsonNode node) {
        return isRecord(node) ? node : null;
    }

    public static boolean isArray(JsonNode node) {
        return node != null && node.isArray();
    }

    public static boolean isString(JsonNode node) {
        return node != null && node.isTextual();
    }

    public static boolean isNumber(JsonNode node) {
        return node != null && node.isNumber();
    }

    public static boolean isBoolean(JsonNode node) {
        return node != null && node.isBoolean();
    }

    public static boolean isNull(JsonNode node) {
        return node != null && node.isNull();
    }

    public static String text(JsonNode node) {
        return isString(node) ? node.textValue() : null;
    }

    public static boolean nonEmptyArray(JsonNode node) {
        return isArray(node) && node.size() > 0;
    }

    public static boolean isInteger(JsonNode node) {
        if (!isNumber(node)) {
            return false;
        }
        if (node.isIntegralNumber()) {
            return true;
        }
        BigDecimal value = node.decimalValue();
        return value.signum() == 0 || value.stripTrailingZeros().scale() <= 0;
    }

    /**
     * `Object.keys` 的枚举顺序：数组下标形态的键先按数值升序，其余按插入顺序。
     */
    public static List<String> keys(JsonNode node) {
        List<String> indexLike = new ArrayList<>();
        List<String> others = new ArrayList<>();
        if (isRecord(node)) {
            for (Iterator<String> it = node.fieldNames(); it.hasNext(); ) {
                String key = it.next();
                if (isArrayIndex(key)) {
                    indexLike.add(key);
                } else {
                    others.add(key);
                }
            }
        }
        indexLike.sort((left, right) -> Long.compare(Long.parseLong(left), Long.parseLong(right)));
        indexLike.addAll(others);
        return indexLike;
    }

    /** `Object.entries` 的顺序，与 {@link #keys} 一致。 */
    public static List<Map.Entry<String, JsonNode>> entries(JsonNode node) {
        List<Map.Entry<String, JsonNode>> result = new ArrayList<>();
        for (String key : keys(node)) {
            result.add(Map.entry(key, node.get(key)));
        }
        return result;
    }

    private static boolean isArrayIndex(String key) {
        if (key.isEmpty() || key.length() > 10) {
            return false;
        }
        if (key.length() > 1 && key.charAt(0) == '0') {
            return false;
        }
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return Long.parseLong(key) < 4294967295L;
    }

    /** JSON 深相等（数字按数值比较，1 与 1.0 相等），对应 ajv 的 fast-deep-equal。 */
    public static boolean deepEquals(JsonNode left, JsonNode right) {
        if (left == null || right == null) {
            return left == right;
        }
        if (left.isNumber() && right.isNumber()) {
            return left.decimalValue().compareTo(right.decimalValue()) == 0;
        }
        if (left.isObject() && right.isObject()) {
            if (left.size() != right.size()) {
                return false;
            }
            for (Map.Entry<String, JsonNode> entry : left.properties()) {
                JsonNode other = right.get(entry.getKey());
                if (other == null || !deepEquals(entry.getValue(), other)) {
                    return false;
                }
            }
            return true;
        }
        if (left.isArray() && right.isArray()) {
            if (left.size() != right.size()) {
                return false;
            }
            for (int i = 0; i < left.size(); i++) {
                if (!deepEquals(left.get(i), right.get(i))) {
                    return false;
                }
            }
            return true;
        }
        if (left.isNumber() || right.isNumber() || left.isObject() || right.isObject()
                || left.isArray() || right.isArray()) {
            return false;
        }
        return left.equals(right);
    }

    /** `JSON.stringify(value)`：紧凑、无空格、非 ASCII 原样输出。 */
    public static String stringify(JsonNode node) {
        StringBuilder out = new StringBuilder();
        stringify(node, out);
        return out.toString();
    }

    private static void stringify(JsonNode node, StringBuilder out) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            out.append("null");
        } else if (node.isTextual()) {
            quote(node.textValue(), out);
        } else if (node.isNumber()) {
            out.append(JsNumbers.toString(node));
        } else if (node.isBoolean()) {
            out.append(node.booleanValue());
        } else if (node.isArray()) {
            out.append('[');
            for (int i = 0; i < node.size(); i++) {
                if (i > 0) {
                    out.append(',');
                }
                stringify(node.get(i), out);
            }
            out.append(']');
        } else {
            out.append('{');
            boolean first = true;
            for (String key : keys(node)) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                quote(key, out);
                out.append(':');
                stringify(node.get(key), out);
            }
            out.append('}');
        }
    }

    private static void quote(String value, StringBuilder out) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20 || Character.isSurrogate(c) && !isPairedSurrogate(value, i)) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }

    private static boolean isPairedSurrogate(String value, int index) {
        char c = value.charAt(index);
        if (Character.isHighSurrogate(c)) {
            return index + 1 < value.length() && Character.isLowSurrogate(value.charAt(index + 1));
        }
        return index > 0 && Character.isHighSurrogate(value.charAt(index - 1));
    }

    /** 逐层复制 JSON 树（对应基线的 cloneJsonTree），产物可就地修改而不触及输入。 */
    public static JsonNode clone(JsonNode node) {
        return node == null ? null : node.deepCopy();
    }

    public static ObjectNode object(JsonNode node) {
        return (ObjectNode) node;
    }

    public static ArrayNode array(JsonNode node) {
        return (ArrayNode) node;
    }
}
