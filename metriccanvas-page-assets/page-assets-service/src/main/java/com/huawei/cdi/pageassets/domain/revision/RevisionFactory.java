package com.huawei.cdi.pageassets.domain.revision;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Optional;

/**
 * 构造下一个不可变修订（基线 `buildPageRevision`）：修订号只由当前 latest 推导，内容哈希取规范化文档，
 * Data Context 版本由调用方提供（Java 不反查 Relay 或 DQE）。
 */
public final class RevisionFactory {
    private final RevisionIdGenerator ids;
    private final Clock clock;

    public RevisionFactory(RevisionIdGenerator ids, Clock clock) {
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PageRevision next(SaveRevisionCommand command, JsonNode document, Optional<PageHead> head, String actorId) {
        String revisionId = ids.next();
        if (!RevisionIdGenerator.isWellFormed(revisionId)) {
            throw new IllegalStateException("修订 id 必须是 32 位无横线十六进制:" + revisionId);
        }
        long number = head.map(PageHead::latestRevisionNumber).orElse(0L) + 1;
        Instant now = clock.instant().truncatedTo(ChronoUnit.MILLIS);
        return new PageRevision(
                revisionId,
                number,
                command.pageId(),
                command.baseRevisionId(),
                document.deepCopy(),
                ContentHash.of(document),
                command.dataContextVersion(),
                command.source(),
                actorId,
                now);
    }
}
