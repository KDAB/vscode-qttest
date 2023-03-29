# SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# Author: Sergio Martins <sergio.martins@kdab.com>
# SPDX-License-Identifier: MIT

cmake_minimum_required(VERSION 3.12)
project(qttest)

find_package(Qt5Test 5.15 REQUIRED)
set(CMAKE_AUTOMOC ON)

add_executable(test1 test1.cpp)
add_executable(test2 test2.cpp)
add_executable(test3 test3.cpp)

target_link_libraries(test1 Qt5::Test)
target_link_libraries(test2 Qt5::Test)
target_link_libraries(test3 Qt5::Test)
