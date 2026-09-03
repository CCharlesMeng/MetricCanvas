package com.huawei.cdi.pageassets.adapter.config;

import com.alibaba.druid.pool.DruidDataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.IdempotencyPurgeTask;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.MyBatisPageStore;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.MySqlPageWriteTransaction;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.IdempotencyMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.PageMapper;
import com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper.PageRevisionMapper;
import com.huawei.cdi.pageassets.application.IdempotencyRetention;
import org.apache.ibatis.session.SqlSessionFactory;
import org.flywaydb.core.Flyway;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.time.Clock;

/**
 * `pageassets.store=mysql` 的装配（J3，ADR-0062）：Druid + MariaDB 驱动 → Flyway 启动迁移 → MyBatis → 三个 Port。
 *
 * <p>全部 Bean 都带 `pageAssets` 前缀名并显式引用，不用 Spring Boot 的 DataSource / Flyway / MyBatis 自动配置：
 * 并入 CDINL2DataBuilderService 时宿主已有自己的一套，这里的命名与 {@code @MapperScan} 的包限定让两套并存。
 * Flyway 用独立历史表 `flyway_page_assets_history` 与独立 locations，`baselineVersion=0` 使宿主非空库
 * 第一次遇到本 Module 时仍从 `V1.0.0.1__pa_init` 跑起，而不是把它当作已存在而跳过。
 */
@Configuration
@ConditionalOnProperty(name = "pageassets.store", havingValue = "mysql")
@EnableConfigurationProperties(PageAssetsDbProperties.class)
@EnableScheduling
@MapperScan(basePackageClasses = PageMapper.class, sqlSessionFactoryRef = "pageAssetsSqlSessionFactory")
public class MySqlStoreConfiguration {
    static final String FLYWAY_TABLE = "flyway_page_assets_history";
    static final String FLYWAY_LOCATION = "classpath:db/migration/pageassets";
    static final String MAPPER_LOCATION = "classpath*:mybatis/pageassets/*Mapper.xml";

    /** 没有 {@link SecretDecryptor} Bean 时口令原文透传；公司环境注册 TitanCipher 实现即可覆盖。 */
    @Bean(name = "pageAssetsDataSource", destroyMethod = "close")
    DruidDataSource pageAssetsDataSource(PageAssetsDbProperties properties, ObjectProvider<SecretDecryptor> decryptor) {
        if (properties.getUrl() == null || properties.getUrl().isBlank()) {
            throw new IllegalStateException("pageassets.store=mysql 需要 DB_URL（pageassets.db.url）");
        }
        SecretDecryptor secrets = decryptor.getIfAvailable(SecretDecryptor::plain);
        DruidDataSource dataSource = new DruidDataSource();
        dataSource.setDriverClassName(properties.getDriverClassName());
        dataSource.setUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword() == null ? null : secrets.decrypt(properties.getPassword()));
        dataSource.setInitialSize(properties.getInitialSize());
        dataSource.setMinIdle(properties.getMinIdle());
        dataSource.setMaxActive(properties.getMaxActive());
        dataSource.setMaxWait(properties.getMaxWaitMillis());
        dataSource.setValidationQuery("SELECT 1");
        dataSource.setTestWhileIdle(true);
        dataSource.setTestOnBorrow(false);
        dataSource.setDefaultAutoCommit(true);
        return dataSource;
    }

    @Bean(name = "pageAssetsFlyway", initMethod = "migrate")
    Flyway pageAssetsFlyway(@Qualifier("pageAssetsDataSource") DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .table(FLYWAY_TABLE)
                .locations(FLYWAY_LOCATION)
                .sqlMigrationPrefix("V")
                .sqlMigrationSeparator("__")
                .sqlMigrationSuffixes(".sql")
                .encoding(StandardCharsets.UTF_8)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .validateOnMigrate(true)
                .load();
    }

    @Bean(name = "pageAssetsSqlSessionFactory")
    SqlSessionFactory pageAssetsSqlSessionFactory(@Qualifier("pageAssetsDataSource") DataSource dataSource)
            throws Exception {
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setDataSource(dataSource);
        factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources(MAPPER_LOCATION));
        org.apache.ibatis.session.Configuration configuration = new org.apache.ibatis.session.Configuration();
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.setDefaultStatementTimeout(30);
        factory.setConfiguration(configuration);
        SqlSessionFactory sessionFactory = factory.getObject();
        if (sessionFactory == null) {
            throw new IllegalStateException("SqlSessionFactory 构建失败");
        }
        return sessionFactory;
    }

    @Bean(name = "pageAssetsTransactionManager")
    PlatformTransactionManager pageAssetsTransactionManager(@Qualifier("pageAssetsDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean
    MySqlPageWriteTransaction pageAssetsWriteTransaction(
            @Qualifier("pageAssetsDataSource") DataSource dataSource,
            @Qualifier("pageAssetsTransactionManager") PlatformTransactionManager transactionManager,
            PageAssetsDbProperties properties) {
        return new MySqlPageWriteTransaction(dataSource, transactionManager, properties.getLockTimeoutSeconds());
    }

    @Bean
    @DependsOn("pageAssetsFlyway")
    MyBatisPageStore myBatisPageStore(PageMapper pages,
                                      PageRevisionMapper revisions,
                                      IdempotencyMapper idempotency,
                                      ObjectMapper json) {
        return new MyBatisPageStore(pages, revisions, idempotency, json);
    }

    @Bean
    IdempotencyRetention idempotencyRetention(MyBatisPageStore store, Clock clock) {
        return new IdempotencyRetention(store, clock);
    }

    @Bean
    IdempotencyPurgeTask idempotencyPurgeTask(IdempotencyRetention retention) {
        return new IdempotencyPurgeTask(retention);
    }
}
