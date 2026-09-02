package com.huawei.cdi.pageassets.application;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.error.ErrorCode;
import com.huawei.cdi.pageassets.domain.error.ErrorDetails;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.page.ErrorType;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.revision.ContentHash;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.domain.revision.RevisionIdGenerator;
import com.huawei.cdi.pageassets.domain.revision.RevisionRef;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;
import com.huawei.cdi.pageassets.testing.PageAssetsFixture;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.ACTOR;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.T0;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.firstSave;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.inlineReport;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.nextSave;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.validPage;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 四个用例在内存仓储下的领域测试（ADR-0062 J2）：首保确认、基线冲突、id 不一致、完整复验、
 * 修订构造、指纹幂等、读取顺序与目录游标。
 */
class PageAssetServiceTest {
    private final PageAssetsFixture fx = new PageAssetsFixture();

    private PageRevision saveFirst(String pageId) {
        return fx.service.savePageRevision(firstSave(pageId, inlineReport(pageId), "k-" + pageId), ACTOR);
    }

    private static PageAssetException failure(Runnable action) {
        try {
            action.run();
        } catch (PageAssetException e) {
            return e;
        }
        throw new AssertionError("expected PageAssetException");
    }

    @Nested
    class FirstSave {
        @Test
        void buildsRevisionOneWithHashSourceAndStamp() {
            ObjectNode document = inlineReport("p1");
            PageRevision revision = fx.service.savePageRevision(firstSave("p1", document, "k1"), ACTOR);

            assertThat(revision.revisionNumber()).isEqualTo(1);
            assertThat(RevisionIdGenerator.isWellFormed(revision.revisionId())).isTrue();
            assertThat(revision.pageId()).isEqualTo("p1");
            assertThat(revision.baseRevisionId()).isNull();
            assertThat(revision.document()).isEqualTo(document);
            assertThat(revision.contentHash()).isEqualTo(ContentHash.of(document)).hasSize(64);
            assertThat(revision.dataContextVersion()).isEqualTo("dcv-1");
            assertThat(revision.source()).isEqualTo(RevisionSource.relay("session-1", null, "1.0.0"));
            assertThat(revision.createdBy()).isEqualTo(ACTOR);
            assertThat(revision.createdAt()).isEqualTo(T0);
        }

