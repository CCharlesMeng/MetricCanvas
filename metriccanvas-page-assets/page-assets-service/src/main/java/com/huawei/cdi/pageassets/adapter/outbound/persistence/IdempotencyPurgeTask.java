package com.huawei.cdi.pageassets.adapter.outbound.persistence;

import com.huawei.cdi.pageassets.application.IdempotencyRetention;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.Objects;

/**
 * 幂等记录 7 天清理任务。单实例进程内定时即可：删除按 `created_at` 索引分批，多副本同时跑也只是重复删空，
 * 不需要分布式锁。间隔与首次延迟由 `pageassets.idempotency.purge-interval` / `purge-initial-delay` 配置。
 */
public final class IdempotencyPurgeTask {
    private static final Logger LOG = LoggerFactory.getLogger(IdempotencyPurgeTask.class);

    private final IdempotencyRetention retention;

    public IdempotencyPurgeTask(IdempotencyRetention retention) {
        this.retention = Objects.requireNonNull(retention, "retention");
    }

    @Scheduled(fixedDelayString = "${pageassets.idempotency.purge-interval:PT1H}",
            initialDelayString = "${pageassets.idempotency.purge-initial-delay:PT1M}")
    public void purge() {
        try {
            int purged = retention.purgeExpired();
            if (purged > 0) {
                LOG.info("已清理过期幂等记录 {} 条", purged);
            }
        } catch (RuntimeException e) {
            LOG.warn("幂等记录清理失败，下个周期重试", e);
        }
    }
}
