package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.huawei.cdi.pageassets.delegate.HealthcheckApiDelegate;
import com.huawei.cdi.pageassets.model.HealthcheckResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/** 自定义健康检查（不用 Actuator）。J3 接上 MySQL 后再决定是否探活数据库。 */
@Component
public final class HealthcheckDelegate implements HealthcheckApiDelegate {
    @Override
    public ResponseEntity<HealthcheckResponse> healthcheck() {
        return ResponseEntity.ok(new HealthcheckResponse().status(HealthcheckResponse.StatusEnum.UP));
    }
}
