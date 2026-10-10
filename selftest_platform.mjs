// 平台守卫：只有鸿蒙/OpenHarmony 才能运行本包；非鸿蒙上必须"什么都不改"
import { isOhos, OHOS_PLATFORM } from './detect.js'
import { readFileSync } from 'node:fs'

const checks = []
const check = (label, ok) => checks.push([label, ok])

console.log('process.platform =', process.platform)
console.log('isOhos()         =', isOhos())

// 1. 本机就是鸿蒙（openharmony），判定必须为真
check(`platform "${OHOS_PLATFORM}" is OHOS`, isOhos() === true)

// 2. 发布就绪：可发布、且捆绑包补丁已声明（平台限制不靠包管理器元数据）
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
check('package.json is publishable (no private)', manifest.private !== true)
check('package.json declares the bundle patch', manifest.dsh?.bundle?.patch === './cordis.patch.yml')
check('package.json carries no os field', manifest.os === undefined)

// 3. OHOS_FORCE 覆盖：0 = 强制非鸿蒙，1 = 强制鸿蒙
process.env.OHOS_FORCE = '0'
check('OHOS_FORCE=0 forces non-OHOS', isOhos() === false)
process.env.OHOS_FORCE = '1'
check('OHOS_FORCE=1 forces OHOS', isOhos() === true)
delete process.env.OHOS_FORCE

// 4. 拒绝路径：非鸿蒙上 index.js 只报错，环境必须逐字节不变
process.env.OHOS_FORCE = '0'
const before = { ...process.env }
const errors = []
const warnings = []
let effects = 0
const fakeCtx = {
  logger: {
    info: () => {},
    warn: (message) => warnings.push(message),
    error: (message) => errors.push(message),
  },
  effect: () => { effects++ },
  shellEnv: { register: () => { throw new Error('facts row registered on a non-OHOS platform') } },
}

const { apply: applyEnv } = await import('./index.js')
applyEnv(fakeCtx)
const changed = Object.keys({ ...before, ...process.env }).filter((key) => before[key] !== process.env[key])
check('index.js logged an error', errors.length === 1 && errors[0].includes('HarmonyOS / OpenHarmony only'))
check('index.js changed no environment key', changed.length === 0)
check('index.js registered no effect', effects === 0)

const { apply: applyFacts } = await import('./facts.js')
applyFacts(fakeCtx)
check('facts.js registered no contributor', warnings.length === 1 && warnings[0].includes('DSH_OHOS'))
delete process.env.OHOS_FORCE

console.log('\n--- assertions ---')
for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
