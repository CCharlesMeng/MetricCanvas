package com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper;

import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.PageRevisionPo;
import org.apache.ibatis.annotations.Param;

/** `t_pa_page_revision`；SQL 在 `mybatis/pageassets/PageRevisionMapper.xml`。 */
public interface PageRevisionMapper {

    PageRevisionPo selectByPageAndRevision(@Param("pageId") String pageId, @Param("revisionId") String revisionId);

    /** 经 `t_pa_page.latest_revision_id` 取当前 latest 修订。 */
    PageRevisionPo selectLatest(@Param("pageId") String pageId);

    int insert(PageRevisionPo revision);
}
