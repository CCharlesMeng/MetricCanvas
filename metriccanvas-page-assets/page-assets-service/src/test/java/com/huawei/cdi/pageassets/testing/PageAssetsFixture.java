package com.huawei.cdi.pageassets.testing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huawei.cdi.pageassets.adapter.outbound.contract.ClasspathContractSnapshot;
import com.huawei.cdi.pageassets.adapter.outbound.memory.InMemoryPageStore;
import com.huawei.cdi.pageassets.application.PageAssetService;
import com.huawei.cdi.pageassets.domain.contract.ProductContract;
import com.huawei.cdi.pageassets.domain.page.PageValidator;
import com.huawei.cdi.pageassets.domain.revision.RevisionFactory;
import com.huawei.cdi.pageassets.domain.revision.RevisionIdGenerator;
import com.huawei.cdi.pageassets.domain.revision.RevisionSource;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionPolicy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 领域测试的公共装配：真实契约快照 + 真实校验器 + 内存仓储 + 可控时钟。
 * 合法页面取自共享 conformance 向量，只改 `id` 以匹配目标页面。
 */
public final class PageAssetsFixture {
    public static final Instant T0 = Instant.parse("2026-09-02T10:00:00.000Z");
    public static final String ACTOR = "operator-a";

    private static final ClasspathContractSnapshot SNAPSHOT = new ClasspathContractSnapshot();
    private static final ProductContract CONTRACT = SNAPSHOT.load();
    private static final PageValidator VALIDATOR = new PageValidator(CONTRACT.pageSchema());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public final InMemoryPageStore store = new InMemoryPageStore();
    public final MutableClock clock = new MutableClock(T0);
    public final PageAssetService service = new PageAssetService(store, store, store,
            new SaveRevisionPolicy(VALIDATOR), new RevisionFactory(RevisionIdGenerator.uuidV4(), clock));

    public static PageValidator validator() {
        return VALIDATOR;
    }

    public static ObjectMapper mapper() {
        return MAPPER;
    }

    /** 共享合法样例，改 id 后仍是合法页面（id 不参与任何跨引用）。 */
    public static ObjectNode validPage(String fixture, String pageId) {
        ObjectNode document = (ObjectNode) SNAPSHOT.readJson("page/conformance/valid/" + fixture + ".json").deepCopy();
        document.put("id", pageId);
        return document;
    }

    public static ObjectNode inlineReport(String pageId) {
        return validPage("inline-report", pageId);
    }

    public static SaveRevisionCommand firstSave(String pageId, JsonNode document, String key) {
        return new SaveRevisionCommand(pageId, null, document, key, true,
                RevisionSource.relay("session-1", null, "1.0.0"), "dcv-1");
    }

    public static SaveRevisionCommand nextSave(String pageId, String baseRevisionId, JsonNode document, String key) {
        return new SaveRevisionCommand(pageId, baseRevisionId, document, key, false, RevisionSource.manual(), null);
    }

    public static final class MutableClock extends Clock {
        private final AtomicLong millis;

        public MutableClock(Instant start) {
            this.millis = new AtomicLong(start.toEpochMilli());
        }

        public void advanceMillis(long delta) {
            millis.addAndGet(delta);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis.get());
        }
    }
}
