// dsh/api.js — IOC 数据开发工作台只读数据接口(host 半)
//
// 目的:给 client 半(浏览器)提供"等效读本地文件"的数据通道。
// 浏览器安全模型禁止网页代码直接读磁盘,故经 host 半注册 HTTP 路由,
// 由 host 读 feature 目录并解析为 JSON(client fetch 同源接口)。
//
// 端点(全部只读,不写磁盘):
//   GET /ioc-api/features?root=<仓库根>          — 自动发现 feature 列表
//   GET /ioc-api/feature?path=<feature目录>      — feature 完整状态 JSON
//   GET /ioc-api/feature/tables?path=<feature目录> — 血缘节点/边(第二批发)
//
// 零依赖:仅 node 内置模块;YAML 用内置 mini 解析(change-manifest 为简单
// key: value + 缩进块结构,不引入 yaml 依赖,与原插件零依赖原则一致)。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'

const MANIFEST = 'change-manifest.yaml'
const VERSIONS_GLOB = ['codespec', 'changes']

// ── mini YAML 解析(仅 cover change-manifest 结构)────────────────────────
// 支持:顶层 `key: value`、`key: value` 注释行、缩进块 `block:` 下 `key: value`
function parseManifest(text) {
  const lines = text.split(/\r?\n/)
  const out = {}
  let block = null
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trimEnd()
    if (!line.trim() || /^#/.test(line.trim())) continue
    const indent = line.match(/^\s*/)[0].length
    const m = /^([A-Za-z0-9_\-./*]+)\s*:\s*(.*)$/.exec(line.trim())
    if (!m) continue
    const [, key, value] = m
    if (indent === 0) {
      if (value.trim() === '') {
        block = key
        if (!out[block]) out[block] = {}
      } else {
        out[key] = stripQuotes(value.trim())
        block = null
      }
    } else if (block) {
      if (!out[block] || typeof out[block] !== 'object') out[block] = {}
      out[block][key] = stripQuotes(value.trim())
    }
  }
  return out
}

function stripQuotes(v) {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  return v
}

// ── 解析澄清项表格(*-clarification-questions.md)─────────────────────────
function parseClarifications(dir) {
  const found = readdirSync(dir).filter((f) => f.endsWith('-clarification-questions.md'))
  const items = []
  for (const file of found) {
    let text
    try {
      text = readFileSync(join(dir, file), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim().startsWith('|')) continue
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c !== '' && c !== '---' && !/^#{2,}$/.test(c))
      if (cells.length < 4) continue
      const id = cells[0]
      if (!/^CL-\d+$/i.test(id)) continue
      items.push({
        id,
        question: cells[1] || '',
        status: cells[2] || '',
        priority: cells[3] || '',
        owner: cells[4] || '',
        closed_by: cells[5] || '',
        consumed_at: cells[6] || '',
        file,
      })
    }
  }
  return items
}

// ── 阶段状态推导 ─────────────────────────────────────────────────────────
// data 主路径 16 阶段(subject 13 阶段)。done:出口门禁 pass 且产物齐;
// current:第一个存在未置位出口门禁的阶段;其余 todo。
const DATA_STAGES = [
  ['intake', []],
  ['requirement', []],
  ['data-design', ['data_design']],
  ['ads-design', []],
  ['ads-design-validation', ['ads_design_validation']],
  ['ads-clarification-apply', ['ads_clarification_applied']],
  ['clouddevops-review', ['clouddevops_review']],
  ['sql-bindings-ready', ['sql_bindings_ready']],
  ['sql-generate', []],
  ['sql-validation', ['sql_validation_static']],
  ['job-create · TEST', ['sql_validation_static']],
  ['platform-test', ['test_execution', 'platform_test']],
  ['promotion', ['test_execution', 'platform_test', 'sql_validation_static']],
  ['job-create · FORMAL', ['sql_validation_static']],
  ['platform-formal', ['platform_formal']],
  ['archive', ['sql_promotion', 'platform_formal']],
]
const SUBJECT_STAGES = [
  ['requirement', []],
  ['subject-design', []],
  ['subject-design-validation', []],
  ['subject-clarification-apply', ['ads_clarification_applied']],
  ['subject-sql-bindings-ready', []],
  ['sql-generate', []],
  ['sql-validation', ['sql_validation_static']],
  ['job-create', ['sql_validation_static']],
  ['platform-test', ['test_execution', 'platform_test']],
  ['promotion', ['test_execution', 'platform_test', 'sql_validation_static']],
  ['platform-formal', ['platform_formal']],
  ['archive', ['sql_promotion', 'platform_formal']],
]

function stageStatus(stageGates, gates) {
  const open = stageGates.filter((g) => gates[g] !== 'pass')
  if (open.length === 0) return 'done'
  return 'current'
}

function deriveStages(manifest) {
  const gates = manifest.gates || {}
  const path = manifest.main_path === 'subject' ? SUBJECT_STAGES : DATA_STAGES
  let currentSeen = false
  return path.map(([name, stageGates]) => {
    const base = stageStatus(stageGates, gates)
    // 门禁全过 → done;第一个未过门禁的阶段 → current;其后所有阶段 → todo
    let status
    if (base === 'done') {
      status = 'done'
    } else if (!currentSeen) {
      status = 'current'
      currentSeen = true
    } else {
      status = 'todo'
    }
    return { id: name, status, gates: stageGates }
  })
}

// ── feature 完整状态 ─────────────────────────────────────────────────────
function loadFeature(dir) {
  const manifestPath = join(dir, MANIFEST)
  if (!existsSync(manifestPath)) {
    throw new Error(`[ioc-api] 目录不含 change-manifest.yaml: ${dir}`)
  }
  const manifest = parseManifest(readFileSync(manifestPath, 'utf8'))
  const gates = manifest.gates || {}
  const artifacts = manifest.artifacts || {}
  const gateSummary = Object.values(gates).reduce(
    (acc, v) => {
      if (v === 'pass') acc.pass += 1
      else if (v === 'not_started') acc.not_started += 1
      else acc.other += 1
      return acc
    },
    { pass: 0, not_started: 0, other: 0 },
  )
  const artifactSummary = Object.values(artifacts).reduce(
    (acc, v) => {
      if (v === 'done') acc.done += 1
      else acc.todo += 1
      return acc
    },
    { done: 0, todo: 0 },
  )
  let clarifications = []
  try {
    clarifications = parseClarifications(dir)
  } catch {
    /* 目录不可读时澄清项为空 */
  }
  const openP0 = clarifications.filter((c) => c.priority === 'P0' && c.status !== 'closed')
  const stages = deriveStages(manifest)
  const currentStage = stages.find((s) => s.status === 'current') || null
  return {
    feature_id: manifest.feature_id || basename(dir),
    feature_name: manifest.feature_name || '',
    main_path: manifest.main_path || 'data',
    engine: manifest.engine || '',
    version: manifest.version || '',
    dir,
    gates,
    gate_summary: gateSummary,
    artifacts,
    artifact_summary: artifactSummary,
    clarifications,
    open_p0_count: openP0.length,
    stages,
    current_stage: currentStage ? currentStage.id : (stages.every((s) => s.status === 'done') ? '全部完成' : null),
    evidence_index: manifest.evidence_index || '',
    packet: manifest.packet || '',
  }
}

// ── 自动发现 feature 列表 ────────────────────────────────────────────────
function discoverFeatures(root) {
  const found = []
  if (!existsSync(root)) return found
  const changesDir = join(root, 'codespec', 'changes')
  if (!existsSync(changesDir)) return found
  for (const version of readdirSync(changesDir)) {
    const vDir = join(changesDir, version)
    if (!statSync(vDir).isDirectory()) continue
    for (const featureId of readdirSync(vDir)) {
      const fDir = join(vDir, featureId)
      if (!statSync(fDir).isDirectory()) continue
      const manifestPath = join(fDir, MANIFEST)
      if (!existsSync(manifestPath)) continue
      let summary
      try {
        summary = loadFeature(fDir)
      } catch {
        continue
      }
      found.push({
        feature_id: summary.feature_id,
        feature_name: summary.feature_name,
        main_path: summary.main_path,
        engine: summary.engine,
        version: summary.version || version,
        dir: fDir,
        current_stage: summary.current_stage,
        gate_summary: summary.gate_summary,
        artifact_summary: summary.artifact_summary,
        open_p0_count: summary.open_p0_count,
      })
    }
  }
  return found.sort((a, b) => String(b.version).localeCompare(String(a.version)))
}

// ── HTTP 工具 ────────────────────────────────────────────────────────────
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: String(message) })
}

