# SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# Author: Sergio Martins <sergio.martins@kdab.com>
# SPDX-License-Identifier: MIT

add_executable(test_nested test_nested.cpp)
target_link_libraries(test_nested Qt6::Test)

add_test(NAME test_nested COMMAND test_nested)
