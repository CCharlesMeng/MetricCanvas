// Synthetic host for the local Embed example. OM supplies these states from its session.
export function opportunityExportInputs() {
  const choices = [
    ['等待权限', { status: 'pending' }],
    ['允许导出', { status: 'ready', value: true }],
    ['禁止导出', { status: 'ready', value: false }],
    ['缺少权限位', undefined],
    ['权限读取失败', { status: 'error' }],
    ['无效的字符串值', { status: 'ready', value: 'true' }]
  ];
  const label = document.createElement('label');
  label.textContent = '模拟宿主导出权限 ';
  const select = document.createElement('select');
  for (const [name] of choices) select.add(new Option(name));
  label.append(select);
  document.body.prepend(label);

  const listeners = new Set();
  function getSnapshot() {
    const input = choices[select.selectedIndex][1];
    return { permissionRevision: 'demo-session', permissions: input ? { canExport: input } : {}, values: {} };
  }
  select.onchange = () => {
    const snapshot = getSnapshot();
    for (const listener of listeners) listener(snapshot);
  };
  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
