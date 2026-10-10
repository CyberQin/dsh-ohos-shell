import { installOhosEnvironment, which, isWritableDirectory } from './detect.js'
import { tmpdir, userInfo } from 'node:os'

console.log('--- 模拟"从桌面图标启动"的裸环境 ---')
console.log('PATH        =', JSON.stringify(process.env.PATH))
console.log('SHELL       =', JSON.stringify(process.env.SHELL))
console.log('TMPDIR      =', JSON.stringify(process.env.TMPDIR))
console.log('NODE_OPTIONS=', JSON.stringify(process.env.NODE_OPTIONS))
try { userInfo(); console.log('userInfo()  = OK (unexpected)') }
catch (e) { console.log('userInfo()  = THROWS', e.code, '<-- 这就是崩溃点') }
console.log('os.tmpdir() =', tmpdir())

const { changes } = installOhosEnvironment()
console.log('\n--- 插件做了什么 ---')
for (const c of changes) console.log('  ' + c)

console.log('\n--- 修复后 ---')
console.log('PATH        =', process.env.PATH)
console.log('SHELL       =', process.env.SHELL)
console.log('TMPDIR      =', process.env.TMPDIR)
console.log('os.tmpdir() =', tmpdir())

const checks = [
  ['brew 可解析', which('brew') !== undefined],
  ['jq 可解析', which('jq') !== undefined],
  ['git 可解析 (keg-only)', which('git') !== undefined],
  ['node 可解析', which('node') !== undefined],
  ['zsh 可解析', which('zsh') !== undefined],
  ['zsh 成为默认 shell', process.env.SHELL === '/usr/bin/zsh'],
  ['TMPDIR 可写', isWritableDirectory(process.env.TMPDIR)],
  ['os.tmpdir() 不再指向只读 /tmp', tmpdir() !== '/tmp'],
  ['NODE_OPTIONS 挂上 shim', (process.env.NODE_OPTIONS ?? '').includes('userinfo-shim.cjs')],
]
console.log('\n--- 断言 ---')
for (const [l, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`)
const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS (裸环境已被救回)' : failed + ' FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
