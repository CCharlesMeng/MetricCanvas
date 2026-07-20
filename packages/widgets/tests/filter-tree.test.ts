import { describe, expect, it } from 'vitest';
import { buildFilterTree, nodeState, toggleNodeValues } from '../src/filter-tree';

/** 候选值样例:'/' 分隔符约定的两级层级 + 一个无分隔符的平面值 */
const options = ['华东/上海', '华东/杭州', '华北/北京', '海外'];

describe("buildFilterTree:候选值 '/' 分隔符约定建树", () => {
  it('按分隔符分层:两级路径成父子,无分隔符的候选值是根层叶子', () => {
    const tree = buildFilterTree(options);
    expect(tree.map((node) => node.label)).toEqual(['华东', '华北', '海外']);
    expect(tree[0].children.map((node) => node.label)).toEqual(['上海', '杭州']);
    expect(tree[2].children).toEqual([]);
  });

  it('叶子节点的 value 是完整原始字符串(写回筛选状态的就是它),中间节点 value 为 null', () => {
    const tree = buildFilterTree(options);
    expect(tree[0].value).toBeNull();
    expect(tree[0].children[0].value).toBe('华东/上海');
    expect(tree[2].value).toBe('海外');
  });

  it('父节点 leaves 聚合后代全部候选值(复选批量作用的范围)', () => {
    const tree = buildFilterTree(options);
    expect(tree[0].leaves).toEqual(['华东/上海', '华东/杭州']);
    expect(tree[2].leaves).toEqual(['海外']);
  });

  it('路径本身也是候选值时(如 "华东" 与 "华东/上海" 并存),该节点既可选又有子节点', () => {
    const tree = buildFilterTree(['华东', '华东/上海']);
    expect(tree).toHaveLength(1);
    expect(tree[0].value).toBe('华东');
    expect(tree[0].children.map((node) => node.label)).toEqual(['上海']);
    expect(tree[0].leaves).toEqual(['华东', '华东/上海']);
  });

  it('空候选列表建出空树', () => {
    expect(buildFilterTree([])).toEqual([]);
  });
});

describe('nodeState:节点勾选态(全选/半选/未选)', () => {
  const tree = buildFilterTree(options);

  it('后代候选值全部选中为 all', () => {
    expect(nodeState(tree[0], new Set(['华东/上海', '华东/杭州']))).toBe('all');
  });

  it('部分选中为 some(渲染为半选)', () => {
    expect(nodeState(tree[0], new Set(['华东/上海']))).toBe('some');
  });

  it('全未选中为 none', () => {
    expect(nodeState(tree[0], new Set())).toBe('none');
    expect(nodeState(tree[0], new Set(['华北/北京']))).toBe('none');
  });
});

describe('toggleNodeValues:节点复选切换', () => {
  const tree = buildFilterTree(options);

  it('未选/半选的父节点勾选,补齐后代全部候选值且不重复', () => {
    const next = toggleNodeValues(tree[0], ['华东/上海'], new Set(['华东/上海']));
    expect(next).toEqual(['华东/上海', '华东/杭州']);
  });

  it('全选态的父节点取消,整棵摘除且不影响其它已选值', () => {
    const value = ['华东/上海', '华东/杭州', '华北/北京'];
    const next = toggleNodeValues(tree[0], value, new Set(value));
    expect(next).toEqual(['华北/北京']);
  });

  it('叶子节点切换等价于单值增删', () => {
    const leaf = tree[0].children[0];
    expect(toggleNodeValues(leaf, [], new Set())).toEqual(['华东/上海']);
    expect(toggleNodeValues(leaf, ['华东/上海'], new Set(['华东/上海']))).toEqual([]);
  });
});
