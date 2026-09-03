package com.huawei.cdi.pageassets.adapter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * `pageassets.db.*`（只在 `pageassets.store=mysql` 时读取）。缺省值跟随公司 `DataSourceConfig`：
 * MariaDB 驱动、Druid initialSize 5 / minIdle 10 / maxActive 100 / maxWait 60s；
 * `url` / `username` / `password` 在 application.yaml 里绑定到 `DB_URL` / `DB_USERNAME` / `DB_PASSWORD`。
 */
@ConfigurationProperties(prefix = "pageassets.db")
public class PageAssetsDbProperties {
    private String url;
    private String username;
    private String password;
    private String driverClassName = "org.mariadb.jdbc.Driver";
    private int initialSize = 5;
    private int minIdle = 10;
    private int maxActive = 100;
    private long maxWaitMillis = 60_000;
    /** `GET_LOCK` 等待上限；超过即放弃本次保存（500），不无限排队。 */
    private int lockTimeoutSeconds = 10;

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDriverClassName() {
        return driverClassName;
    }

    public void setDriverClassName(String driverClassName) {
        this.driverClassName = driverClassName;
    }

    public int getInitialSize() {
        return initialSize;
    }

    public void setInitialSize(int initialSize) {
        this.initialSize = initialSize;
    }

    public int getMinIdle() {
        return minIdle;
    }

    public void setMinIdle(int minIdle) {
        this.minIdle = minIdle;
    }

    public int getMaxActive() {
        return maxActive;
    }

    public void setMaxActive(int maxActive) {
        this.maxActive = maxActive;
    }

    public long getMaxWaitMillis() {
        return maxWaitMillis;
    }

    public void setMaxWaitMillis(long maxWaitMillis) {
        this.maxWaitMillis = maxWaitMillis;
    }

    public int getLockTimeoutSeconds() {
        return lockTimeoutSeconds;
    }

    public void setLockTimeoutSeconds(int lockTimeoutSeconds) {
        this.lockTimeoutSeconds = lockTimeoutSeconds;
    }
}
