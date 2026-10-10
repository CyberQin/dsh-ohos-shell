import { installOhosEnvironment } from './detect.js'
import { spawnSync } from 'node:child_process'

const PROBE = 'try{console.log("child-ok:",require("os").userInfo().username)}catch(e){console.log("child-THROWS:",e.code)}'

console.log('--- 加固前，子 node 进程 ---')
console.log('  ', spawnSync(process.execPath, ['-e', PROBE], { encoding: 'utf8' }).stdout.trim())

installOhosEnvironment()

console.log('--- 加固后（模拟子进程继承 process.env）---')
const r = spawnSync(process.execPath, ['-e', PROBE], { encoding: 'utf8' })
console.log('  ', r.stdout.trim())
const ok = r.stdout.includes('child-ok:')
console.log(ok ? '\nRESULT: PASS — 子进程崩溃已消除' : '\nRESULT: FAIL')
process.exit(ok ? 0 : 1)
