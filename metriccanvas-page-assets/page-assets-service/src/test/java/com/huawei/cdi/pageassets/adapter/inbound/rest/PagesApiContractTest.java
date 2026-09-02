package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.delegate.HealthcheckApiController;
import com.huawei.cdi.pageassets.delegate.PagesApiController;
import com.huawei.cdi.pageassets.domain.error.ErrorCode;
import com.huawei.cdi.pageassets.model.ErrorResponse;
import com.huawei.cdi.pageassets.testing.PageAssetsFixture;
import com.huawei.cdi.pageassets.testing.TestApplication;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 契约测试（ADR-0062 J2 完成条件"信封与 YAML 一致"）：真实 delegate + MockMvc，对齐作者文件
 * rest-services-page-assets.yaml 的路径、方法、响应属性、错误码闭集与 HTTP 状态语义。
 * base-path 用非缺省值，证明 `{service}` 前缀由配置注入。
 */
@SpringBootTest(classes = TestApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {"pageassets.base-path=/rest/cdi/testsvc/v1", "pageassets.store=memory"})
class PagesApiContractTest {
    private static final String BASE = "/rest/cdi/testsvc/v1";
    private static final String OPERATOR = "operator-a";
    private static final String CREATED_AT = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$";

    private static Map<String, Object> spec;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private RequestMappingHandlerMapping mappings;

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void loadSpec() throws Exception {
        try (InputStream in = PagesApiContractTest.class.getClassLoader()
                .getResourceAsStream("rest-services-page-assets.yaml")) {
            assertThat(in).as("作者文件必须随 page-assets-model 打包").isNotNull();
            spec = new Yaml().load(in);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(String... path) {
        Map<String, Object> current = spec;
        for (String key : path) {
            current = (Map<String, Object>) current.get(key);
            assertThat(current).as(String.join("/", path)).isNotNull();
        }
        return current;
    }

    private static Set<String> propertyNames(String definition) {
        return new TreeSet<>(section("definitions", definition, "properties").keySet());
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> keys = new TreeSet<>();
        node.fieldNames().forEachRemaining(keys::add);
        return keys;
    }

    private MockHttpServletRequestBuilder withHeaders(MockHttpServletRequestBuilder builder) {
        return builder.header("X-Operator-Id", OPERATOR).header("X-Auth-Token", "token").header("X-Workspace-Id", "ws");
    }

    private JsonNode body(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private MvcResult save(String pageId, ObjectNode request) throws Exception {
        return mvc.perform(withHeaders(post(BASE + "/pages/{pageId}/revisions", pageId))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString())).andReturn();
    }

    /** 幂等键按 (actor, key) 作用域、跨页面共享，同一 Spring 上下文内的测试必须用页面级前缀避免互相命中。 */
    private ObjectNode firstSaveRequest(String pageId, String key) {
        ObjectNode request = mapper.createObjectNode();
        request.putNull("baseRevisionId");
        request.set("document", PageAssetsFixture.inlineReport(pageId));
        request.put("idempotencyKey", pageId + ":" + key);
        request.put("pageIdConfirmed", true);
        request.putObject("source").put("type", "relay").put("sessionId", "s-1").put("skillVersion", "1.2.0");
        request.put("dataContextVersion", "dcv-1");
        return request;
    }

    private JsonNode saved(String pageId) throws Exception {
        MvcResult result = save(pageId, firstSaveRequest(pageId, "first-" + pageId));
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        return body(result);
    }

    @Nested
    class SpecAlignment {
        @Test
        void everyYamlOperationHasExactlyOneHandlerAndViceVersa() {
            Set<String> expected = new TreeSet<>();
            section("paths").forEach((path, methods) -> ((Map<?, ?>) methods).keySet()
                    .forEach(method -> expected.add(method.toString().toUpperCase() + " " + BASE + path)));

            Set<String> actual = new TreeSet<>();
            for (Map.Entry<RequestMappingInfo, ?> entry : mappings.getHandlerMethods().entrySet()) {
                Class<?> bean = ((org.springframework.web.method.HandlerMethod) entry.getValue()).getBeanType();
                if (bean != PagesApiController.class && bean != HealthcheckApiController.class) {
                    continue;
                }
                RequestMappingInfo info = entry.getKey();
                for (String pattern : info.getPathPatternsCondition().getPatternValues()) {
                    info.getMethodsCondition().getMethods().forEach(m -> actual.add(m.name() + " " + pattern));
                }
            }
            assertThat(actual).isEqualTo(expected);
        }

        @Test
        void controllerDefaultBasePathEqualsYamlBasePath() {
            String value = PagesApiController.class.getAnnotation(RequestMapping.class).value()[0];
            assertThat(value).startsWith("${pageassets.base-path:").endsWith("}");
            String defaultBasePath = value.substring("${pageassets.base-path:".length(), value.length() - 1);
            assertThat(defaultBasePath).isEqualTo(spec.get("basePath"));
            assertThat(HealthcheckApiController.class.getAnnotation(RequestMapping.class).value()[0]).isEqualTo(value);
        }

        @Test
        void errorCodeEnumIsTheClosedSetPlusTransportCodes() {
            @SuppressWarnings("unchecked")
            List<String> yamlCodes = (List<String>) section("definitions", "ErrorResponse", "properties", "code")
                    .get("enum");
            Set<String> modelCodes = Arrays.stream(ErrorResponse.CodeEnum.values()).map(Enum::name)
                    .collect(Collectors.toCollection(TreeSet::new));
            assertThat(new TreeSet<>(yamlCodes)).isEqualTo(modelCodes);

            Set<String> domainCodes = Arrays.stream(ErrorCode.values()).map(Enum::name)
                    .collect(Collectors.toCollection(TreeSet::new));
            assertThat(yamlCodes).containsAll(domainCodes);
            assertThat(new TreeSet<>(yamlCodes)).isEqualTo(new TreeSet<>(union(domainCodes,
                    Set.of("INVALID_REQUEST", "INTERNAL_ERROR"))));
        }

        private static Set<String> union(Set<String> left, Set<String> right) {
            Set<String> all = new TreeSet<>(left);
            all.addAll(right);
            return all;
        }

        @Test
        void revisionSourceEnumMatchesModel() {
            @SuppressWarnings("unchecked")
            List<String> types = (List<String>) section("definitions", "RevisionSource", "properties", "type").get("enum");
            assertThat(types).containsExactlyInAnyOrder("relay", "manual");
        }
    }

    @Nested
    class SaveAndRead {
        @Test
        void firstSaveReturnsFullRevisionShapedLikeYaml() throws Exception {
            JsonNode revision = saved("shape-page");

            assertThat(keys(revision)).isEqualTo(propertyNames("PageRevision"));
            assertThat(revision.get("revisionId").asText()).matches("^[0-9a-f]{32}$");
            assertThat(revision.get("revisionNumber").asLong()).isEqualTo(1);
            assertThat(revision.get("pageId").asText()).isEqualTo("shape-page");
            assertThat(revision.get("baseRevisionId").isNull()).isTrue();
            assertThat(revision.get("document")).isEqualTo(PageAssetsFixture.inlineReport("shape-page"));
            assertThat(revision.get("contentHash").asText()).hasSize(64);
            assertThat(revision.get("dataContextVersion").asText()).isEqualTo("dcv-1");
            assertThat(keys(revision.get("source"))).isEqualTo(propertyNames("RevisionSource"));
            assertThat(revision.get("source").get("type").asText()).isEqualTo("relay");
            assertThat(revision.get("source").get("skillVersion").asText()).isEqualTo("1.2.0");
            assertThat(revision.get("source").get("runId").isNull()).isTrue();
            assertThat(revision.get("createdBy").asText()).isEqualTo(OPERATOR);
            assertThat(revision.get("createdAt").asText()).matches(CREATED_AT);
        }

        @Test
        void replayIsSameStatusAndSameBody() throws Exception {
            ObjectNode request = firstSaveRequest("replay-page", "k");
            JsonNode first = body(save("replay-page", request));
            MvcResult again = save("replay-page", request);
            assertThat(again.getResponse().getStatus()).isEqualTo(201);
            assertThat(body(again)).isEqualTo(first);
        }

        @Test
        void latestAndExactReadsReturnTheSameShape() throws Exception {
            JsonNode first = saved("read-page");
            ObjectNode next = firstSaveRequest("read-page", "second");
            next.put("baseRevisionId", first.get("revisionId").asText());
            next.putObject("source").put("type", "manual");
            next.putNull("dataContextVersion");
            JsonNode second = body(save("read-page", next));
            assertThat(second.get("revisionNumber").asLong()).isEqualTo(2);
            assertThat(second.get("source").get("type").asText()).isEqualTo("manual");

            MvcResult latest = mvc.perform(withHeaders(get(BASE + "/pages/{pageId}", "read-page"))).andReturn();
            assertThat(latest.getResponse().getStatus()).isEqualTo(200);
            assertThat(body(latest)).isEqualTo(second);

            MvcResult exact = mvc.perform(withHeaders(get(BASE + "/pages/{pageId}/revisions/{revisionId}",
                    "read-page", first.get("revisionId").asText()))).andReturn();
            assertThat(exact.getResponse().getStatus()).isEqualTo(200);
            assertThat(body(exact)).isEqualTo(first);
        }

        @Test
        void listPagesProjectsHeadsWithCursor() throws Exception {
            saved("list-a");
            saved("list-b");
            saved("list-c");
            MvcResult result = mvc.perform(withHeaders(get(BASE + "/pages").param("after", "list-a")
                    .param("limit", "1"))).andReturn();
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            JsonNode list = body(result);
            assertThat(keys(list)).isEqualTo(propertyNames("PageList"));
            assertThat(list.get("pages")).hasSize(1);
            JsonNode item = list.get("pages").get(0);
            assertThat(keys(item)).isEqualTo(propertyNames("PageListItem"));
            assertThat(item.get("pageId").asText()).isEqualTo("list-b");
            assertThat(keys(item.get("latestRevision"))).isEqualTo(propertyNames("RevisionSummary"));
            assertThat(item.get("latestRevision").get("createdAt").asText()).matches(CREATED_AT);
            assertThat(list.get("nextAfter").asText()).isEqualTo("list-b");
        }

        @Test
        void healthcheckIsUp() throws Exception {
            MvcResult result = mvc.perform(get(BASE + "/healthcheck")).andReturn();
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            assertThat(body(result).get("status").asText()).isEqualTo("UP");
        }
    }

    @Nested
    class ErrorEnvelope {
        private JsonNode expectError(MvcResult result, int status, String code) throws Exception {
            assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(status);
            assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
            JsonNode error = body(result);
            assertThat(keys(error)).isEqualTo(propertyNames("ErrorResponse"));
            assertThat(error.get("code").asText()).isEqualTo(code);
            assertThat(error.get("message").asText()).isNotBlank();
            return error;
        }

        @Test
        void confirmationRequiredIs409WithoutDetails() throws Exception {
            ObjectNode request = firstSaveRequest("confirm-page", "k");
            request.put("pageIdConfirmed", false);
            JsonNode error = expectError(save("confirm-page", request), 409, "PAGE_ID_CONFIRMATION_REQUIRED");
            assertThat(error.get("details").isNull()).isTrue();
        }

        @Test
        void revisionConflictIs409WithCurrentLatestRefOnly() throws Exception {
            JsonNode first = saved("conflict-page");
            ObjectNode stale = firstSaveRequest("conflict-page", "stale");
            stale.put("baseRevisionId", "0".repeat(32));
            JsonNode error = expectError(save("conflict-page", stale), 409, "REVISION_CONFLICT");
            JsonNode details = error.get("details");
            assertThat(keys(details)).isEqualTo(propertyNames("RevisionConflictDetails"));
            assertThat(keys(details.get("currentLatest"))).isEqualTo(propertyNames("LatestRevisionRef"));
            assertThat(details.get("currentLatest").get("revisionId")).isEqualTo(first.get("revisionId"));
            assertThat(details.get("currentLatest").get("revisionNumber").asLong()).isEqualTo(1);
        }

        @Test
        void firstSaveWithBaseIs409WithNullCurrentLatest() throws Exception {
            ObjectNode request = firstSaveRequest("fresh-page", "k");
            request.put("baseRevisionId", "0".repeat(32));
            JsonNode error = expectError(save("fresh-page", request), 409, "REVISION_CONFLICT");
            assertThat(error.get("details").get("currentLatest").isNull()).isTrue();
        }

        @Test
        void idempotencyConflictIs409() throws Exception {
            save("idem-page", firstSaveRequest("idem-page", "k"));
            ObjectNode changed = firstSaveRequest("idem-page", "k");
            ((ObjectNode) changed.get("document")).putObject("meta").put("description", "changed");
            JsonNode error = expectError(save("idem-page", changed), 409, "IDEMPOTENCY_CONFLICT");
            assertThat(error.get("details").isNull()).isTrue();
        }

        @Test
        void invalidPageIs422WithContractTypedErrors() throws Exception {
            ObjectNode request = firstSaveRequest("invalid-page", "k");
            ((ObjectNode) request.get("document")).remove("sections");
            JsonNode error = expectError(save("invalid-page", request), 422, "INVALID_PAGE");
            JsonNode details = error.get("details");
            assertThat(keys(details)).isEqualTo(propertyNames("InvalidPageDetails"));
            assertThat(details.get("errors")).isNotEmpty();
            assertThat(keys(details.get("errors").get(0))).isEqualTo(propertyNames("ValidationError"));
            assertThat(details.get("errors").get(0).get("type").asText()).isEqualTo("SCHEMA_ERROR");
            assertThat(details.get("errors").get(0).get("path").asText()).isEqualTo("/sections");
        }

        @Test
        void pageIdMismatchIs422() throws Exception {
            ObjectNode request = firstSaveRequest("mismatch-page", "k");
            ((ObjectNode) request.get("document")).put("id", "another-page");
            expectError(save("mismatch-page", request), 422, "PAGE_ID_MISMATCH");
        }

        @Test
        void notFoundCodesJudgePageBeforeRevision() throws Exception {
            JsonNode first = saved("exists-page");
            expectError(mvc.perform(withHeaders(get(BASE + "/pages/{pageId}", "missing-page"))).andReturn(),
                    404, "PAGE_NOT_FOUND");
            expectError(mvc.perform(withHeaders(get(BASE + "/pages/{pageId}/revisions/{revisionId}", "missing-page",
                    first.get("revisionId").asText()))).andReturn(), 404, "PAGE_NOT_FOUND");
            expectError(mvc.perform(withHeaders(get(BASE + "/pages/{pageId}/revisions/{revisionId}", "exists-page",
                    "f".repeat(32)))).andReturn(), 404, "REVISION_NOT_FOUND");
        }

        @Test
        void missingOperatorHeaderIs400() throws Exception {
            expectError(mvc.perform(get(BASE + "/pages")).andReturn(), 400, "INVALID_REQUEST");
        }

        @Test
        void malformedJsonIs400() throws Exception {
            expectError(mvc.perform(withHeaders(post(BASE + "/pages/{pageId}/revisions", "p"))
                    .contentType(MediaType.APPLICATION_JSON).content("{not json")).andReturn(), 400, "INVALID_REQUEST");
        }

        @Test
        void missingRequiredBodyFieldIs400() throws Exception {
            ObjectNode request = firstSaveRequest("p", "k");
            request.remove("idempotencyKey");
            expectError(save("p", request), 400, "INVALID_REQUEST");
        }

        @Test
        void relaySourceWithoutSkillVersionIs400() throws Exception {
            ObjectNode request = firstSaveRequest("p", "k");
            request.putObject("source").put("type", "relay");
            expectError(save("p", request), 400, "INVALID_REQUEST");
        }

        @Test
        void unknownSourceTypeIs400() throws Exception {
            ObjectNode request = firstSaveRequest("p", "k");
            request.putObject("source").put("type", "robot");
            expectError(save("p", request), 400, "INVALID_REQUEST");
        }

        @Test
        void illFormedPathParametersAre400() throws Exception {
            expectError(mvc.perform(withHeaders(get(BASE + "/pages/{pageId}", "Upper-Case"))).andReturn(),
                    400, "INVALID_REQUEST");
            expectError(mvc.perform(withHeaders(get(BASE + "/pages/{pageId}/revisions/{revisionId}", "p",
                    "not-a-revision"))).andReturn(), 400, "INVALID_REQUEST");
        }

        @Test
        void unknownRouteUsesTheSameEnvelope() throws Exception {
            expectError(mvc.perform(withHeaders(get(BASE + "/nothing"))).andReturn(), 404, "INVALID_REQUEST");
        }

        @Test
        void defaultBasePathIsNotServedWhenOverridden() throws Exception {
            MvcResult result = mvc.perform(withHeaders(get("/rest/cdi/pageassets/v1/pages"))).andReturn();
            assertThat(result.getResponse().getStatus()).isEqualTo(404);
        }
    }
}
