package com.huawei.cdi.pageassets.domain.page.schema;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.page.json.JsNumbers;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * JSON Schema draft-07 结构校验器，行为对齐 TypeScript 基线使用的
 * {@code new Ajv({ allErrors: true, strict: false })}：关键字求值顺序、错误顺序与错误文案
 * 都按 ajv v8 复现，因为共享 conformance 向量里的结构错误由 ajv 产出。
 *
 * <p>只支持 Page Schema 实际使用的关键字子集，遇到未支持的关键字在构造时即失败，
 * 避免静默放过（页面契约新增关键字时这里必须同步扩展）。
 */
public final class Draft7Evaluator {
    private static final Set<String> RULE_KEYWORDS = Set.of(
            "$ref", "type", "const", "enum", "not", "anyOf", "oneOf", "allOf", "if", "then", "else",
            "maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf",
            "maxLength", "minLength", "pattern", "format",
            "maxItems", "minItems", "uniqueItems", "additionalItems", "items", "contains",
            "maxProperties", "minProperties", "required", "propertyNames", "additionalProperties",
            "dependencies", "properties", "patternProperties");

    private static final Set<String> SUPPORTED_KEYWORDS = Set.of(
            "$ref", "type", "const", "enum", "not", "anyOf", "oneOf", "allOf",
            "maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum",
            "maxLength", "minLength", "pattern",
            "maxItems", "minItems", "uniqueItems", "items",
            "maxProperties", "minProperties", "required", "propertyNames", "additionalProperties",
            "properties",
            // 非规则关键字
            "$schema", "$id", "definitions", "title", "description", "default", "examples", "$comment");

    private static final List<String> NUMBER_GROUP =
            List.of("maximum", "minimum", "exclusiveMaximum", "exclusiveMinimum", "multipleOf");
    private static final List<String> STRING_GROUP = List.of("maxLength", "minLength", "pattern");
    private static final List<String> ARRAY_GROUP =
            List.of("maxItems", "minItems", "uniqueItems", "additionalItems", "items", "contains");
    private static final List<String> OBJECT_GROUP = List.of(
            "maxProperties", "minProperties", "required", "propertyNames", "additionalProperties",
            "dependencies", "properties", "patternProperties");
    private static final List<String> NO_TYPE_GROUP =
            List.of("$ref", "const", "enum", "not", "anyOf", "oneOf", "allOf");
    private static final Set<String> SCALAR_TYPES = Set.of("string", "number", "integer", "boolean", "null");

    private final JsonNode root;
    private final Map<String, Pattern> patterns = new HashMap<>();
    private final Map<String, JsonNode> refs = new HashMap<>();

    public Draft7Evaluator(JsonNode schema) {
        this.root = schema;
        assertSupported(schema, "#");
    }

    public List<SchemaError> validate(JsonNode data) {
        List<SchemaError> errors = new ArrayList<>();
        evaluate(root, data, "", errors);
        return errors;
    }

    private void assertSupported(JsonNode schema, String at) {
        if (schema == null || !schema.isObject()) {
            return;
        }
        for (Map.Entry<String, JsonNode> entry : schema.properties()) {
            String keyword = entry.getKey();
            JsonNode value = entry.getValue();
            if (!SUPPORTED_KEYWORDS.contains(keyword)) {
                throw new IllegalArgumentException("unsupported JSON Schema keyword " + keyword + " at " + at);
            }
            switch (keyword) {
                case "properties", "definitions" -> {
                    for (Map.Entry<String, JsonNode> prop : value.properties()) {
                        assertSupported(prop.getValue(), at + "/" + keyword + "/" + prop.getKey());
                    }
                }
                case "anyOf", "oneOf", "allOf" -> {
                    for (int i = 0; i < value.size(); i++) {
                        assertSupported(value.get(i), at + "/" + keyword + "/" + i);
                    }
                }
                case "items" -> {
                    if (value.isArray()) {
                        throw new IllegalArgumentException("tuple items unsupported at " + at);
                    }
                    assertSupported(value, at + "/items");
                }
                case "not", "propertyNames", "additionalProperties" -> assertSupported(value, at + "/" + keyword);
                default -> {
                }
            }
        }
    }

    // ---------------------------------------------------------------- 求值主干

