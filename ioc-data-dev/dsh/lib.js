// dsh/lib.js — 插件共享工具(零依赖)
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')
export const TOOLS_DIR = join(ROOT, 'harness', 'tools')
export const SKILLS_DIR = join(ROOT, 'skills')

export function runPy(args, timeoutMs = 90_000) {
  const res = spawnSync('python3', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
  })
  if (res.error) {
    return { ok: false, text: `[ioc] 无法运行 python3: ${res.error.message}(需要 python3 环境)` }
  }
  const text = `${res.stdout || ''}${res.stderr ? `\n${res.stderr}` : ''}`.trim()
  return { ok: res.status === 0, text }
}

export function py(script, args) {
  return runPy([join(TOOLS_DIR, script), ...args])
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseFrontmatter(text) {
  const m = FM_RE.exec(text)
  if (!m) return { meta: {}, body: text }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) {
      const key = line.slice(0, i).trim()
      const value = line.slice(i + 1).trim()
      if (value) meta[key] = value
    }
  }
  return { meta, body: text.slice(m[0].length) }
}
