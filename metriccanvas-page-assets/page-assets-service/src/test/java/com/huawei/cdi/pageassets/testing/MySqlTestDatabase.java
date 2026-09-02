package com.huawei.cdi.pageassets.testing;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Duration;
import java.util.Locale;

/**
 * 集成测试用的真实 MySQL，按优先级三选一（ADR-0062 J3 探针决定）：
 * <ol>
 *   <li>环境变量 `PAGE_ASSETS_TEST_DB_URL`（+ `_USERNAME` / `_PASSWORD`）：公司 CI 没有 Docker socket 时指向公司测试库；
 *       库里的 `t_pa_*` 与 `flyway_page_assets_history` 会被测试清空。</li>
 *   <li>本机 / GitHub Actions 有 Docker：Testcontainers 起 `mysql:8.0`（`PAGE_ASSETS_TEST_MYSQL_IMAGE` 可换），
 *       用 GenericContainer 而不是 MySQLContainer，后者要求 MySQL Connector/J 在 classpath，而生产只带 MariaDB 驱动。</li>
 *   <li>两者都没有：整类跳过（{@link Condition}），不算失败——这正是 CloudBuild 探针要观察的结果。</li>
 * </ol>
 * 容器整个 JVM 只起一次，由 Testcontainers 的 Ryuk 回收。
 */
public final class MySqlTestDatabase {
    public static final String ENV_URL = "PAGE_ASSETS_TEST_DB_URL";
    public static final String ENV_USERNAME = "PAGE_ASSETS_TEST_DB_USERNAME";
    public static final String ENV_PASSWORD = "PAGE_ASSETS_TEST_DB_PASSWORD";
    public static final String ENV_IMAGE = "PAGE_ASSETS_TEST_MYSQL_IMAGE";

    private static final String DEFAULT_IMAGE = "mysql:8.0";
    private static final String DATABASE = "pageassets";
    private static final String USER = "pageassets";
    private static final String PASSWORD = "pageassets-secret";

    private static volatile Endpoint endpoint;
    private static volatile String unavailableReason;

    private MySqlTestDatabase() {
    }

    public record Endpoint(String url, String username, String password) {
    }

    /** 可用则返回连接信息；不可用返回 null 并记录原因（不抛，供条件与 @DynamicPropertySource 复用）。 */
    public static Endpoint endpoint() {
        Endpoint current = endpoint;
        if (current != null) {
            return current;
        }
        synchronized (MySqlTestDatabase.class) {
            if (endpoint == null && unavailableReason == null) {
                resolve();
            }
            return endpoint;
        }
    }

    public static String unavailableReason() {
        endpoint();
        return unavailableReason;
    }

    private static void resolve() {
        String envUrl = System.getenv(ENV_URL);
        if (envUrl != null && !envUrl.isBlank()) {
            endpoint = new Endpoint(envUrl, System.getenv(ENV_USERNAME), System.getenv(ENV_PASSWORD));
            return;
        }
        boolean docker;
        try {
            docker = DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            docker = false;
        }
        if (!docker) {
            unavailableReason = "没有 Docker 也没有 " + ENV_URL + "，MySQL 集成测试跳过";
            return;
        }
        try {
            endpoint = startContainer();
        } catch (RuntimeException e) {
            unavailableReason = "MySQL 容器启动失败:" + e.getMessage();
        }
    }

    @SuppressWarnings("resource")
    private static Endpoint startContainer() {
        String image = System.getenv().getOrDefault(ENV_IMAGE, DEFAULT_IMAGE);
        GenericContainer<?> mysql = new GenericContainer<>(DockerImageName.parse(image))
                .withEnv("MYSQL_ROOT_PASSWORD", "root-" + PASSWORD)
                .withEnv("MYSQL_DATABASE", DATABASE)
                .withEnv("MYSQL_USER", USER)
                .withEnv("MYSQL_PASSWORD", PASSWORD)
                .withExposedPorts(3306)
                .waitingFor(Wait.forLogMessage(".*ready for connections.*port: 3306.*\\s", 1)
                        .withStartupTimeout(Duration.ofMinutes(3)));
        mysql.start();
        // MySQL 8 缺省 caching_sha2_password：MariaDB 驱动在非 SSL 连接上需要允许取服务端 RSA 公钥，否则握手即失败。
        String url = String.format(Locale.ROOT, "jdbc:mariadb://%s:%d/%s?allowPublicKeyRetrieval=true",
                mysql.getHost(), mysql.getMappedPort(3306), DATABASE);
        awaitJdbc(url);
        return new Endpoint(url, USER, PASSWORD);
    }

    private static void awaitJdbc(String url) {
        long deadline = System.nanoTime() + Duration.ofSeconds(60).toNanos();
        SQLException last = null;
        while (System.nanoTime() < deadline) {
            try (Connection connection = DriverManager.getConnection(url, USER, PASSWORD)) {
                if (connection.isValid(5)) {
                    return;
                }
            } catch (SQLException e) {
                last = e;
                try {
                    Thread.sleep(500);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("等待 MySQL 被中断", interrupted);
                }
            }
        }
        throw new IllegalStateException("MySQL 容器 60s 内未能接受 JDBC 连接"
                + (last == null ? "" : ": " + last.getMessage()), last);
    }

    /** 放在 `@SpringBootTest` 之前声明，使条件在 Spring 建上下文之前评估。 */
    public static final class Condition implements ExecutionCondition {
        @Override
        public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
            return endpoint() != null
                    ? ConditionEvaluationResult.enabled("MySQL 可用")
                    : ConditionEvaluationResult.disabled(unavailableReason());
        }
    }
}