    private boolean evaluate(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        int before = errors.size();
        if (schema.isBoolean()) {
            if (!schema.booleanValue()) {
                errors.add(error(path, "false schema", "boolean schema is false", params()));
            }
            return errors.size() == before;
        }
        if (schema.has("$ref") && !hasRulesButRef(schema)) {
            evaluate(resolve(schema.get("$ref").textValue()), data, path, errors);
            return errors.size() == before;
        }

        List<String> types = schemaTypes(schema);
        boolean checkedTypes = false;
        if (!types.isEmpty() && !(types.size() == 1 && hasRulesForType(schema, types.get(0)))) {
            checkedTypes = true;
            if (!matchesAnyType(types, data)) {
                reportTypeError(types, path, errors);
            }
        }

        if (shouldUseGroup(schema, NO_TYPE_GROUP)) {
            noTypeKeywords(schema, data, path, errors);
        }
        typedGroup(schema, data, path, errors, "number", NUMBER_GROUP, types, checkedTypes);
        typedGroup(schema, data, path, errors, "string", STRING_GROUP, types, checkedTypes);
        typedGroup(schema, data, path, errors, "array", ARRAY_GROUP, types, checkedTypes);
        typedGroup(schema, data, path, errors, "object", OBJECT_GROUP, types, checkedTypes);
        return errors.size() == before;
    }

    private void typedGroup(JsonNode schema, JsonNode data, String path, List<SchemaError> errors,
                            String groupType, List<String> keywords, List<String> types, boolean checkedTypes) {
        if (!shouldUseGroup(schema, keywords)) {
            return;
        }
        if (matchesType(groupType, data)) {
            switch (groupType) {
                case "number" -> numberKeywords(schema, data, path, errors);
                case "string" -> stringKeywords(schema, data, path, errors);
                case "array" -> arrayKeywords(schema, data, path, errors);
                default -> objectKeywords(schema, data, path, errors);
            }
        } else if (types.size() == 1 && types.get(0).equals(groupType) && !checkedTypes) {
            reportTypeError(types, path, errors);
        }
    }

