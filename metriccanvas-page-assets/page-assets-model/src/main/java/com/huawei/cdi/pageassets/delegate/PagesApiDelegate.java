package com.huawei.cdi.pageassets.delegate;

import com.huawei.cdi.pageassets.model.PageList;
import com.huawei.cdi.pageassets.model.PageRevision;
import com.huawei.cdi.pageassets.model.SavePageRevisionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.NativeWebRequest;

import java.util.Optional;

/**
 * {@link PagesApi} 的 delegate：业务实现放在 adapter/inbound/rest，不改本 module。
 * 未实现的方法返回 501。
 */
public interface PagesApiDelegate {

    default Optional<NativeWebRequest> getRequest() {
        return Optional.empty();
    }

    /**
     * @see PagesApi#savePageRevision
     */
    default ResponseEntity<PageRevision> savePageRevision(String xAuthToken,
                                                          String xOperatorId,
                                                          String xWorkspaceId,
                                                          String pageId,
                                                          SavePageRevisionRequest body) {
        return new ResponseEntity<>(HttpStatus.NOT_IMPLEMENTED);
    }

    /**
     * @see PagesApi#getLatestPage
     */
    default ResponseEntity<PageRevision> getLatestPage(String xAuthToken,
                                                       String xOperatorId,
                                                       String xWorkspaceId,
                                                       String pageId) {
        return new ResponseEntity<>(HttpStatus.NOT_IMPLEMENTED);
    }

    /**
     * @see PagesApi#getPageRevision
     */
    default ResponseEntity<PageRevision> getPageRevision(String xAuthToken,
                                                         String xOperatorId,
                                                         String xWorkspaceId,
                                                         String pageId,
                                                         String revisionId) {
        return new ResponseEntity<>(HttpStatus.NOT_IMPLEMENTED);
    }

    /**
     * @see PagesApi#listPages
     */
    default ResponseEntity<PageList> listPages(String xAuthToken,
                                               String xOperatorId,
                                               String xWorkspaceId,
                                               String after,
                                               Integer limit) {
        return new ResponseEntity<>(HttpStatus.NOT_IMPLEMENTED);
    }
}
