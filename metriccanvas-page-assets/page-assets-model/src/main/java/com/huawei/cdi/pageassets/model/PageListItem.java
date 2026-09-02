package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.Objects;

/**
 * PageListItem
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class PageListItem {
    @JsonProperty("pageId")
    private String pageId = null;

    @JsonProperty("latestRevision")
    private RevisionSummary latestRevision = null;

    public PageListItem pageId(String pageId) {
        this.pageId = pageId;
        return this;
    }

    @NotNull
    public String getPageId() {
        return pageId;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public PageListItem latestRevision(RevisionSummary latestRevision) {
        this.latestRevision = latestRevision;
        return this;
    }

    @NotNull
    @Valid
    public RevisionSummary getLatestRevision() {
        return latestRevision;
    }

    public void setLatestRevision(RevisionSummary latestRevision) {
        this.latestRevision = latestRevision;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PageListItem that = (PageListItem) o;
        return Objects.equals(this.pageId, that.pageId)
                && Objects.equals(this.latestRevision, that.latestRevision);
    }

    @Override
    public int hashCode() {
        return Objects.hash(pageId, latestRevision);
    }

    @Override
    public String toString() {
        return "class PageListItem {\n"
                + "    pageId: " + pageId + "\n"
                + "    latestRevision: " + latestRevision + "\n"
                + "}";
    }
}
