/**
 * Model-visible HarmonyOS facts for `dsh-ohos-shell`.
 *
 * Registered with `ctx.shellEnv`, so every model shell call on this profile
 * carries them. They tell the agent that it is on HarmonyOS and where the
 * harmonybrew (Homebrew) prefix, the interactive shell and the writable temp
 * directory actually are — the three things it cannot guess from a bare `sh`.
 *
 * @module dsh-ohos-shell/facts
 */

import { describeEnvironment, isOhos } from './detect.js'

/** Cordis plugin name. */
export const name = 'ohos-shell-facts'

/** The registry is optional in a minimal composition, so require it explicitly. */
export const inject = ['shellEnv']

/** Contributor identity and the exact keys it may return. */
const CONTRIBUTOR = 'ohos-shell'

/** @type {Record<string, {description: string}>} */
const VARIABLES = {
  DSH_OHOS: {
    description: 'Set to 1 when the Harness runs on HarmonyOS / OpenHarmony.',
  },
  DSH_OHOS_BREW_PREFIX: {
    description: 'harmonybrew (Homebrew) prefix; its bin/ holds the formula commands.',
  },
  DSH_OHOS_SHELL: {
    description: 'Interactive shell the Web sidebar terminal opens by default.',
  },
  DSH_OHOS_TMPDIR: {
    description: 'Writable temp directory; /tmp is read-only on HarmonyOS.',
  },
}

/**
 * Register the HarmonyOS facts for the lifetime of this plugin.
 *
 * On any platform other than HarmonyOS / OpenHarmony the row registers nothing:
 * a `DSH_OHOS=1` fact would be false there, and the `ohos-shell-env` row has
 * already refused to install the environment it describes.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context carrying `shellEnv`.
 */
export function apply(ctx) {
  if (!isOhos()) {
    ctx.logger.warn(
      `ohos-shell: HarmonyOS / OpenHarmony only, but this process reports platform ${JSON.stringify(process.platform)}; `
      + 'the DSH_OHOS* facts are not registered.',
    )
    return
  }

  ctx.shellEnv.register({
    name: CONTRIBUTOR,
    variables: VARIABLES,
    /*
     * Resolved per execution, never at activation: this row and
     * `ohos-shell-env` are independent Loader rows, so an activation-time
     * snapshot would race the environment installation. Reading `process.env`
     * here is always after both rows settled.
     */
    resolve: () => {
      const environment = describeEnvironment()
      const values = { DSH_OHOS: '1' }
      if (environment.brewPrefix !== undefined) values.DSH_OHOS_BREW_PREFIX = environment.brewPrefix
      if (environment.shell !== undefined) values.DSH_OHOS_SHELL = environment.shell
      if (environment.tempDir !== undefined) values.DSH_OHOS_TMPDIR = environment.tempDir
      return values
    },
  })
}