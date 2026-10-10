/**
 * `dsh-ohos-shell` — give every Harness child the harmonybrew environment on
 * HarmonyOS, and make the Web sidebar terminal default to a configured shell.
 *
 * Why mutating `process.env` is the right lever: `scrubbedParentEnv()` in
 * `@deepseek-ai/dsh-subprocess` reads `process.env` at **every** spawn, so one
 * mutation at activation reaches the sidebar terminal, the model-facing `bash`
 * tool, subagents and MCP servers at once. `PATH`, `HOME`, locale and proxy
 * variables survive that scrub; credential-shaped and `DSH_*` names do not.
 *
 * This row is for HarmonyOS and OpenHarmony only. On any other platform it logs
 * an error and returns without touching the environment, so an accidental
 * installation changes nothing.
 *
 * @module dsh-ohos-shell
 */

import { installOhosEnvironment, isOhos } from './detect.js'

/** Cordis plugin name. */
export const name = 'ohos-shell-env'

/**
 * Install the launch environment for this Host process and restore it on
 * unload, so a Hot-reload or `remove_bundle` leaves nothing behind.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 */
export function apply(ctx) {
  if (!isOhos()) {
    ctx.logger.error(
      `ohos-shell: HarmonyOS / OpenHarmony only, but this process reports platform ${JSON.stringify(process.platform)}; `
      + 'no environment was changed. Remove dsh-ohos-shell from this profile, or set OHOS_FORCE=1 when the platform is misreported.',
    )
    return
  }

  const { changes, warnings, restore } = installOhosEnvironment()

  if (changes.length === 0) ctx.logger.info('ohos-shell: environment already complete; nothing to change')
  else ctx.logger.info(`ohos-shell: ${changes.join('; ')}`)
  for (const warning of warnings) ctx.logger.warn(`ohos-shell: ${warning}`)

  ctx.effect(() => restore, 'ohos-shell.process-environment')
}
