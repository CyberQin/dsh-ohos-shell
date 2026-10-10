# 更新日志 / Changelog

本文件为双语对照，每节先中文，后英文。代码、路径、命令与字段名两语共用，只出现一次。

This document is bilingual. Each section gives Chinese first, then English. Code, paths, commands, and field names are shared and appear once.

## 1.1.0 — 2026-10-10

首次公开发布前的整理。

Preparation for the first public release.

### 新增 / Added

- 平台判定 `isOhos()`。非鸿蒙平台上，两个插件行拒绝运行，只记录 `error`，不改动环境。
- `selftest_platform.mjs` 覆盖平台判定与拒绝路径。

- The platform verdict `isOhos()`. On a platform other than HarmonyOS, both plugin rows refuse to run, log an `error`, and change nothing.
- `selftest_platform.mjs` covers the verdict and the refusal path.

### 变更 / Changed

- `package.json` 补齐发布元数据：`repository`、`homepage`、`bugs`、`keywords`、`engines`、`peerDependencies`、`icon`、`publishConfig`，并移除 `private`。
- 平台限制在运行时执行。`package.json` 不写 `os` 字段，判定完全由 `isOhos()` 完成。
- `detect.js` 删除硬编码的 harmonybrew 路径，改由 `OHOS_BREW_PREFIX`、`HOMEBREW_PREFIX` 与 `~/.harmonybrew` 探测前缀。
- 新增根 `LICENSE`（MIT）。`zsh-functions/` 中的两个文件仍适用 zsh 自身许可证，原文随包在 `zsh-functions/LICENCE`。

- `package.json` gained the publish metadata `repository`, `homepage`, `bugs`, `keywords`, `engines`, `peerDependencies`, `icon`, and `publishConfig`. The `private` field is gone.
- The platform limit is enforced at runtime. `package.json` carries no `os` field, and `isOhos()` alone decides.
- `detect.js` dropped its hardcoded harmonybrew path. The prefix now comes from `OHOS_BREW_PREFIX`, `HOMEBREW_PREFIX`, or `~/.harmonybrew`.
- A root `LICENSE` (MIT) is new. The two files under `zsh-functions/` still fall under zsh's own license, shipped at `zsh-functions/LICENCE`.
