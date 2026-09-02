package com.huawei.cdi.pageassets.domain.catalog;

import java.util.Comparator;

/**
 * 页面目录游标语义的唯一定义（ADR-0062）：按 `pageId` 码点序升序，游标严格大于，limit 缺省 50、上限 100。
 * MySQL 侧以 `utf8mb4_bin` 对齐（UTF-8 字节序即码点序）；内存侧的排序与游标过滤都必须用这一比较。
 */
public final class PageCatalogPolicy {
    public static final int DEFAULT_LIMIT = 50;
    public static final int MAX_LIMIT = 100;
    public static final Comparator<String> PAGE_ID_ORDER = PageCatalogPolicy::comparePageIds;

    private PageCatalogPolicy() {
    }

    /** 非整数、缺省或小于 1 都按缺省 50；大于上限截到 100（基线 `pageListLimit`）。 */
    public static int limit(Integer requested) {
        if (requested == null || requested < 1) {
            return DEFAULT_LIMIT;
        }
        return Math.min(requested, MAX_LIMIT);
    }

    /** 严格大于游标；游标缺省视为空串（一切 id 都大于它）。 */
    public static boolean afterCursor(String pageId, String after) {
        return comparePageIds(pageId, after == null ? "" : after) > 0;
    }

    public static int comparePageIds(String left, String right) {
        int i = 0;
        int j = 0;
        while (i < left.length() && j < right.length()) {
            int a = left.codePointAt(i);
            int b = right.codePointAt(j);
            if (a != b) {
                return Integer.compare(a, b);
            }
            i += Character.charCount(a);
            j += Character.charCount(b);
        }
        return Integer.compare(left.length() - i, right.length() - j);
    }
}
