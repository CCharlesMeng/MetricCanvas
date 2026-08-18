// dsh/guards.js — IOC 行为守卫(原 .cac/hooks 的 DSH 落地)
//
// 挂载点:
//   tools/pre-execute  — 硬性模板约束:违反 → deny(CORE-AX8/AX9/AX10)
//   tools/post-execute — 结构守卫:对约束产物运行 validate_*.py,FAIL → guard-report.md
//
// 设计原则:只在精确命中 IOC 约束产物时介入,绝不干扰其它文件;守卫可被
// cordis.patch.yml 的 config.guardsEnabled=false 整体关闭。
import { basename, dirname, join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { py } from './lib.js'

const WRITE_TOOLS = new Set(['write', 'edit'])

// basename(小写) → { validators: [脚本名], pre: 写前硬约束(可选) }
// 与 codespec/guidelines/ioc-kernel/template-constraints.yaml、behavioral-guards.yaml 对齐
const CONSTRAINED = {
  'change-manifest.yaml': {
    validators: ['validate_gate_change.py'],
    pre: (content) => {
      // CORE-AX9:禁止新增未登记 gate、非法 gate 值
      const legal = ['not_started', 'in_progress', 'pass', 'fail', 'waived']
      const known = [
        'data_design', 'ads_design_validation', 'clouddevops_review',
        'ads_clarification_applied', 'service_design', 'service_develop',
        'sql_bindings_ready', 'sql_validation_static', 'test_execution',
        'platform_test', 'sql_promotion', 'platform_formal',
      ]
      for (const line of content.split(/\r?\n/)) {
        const m = /^(\s*)([a-z_]+):\s*(\S+)/.exec(line)
        if (!m) continue
        if (m[2] === 'gates') continue
        if (known.includes(m[2])) {
          if (!legal.includes(m[3])) return `gate ${m[2]} 值 ${m[3]} 非法(须 ${legal.join('/')})`
        }
      }
      return null
    },
  },
  'feature-delta-indicator.md': {
    validators: ['validate_lifecycle_columns.py'],
  },
  'ads-clarification-questions.md': {
    validators: ['validate_ads_clarification.py'],
    pre: (content) => {
      // CORE-AX8:AI 不得 closed P0;closed 必须人类裁定(兼容 label 格式与表格行格式)
      const low = content.toLowerCase()
      const labelForm = /status\s*[:|]\s*closed/.test(low) && /closed_by\s*[:|]\s*(ai|agent|模型|机器)/.test(low)
      const rowForm = /^\s*\|[^|]*\|[^|]*\|\s*closed\s*\|[^|]*\|[^|]*\|\s*(?:ai|agent|模型|机器)\s*\|/im.test(low)
      if (labelForm || rowForm) {
        return '澄清项 closed_by 为 AI(CORE-AX8:只能由人类裁定)'
      }
      return null
    },
  },
  'data-design-clarification-questions.md': {
    validators: ['validate_ads_clarification.py'],
    pre: (content) => {
      const low = content.toLowerCase()
      const labelForm = /status\s*[:|]\s*closed/.test(low) && /closed_by\s*[:|]\s*(ai|agent|模型|机器)/.test(low)
      const rowForm = /^\s*\|[^|]*\|[^|]*\|\s*closed\s*\|[^|]*\|[^|]*\|\s*(?:ai|agent|模型|机器)\s*\|/im.test(low)
      if (labelForm || rowForm) {
        return '澄清项 closed_by 为 AI(CORE-AX8:只能由人类裁定)'
      }
      return null
    },
  },
  'subject-clarification-questions.md': {
    validators: ['validate_ads_clarification.py'],
    pre: (content) => {
      const low = content.toLowerCase()
      const labelForm = /status\s*[:|]\s*closed/.test(low) && /closed_by\s*[:|]\s*(ai|agent|模型|机器)/.test(low)
      const rowForm = /^\s*\|[^|]*\|[^|]*\|\s*closed\s*\|[^|]*\|[^|]*\|\s*(?:ai|agent|模型|机器)\s*\|/im.test(low)
      if (labelForm || rowForm) {
        return '澄清项 closed_by 为 AI(CORE-AX8:只能由人类裁定)'
      }
      return null
    },
  },
  'validation-report.md': {
    validators: [],
  },
}

// hql 文件按目录/后缀命中
function hqlValidators() {
  return ['validate_sql_ddl.py', 'validate_sql_etl_patterns.py', 'validate_domain_patterns.py']
}

function artifactRules(filePath) {
  const base = basename(filePath).toLowerCase()
  if (Object.prototype.hasOwnProperty.call(CONSTRAINED, base)) {
    return CONSTRAINED[base]
  }
  if (/(^|[\\/])(hql_test|hql)[\\/]/.test(filePath) && /\.sql$/i.test(filePath)) {
    return { validators: hqlValidators() }
  }
  return null
}

// 写前内容取法:write 有全量 content;edit 只有增量,无法可靠全文校验 → 仅对
// 澄清/清单这类"增量即危险"的文件用 new_string 做关键字检查
function contentFor(name, args) {
  if (name === 'write') return args?.content ?? ''
  if (name === 'edit') return args?.new_string ?? ''
  return ''
}

function guardReportPath(filePath) {
  return join(dirname(filePath), 'guard-report.md')
}

function writeGuardReport(filePath, lines) {
  try {
    const p = guardReportPath(filePath)
    const body = [
      '# guard-report.md — 结构守卫记录',
      '',
      `> 触发文件: ${filePath}`,
      `> 时间: ${new Date().toISOString()}`,
      '',
      ...lines,
    ].join('\n')
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, body, 'utf8')
  } catch (error) {
    console.error(`[ioc-data-dev] guard-report 写入失败: ${error}`)
  }
}

