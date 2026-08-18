// DeepSeek Harness 插件 — IOC 数据开发垂直领域(host 半)
//
// 加载方式:cordis.patch.yml 行 `dsh-plugin-ioc-data-dev`(bundle 根导出)。
// 零依赖:仅 node 内置模块;校验器本体为包内 Python(harness/tools/*.py,零依赖),
// 经 python3 调用,与原体系保持单一事实源。
//
// 本模块注册:
//   1. ioc_stage_gate    — 阶段出口门禁(CORE-AX9 Fail-Closed)
//   2. ioc_validate      — 结构校验器统一入口(sql-ddl/etl/domain/lifecycle/clarification/gate-change)
//   3. ioc_init_workspace— 在项目工作区落地领域骨架(codespec/harness/knowledge-base)
//   4. 领域技能 Provider — 把包内 skills/ 注册进 ctx.skills 目录
//   5. 行为守卫          — dsh/guards.js(pre/post-execute)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { apply as applyGuards } from './guards.js'
import { ROOT, TOOLS_DIR, SKILLS_DIR, py, parseFrontmatter } from './lib.js'

export const name = 'ioc-data-dev'
export const inject = ['tools', 'skills']

// ── 技能 Provider(SkillCandidate/SkillDefinition 兼容)──────────────────────

function makeSkillsProvider() {
  return {
    name: 'ioc-data-dev-fs',
    async list() {
      const candidates = []
      let entries = []
      try {
        entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
      } catch {
        return candidates
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const sk = join(SKILLS_DIR, entry.name, 'SKILL.md')
        if (!existsSync(sk)) continue
        let text
        try {
          text = readFileSync(sk, 'utf8')
        } catch {
          continue
        }
        const { meta } = parseFrontmatter(text)
        if (!meta.name || !meta.description) continue
        candidates.push({
          name: meta.name,
          description: meta.description,
          ...(meta.whenToUse ? { whenToUse: meta.whenToUse } : {}),
          rank: 300, // custom 层,与 filesystem provider 的 customSkillDirs 同级
          locator: sk,
          path: sk,
        })
      }
      return candidates
    },
    async get(candidate) {
      let text
      try {
        text = readFileSync(candidate.locator, 'utf8')
      } catch {
        return undefined
      }
      const { meta, body } = parseFrontmatter(text)
      return {
        name: meta.name,
        description: meta.description,
        ...(meta.whenToUse ? { whenToUse: meta.whenToUse } : {}),
        content: body,
        path: candidate.locator,
      }
    },
  }
}

// ── 工具注册 ───────────────────────────────────────────────────────────────
const VALIDATORS = {
  'sql-ddl': { script: 'validate_sql_ddl.py', args: (a) => ['--engine', a.engine || 'hive', ...(a.test ? ['--test'] : [])] },
  'sql-etl': { script: 'validate_sql_etl_patterns.py', args: () => [] },
  'domain-patterns': { script: 'validate_domain_patterns.py', args: () => [] },
  'lifecycle-columns': { script: 'validate_lifecycle_columns.py', args: () => [] },
  'ads-clarification': { script: 'validate_ads_clarification.py', args: () => [] },
  'gate-change': { script: 'validate_gate_change.py', args: () => [] },
  'deliverable-level': { script: 'deliverable_level.py', args: (a) => (a.min ? ['--min', a.min] : []) },
}

const textOutput = { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] }

