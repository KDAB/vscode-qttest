// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group
// company <info@kdab.com> Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

#include <QObject>
#include <QtTest>

class MyNestedTest : public QObject {
  Q_OBJECT
private Q_SLOTS:
  void slotNested1() {}
  void slotNested2() {}
  void slotNested3() {}
};

QTEST_MAIN(MyNestedTest);

#include <test_nested.moc>
