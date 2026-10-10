/**
 * HarmonyOS / OpenHarmony environment detection for `dsh-ohos-shell`.
 *
 * HarmonyOS differs from a normal Linux host in five ways that matter to a
 * Harness child process:
 *
 * - `SHELL` is `/bin/sh`, and `/bin/sh` here is **mksh** (MirBSD Korn Shell),
 *   which reads `${ENV:-~/.mkshrc}` and therefore no configuration at all. It
 *   is neither bash nor zsh, so a sidebar terminal started that way loses the
 *   user's aliases, functions, completions and prompt.
 * - `/etc/shells` does not exist, so nothing discovers the installed shells.
 * - `/tmp` is read-only; a writable `TMPDIR` is mandatory.
 * - The app-sandbox uid (2000xxxx) has no `/etc/passwd` entry, so Node's
 *   `os.userInfo()` throws `uv_os_get_passwd ENOENT` unless a preload shim
 *   replaces it. Node CLIs call it without a try/catch.
 * - zsh ships without its function library: the compiled-in `fpath` points at
 *   the build machine, and `/system/usr/share/zsh/functions` holds 3 files out
 *   of upstream's 281. Two of the missing ones are exactly what the Harness's
 *   zsh integration autoloads, so a zsh terminal prints `function definition
 *   file not found` three times at startup. `FPATH` is tied to zsh's `fpath`
 *   special parameter, so this module can supply them from `zsh-functions/`.
 *
 * Everything here works by mutating `process.env`. That is deliberate:
 * `scrubbedParentEnv()` in `@deepseek-ai/dsh-subprocess` reads `process.env` at
 * every spawn, so one mutation at activation reaches the Web sidebar terminal,
 * the model-facing `bash` tool, subagents and MCP servers alike.
 *
 * This module is for HarmonyOS and OpenHarmony only. `isOhos()` answers that
 * question, the two plugin rows refuse to run when it says no, and the package
 * declares `os: ["openharmony"]` so npm refuses the installation elsewhere.
 *
 * @module dsh-ohos-shell/detect
 */

