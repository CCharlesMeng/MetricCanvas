package com.huawei.cdi.pageassets.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.domain.catalog.PageCatalogPolicy;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.idempotency.RequestFingerprint;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.revision.ContentHash;
import com.huawei.cdi.pageassets.domain.revision.PageLock;
import com.huawei.cdi.pageassets.domain.revision.RevisionIdGenerator;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;
import com.huawei.cdi.pageassets.testing.PageAssetsFixture;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DomainPolicyTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static JsonNode json(String text) throws Exception {
        return MAPPER.readTree(text);
    }

    @Test
    void canonicalJsonSortsKeysAndUsesJsNumberText() throws Exception {
        JsonNode node = json("{\"b\":[1.0,2.50,1e21,\"x\"],\"a\":{\"d\":null,\"c\":true},\"中\":\"文\\n\"}");
        assertThat(Json.canonical(node))
                .isEqualTo("{\"a\":{\"c\":true,\"d\":null},\"b\":[1,2.5,1e+21,\"x\"],\"中\":\"文\\n\"}");
    }

    @Test
    void contentHashMatchesBaselineSha256OfCanonicalJson() throws Exception {
        // 期望值由 TypeScript 基线 createHash('sha256').update(canonicalizeJson(x)) 得出。
        assertThat(ContentHash.of(json("{\"a\":1}")))
                .isEqualTo("015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862");
        assertThat(ContentHash.of(PageAssetsFixture.validPage("inline-report", "inline-report")))
                .isEqualTo("a77f80bc4a2fafff3b4c34ec48d75ba03b818bb6543c771324b8afac5a681699");
        assertThat(ContentHash.of(json("{\"b\":2,\"a\":1}"))).isEqualTo(ContentHash.of(json("{\"a\":1,\"b\":2}")));
    }

    @Test
    void fingerprintCoversEveryBusinessFieldButNotActor() throws Exception {
        JsonNode document = json("{\"id\":\"p\"}");
        SaveRevisionCommand base = new SaveRevisionCommand("p", null, document, "k", true,
                RevisionSource.relay("s", null, "1.0"), "dcv");
        String fingerprint = RequestFingerprint.of(base);

        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, document, "other-key", true,
                RevisionSource.relay("s", null, "1.0"), "dcv"))).as("幂等键本身不进指纹").isEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("q", null, document, "k", true,
                RevisionSource.relay("s", null, "1.0"), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", "0".repeat(32), document, "k", true,
                RevisionSource.relay("s", null, "1.0"), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, json("{\"id\":\"p\",\"x\":1}"), "k", true,
                RevisionSource.relay("s", null, "1.0"), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, document, "k", false,
                RevisionSource.relay("s", null, "1.0"), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, document, "k", true,
                RevisionSource.manual(), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, document, "k", true,
                RevisionSource.relay("s", "run", "1.0"), "dcv"))).isNotEqualTo(fingerprint);
        assertThat(RequestFingerprint.of(new SaveRevisionCommand("p", null, document, "k", true,
                RevisionSource.relay("s", null, "1.0"), null))).isNotEqualTo(fingerprint);
    }

    @Test
    void relaySourceRequiresSkillVersion() {
        assertThatThrownBy(() -> RevisionSource.relay(null, null, " ")).isInstanceOf(IllegalArgumentException.class);
        assertThat(RevisionSource.relay("", "", "1.0")).isEqualTo(new RevisionSource.Relay(null, null, "1.0"));
        assertThat(RevisionSource.manual().type()).isEqualTo("manual");
    }

    @Test
    void revisionIdsAreThirtyTwoHexChars() {
        RevisionIdGenerator ids = RevisionIdGenerator.uuidV4();
        for (int i = 0; i < 100; i++) {
            assertThat(RevisionIdGenerator.isWellFormed(ids.next())).isTrue();
        }
        assertThat(RevisionIdGenerator.isWellFormed("0123456789ab-cdef")).isFalse();
    }

    @Test
    void idempotencyLockNameFitsMysqlLimit() {
        String name = IdempotencyScope.savePageRevision("a".repeat(128), "k".repeat(200)).lockName();
        assertThat(name.length()).isLessThanOrEqualTo(64);
        assertThat(IdempotencyScope.savePageRevision("a", "k").lockName())
                .isNotEqualTo(IdempotencyScope.savePageRevision("a", "k2").lockName());
    }

    @Test
    void pageLockNameFitsMysqlLimitAndNeverCollidesWithIdempotencyLock() {
        String name = PageLock.lockName("p".repeat(128));
        assertThat(name.length()).isLessThanOrEqualTo(64);
        assertThat(name).startsWith("pa:page:");
        assertThat(PageLock.lockName("a")).isNotEqualTo(PageLock.lockName("b"));
        assertThat(IdempotencyScope.savePageRevision("a", "k").lockName()).startsWith("pa:idem:");
    }

    @Test
    void catalogPolicyIsCodePointOrderStrictCursorAndClampedLimit() {
        List<String> ids = new java.util.ArrayList<>(List.of("b", "a-2", "a", "Z", "1", "a-10"));
        ids.sort(PageCatalogPolicy.PAGE_ID_ORDER);
        assertThat(ids).containsExactly("1", "Z", "a", "a-10", "a-2", "b");
        assertThat(PageCatalogPolicy.afterCursor("a", null)).isTrue();
        assertThat(PageCatalogPolicy.afterCursor("a", "a")).isFalse();
        assertThat(PageCatalogPolicy.afterCursor("a-2", "a")).isTrue();
        assertThat(PageCatalogPolicy.limit(null)).isEqualTo(50);
        assertThat(PageCatalogPolicy.limit(0)).isEqualTo(50);
        assertThat(PageCatalogPolicy.limit(7)).isEqualTo(7);
        assertThat(PageCatalogPolicy.limit(101)).isEqualTo(100);
    }
}
