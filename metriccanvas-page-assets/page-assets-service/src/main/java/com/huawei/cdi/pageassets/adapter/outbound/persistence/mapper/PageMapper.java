package com.huawei.cdi.pageassets.adapter.outbound.persistence.mapper;

import com.huawei.cdi.pageassets.adapter.outbound.persistence.po.PagePo;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/** `t_pa_page`；SQL 在 `mybatis/pageassets/PageMapper.xml`。 */
public interface PageMapper {

    PagePo selectByPageId(@Param("pageId") String pageId);

    /** 码点序升序、严格大于 after（null 表示从头），最多 limit 条；排序由列的 utf8mb4_bin 保证。 */
    List<PagePo> selectAfter(@Param("after") String after, @Param("limit") int limit);

    /** 首保插入，后续保存推进 latest 指针（`INSERT ... ON DUPLICATE KEY UPDATE`）。 */
    int upsertLatest(PagePo page);
}
