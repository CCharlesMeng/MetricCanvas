/**
 * dsh/client.js — IOC 数据开发工作台 client 半(浏览器端)
 *
 * 手写 __ModuleLoader__ bundle(零 tsdown 依赖,契约同 tsdown 产物):
 *   window.__ModuleLoader__.load({ id, factory })
 * factory 接收同步 require,仅解析平台 seed 词表(react / react/jsx-runtime /
 * @deepseek-ai/dsh-client-ui-slots 等),其余逻辑全部内联。
 *
 * 注册:
 *   1. tool.call.toolview(keyed: ioc_stage_gate)→ 门禁结果卡片
 *   2. tool.call.toolview(keyed: ioc_validate)  → 校验矩阵卡片
 *   3. sidebar.footer.action                    → IOC 工作台面板(流水线+卡点+feature 切换)
 *
 * 数据:工作台经同源 fetch /ioc-api/*(host 半 dsh/api.js)读取 feature 目录,
 * 等效"浏览器读本地文件"。无 CSP 限制(全仓无 Content-Security-Policy)。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-ioc-data-dev',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var React = require('react')
    var jsxRuntime = require('react/jsx-runtime')
    var jsx = jsxRuntime.jsx
    var createElement = React.createElement

    // ── block 解析(与 ui-cordis card-model 同构)────────────────────────
    function parseArgs(argsRaw) {
      try {
        var parsed = JSON.parse(argsRaw || '')
        return typeof parsed === 'object' && parsed !== null ? parsed : null
      } catch { return null }
    }
    function resultText(block) {
      if (!block || block.kind !== 'tool-result') return null
      var text = (block.content || [])
        .map(function (item) { return item.type === 'text' ? item.text : JSON.stringify(item, null, 2) })
        .join('\n')
      if (text !== '') return text
      return block.error === undefined ? null : (block.error.name || '') + ': ' + (block.error.code || '')
    }
    function stateOf(block) {
      if (!block || block.kind !== 'tool-result') return 'running'
      return block.isError ? 'error' : 'ok'
    }
    function firstLine(text) {
      if (!text) return ''
      var i = text.indexOf('\n')
      return i === -1 ? text : text.slice(0, i)
    }
    function parseGateResult(text) {
      // ioc_stage_gate 输出含 "[RESULT] PASS — 允许进入/继续" 或 "[RESULT] BLOCKED — ..."
      var t = String(text || '').trim()
      if (/\bBLOCKED\b/i.test(t)) return { verdict: 'BLOCKED', detail: t }
      if (/\bPASS\b/i.test(t)) return { verdict: 'PASS' }
      return { verdict: 'UNKNOWN', detail: t }
    }
    function parseValidateResult(text) {
      // ioc_validate 返回逐项 PASS/FAIL 文本;此处仅提取每行首词做矩阵
      var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== '' })
      var rows = []
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        var ok = /(?:^|\s)(PASS|OK|✓)(?:\s|$)/.test(line)
        var fail = /(?:^|\s)(FAIL|BLOCKED|✗)(?:\s|$)/.test(line)
        rows.push({ line: line, pass: ok && !fail, fail: fail && !ok, neutral: !ok && !fail })
      }
      return rows
    }

    // ── 通用小样式(内联,跟随主题)──────────────────────────────────────
    var S = {
      card: { border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--card)', fontSize: 12.5, color: 'var(--foreground)', fontFamily: 'var(--font-sans, system-ui, sans-serif)' },
      row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
      badge: { fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, letterSpacing: '.02em' },
      muted: { color: 'var(--muted-foreground)', fontSize: 11.5 },
      mono: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5 },
      h: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
      dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flex: 'none' },
    }
    function passBadge(pass) {
      return createElement(
        'span',
        {
          style: Object.assign({}, S.badge, pass
            ? { background: 'color-mix(in srgb, var(--viz-series-1) 16%, transparent)', color: 'var(--viz-series-1)' }
            : { background: 'color-mix(in srgb, #dc2626 14%, transparent)', color: '#dc2626' }),
        },
        pass ? 'PASS' : 'FAIL',
      )
    }

    // ── 1. ioc_stage_gate 卡片 ──────────────────────────────────────────
    function GateCard(props) {
      var block = props.block
      var args = parseArgs(block && block.kind === 'tool-result' ? (block.call && block.call.argsRaw) : block ? block.argsRaw : null)
      var stage = (args && args.stage) || ''
      var feature = (args && args.feature) || ''
      var text = resultText(block)
      var state = stateOf(block)
      var gate = parseGateResult(text)
      var running = state === 'running'
      var ok = state === 'ok' && gate.verdict === 'PASS'
      var blocked = state === 'ok' && gate.verdict === 'BLOCKED'
      var err = state === 'error'
      var statusColor = blocked || err ? '#dc2626' : ok ? 'var(--viz-series-1)' : 'var(--warn)'
      return createElement(
        'div',
        { style: S.card },
        createElement('div', { style: Object.assign({}, S.row, { marginBottom: 6 }) },
          createElement('span', { style: Object.assign({}, S.dot, { background: statusColor }) }),
          createElement('span', { style: { fontWeight: 700 } }, 'ioc_stage_gate'),
          createElement('span', { style: S.muted }, running ? '运行中…' : (ok ? 'PASS' : blocked ? 'BLOCKED' : err ? '错误' : '未知')),
        ),
        stage ? createElement('div', { style: Object.assign({}, S.row) },
          createElement('span', { style: S.muted }, '阶段'),
          createElement('span', { style: S.mono }, stage)) : null,
        feature ? createElement('div', { style: Object.assign({}, S.row) },
          createElement('span', { style: S.muted }, 'feature'),
          createElement('span', { style: S.mono, wordBreak: 'break-all' }, feature)) : null,
        blocked ? createElement('div', { style: { marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, #dc2626 10%, transparent)', border: '1px solid color-mix(in srgb, #dc2626 35%, transparent)', fontSize: 12 } },
          '⛔ 门禁 BLOCKED — 停工(CORE-AX9)。请处理阻塞项后再推进。') : null,
        ok ? createElement('div', { style: { marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--viz-series-1) 9%, transparent)', fontSize: 12 } },
          '✅ 门禁通过,可推进。') : null,
        err ? createElement('div', { style: { marginTop: 8, fontSize: 11.5, color: '#dc2626' } }, String(text || '工具执行失败')) : null,
        blocked && gate.detail ? createElement('div', { style: Object.assign({}, S.muted, { marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 96, overflowY: 'auto' }) }, gate.detail) : null,
      )
    }

    // ── 2. ioc_validate 卡片 ────────────────────────────────────────────
    function ValidateCard(props) {
      var block = props.block
      var args = parseArgs(block && block.kind === 'tool-result' ? (block.call && block.call.argsRaw) : block ? block.argsRaw : null)
      var validator = (args && args.validator) || ''
      var path = (args && args.path) || ''
      var text = resultText(block)
      var state = stateOf(block)
      var running = state === 'running'
      var rows = parseValidateResult(text)
      var passCount = rows.filter(function (r) { return r.pass }).length
      var failCount = rows.filter(function (r) { return r.fail }).length
      var err = state === 'error'
      return createElement(
        'div',
        { style: S.card },
        createElement('div', { style: Object.assign({}, S.row, { marginBottom: 6 }) },
          createElement('span', { style: Object.assign({}, S.dot, { background: err ? '#dc2626' : failCount > 0 ? '#dc2626' : 'var(--viz-series-1)' }) }),
          createElement('span', { style: { fontWeight: 700 } }, 'ioc_validate'),
          createElement('span', { style: S.muted }, validator || ''),
          running ? createElement('span', { style: S.muted }, '运行中…') : null,
        ),
        validator ? createElement('div', { style: Object.assign({}, S.row) },
          createElement('span', { style: S.muted }, '校验器'),
          createElement('span', { style: S.mono }, validator)) : null,
        path ? createElement('div', { style: Object.assign({}, S.row) },
          createElement('span', { style: S.muted }, '目标'),
          createElement('span', { style: Object.assign({}, S.mono, { wordBreak: 'break-all' }) }, path)) : null,
        !running && !err ? createElement('div', { style: Object.assign({}, S.row, { marginTop: 6, gap: 10 }) },
          createElement('span', {}, passBadge(passCount > 0 && failCount === 0)),
          createElement('span', { style: S.muted }, passCount + ' 项通过' + (failCount > 0 ? ' · ' + failCount + ' 项失败' : ''))) : null,
        err ? createElement('div', { style: { marginTop: 8, fontSize: 11.5, color: '#dc2626' } }, String(text || '工具执行失败')) : null,
        failCount > 0 ? createElement('div', { style: { marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6, maxHeight: 140, overflowY: 'auto' } },
          rows.filter(function (r) { return r.fail }).map(function (r, i) {
            return createElement('div', { key: i, style: Object.assign({}, S.row, { alignItems: 'flex-start' }) },
              createElement('span', { style: { color: '#dc2626', fontWeight: 700, flex: 'none' } }, '✗'),
              createElement('span', { style: Object.assign({}, S.mono, { fontSize: 11, wordBreak: 'break-word' }) }, firstLine(r.line)))
          })) : null,
      )
    }

    // ── 3. 侧边栏工作台面板 ────────────────────────────────────────────
    // 槽系统契约:inject face 的 `hooks` 字段必须是 HostObservable 字典
    // (getSnapshot/subscribe),槽系统把它转成 use<Xxx> selector hook 注入
    // 组件;非 hooks 字段(如 onSelect)原样透传。所以工作台数据用一个
    // 真 observable store 承载,组件经 props.useWorkbench(s => s) 读取。
    function stageDotColor(status) {
      if (status === 'done') return 'var(--viz-series-1)'
      if (status === 'current') return '#d97706'
      return 'var(--border)'
    }
    function createObservable(initial) {
      var snapshot = initial
      var listeners = []
      return {
        getSnapshot: function () { return snapshot },
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            listeners = listeners.filter(function (l) { return l !== fn })
          }
        },
        set: function (next) {
          snapshot = next
          listeners.slice().forEach(function (fn) { fn() })
        },
      }
    }
    function WorkbenchPanel(props) {
      var useWorkbench = props.useWorkbench
      var snap = useWorkbench
        ? useWorkbench(function (s) { return s })
        : { loading: true, features: [], selected: null, error: null }
      var loading = snap.loading, features = snap.features || [], selected = snap.selected, error = snap.error
      var onSelect = props.onSelect
      if (loading) {
        return createElement('div', { style: Object.assign({}, S.card, { padding: 12 }) }, 'IOCC 工作台:加载中…')
      }
      if (error) {
        return createElement('div', { style: Object.assign({}, S.card, { padding: 12 }) },
          createElement('div', { style: { fontWeight: 700, marginBottom: 4 } }, 'IOCC 工作台'),
          createElement('div', { style: Object.assign({}, S.muted, { color: '#dc2626' }) }, String(error)),
          createElement('div', { style: Object.assign({}, S.muted, { marginTop: 6 }) }, '提示:确认当前 workspace 是 IOC 数据开发仓库根(含 codespec/changes/)。'),
        )
      }
      var feats = features
      var sel = selected
      return createElement('div', { style: Object.assign({}, S.card, { padding: 12 }) },
        createElement('div', { style: Object.assign({}, S.h, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }) },
          createElement('span', {}, 'IOCC 工作台'),
          createElement('span', { style: Object.assign({}, S.muted, { fontSize: 10.5 }) }, feats.length + ' 个 feature')),
        createElement('div', { style: { marginBottom: 8 } },
          feats.length === 0
            ? createElement('div', { style: S.muted }, '未发现 feature(codespec/changes/<version>/<feature-id>/)')
            : createElement('select', {
                value: sel ? sel.dir : '',
                onChange: function (e) {
                  var target = feats.find(function (f) { return f.dir === e.target.value })
                  if (target && onSelect) onSelect(target)
                },
                style: { width: '100%', padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 },
              },
                feats.map(function (f) {
                  return createElement('option', { key: f.dir, value: f.dir }, f.feature_id + (f.feature_name ? ' · ' + f.feature_name : ''))
                }))),
        sel ? createElement('div', {},
          createElement('div', { style: Object.assign({}, S.row, { flexWrap: 'wrap' }) },
            createElement('span', { style: Object.assign({}, S.dot, { background: 'var(--viz-series-1)' }) }),
            createElement('span', { style: { fontWeight: 700 } }, sel.feature_id || sel.feature_name || ''),
          ),
          sel.current_stage ? createElement('div', { style: Object.assign({}, S.row, { marginBottom: 6 }) },
            createElement('span', { style: S.muted }, '当前阶段'),
            createElement('span', { style: { fontWeight: 600 } }, sel.current_stage)) : null,
          (sel.stages || []).length > 0 ? createElement('div', { style: { marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 3 } },
            sel.stages.map(function (st, i) {
              return createElement('span', { key: i, title: st.id + ' · ' + st.status, style: { width: 8, height: 8, borderRadius: 2, background: stageDotColor(st.status) } })
            })) : null,
          sel.gate_summary ? createElement('div', { style: Object.assign({}, S.row, { fontSize: 11.5, gap: 10, marginBottom: 4 }) },
            createElement('span', {}, createElement('b', { style: { color: 'var(--viz-series-1)' } }, sel.gate_summary.pass) + ' 门禁通过'),
            createElement('span', { style: S.muted }, sel.open_p0_count > 0 ? '🔴 ' + sel.open_p0_count + ' 个 P0 澄清待处理' : '无 P0 澄清')) : null,
          (sel.clarifications || []).filter(function (c) { return c.status !== 'closed' }).length > 0
            ? createElement('div', { style: { marginTop: 4, fontSize: 11, color: '#d97706' } }, '⚠ 有未关闭澄清项,需人工处理')
            : null,
        ) : null,
        createElement('div', { style: Object.assign({}, S.muted, { marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6, fontSize: 10.5 }) },
          '数据源:本地 feature 目录(只读) · 切换 feature 仅影响本视图'),
      )
    }

    function makeWorkbench(ctx) {
      var store = createObservable({ loading: true, features: [], selected: null, error: null })
      function load() {
        return Promise.resolve().then(function () {
          var ws = ctx.workspaces ? ctx.workspaces.list.getSnapshot() : null
          var recentId = ws ? ws.recentWorkspaceId : undefined
          var root = ''
          if (ws && ws.items) {
            var recent = ws.items.find(function (w) { return w.workspaceId === recentId })
            root = recent ? recent.path : (ws.items[0] ? ws.items[0].path : '')
          }
          if (!root) return { features: [], selected: null, error: '未找到当前 workspace 路径' }
          return fetch('/ioc-api/features?root=' + encodeURIComponent(root), { cache: 'no-store' })
            .then(function (r) { return r.json() })
            .then(function (json) {
              if (!json.ok) throw new Error(json.error || '接口错误')
              var feats = json.features || []
              return { features: feats, selected: feats[0] || null, error: null }
            })
            .catch(function (e) { return { features: [], selected: null, error: '读取失败: ' + e.message } })
        })
      }
      function refresh() {
        load().then(function (result) { store.set(result) })
      }
      refresh()
      var ws = ctx.workspaces ? ctx.workspaces.list : null
      if (ws && typeof ws.subscribe === 'function') {
        var unsub = ws.subscribe(refresh)
        ctx.effect ? ctx.effect(function () { return unsub }) : void 0
      }
      return {
        hooks: { workbench: store },
        onSelect: function (f) {
          store.set({ loading: false, features: store.getSnapshot().features, selected: f, error: null })
        },
      }
    }

    // ── 入口 ─────────────────────────────────────────────────────────────
    var inject = ['slots', 'workspaces']
    function apply(ctx) {
      ctx.slots.inject('tool.call.toolview', function () {
        return ctx.slots.register({ name: 'tool.call.toolview', key: 'ioc_stage_gate' }, GateCard)
      })
      ctx.slots.inject('tool.call.toolview', function () {
        return ctx.slots.register({ name: 'tool.call.toolview', key: 'ioc_validate' }, ValidateCard)
      })
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'ioc-workbench',
          inject: function () { return makeWorkbench(ctx) },
        }, WorkbenchPanel)
      })
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
