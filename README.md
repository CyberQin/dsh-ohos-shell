# dsh-ohos-shell

本文件为双语对照，每节先中文，后英文。以下内容由两语共用，只出现一次：代码块、路径、命令、字段名、环境变量名、URL 与版本号。

This document is bilingual. Each section gives Chinese first, then English. These items are shared and appear once: code blocks, paths, commands, field names, environment variable names, URLs, and version numbers.

## 1 概述 / Overview

`dsh-ohos-shell` 是 deepseek-harness 的捆绑包（bundle）。它面向 HarmonyOS 与 OpenHarmony 设备，用于补齐子进程的运行环境。

`dsh-ohos-shell` is a bundle for deepseek-harness. It targets HarmonyOS and OpenHarmony devices. It completes the runtime environment of child processes.

本包只在 HarmonyOS 与 OpenHarmony 上生效。其它平台上两行 Host 插件拒绝运行，环境保持不变。

This package acts on HarmonyOS and OpenHarmony only. On every other platform both Host plugin rows refuse to run and the environment stays unchanged.

捆绑包向 profile 插入两行 Host 插件。

The bundle inserts two Host plugin rows into the profile.

| 行 | 作用 |
|---|---|
| `ohos-shell-env` | 把运行环境写入主进程的 `process.env`，卸载时还原。 |
| `ohos-shell-facts` | 通过 `ctx.shellEnv` 发布同样的信息（`DSH_OHOS*`），供模型 shell 读取。 |

| Row | Function |
|---|---|
| `ohos-shell-env` | Writes the environment into the host process `process.env`. It restores the value at unload. |
| `ohos-shell-facts` | Publishes the same facts through `ctx.shellEnv` (`DSH_OHOS*`) for model shell calls. |

## 2 适用背景 / Background

鸿蒙不是普通的 Linux 主机。下面五项差异会影响 Harness 的子进程。

HarmonyOS is not a standard Linux host. Five differences below affect Harness child processes.

| 事实 | 后果 |
|---|---|
| `SHELL=/bin/sh`，而 `/bin/sh` 是 mksh（MirBSD Korn Shell） | mksh 读取 `${ENV:-~/.mkshrc}`。该文件不存在，因此它不读任何配置：没有别名、函数、补全与提示符。它既不是 bash，也不是 zsh。 |
| `/etc/shells` 不存在 | Harness 的 shell 发现没有注册表可查。 |
| `/tmp` 只读 | 必须有可写的 `TMPDIR`，否则 `os.tmpdir()` 返回 `/tmp`。 |
| 应用沙箱 uid（2000xxxx）不在 `/etc/passwd` 中 | Node 的 `os.userInfo()` 抛出 `uv_os_get_passwd ENOENT`。Node 命令行工具调用它时不加 `try`/`catch`。 |
| zsh 未随包发行函数库 | `fpath` 指向构建机，上游 281 个函数中只有 3 个存在，Harness 的 zsh 集成因此无法 autoload 所需函数。见 5.3 节。 |

| Fact | Consequence |
|---|---|
| `SHELL=/bin/sh`, and `/bin/sh` is mksh (MirBSD Korn Shell) | mksh reads `${ENV:-~/.mkshrc}`. That file does not exist, so mksh reads no configuration. It has no aliases, functions, completions, or prompt. It is not bash and not zsh. |
| `/etc/shells` does not exist | The Harness shell discovery has no registry to read. |
| `/tmp` is read-only | A writable `TMPDIR` is necessary. Without it, `os.tmpdir()` returns `/tmp`. |
| The app sandbox uid (2000xxxx) has no `/etc/passwd` entry | Node `os.userInfo()` throws `uv_os_get_passwd ENOENT`. Node command-line tools call it without a `try`/`catch`. |
| zsh ships without its function library | `fpath` points at the build machine. Only 3 of the 281 upstream functions exist, so the Harness zsh integration cannot autoload the functions it needs. See section 5.3. |

侧栏终端按下面的表达式解析 shell。`dsh-subprocess-local` 从 `process.env.SHELL` 取默认值。

The sidebar terminal resolves its shell with the expression below. `dsh-subprocess-local` reads the default value from `process.env.SHELL`.

```
subprocess.terminalEnvironment().defaultShell ?? '/bin/sh'
```

