// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group
// company <info@kdab.com> Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import QtQuick
import QtTest

TestCase {
    name: "QuickTest"

    function test_addition() {
        compare(2 + 2, 4)
    }

    function test_string() {
        compare("foo" + "bar", "foobar")
    }
}
