package com.huawei.cdi.pageassets.domain.contract;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * 构建时嵌入的产品契约只读快照（ADR-0062）：Page Schema、组件能力目录、错误闭集与
 * conformance 向量清单。运行时不挂载、不远程拉取；来源与摘要校验在适配器侧完成。
 */
public record ProductContract(
        String productContractVersion,
        String pageSchemaVersion,
        String manifestSha256,
        JsonNode pageSchema,
        JsonNode componentCatalog,
        List<String> errorTypes,
        List<String> files) {
    public ProductContract {
        errorTypes = List.copyOf(errorTypes);
        files = List.copyOf(files);
    }
}
