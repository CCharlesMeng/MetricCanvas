package com.huawei.cdi.pageassets.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.application.port.PageRepository;
import com.huawei.cdi.pageassets.application.port.PageWriteTransaction;
import com.huawei.cdi.pageassets.domain.catalog.PageCatalogPolicy;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyRecord;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.idempotency.RequestFingerprint;
import com.huawei.cdi.pageassets.domain.revision.PageHead;
import com.huawei.cdi.pageassets.domain.revision.PageRevision;
import com.huawei.cdi.pageassets.domain.revision.RevisionFactory;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionCommand;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionPolicy;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * 四个 Interface 的用例编排（ADR-0062）。保存的事务锁序固定为：
 * 幂等锁 → 页面锁 → 前置检查 → 页面复验 → 插入修订 → 更新 latest 指针 → 保存幂等结果。
 * 幂等只记成功：失败的保存重试时重新判定。
 */
public final class PageAssetService {
    private final PageRepository pages;
    private final IdempotencyRepository idempotency;
    private final PageWriteTransaction transaction;
    private final SaveRevisionPolicy policy;
    private final RevisionFactory revisions;

    public PageAssetService(PageRepository pages,
                            IdempotencyRepository idempotency,
                            PageWriteTransaction transaction,
                            SaveRevisionPolicy policy,
                            RevisionFactory revisions) {
        this.pages = Objects.requireNonNull(pages, "pages");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency");
        this.transaction = Objects.requireNonNull(transaction, "transaction");
        this.policy = Objects.requireNonNull(policy, "policy");
        this.revisions = Objects.requireNonNull(revisions, "revisions");
    }

    public PageRevision savePageRevision(SaveRevisionCommand command, String actorId) {
        Objects.requireNonNull(actorId, "actorId");
        IdempotencyScope scope = IdempotencyScope.savePageRevision(actorId, command.idempotencyKey());
        String fingerprint = RequestFingerprint.of(command);

        return transaction.execute(scope, command.pageId(), () -> {
            Optional<IdempotencyRecord> replay = idempotency.find(scope);
            if (replay.isPresent()) {
                IdempotencyRecord record = replay.get();
                if (!record.matches(fingerprint)) {
                    throw PageAssetException.idempotencyConflict(command.idempotencyKey());
                }
                return pages.findRevision(record.pageId(), record.revisionId())
                        .orElseThrow(() -> new IllegalStateException(
                                "幂等记录指向的修订不存在:" + record.pageId() + "/" + record.revisionId()));
            }

            Optional<PageHead> head = pages.findHead(command.pageId());
            policy.precondition(head, command);
            JsonNode document = policy.checkDocument(command);

            PageRevision revision = revisions.next(command, document, head, actorId);
            pages.insertRevision(revision);
            pages.updateLatest(revision.head());
            idempotency.save(new IdempotencyRecord(scope, fingerprint, revision.pageId(), revision.revisionId(),
                    revision.createdAt()));
            return revision;
        });
    }

    public PageRevision getLatestPage(String pageId) {
        return pages.findLatest(pageId).orElseThrow(() -> PageAssetException.pageNotFound(pageId));
    }

    /** 先判页面再判修订（ADR-0062）。 */
    public PageRevision getPageRevision(String pageId, String revisionId) {
        if (pages.findHead(pageId).isEmpty()) {
            throw PageAssetException.pageNotFound(pageId);
        }
        return pages.findRevision(pageId, revisionId)
                .orElseThrow(() -> PageAssetException.revisionNotFound(revisionId));
    }

    public PageCatalogPage listPages(String after, Integer requestedLimit) {
        int limit = PageCatalogPolicy.limit(requestedLimit);
        List<PageHead> heads = pages.listHeads(after, limit + 1);
        boolean more = heads.size() > limit;
        List<PageHead> selected = more ? heads.subList(0, limit) : heads;
        String nextAfter = more ? selected.get(selected.size() - 1).pageId() : null;
        return new PageCatalogPage(selected, nextAfter);
    }
}
