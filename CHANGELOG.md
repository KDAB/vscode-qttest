# Changelog



## [1.11.1](https://github.com/KDAB/vscode-qttest/compare/v1.11.0...v1.11.1) (2026-04-07)


### Bug Fixes

* add script-file guards to skip execution of .sh/.bat test files ([adeba29](https://github.com/KDAB/vscode-qttest/commit/adeba293384147fa4683ecb491466fe0b53c6d33))

## [1.11.0](https://github.com/KDAB/vscode-qttest/compare/v1.10.1...v1.11.0) (2026-04-05)


### Features

* better support for gtests ([e39ef16](https://github.com/KDAB/vscode-qttest/commit/e39ef16307ab8d044967e1e3d06ed7e696e52295))

## [1.10.1](https://github.com/KDAB/vscode-qttest/compare/v1.10.0...v1.10.1) (2026-04-05)


### Bug Fixes

* Pass cwd if launcher is missing it ([22bdc97](https://github.com/KDAB/vscode-qttest/commit/22bdc97ef057ed3d4c101837374219c7095b4b5f))

## [1.10.0](https://github.com/KDAB/vscode-qttest/compare/v1.9.0...v1.10.0) (2026-04-05)


### Features

* Add integration tests to our CI ([0a528ff](https://github.com/KDAB/vscode-qttest/commit/0a528ff3161c6d62642f143bb88794542cb12062))
* Auto-detect default debugger ([ddf58af](https://github.com/KDAB/vscode-qttest/commit/ddf58af7e46aa4e91638dcef6ccea1e4b9b167e8))
* bump to node22 ([1d4d9cd](https://github.com/KDAB/vscode-qttest/commit/1d4d9cd432ec56ca6fe6ee06f11dbbbc12f0f04a))
* decrease size of package ([3df2254](https://github.com/KDAB/vscode-qttest/commit/3df2254f6517640da6567a201807918018108aff))
* propagate env to debugger as well ([1f1c29c](https://github.com/KDAB/vscode-qttest/commit/1f1c29c85b2ee65c43348c6f0c33bfb2bac374ab))


### Bug Fixes

* add node types to tsconfig ([44dad9c](https://github.com/KDAB/vscode-qttest/commit/44dad9c3751891e663ae337ae8ee6b3ff90c1e44))
* eslint fixes ([a9b487f](https://github.com/KDAB/vscode-qttest/commit/a9b487f74697694b7db2b418e8d9d78b6e549993))
* make run_manual_test.sh executable ([08cb882](https://github.com/KDAB/vscode-qttest/commit/08cb882a00baab2ec39d3a82ef1d2ac887d66dd6))
* use code_clean for testing ([cf59626](https://github.com/KDAB/vscode-qttest/commit/cf59626861f0220e5128377b2c798bdd1d007780))

## [1.9.0](https://github.com/KDAB/vscode-qttest/compare/v1.8.5...v1.9.0) (2024-06-17)


### Features

* Use a proper tap parser to parse test results ([48d75c6](https://github.com/KDAB/vscode-qttest/commit/48d75c6b79b6ccd752bbd0c6e54f7a0e992500e6))

## [1.8.5](https://github.com/KDAB/vscode-qttest/compare/v1.8.4...v1.8.5) (2024-05-06)


### Bug Fixes

* CONTRIBUTING.md now explains our release workflow ([baa4538](https://github.com/KDAB/vscode-qttest/commit/baa45381ba55ae4fb7d84428333a491650894113))

## [1.8.4](https://github.com/KDAB/vscode-qttest/compare/v1.8.3...v1.8.4) (2024-05-03)


### Bug Fixes

* Remove skip-github-release ([3696aa7](https://github.com/KDAB/vscode-qttest/commit/3696aa7db50b07f6e68f693bc6e2000cbc8536d5))

## [1.8.3](https://github.com/KDAB/vscode-qttest/compare/v1.8.2...v1.8.3) (2024-05-03)


### Bug Fixes

* Cleanup CONTRIBUTING.md to reflect release-please workflow ([b884b64](https://github.com/KDAB/vscode-qttest/commit/b884b64bcaa486d9f027f13d64e04093836fb6d1))
* Use the release-please GH action instead of cli ([ed11797](https://github.com/KDAB/vscode-qttest/commit/ed117974a8042b1593ffcf70914abca020bb6fcf))

## [1.8.2](https://github.com/KDAB/vscode-qttest/compare/v1.8.1...v1.8.2) (2024-05-03)


### Bug Fixes

* Run tests in alphabetically order ([f3e1b2c](https://github.com/KDAB/vscode-qttest/commit/f3e1b2c68e503367e2f4e129898cfec672da5f86))

## [1.8.1] - 2024-05-02

### 🐛 Bug Fixes

- Rename extension to qttests

## [1.8.0] - 2024-05-02

### 🚀 Features

- Change publisher to KDAB

## [1.7.0] - 2024-05-02

### 🚀 Features

- Bump package-lock versions

## [1.6.1] - 2024-05-02

### 🐛 Bug Fixes

- Fix running non-Qt tests

## [1.6.0] - 2024-04-30

### 🚀 Features

- Focus "Test Results" when running

## [1.5.0] - 2024-04-26

### 🚀 Features

- Show popup if debugger extension is missing
- Add support for "Go To Test"

### 🐛 Bug Fixes

- Rebuild before run now works if codemodel is buggy
- "Go to File" now works if codemodel is buggy

## [1.4.0] - 2024-04-25

### 🚀 Features

- Display output in "Test Results" when running
- Clicking on the QtTest can now open its source file
- Qt slots now also have a link to their cpp file

### 📚 Documentation

- Improve readme

## [1.3.0] - 2024-04-23

### 🚀 Features

- Allow to reuse existing launches when debugging

### 📚 Documentation

- Add a Settings section to README

## [1.2.0] - 2024-04-23

### 🚀 Features

- Added right-click -> context menu -> debug slot

### 📚 Documentation

- Minor improvement
- Explain that ctest needs to report tests

## [1.1.0] - 2024-04-07

### 🚀 Features

- Bump to qttest v1.1.0
- CheckTestLinksToQtTestLib defaults to false now
- Automatically reload slots if executable changes

## [1.0.0] - 2024-04-06

### 🐛 Bug Fixes

- Handle user pressing the refresh button
