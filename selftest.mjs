import { installOhosEnvironment, describeEnvironment, which, isExecutableFile, isWritableDirectory } from './detect.js'

const before = { ...process.env }
console.log('--- BEFORE ---')
console.log('SHELL      =', process.env.SHELL)
console.log('TMPDIR     =', process.env.TMPDIR)
console.log('NODE_OPTIONS=', process.env.NODE_OPTIONS)
console.log('PATH       =', process.env.PATH)

console.log('\n--- describe ---')
console.log(JSON.stringify(describeEnvironment(), null, 2))

console.log('\n--- install #1 ---')
const first = installOhosEnvironment()
for (const c of first.changes) console.log('  CHANGE:', c)
for (const w of first.warnings) console.log('  WARN  :', w)

console.log('\n--- install #2 (idempotency) ---')
const second = installOhosEnvironment()
console.log('  changes on second run:', second.changes.length === 0 ? 'NONE (good)' : second.changes)

console.log('\n--- AFTER ---')
console.log('SHELL      =', process.env.SHELL)
console.log('TMPDIR     =', process.env.TMPDIR)
console.log('NODE_OPTIONS=', process.env.NODE_OPTIONS)
console.log('PATH       =', process.env.PATH)

console.log('\n--- assertions ---')
const checks = []
checks.push(['SHELL is zsh', process.env.SHELL === '/usr/bin/zsh'])
checks.push(['SHELL executable', isExecutableFile(process.env.SHELL)])
checks.push(['TMPDIR writable', isWritableDirectory(process.env.TMPDIR)])
checks.push(['TMPDIR not /tmp', process.env.TMPDIR !== '/tmp'])
checks.push(['NODE_OPTIONS has shim', process.env.NODE_OPTIONS.includes('userinfo-shim.cjs')])
checks.push(['NODE_OPTIONS single shim', process.env.NODE_OPTIONS.split('userinfo-shim.cjs').length === 2])
checks.push(['PATH has no duplicates', new Set(process.env.PATH.split(':')).size === process.env.PATH.split(':').length])
const head = process.env.PATH.split(':').slice(0, 5)
checks.push(['PATH leads with brew entries', head[0].includes('rustup/bin') && head.includes(process.env.HOMEBREW_PREFIX + '/bin')])
checks.push(['brew resolvable', which('brew') !== undefined])
checks.push(['jq resolvable', which('jq') !== undefined])
checks.push(['git resolvable', which('git') !== undefined])
checks.push(['zsh resolvable', which('zsh') !== undefined])
checks.push(['unrelated PATH entries kept', process.env.PATH.includes('/usr/bin') && process.env.PATH.includes('/vendor/bin')])
for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)

console.log('\n--- restore ---')
first.restore()
const restored = Object.keys({ ...before, ...process.env }).filter((k) => before[k] !== process.env[k] && before[k] !== undefined)
console.log('  keys differing from BEFORE after restore:', restored.length === 0 ? 'NONE (good)' : restored)
console.log('  SHELL back to', process.env.SHELL, '| TMPDIR back to', process.env.TMPDIR)

const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`)
process.exit(failed === 0 ? 0 : 1)
