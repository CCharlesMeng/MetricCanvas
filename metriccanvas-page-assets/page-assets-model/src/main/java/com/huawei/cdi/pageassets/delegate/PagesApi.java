package com.huawei.cdi.pageassets.delegate;

import com.huawei.cdi.pageassets.model.PageList;
import com.huawei.cdi.pageassets.model.PageRevision;
import com.huawei.cdi.pageassets.model.SavePageRevisionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 由 rest-services-page-assets.yaml 的 `pages` tag 对应的 API 接口（codegen spring / delegatePattern 形状）。
 * 路径相对于 basePath；basePath 由 {@link PagesApiController} 上的配置占位注入。
 */
@Validated
public interface PagesApi {

    default PagesApiDelegate getDelegate() {
        return new PagesApiDelegate() {
        };
    }

    @RequestMapping(value = "/pages/{pageId}/revisions",
            produces = {"application/json"},
            consumes = {"application/json"},
            method = RequestMethod.POST)
    default ResponseEntity<PageRevision> savePageRevision(
            @RequestHeader(value = "X-Auth-Token", required = false) String xAuthToken,
            @Size(min = 1, max = 128) @RequestHeader(value = "X-Operator-Id", required = true) String xOperatorId,
            @RequestHeader(value = "X-Workspace-Id", required = false) String xWorkspaceId,
            @Pattern(regexp = "^[a-z0-9][a-z0-9-]*$") @Size(max = 128) @PathVariable("pageId") String pageId,
            @Valid @RequestBody SavePageRevisionRequest body) {
        return getDelegate().savePageRevision(xAuthToken, xOperatorId, xWorkspaceId, pageId, body);
    }

    @RequestMapping(value = "/pages/{pageId}",
            produces = {"application/json"},
            method = RequestMethod.GET)
    default ResponseEntity<PageRevision> getLatestPage(
            @RequestHeader(value = "X-Auth-Token", required = false) String xAuthToken,
            @Size(min = 1, max = 128) @RequestHeader(value = "X-Operator-Id", required = true) String xOperatorId,
            @RequestHeader(value = "X-Workspace-Id", required = false) String xWorkspaceId,
            @Pattern(regexp = "^[a-z0-9][a-z0-9-]*$") @Size(max = 128) @PathVariable("pageId") String pageId) {
        return getDelegate().getLatestPage(xAuthToken, xOperatorId, xWorkspaceId, pageId);
    }

    @RequestMapping(value = "/pages/{pageId}/revisions/{revisionId}",
            produces = {"application/json"},
            method = RequestMethod.GET)
    default ResponseEntity<PageRevision> getPageRevision(
            @RequestHeader(value = "X-Auth-Token", required = false) String xAuthToken,
            @Size(min = 1, max = 128) @RequestHeader(value = "X-Operator-Id", required = true) String xOperatorId,
            @RequestHeader(value = "X-Workspace-Id", required = false) String xWorkspaceId,
            @Pattern(regexp = "^[a-z0-9][a-z0-9-]*$") @Size(max = 128) @PathVariable("pageId") String pageId,
            @Pattern(regexp = "^[0-9a-f]{32}$") @PathVariable("revisionId") String revisionId) {
        return getDelegate().getPageRevision(xAuthToken, xOperatorId, xWorkspaceId, pageId, revisionId);
    }

    @RequestMapping(value = "/pages",
            produces = {"application/json"},
            method = RequestMethod.GET)
    default ResponseEntity<PageList> listPages(
            @RequestHeader(value = "X-Auth-Token", required = false) String xAuthToken,
            @Size(min = 1, max = 128) @RequestHeader(value = "X-Operator-Id", required = true) String xOperatorId,
            @RequestHeader(value = "X-Workspace-Id", required = false) String xWorkspaceId,
            @RequestParam(value = "after", required = false) String after,
            @RequestParam(value = "limit", required = false) Integer limit) {
        return getDelegate().listPages(xAuthToken, xOperatorId, xWorkspaceId, after, limit);
    }
}
