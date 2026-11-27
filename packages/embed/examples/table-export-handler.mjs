import { mount } from '../dist/metriccanvas-runtime.es.js';

const status = document.querySelector('#status');
const actions = document.querySelector('.actions');
const details = document.querySelector('details');
const page = await fetch('/pages/table-trend-arrows.json').then(response => response.json());
let submitted = 0;

function exportHandler({ signal, ...request }) {
  signal.throwIfAborted();
  const sheet = request.sheets[0];
  const description = request.fileName + ' · ' + request.meta.rowCount + ' 行 · ' + sheet.header.length + ' 行表头';
  status.textContent = description + ' · 等待确认';
  const sample = document.querySelector('#sample');
  sample.hidden = !sheet.rows.length;
  sample.textContent = '首行展示值　' + (sheet.rows[0] ?? []).join('　·　');
  details.hidden = false;
  document.querySelector('pre').textContent = JSON.stringify(request, null, 2);
  actions.hidden = false;
  return new Promise((resolve, reject) => {
    function finish(message) {
      actions.hidden = true;
      actions.onclick = null;
      signal.removeEventListener('abort', abort);
      status.textContent = description + ' · ' + message;
    }
    function abort() {
      finish('MC 已取消');
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
    actions.onclick = event => {
      if (!(event.target instanceof HTMLButtonElement)) return;
      switch (event.target.id) {
        case 'submit': {
          const taskId = 'MOCK-' + String(++submitted).padStart(3, '0');
          finish('已提交 ' + taskId);
          resolve({ status: 'submitted', taskId });
          break;
        }
        case 'split':
          finish('已模拟拆分为 2 个文件');
          resolve({ status: 'split', fileCount: 2 });
          break;
        case 'cancel':
          finish('用户已取消');
          resolve({ status: 'cancelled' });
          break;
        case 'fail':
          finish('模拟接口失败');
          reject(new Error('模拟导出接口调用失败'));
          break;
      }
    };
  });
}

mount('#dashboard', { document: page, exportHandler });
