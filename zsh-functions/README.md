# zsh 函数库副本 / Vendored zsh functions

本文件为双语对照，每节先中文，后英文。代码块、路径、命令、字段名与版本号为两语共用，只出现一次。

This document is bilingual. Each section gives Chinese first, then English. Code blocks, paths, commands, field names, and version numbers are shared and appear once.

## 1 用途 / Purpose

本目录存放 zsh 5.9 的两个文件。它们来自上游源码发行包，未作任何修改。`dsh-ohos-shell` 把本目录放进 `FPATH`，zsh 即可 autoload 这两个函数。

This directory holds two files from zsh 5.9. They come from the upstream source distribution and are unmodified. `dsh-ohos-shell` puts this directory on `FPATH`, and zsh can then autoload both functions.

`add-zsh-hook` 只使用 zsh 内建命令。`add-zle-hook-widget` 加载 `zsh/zle`、`zsh/parameter` 与 `zsh/zleparameter`，这三个模块在鸿蒙的 zsh 构建中都存在。

`add-zsh-hook` uses zsh builtins only. `add-zle-hook-widget` loads `zsh/zle`, `zsh/parameter`, and `zsh/zleparameter`. All three modules exist in the OHOS zsh build.

## 2 背景 / Background

鸿蒙的 zsh（`/usr/bin/zsh`，`zsh 5.9 aarch64-unknown-linux-musl`）发布时函数库是坏的。

The HarmonyOS zsh (`/usr/bin/zsh`, `zsh 5.9 aarch64-unknown-linux-musl`) ships with a broken function library.

编译期写死的 `fpath` 指向构建机。那两个目录在设备上不存在。`zsh -f -c 'print -l $fpath'` 会列出三个不存在的目录。

The compiled-in `fpath` points at the build machine. Neither directory exists on the device. `zsh -f -c 'print -l $fpath'` lists three directories that do not exist.

```
/devcloud/workspace/j_U6KRACXY/app_code/zsh_build_script/build/install_dir/share/zsh/5.9/functions
/usr/local/share/zsh/site-functions
```

平台自己的 `/etc/zshrc` 只追加 `/system/usr/share/zsh/functions`。该目录有 **3** 个文件（`_cmd_list`、`_zmv`、`zmv`），上游 `Functions/` 目录有 **281** 个。

The platform `/etc/zshrc` appends `/system/usr/share/zsh/functions` only. That directory holds **3** files (`_cmd_list`, `_zmv`, `zmv`). The upstream `Functions/` tree holds **281**.

Harness 的 zsh 集成（`@deepseek-ai/dsh-subprocess-local` → `prepareShellActivity`）会写一个 `.zshenv`。它在首个提示符前执行下面的语句。

The Harness zsh integration (`@deepseek-ai/dsh-subprocess-local` → `prepareShellActivity`) writes a `.zshenv` file. It runs the statements below before the first prompt.

```zsh
autoload -Uz add-zle-hook-widget add-zsh-hook
add-zle-hook-widget line-init __dsh_shell_idle
add-zle-hook-widget line-finish __dsh_shell_busy
add-zsh-hook preexec __dsh_shell_busy
```

设备无法解析这两个名字。zsh 侧栏终端会打印三条 `function definition file not found` 报错，activity 上报也接不上。控制器随后只看到 `unknown` 状态，从不自动回收该终端。

The device cannot resolve both names. A zsh sidebar terminal prints three `function definition file not found` errors, and the activity report never connects. The controller then sees the `unknown` state only, and it never reclaims that terminal automatically.

这两个文件正好满足该集成的需要。它们**不是**完整 zsh 函数库的替代品：其余约 278 个函数仍然缺失。

These two files are exactly what the integration needs. They are **not** a replacement for a complete zsh function library. The other ~278 functions stay absent.

## 3 出处 / Provenance

| 项 | 值 |
|---|---|
| 仓库 | `https://github.com/zsh-users/zsh` |
| 标签 | `zsh-5.9` |
| 上游路径 | `Functions/Misc/add-zsh-hook`、`Functions/Misc/add-zle-hook-widget` |
| 获取方式 | `https://codeload.github.com/zsh-users/zsh/tar.gz/refs/tags/zsh-5.9` |
| 本地副本 | 逐字节一致，未修改 |

| Item | Value |
|---|---|
| Repository | `https://github.com/zsh-users/zsh` |
| Tag | `zsh-5.9` |
| Upstream paths | `Functions/Misc/add-zsh-hook`, `Functions/Misc/add-zle-hook-widget` |
| Retrieved through | `https://codeload.github.com/zsh-users/zsh/tar.gz/refs/tags/zsh-5.9` |
| Local copies | Byte for byte, unmodified |

```
f0e9ac9dfe1b2367164d6674924b5297621881a4a325860942d72ec7f7281a8d  add-zsh-hook
0d00fe1f9ca24ab43d38d11e30ae2dcab64ecb375aad0c688d6c65a976f59d4e  add-zle-hook-widget
```

## 4 许可证 / License

两个文件都没有 `Copyright` 头。它们适用 zsh 的默认许可证，而不是覆盖部分 shell 函数的 GPL。

Neither file carries a `Copyright` header. They fall under the zsh default license, not the GPL that covers some other shell functions.

上游许可证原文照录于 [`LICENCE`](LICENCE)。

The full upstream notice is copied to [`LICENCE`](LICENCE).