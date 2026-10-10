// 用一个假的 ctx 验证 facts 行：契约合法 + 惰性解析（不受挂载顺序影响）
const { apply, inject, name } = await import('./facts.js')

let contributor
const fakeCtx = { shellEnv: { register: (c) => { contributor = c } } }
apply(fakeCtx)

console.log('name       =', name)
console.log('inject     =', JSON.stringify(inject))
console.log('contributor=', contributor?.name)

const declared = Object.keys(contributor.variables)
const first = contributor.resolve()
console.log('\n第一次 resolve():', JSON.stringify(first))
console.log('返回的 key 全部已声明 ?', Object.keys(first).every((k) => declared.includes(k)))
console.log('每个 key 都有 description ?', Object.values(contributor.variables).every((v) => typeof v.description === 'string' && v.description.length > 0))
console.log('保留了内置 key ?', declared.some((k) => ['DSH_HOME','DSH_SHELL','DSH_SESSION_ID','DSH_PROFILE','DSH_PROFILE_DIR'].includes(k)) ? 'YES (违规)' : 'NO (good)')

// 惰性：改变环境后，同一个 contributor 应给出新值。
// 必须走 OHOS_SHELL 覆盖路径：resolveShell 会主动"纠正"它不接受的 shell。
process.env.OHOS_SHELL = '/bin/sh'
const second = contributor.resolve()
console.log('\n设置 OHOS_SHELL=/bin/sh 后再次 resolve():', JSON.stringify(second))
const lazy = second.DSH_OHOS_SHELL === '/bin/sh'
console.log(lazy ? 'PASS  惰性解析生效（无挂载顺序竞争）' : 'FAIL  仍在激活时固化')
process.exit(lazy ? 0 : 1)
