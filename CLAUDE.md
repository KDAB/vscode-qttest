# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KDAB QtTest is a VSCode extension that integrates [Qt Test](https://doc.qt.io/qt-6/qtest-overview.html) (QTestLib) with VSCode's native Test Explorer. It discovers Qt test executables via CMake/ctest, lists individual test slots, and supports running and debugging them.

## Commands

```bash
# Install dependencies
npm install

# Compile TypeScript to out/
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Lint
npm run lint

# Package as .vsix
vsce package

# Manual integration test (builds Qt test project and opens VSCode)
./run_manual_test.sh
```

There are no automated unit tests — testing is done manually via `run_manual_test.sh`, which builds the sample Qt project in `test/qt_test/`, packages the extension, installs it, and opens VSCode.

## Architecture

The extension is intentionally minimal: **all extension logic lives in a single file, `src/extension.ts`**, implemented as the `KDABQtTest` class. The bulk of Qt test discovery and execution logic lives in the separate npm package [`@iamsergio/qttest-utils`](https://github.com/KDAB/qttest-utils/) (imported as `QtTest`, `QtTests`, `QtTestSlot` from `@iamsergio/qttest-utils`).

### Key data structures

- `testMap: WeakMap<vscode.TestItem, QtTest>` — maps VSCode TestItems to Qt test executables
- `individualTestMap: WeakMap<vscode.TestItem, QtTestSlot>` — maps child TestItems to individual test slots (e.g. `myTestSlot()`)

### Flow

1. **Discovery**: On activation, `discoverAllTestExecutables()` queries the cmake-tools extension for build directories, calls `QtTests.discoverViaCMake(buildDir)` (which runs `ctest -N`), then registers each executable as a top-level `TestItem`.
2. **Slot parsing**: `parseTestsInExecutable()` calls `testExecutable.parseAvailableSlots()` (runs the executable with `--functions`), then adds each slot as a child `TestItem` with its line range resolved via `rangeForSlot()`.
3. **Running**: `runHandler()` dispatches to either `QtTest.runTest()` or `QtTestSlot.runTest()` from qttest-utils. Before running, `maybeRebuild()` uses the cmake-tools API to rebuild the specific target.
4. **Debugging**: `debugTest()` constructs a `vscode.DebugConfiguration` based on the `KDAB.QtTest.debugger` setting and calls `vscode.debug.startDebugging()`.
5. **File watching**: A `FileSystemWatcher` is created per executable; when the binary changes (after a rebuild), slots are re-parsed automatically.

### CMake integration

The extension depends on `ms-vscode.cmake-tools` (declared as `extensionDependencies`). It uses the `vscode-cmake-tools` API (`getCMakeToolsApi`) to get build directories and project code models. There is a known workaround applied in `cppFileForExecutable()` and `projectsForExecutable()` for a cmake-tools API bug ([issue #7](https://github.com/microsoft/vscode-cmake-tools-api/issues/7)) where executable paths may be in a different format.

### Fixing bugs in qttest-utils

Most test discovery/execution logic is in the separate [qttest-utils](https://github.com/KDAB/qttest-utils/) repo. To fix bugs there: fix and publish a new npm version, then bump the `@iamsergio/qttest-utils` version in `package.json`.

## Conventions

- **Conventional commits**: prefix with `fix:`, `feat:`, or `chore:`
- **Releases**: managed automatically via `release-please` (`.github/workflows/release-please.yml`); merge the Release PR to trigger changelog + version bump + tag
- **Publishing**: `.github/workflows/package.yml` builds the `.vsix`; upload manually to the VS Marketplace at marketplace.visualstudio.com/manage/publishers/KDAB
