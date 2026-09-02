package com.huawei.cdi.pageassets.application.port;

import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;

import java.util.List;
import java.util.Optional;

/**
 * 页面与修订的出站 Port。写方法只在 {@link PageWriteTransaction#execute} 的回调内调用，
 * 调用顺序即 ADR-0062 的锁序：插入修订 → 更新 latest 指针。
 */
public interface PageRepository {

    Optional<PageHead> findHead(String pageId);

    Optional<PageRevision> findLatest(String pageId);

    Optional<PageRevision> findRevision(String pageId, String revisionId);

    /** 按 pageId 码点序升序、严格大于 after，最多 limit 条。 */
    List<PageHead> listHeads(String after, int limit);

    void insertRevision(PageRevision revision);

    /** 首保创建页面行，后续保存推进 latest 指针。 */
    void updateLatest(PageHead head);
}
