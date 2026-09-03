package com.huawei.cdi.pageassets.adapter.outbound.persistence;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.application.IdempotencyRetention;
import com.huawei.cdi.pageassets.application.PageAssetService;
import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.application.port.PageRepository;
import com.huawei.cdi.pageassets.domain.catalog.PageCatalogPolicy;
import com.huawei.cdi.pageassets.domain.error.ErrorCode;
import com.huawei.cdi.pageassets.domain.error.ErrorDetails;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageLock;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.testing.MySqlTestDatabase;
import com.huawei.cdi.pageassets.testing.PageAssetsFixture;
import com.huawei.cdi.pageassets.testing.TestApplication;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * J3 完成条件（ADR-0062）：真实 MySQL 上并发保存、幂等重放、冲突、游标与 `utf8mb4_bin` 排序；
 * 重复启动只 `validate` 不改表。场景与 {@code PageAssetServiceTest} / {@code ConcurrentSaveTest} 对齐，
 * 那两者在内存仓储上定义行为，这里证明 MyBatis 仓储与 `GET_LOCK` 锁序给出同一结果。
 * MySQL 来源见 {@link MySqlTestDatabase}；没有 Docker 与测试库时整类跳过。
 */
@ExtendWith(MySqlTestDatabase.Condition.class)
@SpringBootTest(classes = TestApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "pageassets.store=mysql",
        "pageassets.base-path=/rest/cdi/pageassets/v1",
        // 与生产缺省相同：16 路同键重放要在锁上串行排队，2s 会让排在末尾的请求误判为锁超时。
        "pageassets.db.lock-timeout-seconds=10",
        "pageassets.idempotency.purge-initial-delay=PT1H",
        "spring.flyway.enabled=false"
})
class MySqlPageStoreIntegrationTest {
    private static final int THREADS = 16;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        MySqlTestDatabase.Endpoint endpoint = MySqlTestDatabase.endpoint();
        if (endpoint == null) {
            return;
        }
        registry.add("pageassets.db.url", endpoint::url);
        registry.add("pageassets.db.username", endpoint::username);
        registry.add("pageassets.db.password", endpoint::password);
    }

    @Autowired
    private PageAssetService service;
    @Autowired
    private PageRepository pages;
    @Autowired
    private IdempotencyRepository idempotency;
    @Autowired
    private IdempotencyRetention retention;
    @Autowired
    @Qualifier("pageAssetsFlyway")
    private Flyway flyway;
    @Autowired
    @Qualifier("pageAssetsDataSource")
    private DataSource dataSource;
    @Autowired
    private MockMvc mvc;

    private JdbcTemplate jdbc;

    @BeforeEach
    void cleanTables() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM t_pa_idempotency");
        jdbc.update("DELETE FROM t_pa_page");
        jdbc.update("DELETE FROM t_pa_page_revision");
    }

    // ---- Schema 与 Flyway ----

    @Test
    void flywayUsesOwnHistoryTableAndRestartOnlyValidates() {
        Integer history = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                Integer.class, "flyway_page_assets_history");
        assertThat(history).isEqualTo(1);
        assertThat(flyway.info().applied()).extracting(info -> info.getVersion().getVersion())
                .contains("1.0.0.1");

        MigrateResult again = flyway.migrate();
        assertThat(again.migrationsExecuted).isZero();
        flyway.validate();
    }

    @Test
    void tablesAreUtf8mb4BinWithMillisecondTime() {
        List<Map<String, Object>> tables = jdbc.queryForList(
                "SELECT table_name AS name, table_collation AS collation FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name LIKE 't\\_pa\\_%' ORDER BY table_name");
        assertThat(tables).extracting(row -> String.valueOf(row.get("name")))
                .containsExactly("t_pa_idempotency", "t_pa_page", "t_pa_page_revision");
        assertThat(tables).extracting(row -> String.valueOf(row.get("collation")))
                .containsOnly("utf8mb4_bin");

        String documentType = jdbc.queryForObject(
                "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 't_pa_page_revision' AND column_name = 'document'", String.class);
        assertThat(documentType).isEqualTo("mediumtext");
        String createdAtType = jdbc.queryForObject(
                "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 't_pa_page_revision' AND column_name = 'created_at'", String.class);
        assertThat(createdAtType).isEqualTo("datetime(3)");
    }

    // ---- 保存与读取 ----

    @Test
    void firstSaveRoundTripsThroughMySql() {
        ObjectNode document = inlineReport("p1");
        document.putObject("meta").put("description", "四字节字符 😀 与 中文");
        PageRevision saved = service.savePageRevision(firstSave("p1", document, "p1:k1"), ACTOR);

        assertThat(saved.revisionNumber()).isEqualTo(1);
        assertThat(saved.createdAt()).isEqualTo(saved.createdAt().truncatedTo(ChronoUnit.MILLIS));

        PageRevision latest = service.getLatestPage("p1");
        assertThat(latest).isEqualTo(saved);
        assertThat(latest.document()).isEqualTo(document);
        assertThat(latest.source()).isEqualTo(RevisionSource.relay("session-1", null, "1.0.0"));
        assertThat(latest.dataContextVersion()).isEqualTo("dcv-1");
        assertThat(service.getPageRevision("p1", saved.revisionId())).isEqualTo(saved);

        PageRevision second = service.savePageRevision(nextSave("p1", saved.revisionId(), document, "p1:k2"), ACTOR);
        assertThat(second.revisionNumber()).isEqualTo(2);
        assertThat(second.baseRevisionId()).isEqualTo(saved.revisionId());
        assertThat(second.source()).isEqualTo(RevisionSource.manual());
        assertThat(second.dataContextVersion()).isNull();
        assertThat(service.getLatestPage("p1")).isEqualTo(second);
        assertThat(service.getPageRevision("p1", saved.revisionId())).isEqualTo(saved);
    }

    @Test
    void staleBaseIsRevisionConflictCarryingCurrentLatest() {
        PageRevision first = service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k1"), ACTOR);
        PageRevision second = service.savePageRevision(
                nextSave("p1", first.revisionId(), inlineReport("p1"), "p1:k2"), ACTOR);

        assertThatThrownBy(() -> service.savePageRevision(
                nextSave("p1", first.revisionId(), inlineReport("p1"), "p1:k3"), ACTOR))
                .isInstanceOfSatisfying(PageAssetException.class, e -> {
                    assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT);
                    assertThat(e.details()).contains(new ErrorDetails.RevisionConflict(second.ref()));
                });
        assertThat(countRows("t_pa_page_revision")).isEqualTo(2);
        assertThat(countRows("t_pa_idempotency")).as("失败不记幂等").isEqualTo(2);
    }

    @Test
    void replaySameKeyReturnsSameRevisionAndDifferentFingerprintConflicts() {
        ObjectNode document = inlineReport("p1");
        PageRevision saved = service.savePageRevision(firstSave("p1", document, "p1:k1"), ACTOR);
        PageRevision replayed = service.savePageRevision(firstSave("p1", document, "p1:k1"), ACTOR);
        assertThat(replayed).isEqualTo(saved);
        assertThat(countRows("t_pa_page_revision")).isEqualTo(1);

        ObjectNode changed = inlineReport("p1");
        changed.putObject("meta").put("description", "changed");
        assertThatThrownBy(() -> service.savePageRevision(firstSave("p1", changed, "p1:k1"), ACTOR))
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.IDEMPOTENCY_CONFLICT));

        assertThatThrownBy(() -> service.savePageRevision(firstSave("p1", document, "p1:k1"), "operator-b"))
                .as("作用域含 actorId：另一位 actor 用同键不是重放，而是无基线的首保冲突")
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.REVISION_CONFLICT));
    }

    @Test
    void invalidDocumentIsRejectedAndLeavesNoRows() {
        ObjectNode broken = inlineReport("p1");
        broken.remove("schemaVersion");
        assertThatThrownBy(() -> service.savePageRevision(firstSave("p1", broken, "p1:k1"), ACTOR))
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.INVALID_PAGE));
        assertThat(countRows("t_pa_page")).isZero();
        assertThat(countRows("t_pa_page_revision")).isZero();
        assertThat(countRows("t_pa_idempotency")).isZero();

        PageRevision saved = service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k1"), ACTOR);
        assertThat(saved.revisionNumber()).as("失败后同键重试重新判定").isEqualTo(1);
    }

    @Test
    void readsFollowNotFoundSemantics() {
        assertThatThrownBy(() -> service.getLatestPage("missing"))
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.PAGE_NOT_FOUND));
        PageRevision saved = service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k1"), ACTOR);
        assertThatThrownBy(() -> service.getPageRevision("p1", "0".repeat(32)))
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.REVISION_NOT_FOUND));
        assertThatThrownBy(() -> service.getPageRevision("other", saved.revisionId()))
                .as("修订属于别的页面时先判页面")
                .isInstanceOfSatisfying(PageAssetException.class,
                        e -> assertThat(e.code()).isEqualTo(ErrorCode.PAGE_NOT_FOUND));
    }

    // ---- 并发与锁 ----

    @Test
    void sameBaseConcurrentSavesYieldExactlyOneWinner() throws Exception {
        PageRevision first = service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k0"), ACTOR);
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            ObjectNode document = inlineReport("p1");
            document.putObject("meta").put("description", "writer-" + i);
            String key = "p1:writer-" + i;
            tasks.add(() -> service.savePageRevision(nextSave("p1", first.revisionId(), document, key), ACTOR));
        }

        List<Outcome<PageRevision>> outcomes = race(tasks);
        List<Outcome<PageRevision>> winners = outcomes.stream().filter(o -> o.failure() == null).toList();
        assertThat(winners).hasSize(1);
        assertThat(outcomes.stream().filter(o -> o.failure() != null).map(o -> o.failure().code())
                .collect(Collectors.toSet())).containsExactly(ErrorCode.REVISION_CONFLICT);
        assertThat(service.getLatestPage("p1")).isEqualTo(winners.get(0).value());
        assertThat(countRows("t_pa_page_revision")).isEqualTo(2);
    }

    @Test
    void sameKeyConcurrentReplaysPersistOneRevision() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            tasks.add(() -> service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:same"), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes).allMatch(o -> o.failure() == null);
        assertThat(outcomes.stream().map(o -> o.value().revisionId()).distinct()).hasSize(1);
        assertThat(countRows("t_pa_page_revision")).isEqualTo(1);
        assertThat(countRows("t_pa_idempotency")).isEqualTo(1);
    }

    @Test
    void concurrentFirstSavesYieldOneRevisionOne() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            String key = "p1:first-" + i;
            tasks.add(() -> service.savePageRevision(firstSave("p1", inlineReport("p1"), key), ACTOR));
        }
        List<Outcome<PageRevision>> outcomes = race(tasks);
        assertThat(outcomes.stream().filter(o -> o.failure() == null)).hasSize(1);
        assertThat(outcomes.stream().filter(o -> o.failure() != null))
                .allMatch(o -> o.failure().code() == ErrorCode.REVISION_CONFLICT);
        assertThat(service.getLatestPage("p1").revisionNumber()).isEqualTo(1);
    }

    @Test
    void independentPagesAllSucceedConcurrently() throws Exception {
        List<Callable<PageRevision>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            String pageId = "page-" + i;
            tasks.add(() -> service.savePageRevision(firstSave(pageId, inlineReport(pageId), "k-" + pageId), ACTOR));
        }
        assertThat(race(tasks)).allMatch(o -> o.failure() == null);
        assertThat(service.listPages(null, 100).pages()).hasSize(THREADS);
    }

    @Test
    void heldPageLockTimesOutInsteadOfWritingPastIt() throws Exception {
        // 用裸连接而不是池连接持锁：池连接 close() 只是归还，会话锁会随连接留在池里被下一位借用者"继承"，
        // 造成看似无解释的 GET_LOCK 死锁——这也是生产侧 MySqlPageWriteTransaction 必须在 finally 里 RELEASE 的原因。
        MySqlTestDatabase.Endpoint endpoint = MySqlTestDatabase.endpoint();
        try (Connection foreign = DriverManager.getConnection(endpoint.url(), endpoint.username(), endpoint.password());
             PreparedStatement lock = foreign.prepareStatement("SELECT GET_LOCK(?, 0)")) {
            lock.setString(1, PageLock.lockName("p1"));
            try (ResultSet rs = lock.executeQuery()) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt(1)).isEqualTo(1);
            }

            assertThatThrownBy(() -> service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k1"), ACTOR))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("超时");
            assertThat(countRows("t_pa_page_revision")).isZero();
        }
        // 外部会话关闭即释放会话锁；之后保存恢复正常。
        assertThat(service.savePageRevision(firstSave("p1", inlineReport("p1"), "p1:k1"), ACTOR).revisionNumber())
                .isEqualTo(1);
    }

    // ---- 目录与排序 ----

    @Test
    void listPagesOrdersByCodePointWithStrictCursor() {
        Instant now = Instant.parse("2026-09-02T10:00:00.000Z");
        List<String> ids = List.of("b", "a-1", "a1", "a", "Z", "z", "ä", "😀", "B", "10", "9");
        for (String id : ids) {
            pages.updateLatest(new PageHead(id, "0".repeat(32), 1, now));
        }
        List<String> expected = ids.stream().sorted(PageCatalogPolicy.PAGE_ID_ORDER).toList();
        assertThat(expected).as("码点序：大写 < 小写 < 带音标 < 表情；'a' < 'a-1' < 'a1'")
                .containsExactly("10", "9", "B", "Z", "a", "a-1", "a1", "b", "z", "ä", "😀");

        assertThat(service.listPages(null, 100).pages()).extracting(PageHead::pageId).containsExactlyElementsOf(expected);

        var page1 = service.listPages(null, 4);
        assertThat(page1.pages()).extracting(PageHead::pageId).containsExactly("10", "9", "B", "Z");
        assertThat(page1.nextAfter()).isEqualTo("Z");
        var page2 = service.listPages(page1.nextAfter(), 4);
        assertThat(page2.pages()).extracting(PageHead::pageId).containsExactly("a", "a-1", "a1", "b");
        var page3 = service.listPages(page2.nextAfter(), 4);
        assertThat(page3.pages()).extracting(PageHead::pageId).containsExactly("z", "ä", "😀");
        assertThat(page3.nextAfter()).isNull();
        assertThat(service.listPages("a", 100).pages()).extracting(PageHead::pageId).first().isEqualTo("a-1");
    }

    // ---- 幂等记录保留 ----

    @Test
    void purgeRemovesOnlyRecordsPastRetention() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        IdempotencyScope stale = IdempotencyScope.savePageRevision(ACTOR, "stale");
        IdempotencyScope fresh = IdempotencyScope.savePageRevision(ACTOR, "fresh");
        idempotency.save(new IdempotencyRecord(stale, "f".repeat(64), "p1", "0".repeat(32),
                now.minus(IdempotencyRecord.RETENTION).minus(Duration.ofMinutes(1))));
        idempotency.save(new IdempotencyRecord(fresh, "f".repeat(64), "p1", "0".repeat(32),
                now.minus(IdempotencyRecord.RETENTION).plus(Duration.ofMinutes(1))));

        assertThat(retention.purgeExpired()).isEqualTo(1);
        assertThat(idempotency.find(stale)).isEmpty();
        assertThat(idempotency.find(fresh)).isPresent();
        assertThat(retention.purgeExpired()).isZero();
    }

    // ---- REST 通路（真实 delegate + MySQL 仓储） ----

    @Test
    void restPathWorksOnMySqlStore() throws Exception {
        ObjectNode document = inlineReport("rest-page");
        String body = PageAssetsFixture.mapper().createObjectNode()
                .putNull("baseRevisionId")
                .put("idempotencyKey", "rest-page:k1")
                .put("pageIdConfirmed", true)
                .put("dataContextVersion", "dcv-1")
                .<ObjectNode>set("document", document)
                .<ObjectNode>set("source", PageAssetsFixture.mapper().createObjectNode()
                        .put("type", "relay").put("skillVersion", "1.0.0"))
                .toString();
        mvc.perform(post("/rest/cdi/pageassets/v1/pages/rest-page/revisions")
                        .header("X-Operator-Id", ACTOR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.revisionNumber").value(1));
        mvc.perform(get("/rest/cdi/pageassets/v1/pages/rest-page").header("X-Operator-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageId").value("rest-page"));
        mvc.perform(get("/rest/cdi/pageassets/v1/pages").header("X-Operator-Id", ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pages[0].pageId").value("rest-page"));
    }

    // ---- helpers ----

    private int countRows(String table) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
        return count == null ? 0 : count;
    }

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
                outcomes.add(future.get(60, TimeUnit.SECONDS));
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
}
