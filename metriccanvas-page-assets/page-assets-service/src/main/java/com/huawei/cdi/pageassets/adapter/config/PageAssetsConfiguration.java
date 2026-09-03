package com.huawei.cdi.pageassets.adapter.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huawei.cdi.pageassets.adapter.inbound.rest.RestModelMapper;
import com.huawei.cdi.pageassets.adapter.inbound.rest.UtcMillisSerializer;
import com.huawei.cdi.pageassets.adapter.outbound.contract.ClasspathContractSnapshot;
import com.huawei.cdi.pageassets.adapter.outbound.memory.InMemoryPageStore;
import com.huawei.cdi.pageassets.application.PageAssetService;
import com.huawei.cdi.pageassets.application.port.IdempotencyRepository;
import com.huawei.cdi.pageassets.application.port.PageRepository;
import com.huawei.cdi.pageassets.application.port.PageWriteTransaction;
import com.huawei.cdi.pageassets.domain.contract.ProductContract;
import com.huawei.cdi.pageassets.domain.page.PageValidator;
import com.huawei.cdi.pageassets.domain.revision.RevisionFactory;
import com.huawei.cdi.pageassets.domain.revision.RevisionIdGenerator;
import com.huawei.cdi.pageassets.domain.revision.SaveRevisionPolicy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.OffsetDateTime;

/**
 * 组合根。契约快照在启动时加载并核对摘要（漂移即拒绝启动）；
 * 仓储按 `pageassets.store` 选择：`memory`（缺省，本类装配）或 `mysql`（{@link MySqlStoreConfiguration}）。
 */
@Configuration
public class PageAssetsConfiguration {

    @Bean
    ProductContract productContract() {
        return new ClasspathContractSnapshot().load();
    }

    @Bean
    PageValidator pageValidator(ProductContract contract) {
        return new PageValidator(contract.pageSchema());
    }

    @Bean
    SaveRevisionPolicy saveRevisionPolicy(PageValidator validator) {
        return new SaveRevisionPolicy(validator);
    }

    @Bean
    Clock pageAssetsClock() {
        return Clock.systemUTC();
    }

    @Bean
    RevisionFactory revisionFactory(Clock clock) {
        return new RevisionFactory(RevisionIdGenerator.uuidV4(), clock);
    }

    @Bean
    @ConditionalOnProperty(name = "pageassets.store", havingValue = "memory", matchIfMissing = true)
    InMemoryPageStore inMemoryPageStore() {
        return new InMemoryPageStore();
    }

    @Bean
    PageAssetService pageAssetService(PageRepository pages,
                                      IdempotencyRepository idempotency,
                                      PageWriteTransaction transaction,
                                      SaveRevisionPolicy policy,
                                      RevisionFactory revisions) {
        return new PageAssetService(pages, idempotency, transaction, policy, revisions);
    }

    @Bean
    RestModelMapper restModelMapper(ObjectMapper mapper) {
        return new RestModelMapper(mapper);
    }

    @Bean
    Jackson2ObjectMapperBuilderCustomizer utcMillisDates() {
        return builder -> builder.serializerByType(OffsetDateTime.class, new UtcMillisSerializer());
    }
}
