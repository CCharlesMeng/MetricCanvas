package com.huawei.cdi.pageassets.adapter.outbound.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.IdempotencyMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.PageMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.PageRevisionMapper;
import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.application.port.PageRepository;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * MySQL 仓储（J3，ADR-0062）：三张 `t_pa_*` 表经 MyBatis XML Mapper。写方法只在
 * {@link MySqlPageWriteTransaction#execute} 的回调内被 {@code PageAssetService} 调用，本类不再加锁；
 * 行为基线是 {@code InMemoryPageStore}，两者共用同一组领域测试场景。
 */
public final class MyBatisPageStore implements PageRepository, IdempotencyRepository {
    /** 清理任务每批删除的行数：受 `created_at` 索引约束，避免一条大 DELETE 长期持锁。 */
    static final int PURGE_BATCH_SIZE = 1000;

    private final PageMapper pages;
    private final PageRevisionMapper revisions;
    private final IdempotencyMapper idempotency;
    private final PersistenceRows rows;

    public MyBatisPageStore(PageMapper pages,
                            PageRevisionMapper revisions,
                            IdempotencyMapper idempotency,
                            ObjectMapper json) {
        this.pages = Objects.requireNonNull(pages, "pages");
        this.revisions = Objects.requireNonNull(revisions, "revisions");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency");
        this.rows = new PersistenceRows(json);
    }

    @Override
    public Optional<PageHead> findHead(String pageId) {
        return Optional.ofNullable(pages.selectByPageId(pageId)).map(rows::toHead);
    }

    @Override
    public Optional<PageRevision> findLatest(String pageId) {
        return Optional.ofNullable(revisions.selectLatest(pageId)).map(rows::toRevision);
    }

    @Override
    public Optional<PageRevision> findRevision(String pageId, String revisionId) {
        return Optional.ofNullable(revisions.selectByPageAndRevision(pageId, revisionId)).map(rows::toRevision);
    }

    @Override
    public List<PageHead> listHeads(String after, int limit) {
        return pages.selectAfter(after, limit).stream().map(rows::toHead).toList();
    }

    @Override
    public void insertRevision(PageRevision revision) {
        revisions.insert(rows.toRow(revision));
    }

    @Override
    public void updateLatest(PageHead head) {
        pages.upsertLatest(rows.toRow(head));
    }

    @Override
    public Optional<IdempotencyRecord> find(IdempotencyScope scope) {
        return Optional.ofNullable(idempotency.select(scope.operation(), scope.actorId(), scope.idempotencyKey()))
                .map(rows::toRecord);
    }

    @Override
    public void save(IdempotencyRecord record) {
        idempotency.insert(rows.toRow(record));
    }

    @Override
    public int purgeBefore(Instant cutoff) {
        int total = 0;
        int deleted;
        do {
            deleted = idempotency.deleteCreatedBefore(cutoff, PURGE_BATCH_SIZE);
            total += deleted;
        } while (deleted == PURGE_BATCH_SIZE);
        return total;
    }
}