function queryOf(req) {
  const url = new URL(req.url || '/', 'http://localhost')
  return url.searchParams
}

// ── 路由分发 ─────────────────────────────────────────────────────────────
export function handleIocApi(req, res, pathname) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendError(res, 405, '仅支持 GET(只读接口)')
    }
    const q = queryOf(req)
    if (pathname === '/ioc-api/features') {
      const root = q.get('root')
      if (!root) return sendError(res, 400, '缺少 root 参数(仓库根目录)')
      const list = discoverFeatures(resolve(root))
      return sendJson(res, 200, { ok: true, root: resolve(root), features: list })
    }
    if (pathname === '/ioc-api/feature' || pathname === '/ioc-api/feature/') {
      const path = q.get('path')
      if (!path) return sendError(res, 400, '缺少 path 参数(feature 目录)')
      const feature = loadFeature(resolve(path))
      return sendJson(res, 200, { ok: true, feature })
    }
    if (pathname === '/ioc-api/feature/tables') {
      // 第二批:血缘节点/边。先返回占位结构,后续从 manifest+设计+绑定解析。
      const path = q.get('path')
      if (!path) return sendError(res, 400, '缺少 path 参数(feature 目录)')
      return sendJson(res, 200, { ok: true, nodes: [], edges: [], note: '血缘解析在第二批实现(消费端→ADS→DWS/DWD→贴源表)' })
    }
    return sendError(res, 404, `未知端点: ${pathname}`)
  } catch (error) {
    return sendError(res, 500, error?.message || String(error))
  }
}

/** 挂载路由(在 apply 中调用);返回 disposer。 */
export function registerIocApi(ctx) {
  if (!ctx.webServer) {
    console.warn('[ioc-data-dev] webServer 不可用(非 web 形态),跳过工作台数据接口')
    return () => {}
  }
  let dispose = () => {}
  try {
    dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/ioc-api',
      handler: (req, res) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname
        handleIocApi(req, res, pathname)
      },
    })
    console.log('[ioc-data-dev] 工作台只读接口已挂载: /ioc-api/features /ioc-api/feature')
  } catch (error) {
    console.error(`[ioc-data-dev] 工作台接口挂载失败: ${error}`)
  }
  return () => {
    try {
      dispose()
    } catch {
      /* 忽略卸载错误 */
    }
  }
}
