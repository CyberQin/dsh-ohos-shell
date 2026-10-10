/**
 * Offline self-test for the FPATH / vendored-zsh-functions behaviour.
 *
 * Proves:
 *  - `installOhosEnvironment()` puts the bundle's `zsh-functions/` on `FPATH`;
 *  - a real `zsh` resolves `add-zsh-hook` from the shipped copy (not from the
 *    broken compiled-in path);
 *  - the shipped files are byte-identical to zsh 5.9 upstream;
 *  - `restore()` puts `FPATH` back.
 *
 * The interactive `add-zle-hook-widget` path needs a live zle, so it is covered
 * by `ohos-shell-probe/zsh_wrapper_e2e.py` instead.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { installOhosEnvironment, resolveZshFunctionsDir, resolveFpath } from './detect.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const functionsDir = join(here, 'zsh-functions')

/** Expected sha256 of the unmodified zsh 5.9 files. */
const UPSTREAM = {
  'add-zsh-hook': 'f0e9ac9dfe1b2367164d6674924b5297621881a4a325860942d72ec7f7281a8d',
  'add-zle-hook-widget': '0d00fe1f9ca24ab43d38d11e30ae2dcab64ecb375aad0c688d6c65a976f59d4e',
}

const checks = []
const check = (label, ok) => checks.push([label, ok])

for (const [file, expected] of Object.entries(UPSTREAM)) {
  const actual = createHash('sha256').update(readFileSync(join(functionsDir, file))).digest('hex')
  check(`${file} matches upstream zsh 5.9`, actual === expected)
}

const before = process.env.FPATH
const { changes, restore } = installOhosEnvironment()

console.log('--- changes ---')
for (const change of changes) console.log('  ' + change)

check('FPATH is set', (process.env.FPATH ?? '').length > 0)
check('FPATH leads with the vendored directory', (process.env.FPATH ?? '').split(':')[0] === functionsDir)
check('resolveZshFunctionsDir() finds it', resolveZshFunctionsDir() === functionsDir)
check('resolveFpath() includes the platform directory', resolveFpath(functionsDir).includes('/system/usr/share/zsh/functions'))

// A real zsh must now resolve the function from the shipped copy.
const probe = spawnSync('/usr/bin/zsh', ['-f', '-c', 'autoload -Uz add-zsh-hook; add-zsh-hook -h 2>&1 | head -1'], {
  encoding: 'utf8',
  env: process.env,
})
const probeText = (probe.stdout ?? '').trim()
check('zsh loads add-zsh-hook from the shipped copy', probeText.includes('Usage: add-zsh-hook'))
check('no function-not-found error', !probeText.includes('not found'))

console.log('\n--- zsh 实际加载结果 ---')
console.log('  ' + (probeText || '<empty>'))

restore()
check('restore() puts FPATH back', (process.env.FPATH ?? undefined) === before)

console.log('\n--- assertions ---')
for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)

const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`)
process.exit(failed === 0 ? 0 : 1)