package com.huawei.cdi.pageassets.application;

import com.huawei.cdi.pageassets.domain.revision.PageHead;

import java.util.List;

/** `listPages` 的一页：投影 `{ pageId, latestRevision }` 与下一页游标（无下一页为 null）。 */
public record PageCatalogPage(List<PageHead> pages, String nextAfter) {
    public PageCatalogPage {
        pages = List.copyOf(pages);
    }
}
