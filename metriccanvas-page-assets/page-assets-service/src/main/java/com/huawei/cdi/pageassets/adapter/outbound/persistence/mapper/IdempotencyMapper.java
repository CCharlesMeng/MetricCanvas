package com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper;

import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.IdempotencyPo;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;

/** `t_pa_idempotency`；SQL 在 `mybatis/pageassets/IdempotencyMapper.xml`。 */
public interface IdempotencyMapper {

    IdempotencyPo select(@Param("operation") String operation,
                         @Param("actorId") String actorId,
                         @Param("idempotencyKey") String idempotencyKey);

    int insert(IdempotencyPo record);

    /** 分批删除 created_at 早于 cutoff 的记录，返回本批条数；清理任务循环调用直到为 0。 */
    int deleteCreatedBefore(@Param("cutoff") Instant cutoff, @Param("batchSize") int batchSize);
}
