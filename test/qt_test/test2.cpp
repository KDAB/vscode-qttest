// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group
// company <info@kdab.com> Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

#include <QObject>
#include <QtTest>

class MyTest : public QObject {
  Q_OBJECT
private Q_SLOTS:
  void slotC() {}
  void slotD() {}
  void slotFail() { QFAIL("failed"); }
};

QTEST_MAIN(MyTest);

#include <test2.moc>
