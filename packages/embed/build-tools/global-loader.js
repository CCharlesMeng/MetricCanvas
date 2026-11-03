// Classic-script entry; resolve dependencies beside this script, independently of the host URL.
(function () {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement) || !script.src) {
    throw new Error('MetricCanvas global entry must be loaded from a script src.');
  }
  if (window.MetricCanvas && window.MetricCanvas.ready) return;
  const runtime = {};
  const moduleScript = document.createElement('script');
  moduleScript.type = 'module';
  moduleScript.src = new URL('__METRICCANVAS_GLOBAL_BRIDGE__', script.src).href;
  moduleScript.nonce = script.nonce;
  const ready = new Promise(function (resolve, reject) {
    moduleScript.onload = function () { moduleScript.remove(); resolve(runtime); };
    moduleScript.onerror = function () {
      moduleScript.remove();
      reject(new Error('MetricCanvas runtime modules could not be loaded.'));
    };
  });
  Object.defineProperty(runtime, 'ready', { value: ready, enumerable: true });
  window.MetricCanvas = runtime;
  document.head.append(moduleScript);
})();
