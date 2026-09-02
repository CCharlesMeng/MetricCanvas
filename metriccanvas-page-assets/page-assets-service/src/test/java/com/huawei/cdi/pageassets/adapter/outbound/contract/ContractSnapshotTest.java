package com.huawei.cdi.pageassets.adapter.outbound.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.contract.ProductContract;
import com.huawei.cdi.pageassets.domain.page.ErrorType;
import com.huawei.cdi.pageassets.domain.page.document.ValueFormats;
import com.huawei.cdi.pageassets.domain.page.version.VersionPolicy;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 嵌入快照与 contract-lock 对齐，且 Java 侧硬编码的闭集与快照一致。 */
class ContractSnapshotTest {
    private final ProductContract contract = new ClasspathContractSnapshot().load();

    @Test
    void snapshotMatchesLockAndManifest() {
        assertThat(contract.files()).contains("page/schema.json", "page/component-catalog.json",
                "page/error-types.json", "query/error-codes.json", "data-context/schema.json");
        assertThat(contract.pageSchemaVersion()).isEqualTo(VersionPolicy.CURRENT.current());
    }

    @Test
    void errorTypesMatchContract() {
        assertThat(contract.errorTypes())
                .containsExactly(Arrays.stream(ErrorType.values()).map(Enum::name).toArray(String[]::new));
    }

    @Test
    void supportedVersionsMatchSchemaEnum() {
        List<String> declared = new ArrayList<>();
        contract.pageSchema().at("/properties/schemaVersion/enum").forEach(node -> declared.add(node.asText()));
        assertThat(declared).containsExactlyElementsOf(VersionPolicy.CURRENT.supportedVersions());
    }

    @Test
    void valueFormatPresetsMatchSchemaEnum() {
        List<String> declared = new ArrayList<>();
        JsonNode formats = contract.pageSchema().at("/definitions/textValueReference/properties/format/enum");
        formats.forEach(node -> declared.add(node.asText()));
        assertThat(declared).containsExactlyElementsOf(ValueFormats.PRESETS);
    }
}
