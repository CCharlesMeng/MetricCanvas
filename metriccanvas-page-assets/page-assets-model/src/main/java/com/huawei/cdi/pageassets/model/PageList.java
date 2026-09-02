package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * PageList
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class PageList {
    @JsonProperty("pages")
    private List<PageListItem> pages = new ArrayList<>();

    @JsonProperty("nextAfter")
    private String nextAfter = null;

    public PageList pages(List<PageListItem> pages) {
        this.pages = pages;
        return this;
    }

    public PageList addPagesItem(PageListItem pagesItem) {
        this.pages.add(pagesItem);
        return this;
    }

    @NotNull
    @Valid
    public List<PageListItem> getPages() {
        return pages;
    }

    public void setPages(List<PageListItem> pages) {
        this.pages = pages;
    }

    public PageList nextAfter(String nextAfter) {
        this.nextAfter = nextAfter;
        return this;
    }

    public String getNextAfter() {
        return nextAfter;
    }

    public void setNextAfter(String nextAfter) {
        this.nextAfter = nextAfter;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PageList that = (PageList) o;
        return Objects.equals(this.pages, that.pages)
                && Objects.equals(this.nextAfter, that.nextAfter);
    }

    @Override
    public int hashCode() {
        return Objects.hash(pages, nextAfter);
    }

    @Override
    public String toString() {
        return "class PageList {\n"
                + "    pages: " + pages + "\n"
                + "    nextAfter: " + nextAfter + "\n"
                + "}";
    }
}
