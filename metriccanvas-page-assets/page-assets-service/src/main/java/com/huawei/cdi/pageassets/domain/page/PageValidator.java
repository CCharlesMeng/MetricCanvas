package com.huawei.cdi.pageassets.domain.page;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.document.CompositeCards;
import com.huawei.cdi.pageassets.domain.page.document.Materializer;
import com.huawei.cdi.pageassets.domain.page.document.PageParams;
import com.huawei.cdi.pageassets.domain.page.invariant.Invariants;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;
import com.huawei.cdi.pageassets.domain.page.schema.Draft7Evaluator;
import com.huawei.cdi.pageassets.domain.page.schema.SchemaError;
import com.huawei.cdi.pageassets.domain.page.version.VersionPolicy;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 页面文档完整复验（ADR-0062）：Page Schema 结构校验 + 全部跨引用不变式，
 * 与 TypeScript 基线 {@code parsePage} 逐步对应，产出契约定义的 {@code type/path/message}。
 * 不可信文档通过结构、能力下限、页面参数、解析、字段契约与不变式校验后才可视为 Page。
 */
public final class PageValidator {
    private final Draft7Evaluator structure;
    private final VersionPolicy policy;
    private final List<String> compositeCardChildTypes;

    public PageValidator(JsonNode pageSchema) {
        this(pageSchema, VersionPolicy.CURRENT);
    }

    public PageValidator(JsonNode pageSchema, VersionPolicy policy) {
        this.structure = new Draft7Evaluator(pageSchema);
        this.policy = policy;
        this.compositeCardChildTypes = CompositeCards.childTypesFromSchema(pageSchema);
    }

    public List<TypedError> validate(JsonNode document) {
        return parse(document).errors();
    }

    public PageParseResult parse(JsonNode document) {
        List<TypedError> structural = structuralErrors(document);
        if (!structural.isEmpty()) {
            List<TypedError> guided = new ArrayList<>(policy.versionErrors(document));
            guided.addAll(CompositeCards.structureErrors(document, compositeCardChildTypes));
            if (!guided.isEmpty()) {
                guided.addAll(withoutGuidedPaths(structural, guided));
                return PageParseResult.failure(guided);
            }
            return PageParseResult.failure(structural);
        }

        // 能力下限与页面参数判定必须跑在文本取值替换之前：替换会把引用消解掉。
        List<JsonNode> declarations = PageParams.declarations(document);
        List<TypedError> documentErrors = new ArrayList<>(policy.capabilityFloorErrors(document));
        documentErrors.addAll(PageParams.pageParamErrors(declarations, filterIds(document), document));
        if (!documentErrors.isEmpty()) {
            return PageParseResult.failure(documentErrors);
        }

        Materializer.Materialized materialized = Materializer.materialize(document);
        if (!materialized.errors().isEmpty()) {
            return PageParseResult.failure(materialized.errors());
        }
        List<TypedError> recheck = structuralErrors(materialized.document());
        if (!recheck.isEmpty()) {
            boolean hasOptional = declarations.stream()
                    .anyMatch(declaration -> !declaration.path("required").asBoolean(false));
            if (hasOptional) {
                List<TypedError> withHint = new ArrayList<>(recheck);
                withHint.add(TypedError.schema("/params", "可选页面参数缺失时引用处整体消失；必填文本属性只能引用必需参数"));
                return PageParseResult.failure(withHint);
            }
            return PageParseResult.failure(recheck);
        }

        JsonNode page = materialized.document();
        List<TypedError> errors = Invariants.errors(page);
        return errors.isEmpty() ? PageParseResult.success(page) : PageParseResult.failure(errors);
    }

    private List<TypedError> structuralErrors(JsonNode document) {
        List<TypedError> errors = new ArrayList<>();
        for (SchemaError error : structure.validate(document)) {
            errors.add(toTypedError(error));
        }
        return errors;
    }

    /**
     * 少数几处形状由结构自己说不清楚（版本枚举失配、判别联合失配）。这些位置先给出定位到位的
     * 引导错误，再把它们已经解释过的那段结构噪声去掉。
     */
    private static List<TypedError> withoutGuidedPaths(List<TypedError> structural, List<TypedError> guided) {
        List<TypedError> kept = new ArrayList<>();
        for (TypedError error : structural) {
            boolean covered = false;
            for (TypedError hint : guided) {
                if (error.path().equals(hint.path()) || error.path().startsWith(hint.path() + "/")) {
                    covered = true;
                    break;
                }
            }
            if (!covered) {
                kept.add(error);
            }
        }
        return kept;
    }

    private static Set<String> filterIds(JsonNode document) {
        Set<String> ids = new HashSet<>();
        JsonNode filters = Json.get(document, "filters");
        if (Json.isArray(filters)) {
            for (JsonNode filter : filters) {
                String id = Json.text(Json.get(filter, "id"));
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        return ids;
    }

    private static TypedError toTypedError(SchemaError error) {
        String path = error.instancePath();
        switch (error.keyword()) {
            case "required" -> {
                String missing = error.params().get("missingProperty").textValue();
                return TypedError.schema(JsonPointer.child(path, missing), "缺少必填字段 " + missing);
            }
            case "additionalProperties" -> {
                String extra = error.params().get("additionalProperty").textValue();
                return TypedError.schema(JsonPointer.child(path, extra), "存在未定义字段 " + extra + "(拼写错误?)");
            }
            case "enum" -> {
                return TypedError.schema(path.isEmpty() ? "/" : path,
                        "取值不在允许范围:" + Json.stringify(error.params().get("allowedValues")));
            }
            default -> {
                return TypedError.schema(path.isEmpty() ? "/" : path,
                        error.message() == null ? "结构不合法" : error.message());
            }
        }
    }
}