export function apply(ctx, config = {}) {
  // ── 写前硬约束:违反 → deny ────────────────────────────────────────────
  ctx.on('tools/pre-execute', async (exec, next) => {
    const name = exec?.name
    if (!WRITE_TOOLS.has(name)) return next()
    const args = exec?.arguments ?? {}
    const file = typeof args?.file_path === 'string' ? args.file_path : ''
    if (!file) return next()
    const rules = artifactRules(file)
    if (!rules?.pre) return next()
    const content = contentFor(name, args)
    try {
      const violation = rules.pre(content)
      if (violation) {
        return {
          kind: 'deny',
          reason: `[ioc-guard] 写入 ${basename(file)} 违反模板约束: ${violation}(CORE-AX;禁止绕过,见 template-constraints.yaml)`,
        }
      }
    } catch (error) {
      console.error(`[ioc-data-dev] pre-execute 守卫异常: ${error}`)
    }
    return next()
  })

  // ── 写后结构守卫:FAIL → guard-report.md ──────────────────────────────
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const name = exec?.name
    if (!WRITE_TOOLS.has(name)) return next()
    if (result?.isError) return next()
    const args = exec?.arguments ?? {}
    const file = typeof args?.file_path === 'string' ? args.file_path : ''
    if (!file) return next()
    const rules = artifactRules(file)
    if (!rules || !rules.validators.length) return next()

    const lines = []
    let failed = false
    for (const script of rules.validators) {
      try {
        const r = py(script, [file])
        if (r.ok) {
          lines.push(`- [PASS] ${script}`)
        } else {
          failed = true
          lines.push(`- [FAIL] ${script}`)
          lines.push('  ```')
          lines.push(r.text.split('\n').map((l) => `  ${l}`).join('\n'))
          lines.push('  ```')
        }
      } catch (error) {
        failed = true
        lines.push(`- [ERROR] ${script}: ${error.message}`)
      }
    }
    if (failed) {
      lines.push('', '> 结构守卫 FAIL:阶段门禁(ioc_stage_gate)将检查 guard-report.md;修复前不得放行。')
      writeGuardReport(file, lines)
    }
    return next()
  })
}