`terminal-controller` 行没有 `shell` 配置。侧栏打开的是 `/bin/sh -i`，也就是 mksh，它不读 rc。内置的 Settings → Shell 页面只改命令超时与输出上限，改不了这一项。

The `terminal-controller` row has no `shell` configuration. The sidebar opens `/bin/sh -i`, which is mksh, and mksh reads no rc file. The built-in Settings → Shell page changes only the command timeout and the output cap. It cannot change this value.

## 3 环境要求 / Requirements

运行前请确认以下条件：

Make sure that these conditions are true:

- 设备运行 HarmonyOS 或 OpenHarmony。这是硬条件：插件在激活时自行判定平台，其它平台上两行插件拒绝运行，各记录一条 `error`，环境保持不变。
- 已安装 harmonybrew，前缀默认为 `~/.harmonybrew`。
- 已通过 harmonybrew 安装 deepseek-harness。
- 系统提供 `/usr/bin/zsh`。

- The device runs HarmonyOS or OpenHarmony. This is a hard condition. Each plugin row decides the platform at activation. On every other platform both rows refuse to run, each one logs an `error`, and the environment stays unchanged.
- harmonybrew is installed. The default prefix is `~/.harmonybrew`.
- deepseek-harness is installed through harmonybrew.
- The system provides `/usr/bin/zsh`.

## 4 安装 / Installation

本包发布在 npm 上。请通过 Harness 的插件管理器安装，或在插件市场里搜索本包。

The package is published on npm. Install it through the Harness plugin manager, or search for it in the plugin market.

```sh
dsh plugin --profile web add dsh-ohos-shell
```

插件管理器会完成两步：把包装入 profile，并把包名写入 `dsh.profile.bundles`。

The plugin manager completes two steps. It installs the package into the profile, and it writes the package name into `dsh.profile.bundles`.

安装后，profile 的 `package.json` 应包含下面的条目。

After the installation, the profile `package.json` contains the entries below.

```json
{
  "dependencies": {
    "dsh-ohos-shell": "^1.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-ohos-shell"]
    }
  }
}
```

在设备上开发本包时，也可以把本包的绝对路径交给插件管理器。它会把该路径记为 `link:` 依赖。

While you develop this package on the device, give the plugin manager the absolute path of this package. It records that path as a `link:` dependency.

请勿手工编辑 profile 的 `package.json` 或 `cordis.patch.yml`。插件管理器负责这两步。

Do not edit the profile `package.json` or `cordis.patch.yml` by hand. The plugin manager owns these two steps.

## 5 功能 / What it does

### 5.1 环境变量 / Environment variables

`scrubbedParentEnv()` 在每次 spawn 时读取 `process.env`。`PATH`、`HOME`、区域设置与代理变量能通过这层清洗，凭据类名称与 `DSH_*` 名称不能。

`scrubbedParentEnv()` reads `process.env` at every spawn. `PATH`, `HOME`, locale, and proxy variables survive that scrub. Credential-shaped names and `DSH_*` names do not survive.

主进程在激活时改一次环境，就能同时覆盖侧栏终端、模型 shell、子智能体与 MCP 服务。

One change at activation in the host process reaches the sidebar terminal, the model shell, subagents, and MCP servers.

下表列出它设置的键。

The table below lists the keys that it sets.

| 键 | 值 |
|---|---|
| `PATH` | 去重，并按 `~/.zshrc` 的顺序把 harmonybrew 放在最前：`opt/rustup/bin`、pnpm `bin`、`opt/portable-git/bin`、`bin`、`sbin`。其余继承目录保留。 |
| `SHELL` | `zsh` 与 `bash` 中第一个存在的。 |
| `TMPDIR` | 先取继承的 `TMPDIR`，再取 `$HOME/.tmp`（不存在则创建），取第一个**真正可写**的目录。可写性用一次真实写入探测，因为 `/tmp` 在只读挂载上仍带 `1777` 权限。 |
| `NODE_OPTIONS` | 当 `$HOME/.config/node-ohos/userinfo-shim.cjs` 存在且尚未写入时，前置 `--require`。 |
| `FPATH` | 依次为：本包的 `zsh-functions/`、平台函数目录、继承的 `FPATH`。`FPATH` 与 zsh 的 `fpath` 特殊参数绑定，见 5.3 节。 |
| `HOMEBREW_PREFIX`、`HOMEBREW_CELLAR`、`HOMEBREW_REPOSITORY` | 探测到的前缀与继承值不同时写入。 |
| `INFOPATH` | 缺少 `<prefix>/share/info` 时前置。 |

