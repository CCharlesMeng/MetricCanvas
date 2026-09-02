package com.huawei.cdi.pageassets;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

/**
 * 分层边界（ADR-0062）：domain / application / adapter 单向依赖，包根限定为
 * com.huawei.cdi.pageassets..；领域层不依赖 Spring、MyBatis 与 Servlet。
 */
@AnalyzeClasses(packages = "com.huawei.cdi.pageassets", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule packageRoot = classes().should().resideInAPackage("com.huawei.cdi.pageassets..");

    @ArchTest
    static final ArchRule layers = layeredArchitecture().consideringOnlyDependenciesInLayers()
            .withOptionalLayers(true)
            .layer("domain").definedBy("com.huawei.cdi.pageassets.domain..")
            .layer("application").definedBy("com.huawei.cdi.pageassets.application..")
            .layer("adapter").definedBy("com.huawei.cdi.pageassets.adapter..")
            .whereLayer("adapter").mayNotBeAccessedByAnyLayer()
            .whereLayer("application").mayOnlyBeAccessedByLayers("adapter")
            .whereLayer("domain").mayOnlyBeAccessedByLayers("application", "adapter");

    @ArchTest
    static final ArchRule domainStaysFrameworkFree = noClasses()
            .that().resideInAPackage("com.huawei.cdi.pageassets.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "org.apache.ibatis..", "org.mybatis..", "jakarta.servlet..");
}
