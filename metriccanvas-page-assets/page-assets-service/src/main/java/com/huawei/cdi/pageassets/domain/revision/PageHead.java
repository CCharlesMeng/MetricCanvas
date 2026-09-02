package com.huawei.cdi.pageassets.domain.revision;

import java.time.Instant;
import java.util.Objects;

/**
 * 页面的 latest 指针：`listPages` 的投影，也是保存时的并发基线。页面一旦存在就至少有一个修订。
 */
public record PageHead(String pageId, String latestRevisionId, long latestRevisionNumber, Instant latestCreatedAt) {
    public PageHead {
        Objects.requireNonNull(pageId, "pageId");
        Objects.requireNonNull(latestRevisionId, "latestRevisionId");
        Objects.requireNonNull(latestCreatedAt, "latestCreatedAt");
    }

    public RevisionRef latest() {
        return new RevisionRef(latestRevisionId, latestRevisionNumber);
    }
}
