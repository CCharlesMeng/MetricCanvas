(() => {
  const key = '__metriccanvasRouteHideProbe';
  window[key]?.stop?.();
  const started = performance.now();
  const changes = [];
  const label = node => node instanceof Element ? {tag: node.tagName, classes: node.getAttribute('class'), testId: node.getAttribute('data-testid')} : {tag: node.nodeName};
  const measure = element => {
    if (!element) return null;
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return {...label(element), hidden: element.hidden, display: style.display, visibility: style.visibility,
      rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, childCount: element.childElementCount};
  };
  const pathname = value => {try {return new URL(value, location.href).pathname;} catch {return '<invalid>';}};
  const snapshot = () => ({
    path: location.pathname,
    roots: [...document.querySelectorAll('[data-testid="platform-app"]')].map((root, index) => ({
      index, root: measure(root),
      navigation: [...root.querySelectorAll('.global-rail a')].map(anchor => ({label: anchor.getAttribute('aria-label'), path: pathname(anchor.href), current: anchor.getAttribute('aria-current'), classes: anchor.getAttribute('class')})),
      stack: measure(root.querySelector('.work-stack')),
      tasks: [...root.querySelectorAll('.work-task')].map(task => ({wrapper: measure(task), workbench: measure(task.querySelector('[data-testid="workbench"]')), chat: measure(task.querySelector('.chat')), dialogue: measure(task.querySelector('.chat .dialogue')), dialogueMount: measure(task.querySelector('.chat .dialogue > .mount')), canvas: measure(task.querySelector('.canvas'))})),
      management: [...root.querySelectorAll('.management')].map(measure),
      shell: measure(root.querySelector('.shell-main'))
    })),
    totalWorkbenchCount: document.querySelectorAll('[data-testid="workbench"]').length,
    workbenchesOutsidePlatformRoot: [...document.querySelectorAll('[data-testid="workbench"]')].filter(element => !element.closest('[data-testid="platform-app"]')).map(measure),
    platformResources: [...performance.getEntriesByType('resource')].map(entry => pathname(entry.name)).filter(path => /platform\.(?:umd\.js|css)|\/assets\/index-[^/]+\.(?:js|css)$/.test(path))
  });
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (changes.length >= 100) break;
      const target = record.target;
      if (!(target instanceof Element)) continue;
      if (record.type === 'attributes' && target.matches('.work-stack,.work-task,.nav-link')) {
        changes.push({ms: Math.round(performance.now() - started), ...label(target), attribute: record.attributeName, from: record.oldValue, to: target.getAttribute(record.attributeName)});
      } else if (record.type === 'childList' && target.matches('.chat,.dialogue,.dialogue > .mount,.shell-main')) {
        changes.push({ms: Math.round(performance.now() - started), ...label(target), added: [...record.addedNodes].map(label), removed: [...record.removedNodes].map(label)});
      }
    }
  });
  for (const root of document.querySelectorAll('[data-testid="platform-app"]')) observer.observe(root, {subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'hidden', 'style'], childList: true});
  const before = snapshot();
  const probe = {stop: () => observer.disconnect(), snapshot,
    report: () => {observer.disconnect();const result = {before, after: snapshot(), changes}; console.log(JSON.stringify(result, null, 2)); return result;}
  };
  window[key] = probe;
  console.log('取证已开始。点击 Manage，等异常出现后执行：copy(JSON.stringify(window.__metriccanvasRouteHideProbe.report(), null, 2))');
  return before;
})();