function registerTools(ctx) {
  ctx.tools.register({
    name: 'ioc_stage_gate',
    description:
      'IOC 阶段出口门禁(CORE-AX9 Fail-Closed)。读取 feature 目录的 change-manifest.yaml,按 schema.yaml 的 blocks_when 规则检查 gate 置位、产物等级与契约存在性,返回 PASS 或 BLOCKED。BLOCKED 即停工,禁止自改 gates.* 绕过。Use when 推进 IOC 数据开发阶段(如 data-design → ads-design → sql-generate)、检查阶段能否进入/退出。',
    parameters: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'feature 目录(含 change-manifest.yaml 的绝对或相对路径)' },
        stage: {
          type: 'string',
          description:
            '目标阶段 id,如 intake/requirement/data-design/ads-design/ads-design-validation/ads-clarification-apply/clouddevops-review/sql-bindings-ready/sql-generate/sql-validation/job-create/platform-test/promotion/platform-formal/archive',
        },
      },
      required: ['feature', 'stage'],
    },
    output: textOutput,
    timeoutMs: 120_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: 'ioc_stage_gate',
      kind: 'read',
      rawInput: args,
      ...(typeof args?.feature === 'string' ? { locations: [{ path: args.feature }] } : {}),
    }),
    async execute(args) {
      if (typeof args?.feature !== 'string' || !args.feature.trim()) throw new Error('ioc_stage_gate 需要非空 "feature"')
      if (typeof args?.stage !== 'string' || !args.stage.trim()) throw new Error('ioc_stage_gate 需要非空 "stage"')
      const r = py('sdd_stage_gate.py', ['--feature', args.feature, '--stage', args.stage])
      return r.text || (r.ok ? 'PASS' : 'BLOCKED')
    },
  })

  ctx.tools.register({
    name: 'ioc_validate',
    description:
      'IOC 结构校验器统一入口。对产物文件运行零依赖的 validate_*.py(DDL/ETL 模式/领域模式/指标生命周期/澄清项/门禁清单)。返回逐项 PASS/FAIL。Use when 生成或修改 hql SQL、delta-design-ads.md、feature-delta-indicator.md、change-manifest.yaml、*-clarification-questions.md 后需要机器校验。',
    parameters: {
      type: 'object',
      properties: {
        validator: {
          type: 'string',
          enum: Object.keys(VALIDATORS),
          description:
            '校验器:sql-ddl(DDL 结构,POL-SQL-DDL-*)/sql-etl(ETL 模式,KW-AX3)/domain-patterns(领域模式,KW-AX5)/lifecycle-columns(指标生命周期,CORE-AX6)/ads-clarification(澄清项,CORE-AX8)/gate-change(门禁清单,CORE-AX9)/deliverable-level(产物等级)',
        },
        path: { type: 'string', description: '目标文件或目录(目录时校验其中全部 *.sql)' },
        engine: { type: 'string', enum: ['hive', 'dli'], description: '引擎分支(仅 sql-ddl 使用,默认 hive)' },
        test: { type: 'boolean', description: '测试态 SQL(仅 sql-ddl 使用:表名/目标库分支)' },
        min: { type: 'string', enum: ['L1', 'L2', 'L3'], description: '最低产物等级(仅 deliverable-level)' },
      },
      required: ['validator', 'path'],
    },
    output: textOutput,
    timeoutMs: 120_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: `ioc_validate:${args?.validator || ''}`,
      kind: 'read',
      rawInput: args,
      ...(typeof args?.path === 'string' ? { locations: [{ path: args.path }] } : {}),
    }),
    async execute(args) {
      const def = VALIDATORS[args?.validator]
      if (!def) throw new Error(`ioc_validate 未知校验器 ${args?.validator}(可选: ${Object.keys(VALIDATORS).join(', ')})`)
      if (typeof args?.path !== 'string' || !args.path.trim()) throw new Error('ioc_validate 需要非空 "path"')
      const r = py(def.script, [args.path, ...def.args(args)])
      return r.text || (r.ok ? 'PASS' : 'FAIL')
    },
  })

  ctx.tools.register({
    name: 'ioc_init_workspace',
    description:
      '初始化 IOC 数据开发工作区:把领域骨架(codespec/ 流程schema与规范、harness/ 阶段卡片与工具、knowledge-base/ 知识底座、AGENTS.md)复制到目标目录,并创建 codespec/changes/ 增量工作区。Use when 新项目接入 IOC 垂直领域、工作区缺少 codespec/harness/knowledge-base 骨架。',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '目标目录(应为空或不存在;相对路径基于当前工作区)' },
      },
      required: ['target'],
    },
    output: textOutput,
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: 'ioc_init_workspace',
      kind: 'write',
      rawInput: args,
      ...(typeof args?.target === 'string' ? { locations: [{ path: args.target }] } : {}),
    }),
    async execute(args) {
      if (typeof args?.target !== 'string' || !args.target.trim()) throw new Error('ioc_init_workspace 需要非空 "target"')
      const target = resolve(args.target)
      if (existsSync(join(target, 'codespec'))) {
        throw new Error(`[ioc] ${target}/codespec 已存在,拒绝覆盖。请在空目录初始化或选择其它 target。`)
      }
      mkdirSync(target, { recursive: true })
      const parts = [
        ['codespec', join(ROOT, 'codespec')],
        ['harness', join(ROOT, 'harness')],
        ['knowledge-base', join(ROOT, 'knowledge-base')],
        ['.cac', join(ROOT, '.cac')],
        ['AGENTS.md', join(ROOT, 'AGENTS.md')],
      ]
      const done = []
      for (const [name, src] of parts) {
        if (!existsSync(src)) continue
        cpSync(src, join(target, name), { recursive: true })
        done.push(name)
      }
      mkdirSync(join(target, 'codespec', 'changes'), { recursive: true })
      // 技能目录指针:领域技能由插件全局注册,工作区只需一份索引说明
      writeFileSync(
        join(target, 'skills-INDEX.md'),
        '领域技能由 dsh-plugin-ioc-data-dev 插件全局注册(ioc-vertical / ioc-stage-gate / ioc-data-design / ioc-ads-design / sql-generator / sql-validator / sdd-archive-workspace / ioc-clarification)。\n',
        'utf8',
      )
      return (
        `[ioc] 工作区初始化完成: ${target}\n` +
        `  已创建: ${done.join(', ')}\n` +
        `  下一步:\n` +
        `    1. 新建变更: 在 codespec/changes/{version}/{feature-id}/ 下创建 change-manifest.yaml(模板见 codespec/schemas/ioc-workflow/templates/)\n` +
        `    2. 阶段门禁: 调用 ioc_stage_gate(feature=<目录>, stage=<阶段>)\n` +
        `    3. 校验产物: 调用 ioc_validate(validator=<...>, path=<文件>)\n` +
        `  核心纪律: 先查 knowledge-base/(CORE-AX4);门禁 BLOCKED 即停工(CORE-AX9);工具失败禁止落盘 evidence(CORE-AX10)。`
      )
    },
  })
}

export function apply(ctx, config = {}) {
  const guardsEnabled = config.guardsEnabled !== false
  const skillsEnabled = config.skillsEnabled !== false

  if (skillsEnabled) {
    try {
      const dispose = ctx.skills.register(makeSkillsProvider())
      ctx.effect(() => dispose?.())
    } catch (error) {
      console.error(`[ioc-data-dev] skills provider 注册失败: ${error}`)
    }
  }
  if (guardsEnabled) {
    try {
      applyGuards(ctx, config)
    } catch (error) {
      console.error(`[ioc-data-dev] 行为守卫挂载失败: ${error}`)
    }
  }
  registerTools(ctx)
  console.log('[ioc-data-dev] 垂直领域已加载: ioc_stage_gate / ioc_validate / ioc_init_workspace + 守卫 + 技能')
}
