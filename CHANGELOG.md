# Changelog



## [1.9.0](https://github.com/KDAB/vscode-qttest/compare/qttests-v1.8.1...qttests-v1.9.0) (2024-05-03)


### Features

* Add support for "Go To Test" ([194b40b](https://github.com/KDAB/vscode-qttest/commit/194b40b3372c8d15efdfcc60fc1c070218d6f1f8))
* Added right-click -&gt; context menu -> debug slot ([b95ce95](https://github.com/KDAB/vscode-qttest/commit/b95ce954c93b619b825f11c15635c88bbc4be3f0))
* Allow to reuse existing launches when debugging ([d6aa45d](https://github.com/KDAB/vscode-qttest/commit/d6aa45dc9efc3674473f3690ed761632fc129b9a))
* Automatically reload slots if executable changes ([9f49a18](https://github.com/KDAB/vscode-qttest/commit/9f49a18f9ee67febaf68b7a988decb5fc51b246e))
* Bump package-lock versions ([e5101e1](https://github.com/KDAB/vscode-qttest/commit/e5101e1453de053f1076c94a2051257887ce4897))
* Bump to qttest v1.1.0 ([2df7790](https://github.com/KDAB/vscode-qttest/commit/2df77904f54b830e5e2e21d9ed85d0aa915f5775))
* Change publisher to KDAB ([7f50bdb](https://github.com/KDAB/vscode-qttest/commit/7f50bdbd9b27b54855e0da5d79527dc46674a8fe))
* CheckTestLinksToQtTestLib defaults to false now ([b2b2bc1](https://github.com/KDAB/vscode-qttest/commit/b2b2bc1125f5a012be1e2bb38029646753915834))
* Clicking on the QtTest can now open its source file ([d87db29](https://github.com/KDAB/vscode-qttest/commit/d87db295e89355750ac09320801614a09184b20a))
* Display output in "Test Results" when running ([ebf09f6](https://github.com/KDAB/vscode-qttest/commit/ebf09f6e072ba2e02a35ba47834ad90d04bb5149))
* focus "Test Results" when running ([9f4dcb6](https://github.com/KDAB/vscode-qttest/commit/9f4dcb6265cd3a076769dacfe6ec4cd5d96f42cb))
* Qt slots now also have a link to their cpp file ([d319386](https://github.com/KDAB/vscode-qttest/commit/d319386beb2434167f67f3d8e6150886dc4a6df0))
* Show popup if debugger extension is missing ([d5155ff](https://github.com/KDAB/vscode-qttest/commit/d5155ff25074d29f1785421861b5df1d86688f1c))


### Bug Fixes

* "Go to File" now works if codemodel is buggy ([d95934a](https://github.com/KDAB/vscode-qttest/commit/d95934a70424407c317ba8ba95f2e8bddf6a58ba))
* Fix running non-Qt tests ([e6ebe61](https://github.com/KDAB/vscode-qttest/commit/e6ebe6153eb71b44eb8a02bfd732f2fe212beeaa))
* Handle user pressing the refresh button ([f5c5dc2](https://github.com/KDAB/vscode-qttest/commit/f5c5dc2ca7c8b00a28364aa7c57701db52ee06b6))
* Rebuild before run now works if codemodel is buggy ([1268f45](https://github.com/KDAB/vscode-qttest/commit/1268f45660855f89f0e152d5925be7449c4e9780))
* Rename extension to qttests ([73825d9](https://github.com/KDAB/vscode-qttest/commit/73825d91fe924ff12f487a66b9a1e5939e225b8d))
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
