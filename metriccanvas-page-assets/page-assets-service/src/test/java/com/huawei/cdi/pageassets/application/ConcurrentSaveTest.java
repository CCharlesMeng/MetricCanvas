package com.huawei.cdi.pageassets.application;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.domain.error.ErrorCode;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.testing.PageAssetsFixture;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.ACTOR;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.firstSave;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.inlineReport;
import static com.huawei.cdi.pageassets.testing.PageAssetsFixture.nextSave;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * 并发不变量：同基线并发保存只有一个成功，其余 `REVISION_CONFLICT`；同键并发重放只落一个修订；
 * 首保并发只有一个成功。内存仓储的锁序（幂等锁 → 页面锁）是 MySQL 侧 `GET_LOCK` 的行为基线。
 */
class ConcurrentSaveTest {
    private static final int THREADS = 16;

    private final PageAssetsFixture fx = new PageAssetsFixture();

    private static <T> List<Outcome<T>> race(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Outcome<T>>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    try {
                        return Outcome.ok(task.call());
                    } catch (PageAssetException e) {
                        return Outcome.<T>failed(e);
                    }
                }));
            }
            start.countDown();
            List<Outcome<T>> outcomes = new ArrayList<>();
            for (Future<Outcome<T>> future : futures) {
                outcomes.add(future.get(30, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    record Outcome<T>(T value, PageAssetException failure) {
        static <T> Outcome<T> ok(T value) {
            return new Outcome<>(value, null);
        }

        static <T> Outcome<T> failed(PageAssetException failure) {
            return new Outcome<>(null, failure);
        }
    }

    @Test
    void sameBaseConcurrentSavesYieldExactlyOneWinner() throws Exception {
        PageRevision first = fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "k0"), ACTOR);
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            ObjectNode document = inlineReport("p1");
            document.putObject("meta").put("description", "writer-" + i);
            tasks.add(() -> fx.service.savePageRevision(nextSave("p1", first.revisionId(), document, "k-" + document
                    .get("meta").get("description").asText()), ACTOR));
        }

        List<Outcome<PageRevision>> outcomes = race(tasks);
        List<Outcome<PageRevision>> winners = outcomes.stream().filter(o -> o.failure() == null).toList();
        assertThat(winners).hasSize(1);
        assertThat(outcomes.stream().filter(o -> o.failure() != null).map(o -> o.failure().code())
                .collect(Collectors.toSet())).containsExactly(ErrorCode.REVISION_CONFLICT);
        assertThat(fx.service.getLatestPage("p1").revisionNumber()).isEqualTo(2);
        assertThat(fx.service.getLatestPage("p1")).isEqualTo(winners.get(0).value());
    }

    @Test
    void sameKeyConcurrentReplaysPersistOneRevision() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            tasks.add(() -> fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), "same-key"), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes).allMatch(o -> o.failure() == null);
        assertThat(outcomes.stream().map(o -> o.value().revisionId()).distinct()).hasSize(1);
        assertThat(fx.service.getLatestPage("p1").revisionNumber()).isEqualTo(1);
    }

    @Test
    void concurrentFirstSavesYieldOneRevisionOne() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            String key = "first-" + i;
            tasks.add(() -> fx.service.savePageRevision(firstSave("p1", inlineReport("p1"), key), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes.stream().filter(o -> o.failure() == null)).hasSize(1);
        assertThat(outcomes.stream().filter(o -> o.failure() != null))
                .allMatch(o -> o.failure().code() == ErrorCode.REVISION_CONFLICT);
        assertThat(fx.service.getLatestPage("p1").revisionNumber()).isEqualTo(1);
    }

    @Test
    void sameKeyAcrossPagesIsIdempotencyConflict() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            String pageId = "page-" + i;
            tasks.add(() -> fx.service.savePageRevision(firstSave(pageId, inlineReport(pageId), "k"), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes.stream().filter(o -> o.failure() == null)).hasSize(1);
        assertThat(outcomes.stream().filter(o -> o.failure() != null))
                .allMatch(o -> o.failure().code() == ErrorCode.IDEMPOTENCY_CONFLICT);
        assertThat(fx.service.listPages(null, 100).pages()).hasSize(1);
    }

    @Test
    void independentPagesAllSucceed() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            String pageId = "page-" + i;
            tasks.add(() -> fx.service.savePageRevision(firstSave(pageId, inlineReport(pageId), "k-" + pageId), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes).allMatch(o -> o.failure() == null);
        assertThat(fx.service.listPages(null, 100).pages()).hasSize(THREADS);
    }
}
