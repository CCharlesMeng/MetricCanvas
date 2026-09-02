package com.huawei.cdi.pageassets.adapter.outbound.memory;

import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.application.port.PageRepository;
import com.huawei.cdi.pageassets.application.port.PageWriteTransaction;
import com.huawei.cdi.pageassets.domain.catalog.PageCatalogPolicy;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * 进程内仓储：领域测试与无 MySQL 的本地体验用，重启即空。锁序与 MySQL 侧一致（幂等锁 → 页面锁），
 * 排序与游标过滤都走 {@link PageCatalogPolicy}。J3 的 MyBatis 适配器实现同一组 Port。
 */
public final class InMemoryPageStore implements PageRepository, IdempotencyRepository, PageWriteTransaction {
    private final ConcurrentSkipListMap<String, PageState> pages =
            new ConcurrentSkipListMap<>(PageCatalogPolicy.PAGE_ID_ORDER);
    private final ConcurrentHashMap<IdempotencyScope, IdempotencyRecord> idempotency = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> idempotencyLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> pageLocks = new ConcurrentHashMap<>();

    private static final class PageState {
        private PageHead head;
        private final Map<String, PageRevision> revisions = new LinkedHashMap<>();
    }

    @Override
    public <T> T execute(IdempotencyScope scope, String pageId, Supplier<T> body) {
        ReentrantLock idempotencyLock = idempotencyLocks.computeIfAbsent(scope.lockName(), k -> new ReentrantLock());
        idempotencyLock.lock();
        try {
            ReentrantLock pageLock = pageLocks.computeIfAbsent(pageId, k -> new ReentrantLock());
            pageLock.lock();
            try {
                return body.get();
            } finally {
                pageLock.unlock();
            }
        } finally {
            idempotencyLock.unlock();
        }
    }

    @Override
    public Optional<PageHead> findHead(String pageId) {
        PageState state = pages.get(pageId);
        if (state == null) {
            return Optional.empty();
        }
        synchronized (state) {
            return Optional.ofNullable(state.head);
        }
    }

    @Override
    public Optional<PageRevision> findLatest(String pageId) {
        PageState state = pages.get(pageId);
        if (state == null) {
            return Optional.empty();
        }
        synchronized (state) {
            return state.head == null ? Optional.empty()
                    : Optional.ofNullable(state.revisions.get(state.head.latestRevisionId()));
        }
    }

    @Override
    public Optional<PageRevision> findRevision(String pageId, String revisionId) {
        PageState state = pages.get(pageId);
        if (state == null) {
            return Optional.empty();
        }
        synchronized (state) {
            return Optional.ofNullable(state.revisions.get(revisionId));
        }
    }

    @Override
    public List<PageHead> listHeads(String after, int limit) {
        List<PageHead> result = new ArrayList<>();
        for (Map.Entry<String, PageState> entry : pages.entrySet()) {
            if (result.size() >= limit) {
                break;
            }
            if (!PageCatalogPolicy.afterCursor(entry.getKey(), after)) {
                continue;
            }
            PageState state = entry.getValue();
            synchronized (state) {
                if (state.head != null) {
                    result.add(state.head);
                }
            }
        }
        return result;
    }

    @Override
    public void insertRevision(PageRevision revision) {
        PageState state = pages.computeIfAbsent(revision.pageId(), k -> new PageState());
        synchronized (state) {
            if (state.revisions.putIfAbsent(revision.revisionId(), revision) != null) {
                throw new IllegalStateException("修订 id 重复:" + revision.revisionId());
            }
            for (PageRevision existing : state.revisions.values()) {
                if (existing != revision && existing.revisionNumber() == revision.revisionNumber()) {
                    throw new IllegalStateException("(page_id, revision_number) 重复:" + revision.pageId()
                            + "/" + revision.revisionNumber());
                }
            }
        }
    }

    @Override
    public void updateLatest(PageHead head) {
        PageState state = pages.computeIfAbsent(head.pageId(), k -> new PageState());
        synchronized (state) {
            state.head = head;
        }
    }

    @Override
    public Optional<IdempotencyRecord> find(IdempotencyScope scope) {
        return Optional.ofNullable(idempotency.get(scope));
    }

    @Override
    public void save(IdempotencyRecord record) {
        idempotency.put(record.scope(), record);
    }

    @Override
    public int purgeBefore(Instant cutoff) {
        int before = idempotency.size();
        idempotency.values().removeIf(record -> record.createdAt().isBefore(cutoff));
        return before - idempotency.size();
    }
}
