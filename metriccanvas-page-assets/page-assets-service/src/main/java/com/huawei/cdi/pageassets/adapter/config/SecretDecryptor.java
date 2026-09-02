package com.huawei.cdi.pageassets.adapter.config;

/**
 * 数据库口令解密接缝。公司环境里 `DB_PASSWORD` 是 `TitanCipherEnum.TITAN_SCC_PRIVATE` 加密后的值，
 * 该类在内部依赖中、本仓库拿不到；并入宿主或在公司 CI 上时注册一个调用它的实现 Bean 即可覆盖缺省的
 * {@link #plain()}（原文透传）。本仓库不引入任何外网替代实现。
 */
@FunctionalInterface
public interface SecretDecryptor {

    String decrypt(String cipherText);

    static SecretDecryptor plain() {
        return cipherText -> cipherText;
    }
}
