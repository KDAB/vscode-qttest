# Changelog



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