    private void noTypeKeywords(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        if (schema.has("$ref")) {
            evaluate(resolve(schema.get("$ref").textValue()), data, path, errors);
        }
        if (schema.has("const") && !Json.deepEquals(data, schema.get("const"))) {
            errors.add(error(path, "const", "must be equal to constant",
                    params().set("allowedValue", schema.get("const"))));
        }
        if (schema.has("enum")) {
            boolean found = false;
            for (JsonNode allowed : schema.get("enum")) {
                if (Json.deepEquals(data, allowed)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                errors.add(error(path, "enum", "must be equal to one of the allowed values",
                        params().set("allowedValues", schema.get("enum"))));
            }
        }
        if (schema.has("not")) {
            int before = errors.size();
            boolean valid = evaluate(schema.get("not"), data, path, errors);
            truncate(errors, before);
            if (valid) {
                errors.add(error(path, "not", "must NOT be valid", params()));
            }
        }
        if (schema.has("anyOf")) {
            int before = errors.size();
            boolean valid = false;
            for (JsonNode branch : schema.get("anyOf")) {
                if (valid) {
                    break;
                }
                valid = evaluate(branch, data, path, errors);
            }
            if (valid) {
                truncate(errors, before);
            } else {
                errors.add(error(path, "anyOf", "must match a schema in anyOf", params()));
            }
        }
        if (schema.has("oneOf")) {
            int before = errors.size();
            List<Integer> passing = new ArrayList<>();
            int index = 0;
            for (JsonNode branch : schema.get("oneOf")) {
                if (evaluate(branch, data, path, errors)) {
                    passing.add(index);
                }
                index++;
            }
            if (passing.size() == 1) {
                truncate(errors, before);
            } else {
                ObjectNode params = params();
                if (passing.isEmpty()) {
                    params.putNull("passingSchemas");
                } else {
                    var array = params.putArray("passingSchemas");
                    passing.forEach(array::add);
                }
                errors.add(error(path, "oneOf", "must match exactly one schema in oneOf", params));
            }
        }
        if (schema.has("allOf")) {
            for (JsonNode branch : schema.get("allOf")) {
                evaluate(branch, data, path, errors);
            }
        }
    }

    private void numberKeywords(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        BigDecimal value = data.decimalValue();
        limit(schema, "maximum", value, path, errors, "<=", (v, limit) -> v.compareTo(limit) <= 0);
        limit(schema, "minimum", value, path, errors, ">=", (v, limit) -> v.compareTo(limit) >= 0);
        limit(schema, "exclusiveMaximum", value, path, errors, "<", (v, limit) -> v.compareTo(limit) < 0);
        limit(schema, "exclusiveMinimum", value, path, errors, ">", (v, limit) -> v.compareTo(limit) > 0);
    }

    private interface Comparison {
        boolean ok(BigDecimal value, BigDecimal limit);
    }

    private void limit(JsonNode schema, String keyword, BigDecimal value, String path, List<SchemaError> errors,
                       String okStr, Comparison comparison) {
        if (!schema.has(keyword)) {
            return;
        }
        JsonNode limitNode = schema.get(keyword);
        if (!comparison.ok(value, limitNode.decimalValue())) {
            errors.add(error(path, keyword, "must be " + okStr + " " + JsNumbers.toString(limitNode),
                    params().put("comparison", okStr).set("limit", limitNode)));
        }
    }

    private void stringKeywords(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        String value = data.textValue();
        int length = value.codePointCount(0, value.length());
        if (schema.has("maxLength") && length > schema.get("maxLength").intValue()) {
            errors.add(error(path, "maxLength",
                    "must NOT have more than " + JsNumbers.toString(schema.get("maxLength")) + " characters",
                    params().set("limit", schema.get("maxLength"))));
        }
        if (schema.has("minLength") && length < schema.get("minLength").intValue()) {
            errors.add(error(path, "minLength",
                    "must NOT have fewer than " + JsNumbers.toString(schema.get("minLength")) + " characters",
                    params().set("limit", schema.get("minLength"))));
        }
        if (schema.has("pattern")) {
            String pattern = schema.get("pattern").textValue();
            if (!compile(pattern).matcher(value).find()) {
                errors.add(error(path, "pattern", "must match pattern \"" + pattern + "\"",
                        params().put("pattern", pattern)));
            }
        }
    }

    private void arrayKeywords(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        int size = data.size();
        if (schema.has("maxItems") && size > schema.get("maxItems").intValue()) {
            errors.add(error(path, "maxItems",
                    "must NOT have more than " + JsNumbers.toString(schema.get("maxItems")) + " items",
                    params().set("limit", schema.get("maxItems"))));
        }
        if (schema.has("minItems") && size < schema.get("minItems").intValue()) {
            errors.add(error(path, "minItems",
                    "must NOT have fewer than " + JsNumbers.toString(schema.get("minItems")) + " items",
                    params().set("limit", schema.get("minItems"))));
        }
        if (schema.has("uniqueItems") && schema.get("uniqueItems").asBoolean()) {
            uniqueItems(schema, data, path, errors);
        }
        if (schema.has("items")) {
            JsonNode items = schema.get("items");
            if (!alwaysValid(items)) {
                for (int i = 0; i < size; i++) {
                    evaluate(items, data.get(i), JsonPointer.index(path, i), errors);
                }
            }
        }
    }

    /**
     * ajv 对 uniqueItems 有两条路径：items 全是标量类型时用取值索引表自后向前扫描，
     * 否则两两深比较；两条路径报出的下标对不同，这里逐一复现。
     */
    private void uniqueItems(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        List<String> itemTypes = schema.has("items") ? schemaTypes(schema.get("items")) : List.of();
        boolean scalar = !itemTypes.isEmpty() && SCALAR_TYPES.containsAll(itemTypes);
        int size = data.size();
        if (scalar) {
            Map<String, Integer> indices = new HashMap<>();
            for (int i = size - 1; i >= 0; i--) {
                JsonNode item = data.get(i);
                if (!matchesAnyType(itemTypes, item)) {
                    continue;
                }
                String key = item.isTextual() && itemTypes.size() > 1
                        ? item.textValue() + "_"
                        : item.isTextual() ? item.textValue() : Json.stringify(item);
                Integer seen = indices.get(key);
                if (seen != null) {
                    errors.add(error(path, "uniqueItems",
                            "must NOT have duplicate items (items ## " + seen + " and " + i + " are identical)",
                            params().put("i", i).put("j", seen)));
                    return;
                }
                indices.put(key, i);
            }
            return;
        }
        for (int i = size - 1; i >= 0; i--) {
            for (int j = i - 1; j >= 0; j--) {
                if (Json.deepEquals(data.get(i), data.get(j))) {
                    errors.add(error(path, "uniqueItems",
                            "must NOT have duplicate items (items ## " + j + " and " + i + " are identical)",
                            params().put("i", i).put("j", j)));
                    return;
                }
            }
        }
    }

    private void objectKeywords(JsonNode schema, JsonNode data, String path, List<SchemaError> errors) {
        int size = data.size();
        if (schema.has("maxProperties") && size > schema.get("maxProperties").intValue()) {
            errors.add(error(path, "maxProperties",
                    "must NOT have more than " + JsNumbers.toString(schema.get("maxProperties")) + " properties",
                    params().set("limit", schema.get("maxProperties"))));
        }
        if (schema.has("minProperties") && size < schema.get("minProperties").intValue()) {
            errors.add(error(path, "minProperties",
                    "must NOT have fewer than " + JsNumbers.toString(schema.get("minProperties")) + " properties",
                    params().set("limit", schema.get("minProperties"))));
        }
        if (schema.has("required")) {
            for (JsonNode required : schema.get("required")) {
                String property = required.textValue();
                if (!data.has(property)) {
                    errors.add(error(path, "required", "must have required property '" + property + "'",
                            params().put("missingProperty", property)));
                }
            }
        }
        if (schema.has("propertyNames")) {
            JsonNode nameSchema = schema.get("propertyNames");
            if (!alwaysValid(nameSchema)) {
                for (String key : Json.keys(data)) {
                    boolean valid = evaluate(nameSchema, JsonNodeFactory.instance.textNode(key), path, errors);
                    if (!valid) {
                        errors.add(error(path, "propertyNames", "property name must be valid",
                                params().put("propertyName", key)));
                    }
                }
            }
        }
        if (schema.has("additionalProperties")) {
            JsonNode additional = schema.get("additionalProperties");
            Set<String> declared = new LinkedHashSet<>();
            if (schema.has("properties")) {
                schema.get("properties").fieldNames().forEachRemaining(declared::add);
            }
            boolean forbidden = additional.isBoolean() && !additional.booleanValue();
            if (forbidden || !alwaysValid(additional)) {
                for (String key : Json.keys(data)) {
                    if (declared.contains(key)) {
                        continue;
                    }
                    if (forbidden) {
                        errors.add(error(path, "additionalProperties", "must NOT have additional properties",
                                params().put("additionalProperty", key)));
                    } else {
                        evaluate(additional, data.get(key), JsonPointer.child(path, key), errors);
                    }
                }
            }
        }
        if (schema.has("properties")) {
            JsonNode properties = schema.get("properties");
            for (Map.Entry<String, JsonNode> entry : properties.properties()) {
                if (data.has(entry.getKey())) {
                    evaluate(entry.getValue(), data.get(entry.getKey()),
                            JsonPointer.child(path, entry.getKey()), errors);
                }
            }
        }
    }

    // ---------------------------------------------------------------- 辅助

    private void reportTypeError(List<String> types, String path, List<SchemaError> errors) {
        String joined = String.join(",", types);
        errors.add(error(path, "type", "must be " + joined, params().put("type", joined)));
    }

    private static boolean hasRulesButRef(JsonNode schema) {
        for (Iterator<String> it = schema.fieldNames(); it.hasNext(); ) {
            String key = it.next();
            if (!key.equals("$ref") && RULE_KEYWORDS.contains(key)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasRulesForType(JsonNode schema, String type) {
        return switch (type) {
            case "number" -> shouldUseGroup(schema, NUMBER_GROUP);
            case "string" -> shouldUseGroup(schema, STRING_GROUP);
            case "array" -> shouldUseGroup(schema, ARRAY_GROUP);
            case "object" -> shouldUseGroup(schema, OBJECT_GROUP);
            default -> false;
        };
    }

    private static boolean shouldUseGroup(JsonNode schema, List<String> keywords) {
        for (String keyword : keywords) {
            if (schema.has(keyword)) {
                return true;
            }
        }
        return false;
    }

    private static boolean alwaysValid(JsonNode schema) {
        if (schema.isBoolean()) {
            return schema.booleanValue();
        }
        if (!schema.isObject()) {
            return false;
        }
        for (Iterator<String> it = schema.fieldNames(); it.hasNext(); ) {
            if (RULE_KEYWORDS.contains(it.next())) {
                return false;
            }
        }
        return true;
    }

    private static List<String> schemaTypes(JsonNode schema) {
        JsonNode type = schema.get("type");
        List<String> types = new ArrayList<>();
        if (type == null) {
            return types;
        }
        if (type.isTextual()) {
            types.add(type.textValue());
        } else if (type.isArray()) {
            type.forEach(node -> types.add(node.textValue()));
        }
        return types;
    }

    private static boolean matchesAnyType(List<String> types, JsonNode data) {
        for (String type : types) {
            if (matchesType(type, data)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesType(String type, JsonNode data) {
        return switch (type) {
            case "number" -> Json.isNumber(data);
            case "integer" -> Json.isInteger(data);
            case "string" -> Json.isString(data);
            case "boolean" -> Json.isBoolean(data);
            case "null" -> Json.isNull(data);
            case "object" -> Json.isRecord(data);
            case "array" -> Json.isArray(data);
            default -> false;
        };
    }

    private JsonNode resolve(String ref) {
        return refs.computeIfAbsent(ref, key -> {
            if (!key.startsWith("#")) {
                throw new IllegalArgumentException("only local $ref is supported: " + key);
            }
            String pointer = key.substring(1);
            JsonNode target = pointer.isEmpty() ? root : root.at(pointer);
            if (target == null || target.isMissingNode()) {
                throw new IllegalArgumentException("unresolvable $ref " + key);
            }
            return target;
        });
    }

    private Pattern compile(String pattern) {
        return patterns.computeIfAbsent(pattern, Pattern::compile);
    }

    private static void truncate(List<SchemaError> errors, int size) {
        while (errors.size() > size) {
            errors.remove(errors.size() - 1);
        }
    }

    private static ObjectNode params() {
        return JsonNodeFactory.instance.objectNode();
    }

    private static SchemaError error(String path, String keyword, String message, ObjectNode params) {
        return new SchemaError(path, keyword, message, params);
    }
}