import { accessSync, constants, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Environment keys this module may take over; captured and restored together. */
export const MANAGED_KEYS = [
  'PATH',
  'SHELL',
  'TMPDIR',
  'NODE_OPTIONS',
  'FPATH',
  'HOMEBREW_PREFIX',
  'HOMEBREW_CELLAR',
  'HOMEBREW_REPOSITORY',
  'INFOPATH',
]

/**
 * Directories a complete zsh function library would live in, most specific
 * first. `/system/usr/share/zsh/functions` is the path the platform's own
 * `/etc/zshrc` appends.
 */
const PLATFORM_ZSH_FUNCTIONS = [
  '/usr/local/share/zsh/site-functions',
  '/system/usr/share/zsh/functions',
  '/usr/share/zsh/functions',
]

/** The two functions the Harness's zsh integration autoloads. */
const REQUIRED_ZSH_FUNCTIONS = ['add-zsh-hook', 'add-zle-hook-widget']

/** Shell basenames this launcher accepts as "already configured". */
const ACCEPTED_SHELLS = ['zsh', 'bash']

/** The `process.platform` value an OpenHarmony Node runtime reports. */
export const OHOS_PLATFORM = 'openharmony'

/**
 * Files that exist only on the OpenHarmony platform layout, used to recognise
 * an OHOS Node build that reports the generic `linux` platform instead of
 * `openharmony`. Every one of them must be present.
 */
const OHOS_MARKERS = ['/system/bin/aa', '/system/usr/share/zsh/functions']

/** @param {string} path @returns {boolean} whether `path` is a directory. */
function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** @param {string} path @returns {boolean} whether `path` is a regular file. */
function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/**
 * @param {string} path - candidate executable.
 * @returns {boolean} whether `path` is a regular, executable file.
 */
export function isExecutableFile(path) {
  if (path === undefined || path === null || path.length === 0) return false
  if (!isFile(path)) return false
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** @param {string} path @returns {boolean} whether `path` exists at all. */
function exists(path) {
  return isDirectory(path) || isFile(path)
}

/**
 * Whether this process runs on HarmonyOS / OpenHarmony.
 *
 * `process.platform` is the authoritative answer: the OpenHarmony Node runtime
 * reports `openharmony`, a value that no desktop platform produces. A few OHOS
 * Node builds report the generic `linux` instead, so the platform's own layout
 * is a second and much narrower signal — `/system/bin/aa` and
 * `/system/usr/share/zsh/functions` both exist only on OHOS.
 *
 * `OHOS_FORCE` overrides the verdict: `1` means HarmonyOS, `0` means not. The
 * override serves a build the two signals misjudge, and the tests. It is the
 * only way to run this package where the platform is misreported; it never
 * relaxes anything else.
 *
 * @returns {boolean} whether the OHOS environment may be installed here.
 */
export function isOhos() {
  const override = process.env.OHOS_FORCE
  if (override === '1') return true
  if (override === '0') return false
  if (process.platform === OHOS_PLATFORM) return true
  return process.platform === 'linux' && OHOS_MARKERS.every(exists)
}

/**
 * Probe real writability. Permission bits are not enough on HarmonyOS: `/tmp`
 * carries mode 1777 yet sits on a read-only mount, so the only reliable test is
 * a write.
 *
 * @param {string} dir - candidate directory.
 * @returns {boolean} whether a file can actually be created in `dir`.
 */
export function isWritableDirectory(dir) {
  if (dir === undefined || dir.length === 0 || !isDirectory(dir)) return false
  const probe = join(dir, `.dsh-ohos-probe-${String(process.pid)}`)
  try {
    writeFileSync(probe, '')
    unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a bare command through `PATH`.
 * @param {string} command - bare executable name.
 * @param {NodeJS.ProcessEnv} [env] - environment whose `PATH` to search.
 * @returns {string | undefined} the first executable match.
 */
export function which(command, env = process.env) {
  for (const directory of (env.PATH ?? '').split(delimiter)) {
    if (directory.length === 0) continue
    const candidate = join(directory, command)
    if (isExecutableFile(candidate)) return candidate
  }
  return undefined
}

/** @param {string} path @returns {string} the final path segment. */
function basename(path) {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut === -1 ? path : path.slice(cut + 1)
}

/**
 * Resolve the harmonybrew (Homebrew-for-OHOS) prefix.
 *
 * `OHOS_BREW_PREFIX` wins, then the inherited `HOMEBREW_PREFIX`, then the
 * default install location under the current home directory. No path is
 * hardcoded: the prefix has to be found on the machine that runs this package.
 *
 * @returns {string | undefined} an existing prefix directory.
 */
export function resolveBrewPrefix() {
  const explicit = process.env.OHOS_BREW_PREFIX
  if (explicit !== undefined && isDirectory(explicit)) return explicit
  const candidates = [
    process.env.HOMEBREW_PREFIX,
    join(homedir(), '.harmonybrew'),
  ]
  for (const candidate of candidates) {
    if (candidate !== undefined && isDirectory(join(candidate, 'bin'))) return candidate
  }
  return undefined
}

/** @returns {string | undefined} the pnpm global bin's parent directory. */
function resolvePnpmHome() {
  const explicit = process.env.PNPM_HOME
  if (explicit !== undefined && isDirectory(explicit)) return explicit
  const fallback = join(homedir(), '.local', 'share', 'pnpm')
  return isDirectory(fallback) ? fallback : undefined
}

/**
 * Pick the interactive shell the sidebar terminal should default to.
 *
 * The sidebar resolves its default through
 * `subprocess.terminalEnvironment().defaultShell ?? '/bin/sh'`, and
 * `dsh-subprocess-local` reads that from `process.env.SHELL`. Setting `SHELL`
 * is therefore the whole fix — and it only affects shell *selection*: the
 * model-facing `bash` tool hardcodes `bash -c`, so it is untouched.
 *
 * @param {string | undefined} brewPrefix - resolved harmonybrew prefix.
 * @returns {{path: string | undefined, reason: string}} the chosen shell.
 */
export function resolveShell(brewPrefix) {
  const override = process.env.OHOS_SHELL
  if (override === 'off') return { path: undefined, reason: 'OHOS_SHELL=off' }
  if (override !== undefined && override.length > 0) {
    if (isExecutableFile(override)) return { path: override, reason: 'OHOS_SHELL' }
    return { path: undefined, reason: `OHOS_SHELL=${override} is not executable` }
  }

  const current = process.env.SHELL
  if (current !== undefined && current !== 'off' && ACCEPTED_SHELLS.includes(basename(current))) {
    if (isExecutableFile(current)) return { path: undefined, reason: `SHELL=${current} already configured` }
  }

  const absolute = [
    '/usr/bin/zsh',
    '/bin/zsh',
    brewPrefix === undefined ? undefined : join(brewPrefix, 'bin', 'zsh'),
    '/usr/bin/bash',
    '/bin/bash',
    brewPrefix === undefined ? undefined : join(brewPrefix, 'bin', 'bash'),
    brewPrefix === undefined ? undefined : join(brewPrefix, 'opt', 'bash', 'bin', 'bash'),
  ]
  for (const candidate of absolute) {
    if (candidate !== undefined && isExecutableFile(candidate)) return { path: candidate, reason: 'discovered' }
  }
  for (const name of ACCEPTED_SHELLS) {
    const found = which(name)
    if (found !== undefined) return { path: found, reason: 'PATH lookup' }
  }
  return { path: undefined, reason: 'no zsh or bash found' }
}

/**
 * Read the environment this plugin would install, without changing anything.
 * Shared with the `shellEnv` contributor so the model sees the same facts.
 * @returns {{brewPrefix: string | undefined, shell: string | undefined, tempDir: string | undefined,
 *   userInfoShim: string | undefined, zshFunctions: string | undefined,
 *   pathEntries: string[], pnpmHome: string | undefined}}
 */
export function describeEnvironment() {
  const brewPrefix = resolveBrewPrefix()
  const pnpmHome = resolvePnpmHome()
  const planned = resolveShell(brewPrefix)
  return {
    brewPrefix,
    shell: planned.path ?? process.env.SHELL,
    tempDir: resolveTempDir(),
    userInfoShim: resolveUserInfoShim(),
    zshFunctions: resolveZshFunctionsDir(),
    pathEntries: pathEntries(brewPrefix, pnpmHome),
    pnpmHome,
  }
}

/**
 * The directories harmonybrew contributes, in the order the user's own
 * `~/.zshrc` establishes (rustup first, then pnpm, then the keg-only
 * portable-git, then the prefix's own bin/sbin).
 * @param {string | undefined} brewPrefix - resolved prefix.
 * @param {string | undefined} pnpmHome - resolved pnpm home.
 * @returns {string[]} existing directories, in precedence order.
 */
export function pathEntries(brewPrefix, pnpmHome) {
  const candidates = [
    brewPrefix === undefined ? undefined : join(brewPrefix, 'opt', 'rustup', 'bin'),
    pnpmHome === undefined ? undefined : join(pnpmHome, 'bin'),
    brewPrefix === undefined ? undefined : join(brewPrefix, 'opt', 'portable-git', 'bin'),
    brewPrefix === undefined ? undefined : join(brewPrefix, 'bin'),
    brewPrefix === undefined ? undefined : join(brewPrefix, 'sbin'),
  ]
  return candidates.filter((candidate) => candidate !== undefined && isDirectory(candidate))
}

/** @returns {string | undefined} a directory that can actually hold temp files. */
function resolveTempDir() {
  const candidates = [process.env.TMPDIR, join(homedir(), '.tmp')]
  for (const candidate of candidates) {
    if (candidate !== undefined && isWritableDirectory(candidate)) return candidate
  }
  const fallback = join(homedir(), '.tmp')
  try {
    mkdirSync(fallback, { recursive: true })
  } catch {
    return undefined
  }
  return isWritableDirectory(fallback) ? fallback : undefined
}

/** @returns {string | undefined} the OHOS `os.userInfo()` preload shim, when installed. */
function resolveUserInfoShim() {
  const candidate = join(homedir(), '.config', 'node-ohos', 'userinfo-shim.cjs')
  return isFile(candidate) ? candidate : undefined
}

/** @param {string} directory @returns {boolean} whether it holds every required function. */
function providesRequiredFunctions(directory) {
  return REQUIRED_ZSH_FUNCTIONS.every((fn) => isFile(join(directory, fn)))
}

/**
 * Resolve the vendored zsh functions directory that should lead `FPATH`.
 *
 * Returns `undefined` when the platform already supplies both functions — a
 * real library must win over a vendored copy — or when the operator set
 * `OHOS_ZSH_FUNCTIONS=off`.
 *
 * @returns {string | undefined} an existing directory holding both functions.
 */
export function resolveZshFunctionsDir() {
  if (process.env.OHOS_ZSH_FUNCTIONS === 'off') return undefined
  if (PLATFORM_ZSH_FUNCTIONS.some(providesRequiredFunctions)) return undefined
  const vendored = join(fileURLToPath(import.meta.url), '..', 'zsh-functions')
  return providesRequiredFunctions(vendored) ? vendored : undefined
}

/**
 * Build the `FPATH` value: the vendored functions first, then the platform's
 * own functions directory, then whatever the operator already had. `FPATH` is
 * tied to zsh's `fpath` special parameter, so this is the one lever that
 * reaches a zsh the Harness did not configure.
 *
 * @param {string | undefined} vendored - resolved `zsh-functions/` directory.
 * @returns {string} the joined, de-duplicated `FPATH`.
 */
export function resolveFpath(vendored) {
  const parts = []
  const seen = new Set()
  const add = (directory) => {
    if (directory === undefined || directory.length === 0 || seen.has(directory)) return
    seen.add(directory)
    parts.push(directory)
  }
  add(vendored)
  add(PLATFORM_ZSH_FUNCTIONS.find(providesRequiredFunctions) ?? PLATFORM_ZSH_FUNCTIONS.find(isDirectory))
  for (const directory of (process.env.FPATH ?? '').split(delimiter)) add(directory)
  return parts.join(delimiter)
}

/**
 * Reorder `PATH` so the harmonybrew entries lead and no entry repeats, keeping
 * every unrelated inherited directory (locale toolchains, HNP bins, `/usr/bin`).
 * @param {string} current - the existing `PATH`.
 * @param {string[]} desired - directories to place first.
 * @returns {string} the normalized `PATH`.
 */
export function normalizePath(current, desired) {
  const leading = new Set(desired)
  const seen = new Set(desired)
  const rest = []
  for (const directory of current.split(delimiter)) {
    if (directory.length === 0 || leading.has(directory) || seen.has(directory)) continue
    seen.add(directory)
    rest.push(directory)
  }
  return [...desired, ...rest].join(delimiter)
}

/**
 * Install the HarmonyOS launch environment into `process.env`.
 *
 * Idempotent, and every key it touches is captured first so `restore()` can put
 * the process back exactly as it was when the plugin unloads.
 *
 * @returns {{changes: string[], warnings: string[], restore: () => void}}
 *   human-readable changes, non-fatal problems, and the undo.
 */
export function installOhosEnvironment() {
  const previous = new Map()
  const changes = []
  const warnings = []

  const capture = (key) => {
    if (!previous.has(key)) previous.set(key, process.env[key])
  }
  const set = (key, value) => {
    capture(key)
    process.env[key] = value
  }

  const brewPrefix = resolveBrewPrefix()

  if (brewPrefix !== undefined) {
    if (process.env.HOMEBREW_PREFIX !== brewPrefix) {
      set('HOMEBREW_PREFIX', brewPrefix)
      changes.push(`HOMEBREW_PREFIX=${brewPrefix}`)
    }
    const cellar = join(brewPrefix, 'Cellar')
    if (process.env.HOMEBREW_CELLAR !== cellar && isDirectory(cellar)) {
      set('HOMEBREW_CELLAR', cellar)
      changes.push(`HOMEBREW_CELLAR=${cellar}`)
    }
    const repository = join(brewPrefix, 'Homebrew')
    if (process.env.HOMEBREW_REPOSITORY !== repository && isDirectory(repository)) {
      set('HOMEBREW_REPOSITORY', repository)
      changes.push(`HOMEBREW_REPOSITORY=${repository}`)
    }
    const info = join(brewPrefix, 'share', 'info')
    const inheritedInfo = process.env.INFOPATH ?? ''
    if (isDirectory(info) && !inheritedInfo.split(delimiter).includes(info)) {
      set('INFOPATH', inheritedInfo.length === 0 ? info : `${info}${delimiter}${inheritedInfo}`)
      changes.push(`INFOPATH += ${info}`)
    }
  } else {
    warnings.push('no harmonybrew prefix found; brew tools stay unavailable')
  }

  const pnpmHome = resolvePnpmHome()
  const desired = pathEntries(brewPrefix, pnpmHome)
  if (desired.length > 0) {
    const current = process.env.PATH ?? ''
    const next = normalizePath(current, desired)
    if (next !== current) {
      set('PATH', next)
      changes.push(`PATH leading: ${desired.join(', ')}`)
    }
  }

  const tempDir = resolveTempDir()
  if (tempDir === undefined) {
    warnings.push('no writable temp directory; /tmp is read-only on HarmonyOS')
  } else if (process.env.TMPDIR !== tempDir) {
    set('TMPDIR', tempDir)
    changes.push(`TMPDIR=${tempDir}`)
  }

  const shim = resolveUserInfoShim()
  if (shim === undefined) {
    warnings.push('no userinfo shim; Node CLIs calling os.userInfo() will abort')
  } else {
    const current = process.env.NODE_OPTIONS ?? ''
    if (!current.includes(shim)) {
      const token = `--require ${shim.includes(' ') ? `"${shim}"` : shim}`
      set('NODE_OPTIONS', current.length === 0 ? token : `${token} ${current}`)
      changes.push('NODE_OPTIONS += userinfo shim')
    }
  }

  const planned = resolveShell(brewPrefix)
  if (planned.path !== undefined) {
    set('SHELL', planned.path)
    changes.push(`SHELL=${planned.path}`)
  }

  const zshFunctions = resolveZshFunctionsDir()
  const fpath = resolveFpath(zshFunctions)
  if (fpath.length > 0 && fpath !== (process.env.FPATH ?? '')) {
    set('FPATH', fpath)
    changes.push(
      zshFunctions === undefined
        ? 'FPATH = platform zsh functions'
        : `FPATH leading: ${zshFunctions} (vendored zsh 5.9 hook functions)`,
    )
  }

  return {
    changes,
    warnings,
    restore: () => {
      for (const [key, value] of previous) {
        if (value === undefined) Reflect.deleteProperty(process.env, key)
        else process.env[key] = value
      }
    },
  }
}