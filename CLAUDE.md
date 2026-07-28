# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KDAB QtTest is a VSCode extension that integrates [Qt Test](https://doc.qt.io/qt-6/qtest-overview.html) (QTestLib) with VSCode's native Test Explorer. It discovers Qt test executables via CMake/ctest, lists individual test slots, and supports running and debugging them.

## Commands

### Development

```bash
# Watch TypeScript files and recompile on changes
npm run watch

# Lint and format checks
npm run lint                # ESLint (enforces strict rules, zero warnings)
npm run format:check        # Prettier formatting check
npm run format:fix          # Auto-format with Prettier

# Compile TypeScript to JavaScript
npm run compile
```

### Testing & Building

```bash
# Automated integration tests (runs across Linux, Windows, macOS in CI)
npm test                    # Requires Qt 6.8, Ninja, GTest, and VSCode
./test.sh                   # Builds the Qt fixtures, then runs ./test_qttest.sh and npm test

# Unit tests for the src/qttest-utils/ module (no VSCode needed)
./test_qttest.sh            # Expects test/qt_test/build-dev/ to already be built

# Package the extension as a .vsix file
./build_package.sh          # Output: qttests-*.vsix

# Manual testing (interactive — opens VSCode with extension)
./run_manual_test.sh        # Builds Qt test fixtures, packages extension, launches VSCode
```

### Testing Details

Automated integration tests (`npm test`) use `@vscode/test-cli` to run VSCode extension tests. These require:
- Qt 6.8 or later (installed via `jurplel/install-qt-action`)
- CMake and Ninja build system
- GTest (for test fixtures)
- The sample Qt test project in `test/qt_test/` is built as part of CI

The `src/qttest-utils/` unit tests (`./test_qttest.sh`) are plain node, so they only need the built Qt fixtures — no VSCode.

The CI workflow (`.github/workflows/build.yml`) runs tests on Linux (with xvfb), Windows, and macOS.

For interactive testing, use `./run_manual_test.sh`, which is meant for developer-only manual verification and is not run in CI.

## Architecture

The extension is intentionally minimal: **all VSCode-facing logic lives in a single file, `src/extension.ts`**, implemented as the `KDABQtTest` class. The bulk of Qt test discovery and execution logic lives in the vendored `src/qttest-utils/` module (imported as `QtTest`, `QtTests`, `QtTestSlot`, `CMakeTests` from `./qttest-utils`).

### src/qttest-utils/

This code used to be the external npm package `@iamsergio/qttest-utils`; it now lives in-tree and is edited directly — there is no npm dependency to bump.

- `qttest.ts` — `QtTests` (discovery), `QtTest` (a test executable: slot parsing, running, TAP result parsing), `QtTestSlot` (a single test slot)
- `cmake.ts` — `CMakeTests`/`CMakeTest`, ctest querying and mapping executables back to CMake targets and source files
- `utils.ts` — small helpers
- `index.ts` — the module's public surface; import from `./qttest-utils`, not from the individual files
- `test.ts` — standalone unit tests, run via `./test_qttest.sh` (excluded from the main `tsconfig.json`, compiled by `src/qttest-utils/tsconfig.test.json`)

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

### Dependencies

**ms-vscode.cmake-tools** — Extension dependency (required for this extension to work). Provides CMake integration API for discovering build directories and project code models.

## Development Workflow

- **ESLint** (strict, zero warnings allowed) and **Prettier** run automatically via pre-commit hooks (configured in `.pre-commit-config.yaml`)
- **GitHub Actions** enforces linting on every PR and push (`.github/workflows/lints.yml`)
- Code is type-checked during compilation (`tsc` with strict mode enabled)

## Configuration & Settings

The extension exposes two configuration options (in VSCode settings):

- `KDAB.QtTest.debugger` — Which debugger to use when debugging tests (default/gdb/lldb/msvc). Options like "Existing Launch" allow reusing VSCode launch configurations.
- `KDAB.QtTest.CheckTestLinksToQtTestLib` — Linux-only; check if test executable is linked to QtTestLib (useful to exclude non-Qt test binaries).

## Conventions

- **Conventional commits**: prefix with `fix:`, `feat:`, or `chore:`
- **Releases**: managed automatically via `release-please` (`.github/workflows/release-please.yml`); merge the Release PR to trigger changelog + version bump + tag
- **Publishing**: `.github/workflows/package.yml` builds the `.vsix`; upload manually to the VS Marketplace at marketplace.visualstudio.com/manage/publishers/KDAB