| Key | Value |
|---|---|
| `PATH` | De-duplicated, with harmonybrew first in the order that `~/.zshrc` establishes: `opt/rustup/bin`, pnpm `bin`, `opt/portable-git/bin`, `bin`, `sbin`. Other inherited directories stay. |
| `SHELL` | The first of `zsh` and `bash` that exists. |
| `TMPDIR` | The inherited `TMPDIR`, then `$HOME/.tmp` (created if absent). The first **actually writable** directory wins. A real write tests writability, because `/tmp` carries mode `1777` on a read-only mount. |
| `NODE_OPTIONS` | Prepends `--require` when `$HOME/.config/node-ohos/userinfo-shim.cjs` exists and is not present yet. |
| `FPATH` | In order: the `zsh-functions/` directory of this package, the platform functions directory, the inherited `FPATH`. `FPATH` is tied to the zsh `fpath` special parameter. See section 5.3. |
| `HOMEBREW_PREFIX`, `HOMEBREW_CELLAR`, `HOMEBREW_REPOSITORY` | Written when the detected prefix differs from the inherited value. |
| `INFOPATH` | Prepends `<prefix>/share/info` when it is absent. |

本包不改动模型 shell 的 `bash` 工具。`dsh-bash-local` 固定执行 `bash -c`，把 `SHELL` 改成 zsh 不影响它。

This package does not change the model shell `bash` tool. `dsh-bash-local` always runs `bash -c`, so a change of `SHELL` to zsh does not touch it.

### 5.2 侧栏默认 shell / Sidebar default shell

侧栏原来打开 mksh，因为主进程的 `SHELL` 是 `/bin/sh`。本包把 `SHELL` 指向第一个可用的 zsh 或 bash，侧栏的默认值随之改变。

The sidebar opened mksh before, because the host process `SHELL` was `/bin/sh`. This package points `SHELL` at the first available zsh or bash. The sidebar default changes with it.

选单中的候选 shell 来自 `shellCandidates` 配置，默认值为 `zsh`、`bash`、`fish`、`pwsh`、`powershell`、`cmd`。它们按 `PATH` 解析。

The candidate shells in the menu come from the `shellCandidates` configuration. The default value is `zsh`, `bash`, `fish`, `pwsh`, `powershell`, `cmd`. The Harness resolves them through `PATH`.

zsh 启动时，Harness 会写一个 `.zshenv` 并设置 `ZDOTDIR`。该文件先 `unset ZDOTDIR`，再加载用户自己的启动文件。`~/.zshrc` 与 `/etc/zshrc` 照常生效。

At zsh startup, the Harness writes a `.zshenv` file and sets `ZDOTDIR`. That file unsets `ZDOTDIR` first, and then it loads the user startup files. `~/.zshrc` and `/etc/zshrc` take effect as usual.

### 5.3 缺失的 zsh 函数库 / The missing zsh function library

把侧栏改为 zsh 之后，会出现第二个独立的鸿蒙打包缺陷。设备的 zsh 5.9 把 `fpath` 指向构建机。

A second and unrelated OHOS packaging defect appears after you change the sidebar to zsh. The device zsh 5.9 points `fpath` at the build machine.

```
/devcloud/workspace/j_U6KRACXY/app_code/zsh_build_script/build/install_dir/share/zsh/5.9/functions
/usr/local/share/zsh/site-functions
```

两个目录都不存在。平台的 `/etc/zshrc` 追加 `/system/usr/share/zsh/functions`，而该目录只有 **3** 个文件（`_cmd_list`、`_zmv`、`zmv`），上游 `Functions/` 目录有 **281** 个。

Neither directory exists. The platform `/etc/zshrc` appends `/system/usr/share/zsh/functions`. That directory holds **3** files only (`_cmd_list`, `_zmv`, `zmv`). The upstream `Functions/` tree holds **281**.

Harness 的 zsh 集成由 `dsh-subprocess-local` 的 `prepareShellActivity` 负责。它在首个提示符之前执行下面的语句。

