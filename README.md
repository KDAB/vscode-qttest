# KDAB QtTest

This extension allows VSCode to know about [Qt Tests](https://doc.qt.io/qt-6/qtest-overview.html). QtTestLib tests will appear in the side bar, under "Testing".<br>
The test slots are also exposed and can be run individually.

## Requirements

Only `CMake` based projects are supported at this time. The [cmake extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cmake-tools) is used to determine
the build directory and `ctest` is invoked to list the available tests, which were added with [add_test()](https://cmake.org/cmake/help/latest/command/add_test.html).

## Features
- Listing and running Qt tests
- Listing and running individual QTest test slots
- Context-menu entry to run selected slot in the text editor

## Settings

- `KDAB.QtTest.debugger` By default the extension will try to guess what's the best debugger. But you can and probably should explicitly chose which debugger to use. The best setting might be `Existing Launch`, which will use an existing launch config, this way you can reuse your source maps, pretty printers and launch env variables. When reusing an existing launch, its program and args are replaced by the test you're running.

- `KDAB.QtTest.CheckTestLinksToQtTestLib` Only available on Linux. Turn it on in case you have non-Qt tests executables that
you want to exclude from the list. Patches accepted for Windows and macOS support.

## Future plans

We might try to contribute QtTest support to [C++ TestMate](https://marketplace.visualstudio.com/items?itemName=matepek.vscode-catch2-test-adapter), however, I think it's also fine to keep it as a separate extension, as most of the code is already provided by VSCode, there wouldn't be any code savings by integrating it.
<br>
Either way, we've moved the bulk of this extension's code into a separate [nodejs module](https://www.npmjs.com/package/@iamsergio/qttest-utils). That module is reusable and exposes API ready to be used by other test extensions easily.

## Troubleshooting

In the output pane, chose `KDAB-QtTest` and see if there are any errors.<br>
Before reporting a bug, clear the output pane, reproduce the bug, and copy all output, paste it in the bug report.

Try pressing the reload button if list of tests seem stale.

If no tests are reported, try running `ctest -N` inside the build directory. If that doesn't work either then it's a cmake problem.
Either there's really no tests added with `add_test()` or the `enable_testing()` call is missing in the root `CMakeLists.txt`.

## About KDAB

This extension is supported and maintained by Klarälvdalens Datakonsult AB (KDAB).

The KDAB Group is the global No.1 software consultancy for Qt, C++ and
OpenGL applications across desktop, embedded and mobile platforms.

The KDAB Group provides consulting and mentoring for developing Qt applications
from scratch and in porting from all popular and legacy frameworks to Qt.
We continue to help develop parts of Qt and are one of the major contributors
to the Qt Project. We can give advanced or standard trainings anywhere
around the globe on Qt as well as C++, OpenGL, 3D and more.

Please visit <https://www.kdab.com> to meet the people who write code like this.

Stay up-to-date with KDAB product announcements:

- [KDAB Newsletter](https://news.kdab.com)
- [KDAB Blogs](https://www.kdab.com/category/blogs)
- [KDAB on Twitter](https://twitter.com/KDABQt)
