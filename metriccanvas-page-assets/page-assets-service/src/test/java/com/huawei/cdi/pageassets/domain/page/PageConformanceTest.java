package com.huawei.cdi.pageassets.domain.page;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.adapter.outbound.contract.ClasspathContractSnapshot;
import com.huawei.cdi.pageassets.domain.contract.ProductContract;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 共享 conformance 向量是门禁（ADR-0062）：Java 校验器在每个向量上的输出必须与 TypeScript
 * 逐条相同（type / path / message 与顺序）。向量由 TypeScript 单向导出，Java 只消费。
 */
class PageConformanceTest {
    private final ClasspathContractSnapshot snapshot = new ClasspathContractSnapshot();
    private final ProductContract contract = snapshot.load();
    private final PageValidator validator = new PageValidator(contract.pageSchema());
    private final ObjectMapper mapper = new ObjectMapper();

    @TestFactory
    Stream<DynamicTest> validVectorsPass() {
        List<String> files = snapshot.conformanceCases("valid");
        assertThat(files).isNotEmpty();
        return files.stream().map(file -> DynamicTest.dynamicTest(file, () -> {
            JsonNode document = snapshot.readJson(file);
            assertThat(validator.validate(document)).as(file).isEmpty();
        }));
    }

    @TestFactory
    Stream<DynamicTest> invalidVectorsMatchExpectedErrors() {
        List<String> files = snapshot.conformanceCases("invalid");
        assertThat(files).isNotEmpty();
        return files.stream().map(file -> DynamicTest.dynamicTest(file, () -> {
            JsonNode vector = snapshot.readJson(file);
            List<TypedError> actual = validator.validate(vector.get("input"));
            List<TypedError> expected = new ArrayList<>();
            for (JsonNode error : vector.get("expected")) {
                expected.add(new TypedError(ErrorType.valueOf(error.get("type").asText()),
                        error.get("path").asText(), error.get("message").asText()));
            }
            assertThat(expected).as("%s 必须是反例", file).isNotEmpty();
            assertThat(actual).as("%s\nexpected=%s\nactual=%s", file, mapper.valueToTree(expected),
                    mapper.valueToTree(actual)).containsExactlyElementsOf(expected);
        }));
    }

    @Test
    void coverageListsEveryInvariantWithBothSides() {
        JsonNode coverage = snapshot.readJson("page/conformance/coverage.json");
        assertThat(coverage.get("invariants").size()).isGreaterThan(0);
        for (JsonNode invariant : coverage.get("invariants")) {
            String id = invariant.get("id").asText();
            assertThat(invariant.get("valid").size()).as("%s 缺少正例", id).isGreaterThan(0);
            assertThat(invariant.get("invalid").size()).as("%s 缺少反例", id).isGreaterThan(0);
        }
    }
}