The Harness zsh integration belongs to `prepareShellActivity` in `dsh-subprocess-local`. It runs the statements below before the first prompt.

```zsh
autoload -Uz add-zle-hook-widget add-zsh-hook
add-zle-hook-widget line-init __dsh_shell_idle
add-zle-hook-widget line-finish __dsh_shell_busy
add-zsh-hook preexec __dsh_shell_busy
```

两个名字在设备上都无法解析。zsh 终端会打印三条 `function definition file not found` 报错，activity 上报也接不上。

The device cannot resolve both names. A zsh terminal prints three `function definition file not found` errors, and the activity report never connects.

本包自带这两个函数。它们与 zsh 5.9 原文逐字节一致，出处与许可证见 [`zsh-functions/README.md`](zsh-functions/README.md)，本包把它们放进 `FPATH`。

This package carries both functions. They match the zsh 5.9 originals byte for byte. Their provenance and license are in [`zsh-functions/README.md`](zsh-functions/README.md). The package puts them on `FPATH`.

当平台目录已经提供这两个名字时，本包自动让位，打包正确的 zsh 始终优先。

When a platform directory already provides both names, this package stays out of the way. A correctly packaged zsh always wins.

## 6 配置 / Configuration

本包不需要 `config` 行。四个环境变量覆盖值得改动的场景。主进程在激活时读取它们。

This package needs no `config` row. Four environment variables cover the cases that are worth a change. The host process reads them at activation.

| 变量 | 作用 |
|---|---|
| `OHOS_SHELL` | 强制指定 shell 的绝对路径；设为 `off` 则不改动 `SHELL`。 |
| `OHOS_BREW_PREFIX` | 直接指定 harmonybrew 前缀，跳过自动探测。 |
| `OHOS_ZSH_FUNCTIONS` | 设为 `off` 时，本包不把自己的 `zsh-functions/` 放进 `FPATH`。 |
| `OHOS_FORCE` | 覆盖平台判定：`1` 视为鸿蒙，`0` 视为非鸿蒙。用于 `process.platform` 报告不准的构建与自测。 |

| Variable | Effect |
|---|---|
| `OHOS_SHELL` | Forces the absolute path of a shell. The value `off` leaves `SHELL` alone. |
| `OHOS_BREW_PREFIX` | Sets the harmonybrew prefix and skips auto-detection. |
| `OHOS_ZSH_FUNCTIONS` | The value `off` stops this package from putting its `zsh-functions/` on `FPATH`. |
| `OHOS_FORCE` | Overrides the platform verdict: `1` means HarmonyOS, `0` means not. Use it for a build that misreports `process.platform`, and for the self-tests. |

## 7 验证 / Verification

下列脚本在失败时返回非零状态。

The scripts below exit with a non-zero status on failure.

```sh
node selftest.mjs        # in-place: changes, idempotency, restore, PATH normalization
node selftest_fpath.mjs  # FPATH, upstream file hashes, a real zsh loading the shipped copy
node selftest_facts.mjs  # the shellEnv contributor contract and its lazy resolution
node selftest_platform.mjs  # the OHOS verdict, and the refusal path on other platforms
```

`npm test` 一次跑完全部四项。

`npm test` runs all four of them.

下面的命令模拟从未见过登录 shell 的启动器。

The commands below simulate a launcher that never saw a login shell.

```sh
env -i HOME="$HOME" PATH=/usr/bin:/vendor/bin \
  "$HOMEBREW_PREFIX/bin/node" selftest_bare.mjs
env -i HOME="$HOME" PATH=/usr/bin:/vendor/bin \
  "$HOMEBREW_PREFIX/bin/node" selftest_child.mjs
```

改动之前，该环境没有 `brew`、没有 `zsh`、没有 `TMPDIR`，子 `node` 进程在 `os.userInfo()` 处中止。改动之后，这些都能用。

Before the change, that environment has no `brew`, no `zsh`, and no `TMPDIR`. A child `node` process stops at `os.userInfo()`. After the change, all of them work.

交互部分由真实 PTY 复现覆盖。原因在于 `add-zle-hook-widget` 需要活动的 `zle`。

A real PTY reproduces the Harness zsh wrapper. That reproduction covers the interactive part, because `add-zle-hook-widget` needs an active `zle`.

```sh
python3 ../ohos-shell-probe/zsh_wrapper_e2e.py "$PWD/zsh-functions"
```

