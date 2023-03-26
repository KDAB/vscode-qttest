# KDAB QtTest

This extension allows VSCode to know about Qt Tests. QtTestLib tests will appear in the side bar, under "Testing".<br>
The test slots are also exposed and runnable individually.

## Requirements

Only `CMake` based projects are supported at this time. The cmake extension (ms-vscode.cmake-tools) is used to determine
the build directory, and `ctest` is invoked to list the available tests, which were added with `add_test()`.

## Future plans

The bulk of this extension's code lives in a separate [nodejs module](https://www.npmjs.com/package/@iamsergio/qttest-utils). That module is reusable, and exposes API ready to be used by other test extensions. We might integrate it with the `TestMate` extension, if its authors agree, or we might keep it separate, or both.


## Troubleshooting

In the output pane, chose `KDAB-QtTest` and see if there are any errors.

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
