package com.huawei.cdi.pageassets.application.port;

import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;

import java.util.function.Supplier;

/**
 * 保存写路径的临界区（ADR-0062 锁序的前两步）：先取幂等锁，再取页面锁，然后在同一事务内执行 body。
 * 实现负责锁的获取顺序、事务边界与释放；MySQL 侧用 `GET_LOCK` 会话锁，不保留基线的 mutex 行表。
 */
public interface PageWriteTransaction {

    <T> T execute(IdempotencyScope scope, String pageId, Supplier<T> body);
}