        @Test
        void requiresExplicitPageIdConfirmation() {
            SaveRevisionCommand unconfirmed = new SaveRevisionCommand("p1", null, inlineReport("p1"), "k1", false,
                    RevisionSource.manual(), null);
            PageAssetException e = failure(() -> fx.service.savePageRevision(unconfirmed, ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.PAGE_ID_CONFIRMATION_REQUIRED);
            assertThat(fx.store.findHead("p1")).isEmpty();
        }

        @Test
        void rejectsNonNullBaseWithConflictAndNullCurrentLatest() {
            SaveRevisionCommand command = new SaveRevisionCommand("p1", "0".repeat(32), inlineReport("p1"), "k1", true,
                    RevisionSource.manual(), null);
            PageAssetException e = failure(() -> fx.service.savePageRevision(command, ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT);
            assertThat(e.details()).containsInstanceOf(ErrorDetails.RevisionConflict.class);
            assertThat(((ErrorDetails.RevisionConflict) e.details().get()).currentLatest()).isNull();
        }

        @Test
        void preconditionRunsBeforeDocumentValidation() {
            ObjectNode broken = inlineReport("p1");
            broken.remove("sections");
            SaveRevisionCommand unconfirmed = new SaveRevisionCommand("p1", null, broken, "k1", false,
                    RevisionSource.manual(), null);
            assertThat(failure(() -> fx.service.savePageRevision(unconfirmed, ACTOR)).code())
                    .isEqualTo(ErrorCode.PAGE_ID_CONFIRMATION_REQUIRED);
        }
    }

    @Nested
    class DocumentChecks {
        @Test
        void invalidPageCarriesContractTypedErrors() {
            ObjectNode broken = inlineReport("p1");
            broken.remove("sections");
            PageAssetException e = failure(() -> fx.service.savePageRevision(firstSave("p1", broken, "k1"), ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.INVALID_PAGE);
            ErrorDetails.InvalidPage details = (ErrorDetails.InvalidPage) e.details().orElseThrow();
            assertThat(details.errors()).isNotEmpty();
            assertThat(details.errors().get(0).type()).isEqualTo(ErrorType.SCHEMA_ERROR);
            assertThat(details.errors().get(0).path()).isEqualTo("/sections");
            assertThat(fx.store.findHead("p1")).isEmpty();
        }

        @Test
        void pageIdMismatchWhenDocumentIdDiffers() {
            PageAssetException e = failure(() ->
                    fx.service.savePageRevision(firstSave("p1", inlineReport("other"), "k1"), ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.PAGE_ID_MISMATCH);
            assertThat(e.getMessage()).contains("p1").contains("other");
        }

        @Test
        void acceptsEverySupportedMinorOfCurrentMajor() {
            for (String fixture : List.of("inline-report", "forecast-page", "compute-page", "filters-page",
                    "composite-page")) {
                ObjectNode document = validPage(fixture, fixture);
                PageRevision revision = fx.service.savePageRevision(firstSave(fixture, document, "k-" + fixture), ACTOR);
                assertThat(revision.document().get("schemaVersion")).isEqualTo(document.get("schemaVersion"));
            }
        }

        @Test
        void rejectsMinorAheadOfCurrent() {
            ObjectNode document = inlineReport("p1");
            document.put("schemaVersion", "5.99");
            PageAssetException e = failure(() -> fx.service.savePageRevision(firstSave("p1", document, "k1"), ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.INVALID_PAGE);
            ErrorDetails.InvalidPage details = (ErrorDetails.InvalidPage) e.details().orElseThrow();
            assertThat(details.errors()).anyMatch(error -> error.path().equals("/schemaVersion"));
        }

        @Test
        void storesSubmittedDocumentNotMaterializedParse() {
            ObjectNode document = validPage("grouped-fields-page", "grouped");
            PageRevision revision = fx.service.savePageRevision(firstSave("grouped", document, "k1"), ACTOR);
            assertThat(Json.canonical(revision.document())).isEqualTo(Json.canonical(document));
        }
    }

    @Nested
    class LinearRevisions {
        @Test
        void appendsOnCurrentLatestAndIncrementsNumber() {
            PageRevision first = saveFirst("p1");
            fx.clock.advanceMillis(1000);
            ObjectNode changed = inlineReport("p1");
            changed.putObject("meta").put("description", "changed");
            PageRevision second = fx.service.savePageRevision(nextSave("p1", first.revisionId(), changed, "k2"), ACTOR);

            assertThat(second.revisionNumber()).isEqualTo(2);
            assertThat(second.baseRevisionId()).isEqualTo(first.revisionId());
            assertThat(second.revisionId()).isNotEqualTo(first.revisionId());
            assertThat(second.source()).isEqualTo(RevisionSource.manual());
            assertThat(second.dataContextVersion()).isNull();
            assertThat(second.createdAt()).isEqualTo(T0.plusSeconds(1));
            assertThat(fx.service.getLatestPage("p1")).isEqualTo(second);
            assertThat(fx.service.getPageRevision("p1", first.revisionId())).isEqualTo(first);
        }

        @Test
        void staleBaseIsConflictCarryingOnlyCurrentLatestRef() {
            PageRevision first = saveFirst("p1");
            PageRevision second = fx.service.savePageRevision(
                    nextSave("p1", first.revisionId(), inlineReport("p1"), "k2"), ACTOR);
            PageAssetException e = failure(() -> fx.service.savePageRevision(
                    nextSave("p1", first.revisionId(), inlineReport("p1"), "k3"), ACTOR));

            assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT);
            ErrorDetails.RevisionConflict details = (ErrorDetails.RevisionConflict) e.details().orElseThrow();
            assertThat(details.currentLatest()).isEqualTo(new RevisionRef(second.revisionId(), 2));
        }

        @Test
        void nullBaseOnExistingPageIsConflict() {
            saveFirst("p1");
            PageAssetException e = failure(() -> fx.service.savePageRevision(
                    firstSave("p1", inlineReport("p1"), "k2"), ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT);
        }
    }

    @Nested
    class Idempotency {
        @Test
        void sameKeySameFingerprintReplaysStoredRevision() {
            SaveRevisionCommand command = firstSave("p1", inlineReport("p1"), "k1");
            PageRevision first = fx.service.savePageRevision(command, ACTOR);
            fx.clock.advanceMillis(5000);
            PageRevision replay = fx.service.savePageRevision(command, ACTOR);

            assertThat(replay).isEqualTo(first);
            assertThat(fx.service.getLatestPage("p1").revisionNumber()).isEqualTo(1);
        }

        @Test
        void replayIsIndifferentToJsonKeyOrder() {
            ObjectNode ordered = inlineReport("p1");
            ObjectNode reordered = PageAssetsFixture.mapper().createObjectNode();
            List<String> keys = Json.keys(ordered);
            for (int i = keys.size() - 1; i >= 0; i--) {
                reordered.set(keys.get(i), ordered.get(keys.get(i)));
            }
            PageRevision first = fx.service.savePageRevision(firstSave("p1", ordered, "k1"), ACTOR);
            PageRevision replay = fx.service.savePageRevision(firstSave("p1", reordered, "k1"), ACTOR);
            assertThat(replay.revisionId()).isEqualTo(first.revisionId());
        }

        @Test
        void sameKeyDifferentFingerprintIsIdempotencyConflict() {
            fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k1"), ACTOR);
            ObjectNode changed = inlineReport("p1");
            changed.putObject("meta").put("description", "changed");
            PageAssetException e = failure(() -> fx.service.savePageRevision(firstSave("p1", changed, "k1"), ACTOR));
            assertThat(e.code()).isEqualTo(ErrorCode.IDEMPOTENCY_CONFLICT);
        }

        @Test
        void keyIsScopedByActor() {
            PageRevision first = fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k1"), ACTOR);
            PageAssetException e = failure(() ->
                    fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k1"), "operator-b"));
            assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT);
            assertThat(fx.service.getLatestPage("p1")).isEqualTo(first);
        }

        @Test
        void failedSaveIsNotRecordedSoRetryReevaluates() {
            SaveRevisionCommand unconfirmed = new SaveRevisionCommand("p1", null, inlineReport("p1"), "k1", false,
                    RevisionSource.manual(), null);
            failure(() -> fx.service.savePageRevision(unconfirmed, ACTOR));
            PageRevision saved = fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k1"), ACTOR);
            assertThat(saved.revisionNumber()).isEqualTo(1);
        }

        @Test
        void recordsExpireAfterSevenDays() {
            fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k1"), ACTOR);
            IdempotencyRecord record = fx.store.find(IdempotencyScope.savePageRevision(ACTOR, "k1")).orElseThrow();
            assertThat(record.expiredAt(T0.plus(Duration.ofDays(7)).minusMillis(1))).isFalse();
            assertThat(record.expiredAt(T0.plus(Duration.ofDays(7)))).isTrue();

            // 清理任务以 now - RETENTION 为 cutoff：未到期不删，到期即删。
            assertThat(fx.store.purgeBefore(T0.plus(Duration.ofDays(7)).minusMillis(1).minus(IdempotencyRecord.RETENTION)))
                    .isZero();
            assertThat(fx.store.purgeBefore(T0.plus(Duration.ofDays(7)).plusMillis(1).minus(IdempotencyRecord.RETENTION)))
                    .isEqualTo(1);
            assertThat(fx.store.find(IdempotencyScope.savePageRevision(ACTOR, "k1"))).isEmpty();
        }
    }

    @Nested
    class Reads {
        @Test
        void latestOfUnknownPageIsPageNotFound() {
            assertThat(failure(() -> fx.service.getLatestPage("nope")).code()).isEqualTo(ErrorCode.PAGE_NOT_FOUND);
        }

        @Test
        void revisionLookupJudgesPageBeforeRevision() {
            PageRevision first = saveFirst("p1");
            assertThat(failure(() -> fx.service.getPageRevision("nope", first.revisionId())).code())
                    .isEqualTo(ErrorCode.PAGE_NOT_FOUND);
            assertThat(failure(() -> fx.service.getPageRevision("p1", "0".repeat(32))).code())
                    .isEqualTo(ErrorCode.REVISION_NOT_FOUND);
        }

        @Test
        void revisionOfAnotherPageIsNotVisible() {
            PageRevision first = saveFirst("p1");
            saveFirst("p2");
            assertThat(failure(() -> fx.service.getPageRevision("p2", first.revisionId())).code())
                    .isEqualTo(ErrorCode.REVISION_NOT_FOUND);
        }
    }

    @Nested
    class Catalog {
        @Test
        void ordersByCodePointAndPagesWithStrictCursor() {
            for (String pageId : List.of("b-page", "a-page", "c-page", "a-page-2", "1-page")) {
                saveFirst(pageId);
            }
            PageCatalogPage first = fx.service.listPages(null, 2);
            assertThat(first.pages()).extracting("pageId").containsExactly("1-page", "a-page");
            assertThat(first.nextAfter()).isEqualTo("a-page");

            PageCatalogPage second = fx.service.listPages(first.nextAfter(), 2);
            assertThat(second.pages()).extracting("pageId").containsExactly("a-page-2", "b-page");
            assertThat(second.nextAfter()).isEqualTo("b-page");

            PageCatalogPage last = fx.service.listPages(second.nextAfter(), 2);
            assertThat(last.pages()).extracting("pageId").containsExactly("c-page");
            assertThat(last.nextAfter()).isNull();
        }

        @Test
        void projectsLatestRevisionOnly() {
            PageRevision first = saveFirst("p1");
            PageRevision second = fx.service.savePageRevision(
                    nextSave("p1", first.revisionId(), inlineReport("p1"), "k2"), ACTOR);
            PageCatalogPage page = fx.service.listPages(null, null);
            assertThat(page.pages()).hasSize(1);
            assertThat(page.pages().get(0).latest()).isEqualTo(second.ref());
            assertThat(page.pages().get(0).latestCreatedAt()).isEqualTo(second.createdAt());
        }

        @Test
        void limitDefaultsToFiftyAndCapsAtHundred() {
            for (int i = 0; i < 120; i++) {
                saveFirst(String.format("page-%03d", i));
            }
            assertThat(fx.service.listPages(null, null).pages()).hasSize(50);
            assertThat(fx.service.listPages(null, 0).pages()).hasSize(50);
            assertThat(fx.service.listPages(null, -5).pages()).hasSize(50);
            assertThat(fx.service.listPages(null, 1000).pages()).hasSize(100);
            assertThat(fx.service.listPages(null, 120).nextAfter()).isEqualTo("page-099");
            assertThat(fx.service.listPages("page-099", 100).pages()).hasSize(20);
        }

        @Test
        void exactlyFullPageHasNoCursor() {
            saveFirst("p1");
            saveFirst("p2");
            PageCatalogPage page = fx.service.listPages(null, 2);
            assertThat(page.pages()).hasSize(2);
            assertThat(page.nextAfter()).isNull();
        }
    }
}
