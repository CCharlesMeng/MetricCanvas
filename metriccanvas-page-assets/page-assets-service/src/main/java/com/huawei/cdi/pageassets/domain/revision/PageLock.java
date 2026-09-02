package com.huawei.cdi.pageassets.domain.revision;

import java.util.Objects;

/**
 * 页面写锁名（ADR-0062 锁序第二步）。与 {@code IdempotencyScope.lockName()} 同理：MySQL `GET_LOCK` 名字上限
 * 64 字符而 pageId 允许 128，因此取 sha256 前缀；内存仓储与 MySQL 仓储都用这一个名字，锁语义只定义一次。
 */
public final class PageLock {
    private static final String PREFIX = "pa:page:";

    private PageLock() {
    }

    public static String lockName(String pageId) {
        Objects.requireNonNull(pageId, "pageId");
        return PREFIX + ContentHash.sha256(pageId).substring(0, 40);
    }
}