没有 `zsh-functions/` 时，它复现三条启动报错，且从不写 activity 状态文件。加入之后，启动无报错，activity 序号递增。

Without `zsh-functions/`, it reproduces the three startup errors and never writes an activity state file. With the directory, startup is silent and the activity sequence advances.

改动本包的源码之后，需要重启 Host。`dsh-hmr` 以 `root: []` 运行，只监视 profile 配置，不监视插件源码。文件改动在下次 `dsh web` 启动时生效。

An edit to this package source needs a Host restart. `dsh-hmr` runs with `root: []`, which watches profile configuration only, not plugin source. A file change takes effect at the next `dsh web` start.

## 8 卸载 / Uninstallation

请通过 Harness 的插件管理器移除捆绑包。

Use the Harness plugin manager to remove the bundle.

`ohos-shell-env` 行会还原它改过的每个键。卸载后主进程的环境回到原状。

The `ohos-shell-env` row restores every key that it changed. After the removal, the host process environment returns to its earlier state.

## 9 文件 / Files

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | 捆绑包补丁，插入两行插件。 |
| `detect.js` | 平台判定、探测与环境写入，不依赖 Cordis。 |
| `index.js` | 第 1 行：非鸿蒙时拒绝运行；在鸿蒙上写入并还原环境。 |
| `facts.js` | 第 2 行：非鸿蒙时拒绝注册；在鸿蒙上向 `ctx.shellEnv` 注册 `DSH_OHOS*` 信息。 |
| `zsh-functions/` | zsh 5.9 的 `add-zsh-hook` 与 `add-zle-hook-widget` 原文，附出处与上游许可证。 |
| `selftest*.mjs` | 离线自测。 |
| `icon.svg` | 插件管理器与市场卡片显示的图标。 |
| `LICENSE` | 本包的 MIT 许可证原文。见第 10 节。 |
| `THIRD_PARTY_NOTICES.md` | 随附的第三方文件声明。见第 10 节。 |
| `CHANGELOG.md` | 版本变更记录。 |

| File | Role |
|---|---|
| `cordis.patch.yml` | The bundle patch. It inserts two plugin rows. |
| `detect.js` | The platform verdict, detection, and environment installation. It has no Cordis dependency. |
| `index.js` | Row 1. It refuses to run off HarmonyOS, and installs and restores the environment on it. |
| `facts.js` | Row 2. It refuses to register off HarmonyOS, and registers the `DSH_OHOS*` facts with `ctx.shellEnv` on it. |
| `zsh-functions/` | The zsh 5.9 `add-zsh-hook` and `add-zle-hook-widget` originals, with provenance and the upstream license. |
| `selftest*.mjs` | Offline self-tests. |
| `icon.svg` | The icon the plugin manager and the market card show. |
| `LICENSE` | The MIT license text of this package. See section 10. |
| `THIRD_PARTY_NOTICES.md` | The notices for the vendored third-party files. See section 10. |
| `CHANGELOG.md` | The version history. |

## 10 许可与出处 / License and provenance

本包以 MIT 许可证发布。许可证原文是本包根目录的 `LICENSE`。

This package is released under the MIT license. The license text is the `LICENSE` file in this package's root directory.

`zsh-functions/` 中的两个文件来自 zsh 5.9，未作修改。它们没有 `Copyright` 头，适用 zsh 的默认许可证，而不是覆盖部分 shell 函数的 GPL。上游许可证原文随附在 `zsh-functions/LICENCE`，汇总见根目录的 `THIRD_PARTY_NOTICES.md`。

The two files in `zsh-functions/` come from zsh 5.9 and are unmodified. They have no `Copyright` header. The zsh default license applies, not the GPL that covers some shell functions. The upstream license text is included at `zsh-functions/LICENCE`, and the root `THIRD_PARTY_NOTICES.md` collects the notices.

出处记录：仓库 `https://github.com/zsh-users/zsh`，标签 `zsh-5.9`，上游路径 `Functions/Misc/add-zsh-hook` 与 `Functions/Misc/add-zle-hook-widget`。

Provenance record: the repository is `https://github.com/zsh-users/zsh`, the tag is `zsh-5.9`, and the upstream paths are `Functions/Misc/add-zsh-hook` and `Functions/Misc/add-zle-hook-widget`.