package com.huawei.cdi.pageassets.adapter.outbound.persistence;

import com.alibaba.druid.pool.DruidPooledConnection;
import com.huawei.cdi.pageassets.application.port.PageWriteTransaction;
import com.huawei.cdi.pageassets.domain.idempotency.IdempotencyScope;
import com.huawei.cdi.pageassets.domain.revision.PageLock;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * 保存写路径的临界区（ADR-0062）：`GET_LOCK` 先取幂等锁再取页面锁，然后在一个数据库事务里执行 body。
 *
 * <p>会话锁与事务用**两条连接**：锁连接只做 GET_LOCK / RELEASE_LOCK，事务连接由 {@link TransactionTemplate}
 * 管理。原因是锁必须在事务**提交之后**才释放——若在同一连接上先 RELEASE 再 COMMIT，下一位持锁者会读到旧 latest、
 * 走完前置判定后撞 `(page_id, revision_number)` 唯一键，得到 500 而不是 409；而 Spring 在 commit 之后
 * 已把事务连接还回池子，没有干净的时机在它上面 RELEASE。代价是一次保存占两条池连接，maxActive 配 100 足够。
 *
 * <p>GET_LOCK 超时返回 0、出错返回 NULL，二者都视为临界区不可进入，抛 {@link IllegalStateException}（500）；
 * 不映射为业务错误码，因为它不是调用方能修正的状态。
 */
public final class MySqlPageWriteTransaction implements PageWriteTransaction {
    private final DataSource dataSource;
    private final TransactionTemplate transaction;
    private final int lockTimeoutSeconds;

    public MySqlPageWriteTransaction(DataSource dataSource,
                                     PlatformTransactionManager transactionManager,
                                     int lockTimeoutSeconds) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        this.transaction = new TransactionTemplate(Objects.requireNonNull(transactionManager, "transactionManager"));
        if (lockTimeoutSeconds < 1) {
            throw new IllegalArgumentException("lockTimeoutSeconds 至少 1 秒");
        }
        this.lockTimeoutSeconds = lockTimeoutSeconds;
    }

    @Override
    public <T> T execute(IdempotencyScope scope, String pageId, Supplier<T> body) {
        String idempotencyLock = scope.lockName();
        String pageLock = PageLock.lockName(pageId);
        try (Connection lockSession = dataSource.getConnection()) {
            acquire(lockSession, idempotencyLock);
            try {
                acquire(lockSession, pageLock);
                try {
                    return transaction.execute(status -> body.get());
                } finally {
                    release(lockSession, pageLock);
                }
            } finally {
                release(lockSession, idempotencyLock);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("页面写锁会话不可用", e);
        }
    }

    private void acquire(Connection session, String name) throws SQLException {
        try (PreparedStatement statement = session.prepareStatement("SELECT GET_LOCK(?, ?)")) {
            statement.setString(1, name);
            statement.setInt(2, lockTimeoutSeconds);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalStateException("GET_LOCK 无返回:" + name);
                }
                int acquired = result.getInt(1);
                if (result.wasNull()) {
                    throw new IllegalStateException("GET_LOCK 出错:" + name);
                }
                if (acquired != 1) {
                    throw new IllegalStateException("等待页面写锁超时(" + lockTimeoutSeconds + "s):" + name);
                }
            }
        }
    }

    /**
     * 会话锁跟着连接走：池连接 close() 只是归还，若 RELEASE 失败而连接回池，锁会被下一位借用者"继承"，
     * 表现为无法解释的 GET_LOCK 死锁。因此释放失败时把这条连接从池里废弃，宁可少一条连接。
     */
    private static void release(Connection session, String name) throws SQLException {
        try (PreparedStatement statement = session.prepareStatement("SELECT RELEASE_LOCK(?)")) {
            statement.setString(1, name);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
            }
        } catch (SQLException e) {
            discard(session);
            throw e;
        }
    }

    private static void discard(Connection session) {
        try {
            if (session.isWrapperFor(DruidPooledConnection.class)) {
                session.unwrap(DruidPooledConnection.class).abandond();
            }
        } catch (SQLException ignored) {
            // 连接已不可用，废弃本身失败无需再处理
        }
    }
}
