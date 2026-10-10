// 复刻 dsh-api-terminal-controller 的 resolveShell / discoverShells，
// 输入取本进程 env（它就是 Host 交给子进程的那份 scrubbed 副本，SHELL/PATH 与 Host 一致）。
import { accessSync, constants, statSync } from 'node:fs'
import { isAbsolute, join, delimiter } from 'node:path'

const name = (p) => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1)
const kind = (p) => name(p).toLowerCase().replace(/\.exe$/u, '')
const profile = (p) => ({ path: p, name: name(p), args: kind(p) === 'pwsh' || kind(p) === 'powershell' ? ['-NoLogo'] : ['-i'] })

function loadAbsolute(c) {
  try { if (!statSync(c).isFile()) return undefined; accessSync(c, constants.X_OK); return c } catch { return undefined }
}
function resolveExecutable(cmd) {
  if (isAbsolute(cmd)) return loadAbsolute(cmd)
  for (const d of (process.env.PATH ?? '').split(delimiter)) {
    if (!d) continue
    const hit = loadAbsolute(join(d, cmd))
    if (hit !== undefined) return hit
  }
  return undefined
}

const configured = undefined                       // Host 的 terminal-controller 行没有 shell 配置
const defaultShell = process.env.SHELL             // terminalEnvironment().defaultShell
const preferredPath = configured ?? defaultShell ?? '/bin/sh'
const preferred = profile(preferredPath)
const candidates = ['zsh', 'bash', 'fish', 'pwsh', 'powershell', 'cmd']
const found = candidates.map((c) => { const p = resolveExecutable(c); return p === undefined ? undefined : profile(p) })

const shells = new Map()
for (const s of [preferred, ...found]) { if (s === undefined) continue; if (!shells.has(kind(s.path))) shells.set(kind(s.path), s) }

console.log('process.env.SHELL            =', process.env.SHELL)
console.log('解析出的默认 shell (default)  =', preferred.path, JSON.stringify(preferred.args))
console.log('\n侧栏 ▾ 选单将列出:')
for (const [k, s] of shells) console.log(`  ${k.padEnd(6)} ${s.path}  ${JSON.stringify(s.args)}`)
console.log('\n首个 = 默认打开的那个。')
const gap = preferred.path !== defaultShell
console.log('\n是否仍会开出 mksh (/bin/sh) ?', preferred.path === '/bin/sh' ? 'YES — 未修复' : 'NO — 已修复')
process.exit(preferred.path === '/bin/sh' ? 1 : 0)
