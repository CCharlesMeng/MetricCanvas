/** One source per mount. Nodes are the authorized candidates for this session. */
export function createRegionDepartmentFacts(nodes, initialSearch) {
  const listeners = new Set();
  const byKey = new Map(nodes.map(node => [node.level + '/' + node.value, node]));
  function current(search, revision) {
    const params = new URLSearchParams(search);
    const keys = [...params].filter(([key]) => key === 'rep-office' || key === 'region-dept');
    const [key, value] = keys.at(-1) ?? ['region', params.get('region')];
    const level = { 'rep-office': 'office', 'region-dept': 'region-dept' }[key] ?? params.get('region.level');
    const node = byKey.get(level + '/' + value);
    if (!value || value === '全球') return {status:'ready',value:null,filterRevision:revision};
    if (!node || node.disabled) return {status:'error',filterRevision:revision};
    const department = node.level === 'office' ? node.parent?.value : node.value;
    return department ? {status:'ready',value:department,filterRevision:revision} : {status:'error',filterRevision:revision};
  }
  let fact = current(initialSearch, undefined);
  const getSnapshot = () => ({permissionRevision:'fixture-session',permissions:{},values:{regionDepartment:fact}});
  return {
    displayInputs:{getSnapshot,subscribe(run){listeners.add(run);return ()=>listeners.delete(run);}},
    setSelection(search,revision) {
      fact = current(search, revision);
      for (const listener of listeners) listener(getSnapshot());
    }
  };
}
