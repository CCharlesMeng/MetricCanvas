package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.huawei.cdi.pageassets.application.PageAssetService;
import com.huawei.cdi.pageassets.delegate.PagesApiDelegate;
import com.huawei.cdi.pageassets.model.PageList;
import com.huawei.cdi.pageassets.model.PageRevision;
import com.huawei.cdi.pageassets.model.SavePageRevisionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * 四个 Interface 的 delegate 实现。`X-Operator-Id` 即 actorId；`X-Auth-Token` 由网关校验、
 * `X-Workspace-Id` 按网关要求接受，首批都不用于数据隔离（ADR-0062）。
 */
@Component
public final class PagesDelegate implements PagesApiDelegate {
    private final PageAssetService service;
    private final RestModelMapper mapper;

    public PagesDelegate(PageAssetService service, RestModelMapper mapper) {
        this.service = Objects.requireNonNull(service, "service");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public ResponseEntity<PageRevision> savePageRevision(String xAuthToken, String xOperatorId, String xWorkspaceId,
                                                         String pageId, SavePageRevisionRequest body) {
        var revision = service.savePageRevision(mapper.toCommand(pageId, body), actorId(xOperatorId));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toModel(revision));
    }

    @Override
    public ResponseEntity<PageRevision> getLatestPage(String xAuthToken, String xOperatorId, String xWorkspaceId,
                                                      String pageId) {
        actorId(xOperatorId);
        return ResponseEntity.ok(mapper.toModel(service.getLatestPage(pageId)));
    }

    @Override
    public ResponseEntity<PageRevision> getPageRevision(String xAuthToken, String xOperatorId, String xWorkspaceId,
                                                        String pageId, String revisionId) {
        actorId(xOperatorId);
        return ResponseEntity.ok(mapper.toModel(service.getPageRevision(pageId, revisionId)));
    }

    @Override
    public ResponseEntity<PageList> listPages(String xAuthToken, String xOperatorId, String xWorkspaceId,
                                              String after, Integer limit) {
        actorId(xOperatorId);
        return ResponseEntity.ok(mapper.toModel(service.listPages(after, limit)));
    }

    private static String actorId(String xOperatorId) {
        if (xOperatorId == null || xOperatorId.isBlank()) {
            throw new InvalidRequestException("缺少请求头 X-Operator-Id");
        }
        return xOperatorId.trim();
    }
}
