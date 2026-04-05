// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group
// company <info@kdab.com> Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

#include <QObject>
#include <QtTest>

class MyTest : public QObject {
  Q_OBJECT
private Q_SLOTS:
  void slotA() {}
  void slotB() { QCOMPARE(qgetenv("MY_ENV"), QByteArray("VALUE")); }
  void slotC() {}
};

QTEST_MAIN(MyTest);

#include <test1.moc>
